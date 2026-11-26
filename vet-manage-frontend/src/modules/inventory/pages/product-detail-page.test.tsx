import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastContext } from '../../../common/components/toast-context';
import { AuthContext } from '../../auth/auth-context';
import { RequirePermission } from '../../auth/components/require-permission';
import { inventoryApi } from '../services/inventory-api';
import type { ProductDetail } from '../types';
import { ProductDetailPage } from './product-detail-page';

vi.mock('../services/inventory-api', () => ({
  inventoryApi: { getProduct: vi.fn() },
}));

const showToast = vi.fn();

const product: ProductDetail = {
  id: 'product-1',
  code: 'PR-001',
  name: 'Alimento para perro',
  description: 'Saco de 15 kg',
  unitPrice: '25.50',
  stock: 15,
  minimumStock: 10,
  category: { id: 'category-1', name: 'Alimentos' },
  brand: { id: 'brand-1', name: 'Dog Chow' },
  createdAt: '2026-11-19T00:00:00.000Z',
  batches: [
    {
      id: 'batch-1',
      code: 'L-2026-001',
      expirationDate: '2027-10-23',
      availableQuantity: 10,
      expirationStatus: 'NOT_EXPIRED',
    },
    {
      id: 'batch-2',
      code: 'L-2026-002',
      expirationDate: '2026-11-18',
      availableQuantity: 5,
      expirationStatus: 'EXPIRED',
    },
  ],
};

type RenderOptions = {
  path?: string;
  permissions?: string[];
  allowProductNavigation?: boolean;
};

function renderPage({
  path = '/inventory/products/product-1',
  permissions = ['inventory:read'],
  allowProductNavigation = false,
}: RenderOptions = {}) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <ToastContext.Provider value={{ showToast, dismissToast: vi.fn(), confirm: vi.fn(async () => true) }}>
        <AuthContext.Provider value={{
          status: 'authenticated',
          session: null,
          login: vi.fn(),
          logout: vi.fn(),
          hasPermission: (permission) => permissions.includes(permission),
        }}>
          <Routes>
            <Route
              path="/inventory/products/:id"
              element={(
                <RequirePermission permission="inventory:read">
                  {allowProductNavigation && <Link to="/inventory/products/product-2">Abrir segundo producto</Link>}
                  <ProductDetailPage />
                </RequirePermission>
              )}
            />
          </Routes>
        </AuthContext.Provider>
      </ToastContext.Provider>
    </MemoryRouter>,
  );
}

function expectSummaryValue(label: string, value: string | number) {
  const term = screen.getByText(label);
  expect(term.parentElement).toHaveTextContent(new RegExp(`${label}${String(value)}`));
}

