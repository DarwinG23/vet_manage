import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/auth-context';
import { formatMoney, formatOrderDate, purchaseOrderApiErrorMessage } from '../schemas/purchase-order';
import { purchaseOrdersApi } from '../services/purchase-orders-api';
import { PURCHASE_ORDER_STATUS_LABELS, type PurchaseOrderListResponse } from '../types';
import './purchase-orders-page.css';

const PAGE_SIZE = 10;

// HU-27: listado de órdenes de compra; cada fila abre su consulta.
export function PurchaseOrdersPage() {
  const { hasPermission } = useAuth();
  const canCreate = hasPermission('purchase-orders:create');
  const [orders, setOrders] = useState<PurchaseOrderListResponse | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let current = true;
    purchaseOrdersApi.list({ page, pageSize: PAGE_SIZE }).then((result) => {
      if (current) { setOrders(result); setError(null); }
    }).catch((cause: unknown) => {
      if (current) setError(purchaseOrderApiErrorMessage(cause, 'No se pudo cargar el listado de órdenes de compra.'));
    }).finally(() => {
      if (current) setLoading(false);
    });
    return () => { current = false; };
  }, [page]);

  function changePage(next: number) {
    setLoading(true);
    setPage(next);
  }

  return (
    <section className="inventory-page purchase-orders-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">Inventario · Compras</span>
          <h2>Órdenes de compra</h2>
          <p>Consulte el abastecimiento solicitado a los proveedores.</p>
        </div>
        {canCreate && <Link className="button button--primary" to="/inventory/purchase-orders/new">＋ Nueva orden</Link>}
      </div>

      <div className="catalog-card" aria-busy={loading}>
        {loading ? (
          <div className="empty-state" role="status">Cargando órdenes de compra…</div>
        ) : error ? (
          <div className="purchase-order-message purchase-order-message--error" role="alert"><p>{error}</p></div>
        ) : !orders || orders.items.length === 0 ? (
          <div className="empty-state">
            <strong>Aún no hay órdenes de compra</strong>
            <span>Las órdenes aparecerán aquí cuando sean registradas.</span>
            {canCreate && <Link className="button button--primary" to="/inventory/purchase-orders/new">Elaborar orden</Link>}
          </div>
        ) : (
          <>
            <div className="product-table-wrap">
              <table className="product-table purchase-order-table">
                <caption className="sr-only">Listado de órdenes de compra</caption>
                <thead>
                  <tr><th scope="col">Número</th><th scope="col">Fecha</th><th scope="col">Proveedor</th><th scope="col">Productos</th><th scope="col">Total</th><th scope="col">Estado</th><th scope="col">Acciones</th></tr>
                </thead>
                <tbody>
                  {orders.items.map((order) => (
                    <tr key={order.id}>
                      <td><span className="code-pill">{order.code}</span></td>
                      <td>{formatOrderDate(order.orderDate)}</td>
                      <td><strong>{order.supplier.businessName}</strong></td>
                      <td className="price-cell">{order.itemsCount}</td>
                      <td className="price-cell">{formatMoney(order.total)}</td>
                      <td><span className="status-badge purchase-order-status">{PURCHASE_ORDER_STATUS_LABELS[order.status]}</span></td>
                      <td>
                        <Link
                          className="button button--ghost button--small"
                          to={`/inventory/purchase-orders/${encodeURIComponent(order.id)}`}
                          aria-label={`Ver orden de compra ${order.code}`}
                        >
                          Ver
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="purchase-order-pagination" aria-label="Paginación de órdenes de compra">
              <span>{orders.total} {orders.total === 1 ? 'orden' : 'órdenes'}</span>
              <div>
                <span aria-live="polite">Página {orders.page} de {orders.totalPages}</span>
                <button className="button button--ghost button--small" type="button" onClick={() => changePage(orders.page - 1)} disabled={loading || orders.page <= 1}>Anterior</button>
                <button className="button button--ghost button--small" type="button" onClick={() => changePage(orders.page + 1)} disabled={loading || orders.page >= orders.totalPages}>Siguiente</button>
              </div>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
