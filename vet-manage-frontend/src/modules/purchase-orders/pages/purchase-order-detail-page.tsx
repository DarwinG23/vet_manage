import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { formatMoney, formatOrderDate, purchaseOrderApiErrorMessage } from '../schemas/purchase-order';
import { purchaseOrdersApi } from '../services/purchase-orders-api';
import { PURCHASE_ORDER_STATUS_LABELS, type PurchaseOrder } from '../types';
import './purchase-orders-page.css';

// HU-27, escenario 3: consulta de una orden de compra.
export function PurchaseOrderDetailPage() {
  const { id = '' } = useParams<{ id: string }>();
  const [order, setOrder] = useState<PurchaseOrder | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadedId, setLoadedId] = useState<string | null>(null);
  const loading = loadedId !== id;

  useEffect(() => {
    let current = true;
    purchaseOrdersApi.get(id).then((result) => {
      if (current) { setOrder(result); setError(null); }
    }).catch((cause: unknown) => {
      if (current) { setOrder(null); setError(purchaseOrderApiErrorMessage(cause, 'No se pudo cargar la orden de compra.')); }
    }).finally(() => {
      if (current) setLoadedId(id);
    });
    return () => { current = false; };
  }, [id]);

  return (
    <section className="inventory-page purchase-orders-page">
      <Link className="back-link" to="/inventory/purchase-orders">← Volver a órdenes de compra</Link>
      {loading ? (
        <div className="empty-state" role="status">Cargando orden de compra…</div>
      ) : error || !order ? (
        <div className="purchase-order-message purchase-order-message--error" role="alert"><p>{error ?? 'Orden de compra no encontrada'}</p></div>
      ) : (
        <>
          <div className="page-heading">
            <div>
              <span className="eyebrow">Inventario · Compras</span>
              <h2>Orden de compra {order.code}</h2>
              <p>Las existencias de estos productos se actualizarán cuando se registre la recepción.</p>
            </div>
            <span className="status-badge purchase-order-status">{PURCHASE_ORDER_STATUS_LABELS[order.status]}</span>
          </div>

          <dl className="catalog-card purchase-order-summary">
            <div><dt>Número</dt><dd>{order.code}</dd></div>
            <div><dt>Fecha</dt><dd>{formatOrderDate(order.orderDate)}</dd></div>
            <div><dt>Proveedor</dt><dd>{order.supplier.businessName}<small>RUC {order.supplier.ruc}</small></dd></div>
            <div><dt>Estado</dt><dd>{PURCHASE_ORDER_STATUS_LABELS[order.status]}</dd></div>
          </dl>

          <div className="catalog-card">
            <div className="product-table-wrap">
              <table className="product-table purchase-order-table">
                <caption className="sr-only">Productos de la orden {order.code}</caption>
                <thead>
                  <tr><th scope="col">Código</th><th scope="col">Producto</th><th scope="col">Cantidad</th><th scope="col">Precio unitario</th><th scope="col">Subtotal</th></tr>
                </thead>
                <tbody>
                  {order.items.map((item) => (
                    <tr key={item.id}>
                      <td><span className="code-pill">{item.product.code}</span></td>
                      <td><strong>{item.product.name}</strong></td>
                      <td className="price-cell">{item.quantity}</td>
                      <td className="price-cell">{formatMoney(item.unitPrice)}</td>
                      <td className="price-cell">{formatMoney(item.subtotal)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr><th scope="row" colSpan={4}>Total</th><td className="price-cell"><strong>{formatMoney(order.total)}</strong></td></tr>
                </tfoot>
              </table>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
