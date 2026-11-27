import { useCallback, useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useToast } from '../../../common/components/toast-context';
import { useAuth } from '../../auth/auth-context';
import {
  validateBatchStockAdjustmentDraft,
  type BatchStockAdjustmentErrors,
} from '../schemas/batch-stock-adjustment';
import { inventoryApi } from '../services/inventory-api';
import type { BatchDetail, BatchInventoryMovement, InventoryMovementType } from '../types';
import './batch-detail-page.css';

const MOVEMENT_LABELS: Record<InventoryMovementType, string> = {
  ENTRADA: 'Entrada',
  VENTA: 'Venta',
  USO_CLINICO: 'Uso clínico',
  AJUSTE: 'Ajuste manual',
  BAJA: 'Baja',
};

function formatDifference(quantity: number) {
  return quantity > 0 ? `+${quantity}` : String(quantity);
}

function movementDifference(movement: BatchInventoryMovement) {
  if (movement.type === 'AJUSTE') return movement.quantity;
  return ['VENTA', 'USO_CLINICO', 'BAJA'].includes(movement.type)
    ? -Math.abs(movement.quantity)
    : movement.quantity;
}

export function BatchDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { hasPermission } = useAuth();
  const [batch, setBatch] = useState<BatchDetail | null>(null);
  const [movements, setMovements] = useState<BatchInventoryMovement[]>([]);
  const [historyBatchId, setHistoryBatchId] = useState('');
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [error, setError] = useState(false);
  const [historyError, setHistoryError] = useState(false);
  const [quantityDraft, setQuantityDraft] = useState<{ batchId: string; value: string } | null>(null);
  const [reason, setReason] = useState('');
  const [fieldErrors, setFieldErrors] = useState<BatchStockAdjustmentErrors>({});
  const [submitError, setSubmitError] = useState('');
  const [saving, setSaving] = useState(false);
  const requestVersion = useRef(0);
  const { showToast } = useToast();
  const canAdjust = hasPermission('inventory:adjust-stock');

  const applyBatchData = useCallback((
    batchId: string,
    requestId: number,
    batchResult: PromiseSettledResult<BatchDetail>,
    movementsResult: PromiseSettledResult<BatchInventoryMovement[]>,
  ) => {
    if (requestId !== requestVersion.current) return;
    if (batchResult.status === 'fulfilled') {
      setBatch(batchResult.value);
      setError(false);
    } else {
      setError(true);
      showToast('No se pudo cargar el lote.', 'error');
    }

    if (movementsResult.status === 'fulfilled') {
      setMovements(movementsResult.value);
      setHistoryBatchId(batchId);
      setHistoryError(false);
    } else {
      setHistoryError(true);
      showToast('No se pudo cargar el historial de movimientos.', 'error');
    }

    setLoading(false);
    setHistoryLoading(false);
  }, [showToast]);

  const loadBatchData = useCallback(async () => {
    if (!id) return;
    const requestId = ++requestVersion.current;
    const [batchResult, movementsResult] = await Promise.allSettled([
      inventoryApi.getBatch(id),
      inventoryApi.listBatchMovements(id),
    ]);
    applyBatchData(id, requestId, batchResult, movementsResult);
  }, [applyBatchData, id]);

  useEffect(() => {
    if (!id) return;
    const requestId = ++requestVersion.current;
    void Promise.allSettled([
      inventoryApi.getBatch(id),
      inventoryApi.listBatchMovements(id),
    ]).then(([batchResult, movementsResult]) => {
      applyBatchData(id, requestId, batchResult, movementsResult);
    });
    return () => { requestVersion.current += 1; };
  }, [applyBatchData, id]);

  const currentBatch = batch?.id === id ? batch : null;
  const isLoading = Boolean(id) && !currentBatch && !error;
  const hasError = !id || (error && !currentBatch);
  const currentMovements = historyBatchId === id ? movements : [];
  const newQuantity = quantityDraft && quantityDraft.batchId === id
    ? quantityDraft.value
    : String(currentBatch?.availableQuantity ?? '');
  const isHistoryLoading = historyLoading || (historyBatchId !== id && !historyError);
  const previewQuantity = newQuantity.trim() ? Number(newQuantity) : Number.NaN;
  const previewDifference = Number.isSafeInteger(previewQuantity) && previewQuantity >= 0 && currentBatch
    ? previewQuantity - currentBatch.availableQuantity
    : null;

  async function submitAdjustment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!id || !currentBatch) return;

    const validation = validateBatchStockAdjustmentDraft({ newQuantity, reason });
    if (!validation.valid) {
      setFieldErrors(validation.errors);
      setSubmitError('');
      return;
    }

    setFieldErrors({});
    setSubmitError('');
    setSaving(true);
    const submittedBatchId = id;
    const submittedRequestVersion = requestVersion.current;
    try {
      const result = await inventoryApi.adjustBatchStock(submittedBatchId, validation.value);
      if (submittedRequestVersion !== requestVersion.current) return;

      setBatch((current) => current?.id === submittedBatchId ? {
        ...current,
        availableQuantity: result.stockAfter,
        product: { ...current.product, stock: result.productStock },
      } : current);
      setQuantityDraft({ batchId: submittedBatchId, value: String(result.stockAfter) });
      setReason('');
      showToast('Ajuste de existencias registrado correctamente.', 'success');

      setHistoryLoading(true);
      try {
        const updatedMovements = await inventoryApi.listBatchMovements(submittedBatchId);
        if (submittedRequestVersion === requestVersion.current) {
          setMovements(updatedMovements);
          setHistoryBatchId(submittedBatchId);
          setHistoryError(false);
        }
      } catch {
        if (submittedRequestVersion === requestVersion.current) {
          setHistoryError(true);
          showToast('El ajuste se guardó, pero no se pudo actualizar el historial.', 'error');
        }
      } finally {
        if (submittedRequestVersion === requestVersion.current) setHistoryLoading(false);
      }
    } catch (cause) {
      const apiError = cause as { message?: string; errors?: string[] };
      setSubmitError(apiError.errors?.join(' ') || apiError.message || 'No se pudo registrar el ajuste.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="inventory-page batch-detail-page">
      <Link className="back-link" to={currentBatch ? `/inventory/products/${currentBatch.productId}` : '/inventory/products'}>
        ← Volver al producto
      </Link>
      <div className="page-heading">
        <div>
          <span className="eyebrow">Inventario · Lotes</span>
          <h2>Detalle del lote</h2>
          <p>Consulta existencias, registra ajustes y revisa el historial del lote.</p>
        </div>
        {id && currentBatch && (
          <button className="button button--secondary" type="button" onClick={() => {
            setLoading(true);
            setHistoryLoading(true);
            void loadBatchData();
          }} disabled={loading}>
            {loading ? 'Actualizando…' : 'Actualizar lote'}
          </button>
        )}
      </div>

      {isLoading && <div className="empty-state" role="status">Cargando lote…</div>}

      {!isLoading && hasError && (
        <div className="empty-state" role="alert">
          <strong>No se pudo cargar el lote</strong>
          <span>Verifica que el registro siga disponible.</span>
          {id && <button className="button button--primary" type="button" onClick={() => void loadBatchData()}>Reintentar</button>}
        </div>
      )}

      {!isLoading && currentBatch && (
        <>
          <div className="catalog-card batch-detail-card">
            <div className="product-table-wrap">
              <table className="product-table detail-table" aria-label="Detalle del lote">
                <tbody>
                  <tr><th scope="row">Código del lote</th><td><span className="code-pill">{currentBatch.code}</span></td></tr>
                  <tr><th scope="row">Producto</th><td><Link to={`/inventory/products/${currentBatch.productId}`}>{currentBatch.product.name} <small>({currentBatch.product.code})</small></Link></td></tr>
                  <tr><th scope="row">Fecha de caducidad</th><td><time dateTime={currentBatch.expirationDate}>{currentBatch.expirationDate}</time></td></tr>
                  <tr><th scope="row">Cantidad inicial</th><td>{currentBatch.initialQuantity}</td></tr>
                  <tr><th scope="row">Unidades disponibles en el lote</th><td className="price-cell">{currentBatch.availableQuantity}</td></tr>
                  <tr><th scope="row">Stock total del producto</th><td>{currentBatch.product.stock}</td></tr>
                </tbody>
              </table>
            </div>
          </div>

          {canAdjust && (
            <section className="catalog-card batch-adjustment-card" aria-labelledby="batch-adjustment-title">
              <div className="catalog-card__heading">
                <div>
                  <span className="eyebrow">HU-11</span>
                  <h3 id="batch-adjustment-title">Ajuste manual de existencias</h3>
                  <p>Ingresa el saldo contado y explica el motivo del ajuste.</p>
                </div>
              </div>
              <form className="batch-adjustment-form" onSubmit={submitAdjustment} noValidate>
                <label className="field">
                  <span>Nuevo saldo del lote <b>*</b></span>
                  <input
                    inputMode="numeric"
                    value={newQuantity}
                    onChange={(event) => {
                      setQuantityDraft({ batchId: id ?? '', value: event.target.value });
                      setFieldErrors((current) => ({ ...current, newQuantity: undefined }));
                      setSubmitError('');
                    }}
                    aria-invalid={Boolean(fieldErrors.newQuantity)}
                    aria-describedby={fieldErrors.newQuantity ? 'batch-quantity-error' : undefined}
                  />
                  {fieldErrors.newQuantity && <small id="batch-quantity-error" className="field-error" role="alert">{fieldErrors.newQuantity}</small>}
                </label>
                <label className="field">
                  <span>Motivo del ajuste <b>*</b></span>
                  <textarea
                    rows={3}
                    value={reason}
                    onChange={(event) => {
                      setReason(event.target.value);
                      setFieldErrors((current) => ({ ...current, reason: undefined }));
                      setSubmitError('');
                    }}
                    aria-invalid={Boolean(fieldErrors.reason)}
                    aria-describedby={fieldErrors.reason ? 'batch-reason-error' : undefined}
                  />
                  {fieldErrors.reason && <small id="batch-reason-error" className="field-error" role="alert">{fieldErrors.reason}</small>}
                </label>
                {previewDifference !== null && (
                  <p className="batch-adjustment-preview" role="status">
                    Diferencia que se registrará: <strong>{formatDifference(previewDifference)}</strong> unidades
                  </p>
                )}
                {submitError && <p className="batch-adjustment-error" role="alert">{submitError}</p>}
                <div className="form-actions">
                  <button className="button button--primary" type="submit" disabled={saving || loading}>
                    {saving ? 'Guardando ajuste…' : 'Confirmar ajuste'}
                  </button>
                </div>
              </form>
            </section>
          )}

          <section className="catalog-card batch-movement-card" aria-labelledby="batch-movements-title">
            <div className="catalog-card__heading">
              <div>
                <span className="eyebrow">Historial</span>
                <h3 id="batch-movements-title">Movimientos del lote</h3>
              </div>
              <button
                className="button button--secondary button--small"
                type="button"
                onClick={() => {
                  setLoading(true);
                  setHistoryLoading(true);
                  void loadBatchData();
                }}
                disabled={isHistoryLoading}
              >
                {isHistoryLoading ? 'Actualizando…' : 'Actualizar historial'}
              </button>
            </div>
            {isHistoryLoading && <p className="product-detail-empty" role="status">Cargando movimientos…</p>}
            {!isHistoryLoading && historyError && (
              <p className="product-detail-empty" role="alert">No se pudo cargar el historial. Intenta actualizarlo.</p>
            )}
            {!isHistoryLoading && !historyError && currentMovements.length === 0 && (
              <p className="product-detail-empty" role="status">Este lote aún no tiene movimientos registrados.</p>
            )}
            {!isHistoryLoading && !historyError && currentMovements.length > 0 && (
              <div className="product-table-wrap">
                <table className="product-table batch-movement-table" aria-label="Historial de movimientos del lote">
                  <thead>
                    <tr>
                      <th scope="col">Fecha</th>
                      <th scope="col">Tipo</th>
                      <th scope="col">Nivel</th>
                      <th scope="col">Saldo anterior</th>
                      <th scope="col">Diferencia</th>
                      <th scope="col">Saldo nuevo</th>
                      <th scope="col">Motivo</th>
                      <th scope="col">Responsable</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentMovements.map((movement) => (
                      <tr key={movement.id}>
                        <td><time dateTime={movement.occurredAt}>{new Date(movement.occurredAt).toLocaleString()}</time></td>
                        <td>{MOVEMENT_LABELS[movement.type]}</td>
                        <td>{movement.type === 'AJUSTE' ? 'Lote' : 'Producto'}</td>
                        <td>{movement.stockBefore}</td>
                        <td className={movementDifference(movement) < 0 ? 'batch-movement-delta batch-movement-delta--negative' : 'batch-movement-delta'}>
                          {formatDifference(movementDifference(movement))}
                        </td>
                        <td>{movement.stockAfter}</td>
                        <td>{movement.reason || '—'}</td>
                        <td>{movement.userName}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </section>
  );
}
