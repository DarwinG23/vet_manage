import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastContext } from '../../../common/components/toast-context';
import { ApiError } from '../../../infrastructure/api/http-client';
import { inventoryApi } from '../../inventory/services/inventory-api';
import type { Product } from '../../inventory/types';
import { suppliersApi } from '../../suppliers/services/suppliers-api';
import { purchaseOrdersApi } from '../services/purchase-orders-api';
import type { PurchaseOrder } from '../types';
import { PurchaseOrderFormPage } from './purchase-order-form-page';

vi.mock('../services/purchase-orders-api', () => ({ purchaseOrdersApi: { list: vi.fn(), get: vi.fn(), create: vi.fn() } }));
vi.mock('../../suppliers/services/suppliers-api', () => ({ suppliersApi: { list: vi.fn() } }));
vi.mock('../../inventory/services/inventory-api', () => ({ inventoryApi: { listProducts: vi.fn() } }));

const supplier = { id: 's-1', businessName: 'Distribuidora Vet', ruc: '0012345678001', isActive: true, createdAt: '', updatedAt: '' };
const product = (id: string, code: string, name: string, unitPrice: string): Product => ({
  id, code, name, unitPrice, description: null, stock: 0, minimumStock: null,
  category: { id: 'c-1', name: 'Alimentos' }, brand: { id: 'b-1', name: 'Dog Chow' }, createdAt: '',
});
const created: PurchaseOrder = {
  id: 'order-1', number: 1, code: 'OC-000001', orderDate: '2026-11-26T15:00:00.000Z', status: 'PENDING', total: '137.30',
  supplier: { id: 's-1', businessName: 'Distribuidora Vet', ruc: '0012345678001' }, items: [],
};

function renderForm() {
  const showToast = vi.fn();
  render(
    <ToastContext.Provider value={{ showToast, dismissToast: vi.fn(), confirm: vi.fn(async () => true) }}>
      <MemoryRouter initialEntries={['/inventory/purchase-orders/new']}>
        <Routes>
          <Route path="/inventory/purchase-orders/new" element={<PurchaseOrderFormPage />} />
          <Route path="/inventory/purchase-orders/:id" element={<h2>Detalle de la orden</h2>} />
        </Routes>
      </MemoryRouter>
    </ToastContext.Provider>,
  );
  return { showToast };
}

async function ready() {
  await screen.findByLabelText(/^proveedor/i, { selector: 'select' });
}

