import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useToast } from '../../../common/components/toast-context';
import { inventoryApi } from '../../inventory/services/inventory-api';
import type { Product } from '../../inventory/types';
import { suppliersApi } from '../../suppliers/services/suppliers-api';
import type { Supplier } from '../../suppliers/types';
import {
  buildPurchaseOrderInput,
  draftTotalCents,
  formatMoney,
  hasPurchaseOrderErrors,
  lineSubtotalCents,
  purchaseOrderApiErrorMessage,
  purchaseOrderApiErrors,
  validatePurchaseOrderDraft,
  type PurchaseOrderDraft,
  type PurchaseOrderErrors,
  type PurchaseOrderLineDraft,
} from '../schemas/purchase-order';
import { purchaseOrdersApi } from '../services/purchase-orders-api';
import './purchase-orders-page.css';

const NO_ERRORS: PurchaseOrderErrors = { lines: {} };

// Clave estable de cada fila del formulario.
let lineSequence = 0;
const newLine = (): PurchaseOrderLineDraft => {
  lineSequence += 1;
  return { key: `line-${lineSequence}`, productId: '', quantity: '', unitPrice: '' };
};

// HU-27: el Gerente elabora una orden de compra para un proveedor activo.
export function PurchaseOrderFormPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [draft, setDraft] = useState<PurchaseOrderDraft>(() => ({ supplierId: '', lines: [newLine()] }));
  const [errors, setErrors] = useState<PurchaseOrderErrors>(NO_ERRORS);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let current = true;
    // Solo se ofrecen proveedores activos y productos activos del catálogo.
    Promise.all([
      suppliersApi.list({ page: 1, pageSize: 100, status: 'ACTIVE' }),
      inventoryApi.listProducts(''),
    ]).then(([supplierPage, productList]) => {
      if (!current) return;
      setSuppliers(supplierPage.items.filter((supplier) => supplier.isActive));
      setProducts([...productList].sort((a, b) => a.name.localeCompare(b.name)));
    }).catch((cause: unknown) => {
      if (current) setLoadError(purchaseOrderApiErrorMessage(cause, 'No se pudieron cargar los proveedores y productos.'));
    }).finally(() => {
      if (current) setLoading(false);
    });
    return () => { current = false; };
  }, []);

  function clearLineError(key: string, field: keyof PurchaseOrderLineDraft) {
    setErrors((current) => {
      const line = current.lines[key];
      if (!line) return current;
      const rest = { ...line, [field]: undefined };
      return { ...current, lines: { ...current.lines, [key]: rest } };
    });
  }

  function updateLine(key: string, field: 'productId' | 'quantity' | 'unitPrice', value: string) {
    setDraft((current) => {
      const lines = current.lines.map((line) => (line.key === key ? { ...line, [field]: value } : line));
      // Al elegir un producto se sugiere su precio de catálogo; el Gerente puede cambiarlo.
      if (field === 'productId') {
        const product = products.find(({ id }) => id === value);
        const target = lines.find((line) => line.key === key);
        if (product && target && !target.unitPrice) target.unitPrice = Number(product.unitPrice).toFixed(2);
      }
      return { ...current, lines };
    });
    clearLineError(key, field);
    setFormError(null);
  }

  function addLine() {
    setDraft((current) => ({ ...current, lines: [...current.lines, newLine()] }));
    setErrors((current) => ({ ...current, items: undefined }));
  }

  function removeLine(key: string) {
    setDraft((current) => ({ ...current, lines: current.lines.filter((line) => line.key !== key) }));
    setErrors((current) => {
      const lines = { ...current.lines };
      delete lines[key];
      return { ...current, lines };
    });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;

    const validation = validatePurchaseOrderDraft(draft);
    setErrors(validation);
    if (hasPurchaseOrderErrors(validation)) {
      setFormError('Revise los datos marcados para guardar la orden.');
      return;
    }

    setFormError(null);
    setSaving(true);
    try {
      const order = await purchaseOrdersApi.create(buildPurchaseOrderInput(draft));
      showToast(`Orden de compra ${order.code} registrada correctamente`, 'success');
      navigate(`/inventory/purchase-orders/${encodeURIComponent(order.id)}`);
    } catch (cause) {
      const message = purchaseOrderApiErrorMessage(cause, 'No se pudo registrar la orden de compra.');
      setErrors(purchaseOrderApiErrors(cause, draft));
      setFormError(message);
      showToast(message, 'error');
      setSaving(false);
    }
  }

  const totalCents = draftTotalCents(draft);

  return (
    <section className="inventory-page purchase-orders-page">
      <Link className="back-link" to="/inventory/purchase-orders">← Volver a órdenes de compra</Link>
      <div className="page-heading">
        <div>
          <span className="eyebrow">Inventario · Compras</span>
          <h2>Nueva orden de compra</h2>
          <p>Registre el abastecimiento solicitado a un proveedor. Las existencias se actualizarán al recibir los productos.</p>
        </div>
      </div>

      {loading ? (
        <div className="empty-state" role="status">Cargando proveedores y productos…</div>
      ) : loadError ? (
        <div className="purchase-order-message purchase-order-message--error" role="alert"><p>{loadError}</p></div>
      ) : (
        <form className="product-form purchase-order-form" onSubmit={(event) => void submit(event)} noValidate>
          {formError && <p className="purchase-order-message purchase-order-message--error" role="alert">{formError}</p>}

          <section className="form-section" aria-labelledby="purchase-order-supplier-heading">
            <div className="form-section__heading">
              <span className="section-number" aria-hidden="true">01</span>
              <div>
                <h3 id="purchase-order-supplier-heading">Proveedor</h3>
                <p>Solo se muestran los proveedores activos.</p>
              </div>
            </div>
            <div className="form-grid">
              <label className="field form-grid__full" htmlFor="purchase-order-supplier">
                <span>Proveedor <b aria-hidden="true">*</b></span>
                <select
                  id="purchase-order-supplier"
                  value={draft.supplierId}
                  aria-invalid={Boolean(errors.supplierId)}
                  disabled={saving}
                  onChange={(event) => {
                    const supplierId = event.target.value;
                    setDraft((current) => ({ ...current, supplierId }));
                    setErrors((current) => ({ ...current, supplierId: undefined }));
                    setFormError(null);
                  }}
                >
                  <option value="">{suppliers.length === 0 ? 'No hay proveedores activos' : 'Selecciona un proveedor'}</option>
                  {suppliers.map((supplier) => (
                    <option key={supplier.id} value={supplier.id}>{supplier.businessName} · RUC {supplier.ruc}</option>
                  ))}
                </select>
                {errors.supplierId && <small className="field-error" role="alert">{errors.supplierId}</small>}
              </label>
            </div>
          </section>

          <section className="form-section" aria-labelledby="purchase-order-items-heading">
            <div className="form-section__heading">
              <span className="section-number" aria-hidden="true">02</span>
              <div>
                <h3 id="purchase-order-items-heading">Productos</h3>
                <p>Agregue al menos un producto con cantidad entera y precio unitario mayores que cero.</p>
              </div>
            </div>

            <div className="purchase-order-lines">
              {draft.lines.map((line, index) => {
                const lineErrors = errors.lines[line.key] ?? {};
                const number = index + 1;
                return (
                  <fieldset className="purchase-order-line" key={line.key}>
                    <legend className="sr-only">Producto {number}</legend>
                    <label className="field purchase-order-line__product">
                      <span>Producto {number} <b aria-hidden="true">*</b></span>
                      <select
                        value={line.productId}
                        aria-invalid={Boolean(lineErrors.productId)}
                        disabled={saving}
                        onChange={(event) => updateLine(line.key, 'productId', event.target.value)}
                      >
                        <option value="">Selecciona un producto</option>
                        {products.map((product) => (
                          <option key={product.id} value={product.id}>{product.code} · {product.name}</option>
                        ))}
                      </select>
                      {lineErrors.productId && <small className="field-error" role="alert">{lineErrors.productId}</small>}
                    </label>
                    <label className="field">
                      <span>Cantidad <b aria-hidden="true">*</b></span>
                      {/* Texto para poder avisar cuando se escriben decimales o letras. */}
                      <input
                        inputMode="numeric"
                        value={line.quantity}
                        placeholder="Ej. 10"
                        aria-label={`Cantidad del producto ${number}`}
                        aria-invalid={Boolean(lineErrors.quantity)}
                        disabled={saving}
                        onChange={(event) => updateLine(line.key, 'quantity', event.target.value)}
                      />
                      {lineErrors.quantity && <small className="field-error" role="alert">{lineErrors.quantity}</small>}
                    </label>
                    <label className="field">
                      <span>Precio unitario <b aria-hidden="true">*</b></span>
                      <input
                        inputMode="decimal"
                        value={line.unitPrice}
                        placeholder="0.00"
                        aria-label={`Precio unitario del producto ${number}`}
                        aria-invalid={Boolean(lineErrors.unitPrice)}
                        disabled={saving}
                        onChange={(event) => updateLine(line.key, 'unitPrice', event.target.value)}
                      />
                      {lineErrors.unitPrice && <small className="field-error" role="alert">{lineErrors.unitPrice}</small>}
                    </label>
                    <div className="purchase-order-line__subtotal">
                      <span>Subtotal</span>
                      <strong>{formatMoney(lineSubtotalCents(line), true)}</strong>
                    </div>
                    <button
                      className="button button--ghost button--small purchase-order-line__remove"
                      type="button"
                      onClick={() => removeLine(line.key)}
                      disabled={saving}
                      aria-label={`Quitar producto ${number}`}
                    >
                      Quitar
                    </button>
                  </fieldset>
                );
              })}
              {errors.items && <p className="field-error purchase-order-lines__error" role="alert">{errors.items}</p>}
              <button className="create-link" type="button" onClick={addLine} disabled={saving}>＋ Agregar producto</button>
            </div>
          </section>

          <div className="purchase-order-total" aria-live="polite">
            <span>Total de la orden</span>
            <strong>{formatMoney(totalCents, true)}</strong>
            <small>Se registrará con estado «Pendiente».</small>
          </div>

          <div className="form-actions">
            <Link className="button button--ghost" to="/inventory/purchase-orders">Cancelar</Link>
            <button className="button button--primary" type="submit" disabled={saving}>{saving ? 'Guardando…' : 'Guardar orden'}</button>
          </div>
        </form>
      )}
    </section>
  );
}
