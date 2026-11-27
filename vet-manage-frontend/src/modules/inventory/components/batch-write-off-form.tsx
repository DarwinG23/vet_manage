import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useToast } from '../../../common/components/toast-context';
import { validateBatchWriteOffDraft } from '../schemas/batch-write-off';
import type { BatchWriteOffFieldErrors, BatchWriteOffFormInput } from '../schemas/batch-write-off';
import { inventoryApi } from '../services/inventory-api';
import type { BatchWriteOffDraft, BatchWriteOffResult, Product, ProductDetail } from '../types';

type Props = {
  products: Product[];
  onSubmit: (draft: BatchWriteOffDraft) => Promise<BatchWriteOffResult>;
};
type ProductLoad =
  | { status: 'idle' | 'loading' | 'error'; product: null }
  | { status: 'ready'; product: ProductDetail };

const EMPTY: BatchWriteOffFormInput = { productId: '', batchId: '', quantity: '', reason: '', observation: '' };

export function BatchWriteOffForm({ products, onSubmit }: Props) {
  const [draft, setDraft] = useState<BatchWriteOffFormInput>(EMPTY);
  const [errors, setErrors] = useState<BatchWriteOffFieldErrors>({});
  const [productLoad, setProductLoad] = useState<ProductLoad>({ status: 'idle', product: null });
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [formError, setFormError] = useState<string | null>(null);
  const [phase, setPhase] = useState<'idle' | 'confirming' | 'saving'>('idle');
  const submitting = useRef(false);
  const mounted = useRef(false);
  const { confirm } = useToast();
  const productId = draft.productId;

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    if (!productId) return;
    let cancelled = false;
    inventoryApi.getProduct(productId).then((product) => {
      if (!cancelled) setProductLoad({ status: 'ready', product });
    }).catch(() => {
      if (!cancelled) setProductLoad({ status: 'error', product: null });
    });
    return () => { cancelled = true; };
  }, [productId, loadAttempt]);

  const product = productLoad.product;
  const batch = product?.batches.find(({ id }) => id === draft.batchId);
  const validation = validateBatchWriteOffDraft(draft, batch);
  const remaining = validation.valid && batch ? batch.availableQuantity - validation.value.quantity : null;
  const busy = phase !== 'idle';

  function update(field: keyof BatchWriteOffFormInput, value: string) {
    setErrors((current) => ({ ...current, [field]: undefined }));
    setFormError(null);
    if (field === 'productId') {
      setDraft((current) => ({ ...current, productId: value, batchId: '', quantity: '' }));
      setErrors({});
      setProductLoad({ status: value ? 'loading' : 'idle', product: null });
    } else {
      setDraft((current) => ({ ...current, [field]: value, ...(field === 'batchId' ? { quantity: '' } : {}) }));
    }
  }

  function reloadProduct() {
    setProductLoad({ status: 'loading', product: null });
    setLoadAttempt((value) => value + 1);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    if (!validation.valid || !batch || !product) {
      if (!validation.valid) setErrors(validation.errors);
      return;
    }
    submitting.current = true;
    setPhase('confirming');
    setErrors({});
    setFormError(null);
    try {
      const accepted = await confirm(
        `Se retirarán ${validation.value.quantity} unidades de ${product.name}, lote ${batch.code}, por ${validation.value.reason}. El saldo del lote pasará de ${batch.availableQuantity} a ${remaining} unidades.`,
        'Confirmar baja',
        'danger',
      );
      if (!accepted || !mounted.current) return;
      setPhase('saving');
      const result = await onSubmit(validation.value);
      if (!mounted.current) return;
      setProductLoad((current) => current.status === 'ready' ? {
        status: 'ready',
        product: {
          ...current.product,
          stock: result.product.stock,
          batches: current.product.batches.map((item) => item.id === result.batch.id
            ? { ...item, availableQuantity: result.batch.availableQuantity }
            : item),
        },
      } : current);
      setDraft((current) => ({ ...current, quantity: '', reason: '', observation: '' }));
    } catch (cause) {
      if (!mounted.current) return;
      setFormError(cause instanceof Error ? cause.message : 'No se pudo registrar la baja');
      reloadProduct();
    } finally {
      submitting.current = false;
      if (mounted.current) setPhase('idle');
    }
  }

  return (
    <form className="product-form write-off-form" onSubmit={submit} noValidate aria-label="Registrar baja de lote">
      <fieldset disabled={busy} className="write-off-fields">
        <div className="form-section">
          <div className="form-section__heading">
            <span className="section-number">01</span>
            <div><h3>Producto y lote</h3><p>Selecciona de dónde se retirarán las unidades.</p></div>
          </div>
          <div className="form-grid">
            <label className="field">
              <span>Producto <b>*</b></span>
              <select aria-label="Producto" value={draft.productId} onChange={(event) => update('productId', event.target.value)} aria-invalid={Boolean(errors.productId)} aria-describedby={errors.productId ? 'write-off-product-error' : undefined}>
                <option value="">Selecciona un producto</option>
                {products.map((item) => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}
              </select>
              {errors.productId && <small id="write-off-product-error" className="field-error" role="alert">{errors.productId}</small>}
            </label>
            <label className="field">
              <span>Lote <b>*</b></span>
              <select aria-label="Lote" value={draft.batchId} onChange={(event) => update('batchId', event.target.value)} disabled={productLoad.status !== 'ready'} aria-invalid={Boolean(errors.batchId)} aria-describedby={errors.batchId ? 'write-off-batch-error' : undefined}>
                <option value="">{productLoad.status === 'loading' ? 'Cargando lotes…' : 'Selecciona un lote'}</option>
                {product?.batches.map((item) => <option key={item.id} value={item.id}>{item.code} · {item.availableQuantity} unidades disponibles</option>)}
              </select>
              {errors.batchId && <small id="write-off-batch-error" className="field-error" role="alert">{errors.batchId}</small>}
            </label>
          </div>
          {productLoad.status === 'loading' && <p className="write-off-hint" role="status">Cargando existencias del producto…</p>}
          {productLoad.status === 'error' && (
            <div className="write-off-load-error" role="alert">
              <span>No se pudieron cargar los lotes.</span>
              <button className="button button--ghost button--small" type="button" onClick={reloadProduct}>Reintentar</button>
            </div>
          )}
          {product && product.batches.length === 0 && <p className="write-off-hint" role="status">Este producto no tiene lotes registrados.</p>}
          {batch && (
            <div className="write-off-balance" aria-label="Existencias del lote">
              <div><span>Lote seleccionado</span><strong>{batch.code}</strong></div>
              <div><span>Unidades disponibles</span><strong>{batch.availableQuantity}</strong></div>
              <div><span>Saldo después de la baja</span><strong>{remaining ?? '—'}</strong></div>
            </div>
          )}
          {batch?.availableQuantity === 0 && <p className="field-error write-off-hint" role="status">El lote no tiene unidades disponibles.</p>}
        </div>

        <div className="form-section">
          <div className="form-section__heading">
            <span className="section-number">02</span>
            <div><h3>Detalle de la baja</h3><p>Indica la cantidad y el motivo del retiro.</p></div>
          </div>
          <div className="form-grid">
            <label className="field">
              <span>Cantidad <b>*</b></span>
              <input aria-label="Cantidad" inputMode="numeric" value={draft.quantity} onChange={(event) => update('quantity', event.target.value)} placeholder="Ej. 3" aria-invalid={Boolean(errors.quantity)} aria-describedby={errors.quantity ? 'write-off-quantity-error' : 'write-off-quantity-hint'} />
              {errors.quantity ? <small id="write-off-quantity-error" className="field-error" role="alert">{errors.quantity}</small> : <small id="write-off-quantity-hint">Número entero mayor que cero, sin superar las existencias.</small>}
            </label>
            <label className="field">
              <span>Motivo <b>*</b></span>
              <select aria-label="Motivo" value={draft.reason} onChange={(event) => update('reason', event.target.value)} aria-invalid={Boolean(errors.reason)} aria-describedby={errors.reason ? 'write-off-reason-error' : undefined}>
                <option value="">Selecciona el motivo</option>
                <option value="Daño">Daño</option>
                <option value="Pérdida">Pérdida</option>
              </select>
              {errors.reason && <small id="write-off-reason-error" className="field-error" role="alert">{errors.reason}</small>}
            </label>
            <label className="field form-grid__full">
              <span>Observación <small>(opcional)</small></span>
              <textarea aria-label="Observación" rows={3} value={draft.observation} onChange={(event) => update('observation', event.target.value)} placeholder="Describe lo ocurrido con estas unidades." />
            </label>
          </div>
          {formError && <p className="write-off-error" role="alert">{formError}</p>}
        </div>

        <div className="form-actions">
          {busy ? <button className="button button--ghost" type="button" disabled>Cancelar</button> : <Link className="button button--ghost" to="/inventory/products">Cancelar</Link>}
          <button className="button button--primary" type="submit" disabled={productLoad.status === 'loading' || productLoad.status === 'error'}>
            {phase === 'saving' ? 'Registrando…' : phase === 'confirming' ? 'Esperando confirmación…' : 'Registrar baja'}
          </button>
        </div>
      </fieldset>
    </form>
  );
}