describe('PurchaseOrderFormPage (HU-27)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(suppliersApi.list).mockResolvedValue({ items: [supplier], page: 1, pageSize: 100, total: 1, totalPages: 1 });
    vi.mocked(inventoryApi.listProducts).mockResolvedValue([
      product('p-1', 'PR-001', 'Alimento para perro', '25.50'),
      product('p-2', 'PR-002', 'Shampoo', '8.00'),
    ]);
    vi.mocked(purchaseOrdersApi.create).mockResolvedValue(created);
  });

  it('solo pide proveedores activos al cargar', async () => {
    renderForm();
    await ready();
    expect(suppliersApi.list).toHaveBeenCalledWith(expect.objectContaining({ status: 'ACTIVE' }));
  });

  it('escenario 1: guarda la orden con proveedor, productos, cantidades y precios, mostrando el total', async () => {
    const { showToast } = renderForm();
    await ready();

    await userEvent.selectOptions(screen.getByLabelText(/^proveedor/i, { selector: 'select' }), 's-1');
    await userEvent.selectOptions(screen.getByLabelText(/^producto 1/i), 'p-1');
    await userEvent.type(screen.getByLabelText('Cantidad del producto 1'), '10');
    const price1 = screen.getByLabelText('Precio unitario del producto 1');
    expect(price1).toHaveValue('25.50');
    await userEvent.clear(price1);
    await userEvent.type(price1, '12.50');

    await userEvent.click(screen.getByRole('button', { name: /agregar producto/i }));
    await userEvent.selectOptions(screen.getByLabelText(/^producto 2/i), 'p-2');
    await userEvent.type(screen.getByLabelText('Cantidad del producto 2'), '3');
    await userEvent.clear(screen.getByLabelText('Precio unitario del producto 2'));
    await userEvent.type(screen.getByLabelText('Precio unitario del producto 2'), '4.10');

    expect(within(screen.getByText('Total de la orden').parentElement!).getByText(/137,30/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /guardar orden/i }));

    expect(purchaseOrdersApi.create).toHaveBeenCalledWith({
      supplierId: 's-1',
      items: [{ productId: 'p-1', quantity: 10, unitPrice: '12.50' }, { productId: 'p-2', quantity: 3, unitPrice: '4.10' }],
    });
    expect(showToast).toHaveBeenCalledWith('Orden de compra OC-000001 registrada correctamente', 'success');
    expect(await screen.findByText('Detalle de la orden')).toBeInTheDocument();
  });

  it('escenario 2: sin proveedor ni producto no envía e indica qué corregir', async () => {
    renderForm();
    await ready();

    await userEvent.click(screen.getByRole('button', { name: /quitar producto 1/i }));
    await userEvent.click(screen.getByRole('button', { name: /guardar orden/i }));

    expect(screen.getByText('Debe seleccionar un proveedor')).toBeInTheDocument();
    expect(screen.getByText('Debe agregar al menos un producto')).toBeInTheDocument();
    expect(purchaseOrdersApi.create).not.toHaveBeenCalled();
  });

  it.each([
    ['0', 'La cantidad debe ser un número entero mayor que cero'],
    ['2.5', 'La cantidad debe ser un número entero mayor que cero'],
    ['abc', 'La cantidad debe ser un número entero mayor que cero'],
  ])('escenario 2: rechaza la cantidad %s', async (quantity, message) => {
    renderForm();
    await ready();
    await userEvent.selectOptions(screen.getByLabelText(/^proveedor/i, { selector: 'select' }), 's-1');
    await userEvent.selectOptions(screen.getByLabelText(/^producto 1/i), 'p-1');
    await userEvent.type(screen.getByLabelText('Cantidad del producto 1'), quantity);
    await userEvent.click(screen.getByRole('button', { name: /guardar orden/i }));

    expect(screen.getByText(message)).toBeInTheDocument();
    expect(purchaseOrdersApi.create).not.toHaveBeenCalled();
  });

  it('escenario 2: rechaza un precio igual a cero', async () => {
    renderForm();
    await ready();
    await userEvent.selectOptions(screen.getByLabelText(/^proveedor/i, { selector: 'select' }), 's-1');
    await userEvent.selectOptions(screen.getByLabelText(/^producto 1/i), 'p-1');
    await userEvent.type(screen.getByLabelText('Cantidad del producto 1'), '5');
    await userEvent.clear(screen.getByLabelText('Precio unitario del producto 1'));
    await userEvent.type(screen.getByLabelText('Precio unitario del producto 1'), '0');
    await userEvent.click(screen.getByRole('button', { name: /guardar orden/i }));

    expect(screen.getByText('El precio unitario debe ser mayor que cero')).toBeInTheDocument();
    expect(purchaseOrdersApi.create).not.toHaveBeenCalled();
  });

  it('escenario 2: muestra el rechazo de la API junto al proveedor', async () => {
    vi.mocked(purchaseOrdersApi.create).mockRejectedValue(new ApiError('El proveedor seleccionado está inactivo', 409));
    const { showToast } = renderForm();
    await ready();
    await userEvent.selectOptions(screen.getByLabelText(/^proveedor/i, { selector: 'select' }), 's-1');
    await userEvent.selectOptions(screen.getByLabelText(/^producto 1/i), 'p-1');
    await userEvent.type(screen.getByLabelText('Cantidad del producto 1'), '5');
    await userEvent.click(screen.getByRole('button', { name: /guardar orden/i }));

    await waitFor(() => expect(showToast).toHaveBeenCalledWith('El proveedor seleccionado está inactivo', 'error'));
    expect(screen.getAllByText('El proveedor seleccionado está inactivo').length).toBeGreaterThan(0);
  });
});
