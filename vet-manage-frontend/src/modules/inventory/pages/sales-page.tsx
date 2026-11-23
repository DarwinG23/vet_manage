import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useToast } from '../../../common/components/toast-context';
import { useAuth } from '../../auth/auth-context';
import { inventoryApi } from '../services/inventory-api';
import type { Product, Sale } from '../types';
import './sales-page.css';

type CartLine = { product: Product; quantity: string };

const money = (value: string | number) => `$${Number(value).toFixed(2)}`;

export function SalesPage({ historyOnly = false }: { historyOnly?: boolean }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { showToast } = useToast();
  const { hasPermission } = useAuth();
  const canCreate = hasPermission('inventory:register-exit');
  const canRead = hasPermission('inventory:read');

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      canCreate && !historyOnly ? inventoryApi.listProducts(search) : Promise.resolve([]),
      canRead ? inventoryApi.listSales() : Promise.resolve([]),
    ]).then(([loadedProducts, loadedSales]) => {
      if (!cancelled) {
        setProducts(loadedProducts);
        setSales(loadedSales);
        setLoading(false);
      }
    }).catch((cause) => {
      if (!cancelled) {
        setLoading(false);
        showToast(cause instanceof Error ? cause.message : 'No se pudo cargar la información de ventas.', 'error');
      }
    });
    return () => { cancelled = true; };
  }, [canCreate, canRead, historyOnly, search, showToast]);

  const total = useMemo(() => cart.reduce((sum, line) => sum + Number(line.product.unitPrice) * Number(line.quantity || 0), 0), [cart]);

  const addProduct = (product: Product) => {
    setCart((current) => current.some((line) => line.product.id === product.id)
      ? current
      : [...current, { product, quantity: '1' }]);
  };

  const confirmSale = async (event: React.FormEvent) => {
    event.preventDefault();
    const invalid = cart.find((line) => !/^\d+$/.test(line.quantity) || Number(line.quantity) <= 0);
    if (invalid) {
      showToast('La cantidad debe ser un número entero mayor que cero.', 'error');
      return;
    }
    const overStock = cart.find((line) => Number(line.quantity) > line.product.stock);
    if (overStock) {
      showToast(`Stock insuficiente: solo hay ${overStock.product.stock} unidades disponibles de ${overStock.product.name}`, 'error');
      return;
    }
    setSaving(true);
    try {
      const created = await inventoryApi.createSale({ items: cart.map((line) => ({ productId: line.product.id, quantity: Number(line.quantity) })) });
      showToast(`Venta registrada por ${money(created.total)}. Existencias actualizadas.`, 'success');
      setCart([]);
      setSales((current) => [created, ...current]);
      setProducts((current) => current.map((product) => {
        const line = cart.find((item) => item.product.id === product.id);
        return line ? { ...product, stock: product.stock - Number(line.quantity) } : product;
      }));
    } catch (cause) {
      showToast(cause instanceof Error ? cause.message : 'No se pudo registrar la venta.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="sales-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">Tienda · Ventas</span>
          <h2>{historyOnly ? 'Historial de ventas' : 'Registrar venta'}</h2>
          <p>{historyOnly ? 'Consulta el detalle de cada venta confirmada y su movimiento de existencias.' : 'Agrega productos, revisa el total y confirma el cobro cuando todo esté correcto.'}</p>
        </div>
        {!historyOnly && canRead && <Link className="button button--ghost" to="/inventory/sales">Ver historial</Link>}
        {historyOnly && canCreate && <Link className="button button--primary" to="/inventory/sales/new">＋ Nueva venta</Link>}
      </div>

      {!historyOnly && canCreate && (
        <div className="sales-layout">
          <div className="sales-catalog">
            <div className="sales-section-heading"><div><span className="eyebrow">Paso 1</span><h3>Elige productos</h3></div><span className="sales-helper">Solo se muestran productos activos</span></div>
            <form className="sales-search" onSubmit={(event) => event.preventDefault()} role="search">
              <label className="search-field"><span aria-hidden="true">⌕</span><input aria-label="Buscar productos para vender" value={search} onChange={(event) => { setLoading(true); setSearch(event.target.value); }} placeholder="Busca por código o nombre" /></label>
            </form>
            <div className="sales-product-grid">
              {loading && <div className="empty-state" role="status">Cargando productos…</div>}
              {!loading && products.length === 0 && <div className="empty-state"><strong>No hay productos para mostrar</strong><span>Revisa el catálogo o cambia tu búsqueda.</span></div>}
              {!loading && products.map((product) => {
                const inCart = cart.some((line) => line.product.id === product.id);
                return <button className={`sales-product-card${inCart ? ' sales-product-card--selected' : ''}`} type="button" key={product.id} onClick={() => addProduct(product)} disabled={product.stock === 0 || inCart}>
                  <span className="sales-product-card__code">{product.code}</span><strong>{product.name}</strong><span className="sales-product-card__meta">{money(product.unitPrice)} · {product.stock} disponibles</span><span className="sales-product-card__action">{product.stock === 0 ? 'Sin existencias' : inCart ? 'Agregado' : '＋ Agregar'}</span>
                </button>;
              })}
            </div>
          </div>
          <form className="sales-cart" onSubmit={confirmSale}>
            <div className="sales-section-heading"><div><span className="eyebrow">Paso 2</span><h3>Revisa la venta</h3></div><span className="sales-cart-count">{cart.length} {cart.length === 1 ? 'producto' : 'productos'}</span></div>
            {cart.length === 0 ? <div className="sales-cart-empty"><span className="sales-cart-empty__icon">＋</span><strong>Tu venta está vacía</strong><span>Selecciona un producto para empezar.</span></div> : <div className="sales-cart-lines">{cart.map((line) => <div className="sales-cart-line" key={line.product.id}><div><strong>{line.product.name}</strong><small>{money(line.product.unitPrice)} por unidad · {line.product.stock} disponibles</small></div><label><span>Cantidad</span><input aria-label={`Cantidad de ${line.product.name}`} inputMode="numeric" value={line.quantity} onChange={(event) => setCart((current) => current.map((item) => item.product.id === line.product.id ? { ...item, quantity: event.target.value } : item))} /></label><strong className="sales-cart-line__subtotal">{money(Number(line.product.unitPrice) * Number(line.quantity || 0))}</strong><button className="sales-remove" type="button" aria-label={`Quitar ${line.product.name}`} onClick={() => setCart((current) => current.filter((item) => item.product.id !== line.product.id))}>×</button></div>)}</div>}
            <div className="sales-total"><span>Total a cobrar</span><strong>{money(total)}</strong></div>
            <button className="button button--primary sales-confirm" type="submit" disabled={saving || cart.length === 0}>{saving ? 'Registrando…' : 'Confirmar venta'}</button>
            <p className="sales-safe-note">Al confirmar, se guardan el precio cobrado, el lote y el movimiento de existencias.</p>
          </form>
        </div>
      )}

      {historyOnly && <div className="sales-history-card">{loading && <div className="empty-state" role="status">Cargando historial…</div>}{!loading && sales.length === 0 && <div className="empty-state"><strong>Aún no hay ventas</strong><span>Las ventas confirmadas aparecerán aquí.</span></div>}{!loading && sales.length > 0 && <div className="sales-history-list">{sales.map((sale) => <article className="sales-history-item" key={sale.id}><div><strong>Venta {sale.id.slice(0, 8).toUpperCase()}</strong><span>{new Date(sale.createdAt).toLocaleString('es-EC')} · {sale.cashier}</span></div><div><span>{sale.items.reduce((count, item) => count + item.quantity, 0)} unidades</span><strong>{money(sale.total)}</strong></div><details><summary>Ver detalle</summary><ul>{sale.items.map((item) => <li key={item.id}>{item.productName} · {item.quantity} × {money(item.unitPrice)} · lote {item.batchCode}</li>)}</ul></details></article>)}</div>}</div>}
    </section>
  );
}
