import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useToast } from '../../../common/components/toast-context';
import { formatMinimumStock } from '../schemas/minimum-stock';
import { inventoryApi } from '../services/inventory-api';
import type { ProductDetail } from '../types';
import './products-page.css';

type ProductLoadState =
  | { id: string; status: 'loading' }
  | { id: string; status: 'error' }
  | { id: string; status: 'ready'; product: ProductDetail };

export function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [loadState, setLoadState] = useState<ProductLoadState>(() => ({ id: id ?? '', status: 'loading' }));
  const requestVersion = useRef(0);
  const { showToast } = useToast();

  const loadProduct = useCallback(async () => {
    if (!id) return;

    const requestId = ++requestVersion.current;
    setLoadState({ id, status: 'loading' });

    try {
      const loaded = await inventoryApi.getProduct(id);
      if (requestId === requestVersion.current) setLoadState({ id, status: 'ready', product: loaded });
    } catch {
      if (requestId === requestVersion.current) {
        setLoadState({ id, status: 'error' });
        showToast('No se pudieron cargar las existencias del producto.', 'error');
      }
    }
  }, [id, showToast]);

  useEffect(() => {
    if (!id) return;
    const requestId = ++requestVersion.current;
    inventoryApi.getProduct(id).then((loaded) => {
      if (requestId === requestVersion.current) setLoadState({ id, status: 'ready', product: loaded });
    }).catch(() => {
      if (requestId === requestVersion.current) {
        setLoadState({ id, status: 'error' });
        showToast('No se pudieron cargar las existencias del producto.', 'error');
      }
    });
    return () => {
      requestVersion.current += 1;
    };
  }, [id, showToast]);

  const product = loadState.id === id && loadState.status === 'ready' ? loadState.product : null;
  const loading = Boolean(id) && (loadState.id !== id || loadState.status === 'loading');
  const error = !id || (loadState.id === id && loadState.status === 'error');

  return (
    <section className="inventory-page">
      <Link className="back-link" to="/inventory/products">← Volver a productos</Link>
      <div className="page-heading">
        <div>
          <span className="eyebrow">Inventario · Productos</span>
          <h2>Existencias del producto</h2>
          <p>Consulta el stock total, el mínimo configurado y el detalle de sus lotes.</p>
        </div>
        {id && (
          <button
            className="button button--secondary"
            type="button"
            onClick={() => void loadProduct()}
            disabled={loading}
          >
            {loading ? 'Actualizando…' : 'Actualizar existencias'}
          </button>
        )}
      </div>

      {loading && (
        <div className="empty-state" role="status">
          {product ? 'Actualizando existencias…' : 'Cargando existencias…'}
        </div>
      )}

      {!loading && (error || !id) && (
        <div className="empty-state" role="alert">
          <strong>No se pudieron cargar las existencias</strong>
          <span>Comprueba tu conexión y vuelve a intentarlo.</span>
          {id && (
            <button className="button button--primary" type="button" onClick={() => void loadProduct()}>
              Reintentar
            </button>
          )}
        </div>
      )}

      {!loading && !error && product && (
        <div className="catalog-card product-detail-card">
          <section className="product-detail-section" aria-labelledby="product-information-title">
            <div className="catalog-card__heading">
              <div>
                <span className="eyebrow">Producto</span>
                <h3 id="product-information-title">Información del producto</h3>
              </div>
            </div>
            <div className="product-table-wrap">
              <table className="product-table detail-table" aria-label="Información del producto">
                <tbody>
                  <tr><th scope="row">Código</th><td><span className="code-pill">{product.code}</span></td></tr>
                  <tr><th scope="row">Nombre</th><td>{product.name}</td></tr>
                  <tr><th scope="row">Categoría</th><td>{product.category.name}</td></tr>
                  <tr><th scope="row">Marca</th><td>{product.brand.name}</td></tr>
                  <tr><th scope="row">Descripción</th><td>{product.description || 'Sin descripción'}</td></tr>
                  <tr><th scope="row">Precio unitario</th><td className="price-cell">${Number(product.unitPrice).toFixed(2)}</td></tr>
                </tbody>
              </table>
            </div>
            <dl className="product-stock-summary" aria-label="Resumen de existencias">
              <div className="product-stock-summary__item">
                <dt>Stock total</dt>
                <dd>{product.stock}</dd>
              </div>
              <div className="product-stock-summary__item">
                <dt>Stock mínimo</dt>
                <dd>{formatMinimumStock(product.minimumStock)}</dd>
              </div>
            </dl>
          </section>

          <section className="product-detail-section" aria-labelledby="product-batches-title">
            <div className="catalog-card__heading">
              <div>
                <span className="eyebrow">Inventario</span>
                <h3 id="product-batches-title">Detalle de lotes</h3>
              </div>
            </div>
            {product.batches.length === 0 ? (
              <p className="product-detail-empty" role="status">
                No existen lotes registrados para este producto
              </p>
            ) : (
              <div className="product-table-wrap">
                <table className="product-table product-batch-table" aria-label="Lotes del producto">
                  <thead>
                    <tr>
                      <th scope="col">Código del lote</th>
                      <th scope="col">Fecha de caducidad</th>
                      <th scope="col">Cantidad disponible</th>
                      <th scope="col">Estado</th>
                      <th scope="col">Detalle</th>
                    </tr>
                  </thead>
                  <tbody>
                    {product.batches.map((batch) => {
                      const expired = batch.expirationStatus === 'EXPIRED';
                      return (
                        <tr key={batch.id}>
                          <td><span className="code-pill">{batch.code}</span></td>
                          <td><time dateTime={batch.expirationDate}>{batch.expirationDate}</time></td>
                          <td>{batch.availableQuantity}</td>
                          <td>
                            <span className={`tag ${expired ? 'tag-red' : 'tag-green'}`}>
                              {expired ? 'Caducado' : 'No caducado'}
                            </span>
                          </td>
                          <td><Link className="button button--ghost button--small" to={`/inventory/batches/${batch.id}`}>Ver lote</Link></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}
    </section>
  );
}
