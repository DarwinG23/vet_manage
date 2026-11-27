import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useToast } from '../../../common/components/toast-context';
import { BatchWriteOffForm } from '../components/batch-write-off-form';
import { inventoryApi } from '../services/inventory-api';
import type { BatchWriteOffDraft, BatchWriteOffResult, Product } from '../types';
import './inventory-movements.css';

export function BatchWriteOffPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [lastResult, setLastResult] = useState<BatchWriteOffResult | null>(null);
  const { showToast } = useToast();

  useEffect(() => {
    let cancelled = false;
    inventoryApi.listProducts('').then((items) => {
      if (!cancelled) { setProducts(items); setStatus('ready'); }
    }).catch(() => {
      if (!cancelled) setStatus('error');
    });
    return () => { cancelled = true; };
  }, [loadAttempt]);

  async function register(draft: BatchWriteOffDraft) {
    const result = await inventoryApi.registerBatchWriteOff(draft);
    setProducts((current) => current.map((item) => item.id === result.product.id ? { ...item, stock: result.product.stock } : item));
    setLastResult(result);
    showToast('Baja registrada correctamente', 'success');
    return result;
  }

  return (
    <section className="inventory-page inventory-form-page">
      <Link className="back-link" to="/inventory/products">← Volver a productos</Link>
      <div className="page-heading">
        <div>
          <span className="eyebrow">Inventario · Bajas</span>
          <h2>Registrar baja de lote</h2>
          <p>Retira unidades por daño o pérdida y conserva el registro de lo ocurrido.</p>
        </div>
      </div>
      {lastResult && (
        <div className="catalog-card batch-entry-summary" role="status">
          <strong>Baja registrada correctamente</strong>
          <span>Se retiraron {lastResult.movement.quantity} unidades del lote <b>{lastResult.movement.batch.code}</b> por {lastResult.movement.reason.toLowerCase()}.</span>
          <span>Saldo del lote: <b>{lastResult.batch.availableQuantity}</b> unidades. Existencias del producto: <b>{lastResult.product.stock}</b>.</span>
          <Link to={`/inventory/products/${encodeURIComponent(lastResult.product.id)}`}>Consultar existencias actualizadas</Link>
        </div>
      )}
      {status === 'loading' && <div className="empty-state" role="status">Cargando productos…</div>}
      {status === 'error' && (
        <div className="catalog-card empty-state" role="alert">
          <strong>No se pudieron cargar los productos</strong>
          <button className="button button--secondary" type="button" onClick={() => { setStatus('loading'); setLoadAttempt((value) => value + 1); }}>Reintentar</button>
        </div>
      )}
      {status === 'ready' && products.length === 0 && <div className="catalog-card empty-state" role="status">No hay productos registrados para seleccionar un lote.</div>}
      {status === 'ready' && products.length > 0 && <BatchWriteOffForm products={products} onSubmit={register} />}
    </section>
  );
}
