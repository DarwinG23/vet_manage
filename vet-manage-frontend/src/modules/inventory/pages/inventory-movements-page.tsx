import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { inventoryApi } from '../services/inventory-api';
import type { InventoryMovement, InventoryMovementsPage as MovementsPage } from '../types';
import './inventory-movements.css';

const MOVEMENT_LABELS: Record<InventoryMovement['type'], string> = {
  ENTRADA: 'Entrada', VENTA: 'Venta', USO_CLINICO: 'Uso clínico', AJUSTE: 'Ajuste', BAJA: 'Baja',
};
const dateFormat = new Intl.DateTimeFormat('es-EC', { dateStyle: 'short' });
const timeFormat = new Intl.DateTimeFormat('es-EC', { timeStyle: 'medium' });

export function InventoryMovementsPage() {
  const [result, setResult] = useState<MovementsPage | null>(null);
  const [page, setPage] = useState(1);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    let cancelled = false;
    inventoryApi.listMovements(page).then((loaded) => {
      if (!cancelled) { setResult(loaded); setStatus('ready'); }
    }).catch(() => {
      if (!cancelled) setStatus('error');
    });
    return () => { cancelled = true; };
  }, [page, loadAttempt]);

  function refresh() {
    setStatus('loading');
    setLoadAttempt((value) => value + 1);
  }
  function changePage(value: number) {
    setStatus('loading');
    setPage(value);
  }

  return (
    <section className="inventory-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">Inventario · Movimientos</span>
          <h2>Historial de movimientos</h2>
          <p>Consulta los retiros registrados, sus saldos y la persona responsable.</p>
        </div>
        <button className="button button--secondary" type="button" disabled={status === 'loading'} onClick={refresh}>Actualizar historial</button>
      </div>
      <div className="catalog-card">
        {status === 'loading' && <div className="empty-state" role="status">Cargando movimientos…</div>}
        {status === 'error' && (
          <div className="empty-state" role="alert">
            <strong>No se pudo cargar el historial</strong>
            <span>Vuelve a intentarlo para consultar los movimientos.</span>
            <button className="button button--secondary" type="button" onClick={refresh}>Reintentar</button>
          </div>
        )}
        {status === 'ready' && result?.items.length === 0 && <div className="empty-state" role="status">No existen movimientos registrados</div>}
        {status === 'ready' && result && result.items.length > 0 && (
          <>
            <div className="product-table-wrap">
              <table className="product-table inventory-movements-table">
                <caption className="sr-only">Movimientos de inventario, del más reciente al más antiguo</caption>
                <thead><tr>
                  <th scope="col">Fecha y hora</th><th scope="col">Producto</th><th scope="col">Lote</th>
                  <th scope="col">Tipo</th><th scope="col">Cantidad</th><th scope="col">Motivo</th>
                  <th scope="col">Observación</th><th scope="col">Saldo anterior</th><th scope="col">Saldo resultante</th><th scope="col">Responsable</th>
                </tr></thead>
                <tbody>{result.items.map((item) => <tr key={item.id}>
                  <td><time dateTime={item.occurredAt}><span>{dateFormat.format(new Date(item.occurredAt))}</span><span>{timeFormat.format(new Date(item.occurredAt))}</span></time></td>
                  <td><Link to={`/inventory/products/${encodeURIComponent(item.batch.product.id)}`}>{item.batch.product.name}</Link><small>{item.batch.product.code}</small></td>
                  <td><Link className="code-pill" to={`/inventory/batches/${encodeURIComponent(item.batch.id)}`}>{item.batch.code}</Link></td>
                  <td>{MOVEMENT_LABELS[item.type]}</td><td>{item.quantity}</td><td>{item.reason}</td>
                  <td className="movement-observation">{item.observation || 'Sin observación'}</td>
                  <td>{item.previousBalance}</td><td>{item.resultingBalance}</td><td>{item.user.firstName} {item.user.lastName}</td>
                </tr>)}</tbody>
              </table>
            </div>
            <div className="inventory-movements-pagination" aria-label="Paginación del historial">
              <span>{result.total} {result.total === 1 ? 'movimiento' : 'movimientos'}</span>
              <div>
                <span aria-live="polite">Página {result.page} de {result.totalPages}</span>
                <button className="button button--ghost button--small" type="button" disabled={result.page <= 1} onClick={() => changePage(result.page - 1)}>Anterior</button>
                <button className="button button--ghost button--small" type="button" disabled={result.page >= result.totalPages} onClick={() => changePage(result.page + 1)}>Siguiente</button>
              </div>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