describe('ProductDetailPage inventory consultation (HU-20)', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(inventoryApi.getProduct).mockResolvedValue(product);
  });

  it('muestra nombre, categoría, los dos lotes, sus fechas, cantidades, total y stock mínimo', async () => {
    renderPage();

    expect(await screen.findByText(product.name)).toBeInTheDocument();
    expect(screen.getByText('Alimentos')).toBeInTheDocument();
    expectSummaryValue('Stock total', 15);
    expectSummaryValue('Stock mínimo', 10);
    expect(screen.getByRole('table', { name: 'Lotes del producto' })).toBeInTheDocument();
    expect(screen.getByText('L-2026-001')).toBeInTheDocument();
    expect(screen.getByText('L-2026-002')).toBeInTheDocument();
    expect(screen.getByText('2027-10-23')).toBeInTheDocument();
    expect(screen.getByText('2026-11-18')).toBeInTheDocument();
    expect(screen.getByRole('row', { name: /L-2026-001.*10/ })).toBeInTheDocument();
    expect(screen.getByRole('row', { name: /L-2026-002.*5/ })).toBeInTheDocument();
    expect(inventoryApi.getProduct).toHaveBeenCalledWith('product-1');
  });

  it('muestra stock cero y mínimo cero sin ocultar el lote de cantidad cero', async () => {
    vi.mocked(inventoryApi.getProduct).mockResolvedValue({
      ...product,
      stock: 0,
      minimumStock: 0,
      batches: [{
        id: 'batch-empty',
        code: 'L-EMPTY',
        expirationDate: '2027-01-01',
        availableQuantity: 0,
        expirationStatus: 'NOT_EXPIRED',
      }],
    });
    renderPage();

    await screen.findByText(product.name);

    expectSummaryValue('Stock total', 0);
    expectSummaryValue('Stock mínimo', 0);
    expect(screen.getByRole('row', { name: /L-EMPTY.*0/ })).toBeInTheDocument();
  });

  it('muestra el mínimo null como sin configurar y el mensaje exacto cuando no hay lotes', async () => {
    vi.mocked(inventoryApi.getProduct).mockResolvedValue({ ...product, minimumStock: null, batches: [] });
    renderPage();

    await screen.findByText(product.name);

    expectSummaryValue('Stock mínimo', 'Sin configurar');
    expect(screen.getByRole('status')).toHaveTextContent('No existen lotes registrados para este producto');
    expect(screen.queryByRole('table', { name: 'Lotes del producto' })).not.toBeInTheDocument();
  });

  it('marca como caducado solo el lote EXPIRED y conserva sus cinco unidades', async () => {
    renderPage();

    const expiredRow = await screen.findByRole('row', { name: /L-2026-002.*5.*Caducado/ });
    expect(expiredRow).toHaveTextContent('2026-11-18');
    expect(expiredRow).toHaveTextContent('5');
    expect(expiredRow).toHaveTextContent('Caducado');
    expect(screen.getByRole('row', { name: /L-2026-001.*No caducado/ })).toBeInTheDocument();
  });

  it('recupera el stock actualizado del servidor al actualizar la consulta', async () => {
    const user = userEvent.setup();
    vi.mocked(inventoryApi.getProduct)
      .mockResolvedValueOnce({ ...product, stock: 10, batches: [product.batches[0]] })
      .mockResolvedValueOnce(product);
    renderPage();

    await screen.findByText(product.name);
    expectSummaryValue('Stock total', 10);
    await user.click(screen.getByRole('button', { name: 'Actualizar existencias' }));

    await waitFor(() => expectSummaryValue('Stock total', 15));
    expect(inventoryApi.getProduct).toHaveBeenCalledTimes(2);
    expect(inventoryApi.getProduct).toHaveBeenNthCalledWith(1, 'product-1');
    expect(inventoryApi.getProduct).toHaveBeenNthCalledWith(2, 'product-1');
  });

  it('anuncia la carga inicial y separa el error del estado sin lotes', async () => {
    let resolveRequest!: (value: ProductDetail) => void;
    vi.mocked(inventoryApi.getProduct).mockImplementationOnce(() => new Promise((resolve) => {
      resolveRequest = resolve;
    }));
    renderPage();

    expect(screen.getByRole('status')).toHaveTextContent('Cargando existencias');
    expect(screen.queryByText('No existen lotes registrados para este producto')).not.toBeInTheDocument();

    await act(async () => resolveRequest(product));
    expect(await screen.findByText(product.name)).toBeInTheDocument();
  });

  it('permite reintentar tras un error y muestra los datos recuperados', async () => {
    const user = userEvent.setup();
    vi.mocked(inventoryApi.getProduct)
      .mockRejectedValueOnce(new Error('Sin conexión'))
      .mockResolvedValueOnce(product);
    renderPage();

    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudieron cargar las existencias');
    expect(screen.queryByText('No existen lotes registrados para este producto')).not.toBeInTheDocument();
    expect(showToast).toHaveBeenCalledWith('No se pudieron cargar las existencias del producto.', 'error');
    await user.click(screen.getByRole('button', { name: 'Reintentar' }));

    expect(await screen.findByText(product.name)).toBeInTheDocument();
    expect(inventoryApi.getProduct).toHaveBeenCalledTimes(2);
  });

  it('ignora una respuesta anterior si cambia el producto consultado', async () => {
    const user = userEvent.setup();
    let resolveFirst!: (value: ProductDetail) => void;
    let resolveSecond!: (value: ProductDetail) => void;
    vi.mocked(inventoryApi.getProduct)
      .mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve; }))
      .mockImplementationOnce(() => new Promise((resolve) => { resolveSecond = resolve; }));
    renderPage({ allowProductNavigation: true });

    await waitFor(() => expect(inventoryApi.getProduct).toHaveBeenCalledTimes(1));
    await user.click(screen.getByRole('link', { name: 'Abrir segundo producto' }));
    await waitFor(() => expect(inventoryApi.getProduct).toHaveBeenCalledTimes(2));

    await act(async () => resolveSecond({ ...product, id: 'product-2', name: 'Producto actualizado', stock: 15 }));
    expect(await screen.findByText('Producto actualizado')).toBeInTheDocument();
    await act(async () => resolveFirst({ ...product, name: 'Respuesta antigua', stock: 10 }));

    expect(screen.getByText('Producto actualizado')).toBeInTheDocument();
    expect(screen.queryByText('Respuesta antigua')).not.toBeInTheDocument();
    expectSummaryValue('Stock total', 15);
  });

  it('permite la consulta con inventory:read sin requerir permiso de edición', async () => {
    renderPage({ permissions: ['inventory:read'] });

    expect(await screen.findByText(product.name)).toBeInTheDocument();
    expect(inventoryApi.getProduct).toHaveBeenCalledWith('product-1');
  });

  it('rechaza la consulta cuando no se cuenta con inventory:read', () => {
    renderPage({ permissions: [] });

    expect(screen.getByRole('alert')).toHaveTextContent('No tiene permisos para realizar esta acción');
    expect(inventoryApi.getProduct).not.toHaveBeenCalled();
  });
});
