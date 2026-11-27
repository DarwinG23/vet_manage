import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastContext } from '../../../common/components/toast-context';
import { AuthContext } from '../../auth/auth-context';
import { inventoryApi } from '../services/inventory-api';
import type { BatchDetail, BatchInventoryMovement, BatchStockAdjustmentResult } from '../types';
import { BatchDetailPage } from './batch-detail-page';

vi.mock('../services/inventory-api', () => ({
  inventoryApi: {
    getBatch: vi.fn(),
    listBatchMovements: vi.fn(),
    adjustBatchStock: vi.fn(),
  },
}));

const showToast = vi.fn();

const batch: BatchDetail = {
  id: 'batch-1',
  productId: 'product-1',
  code: 'L-2026-001',
  expirationDate: '2027-10-23',
  initialQuantity: 25,
  availableQuantity: 20,
  product: { id: 'product-1', code: 'PR-001', name: 'Alimento para perro', stock: 30 },
};

const movement: BatchInventoryMovement = {
  id: 'movement-1',
  batchId: 'batch-1',
  type: 'AJUSTE',
  quantity: -2,
  stockBefore: 20,
  stockAfter: 18,
  reason: 'Diferencia detectada en conteo físico',
  occurredAt: '2026-11-26T12:00:00.000Z',
  userId: 'user-1',
  userName: 'Ana Pérez',
};

function renderPage(permissions = ['inventory:read']) {
  return render(
    <MemoryRouter initialEntries={['/inventory/batches/batch-1']}>
      <ToastContext.Provider value={{ showToast, dismissToast: vi.fn(), confirm: vi.fn(async () => true) }}>
        <AuthContext.Provider value={{
          status: 'authenticated',
          session: null,
          login: vi.fn(),
          logout: vi.fn(),
          hasPermission: (permission) => permissions.includes(permission),
        }}>
          <Routes>
            <Route path="/inventory/batches/:id" element={<BatchDetailPage />} />
          </Routes>
        </AuthContext.Provider>
      </ToastContext.Provider>
    </MemoryRouter>,
  );
}

describe('BatchDetailPage manual stock adjustment (HU-11)', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(inventoryApi.getBatch).mockResolvedValue(batch);
    vi.mocked(inventoryApi.listBatchMovements).mockResolvedValue([movement]);
  });

  it('shows lot and aggregate balances together with movement details and responsible user', async () => {
    renderPage();

    expect(await screen.findByText('L-2026-001')).toBeInTheDocument();
    expect(screen.getByRole('row', { name: /Unidades disponibles en el lote.*20/ })).toBeInTheDocument();
    expect(screen.getByRole('row', { name: /Stock total del producto.*30/ })).toBeInTheDocument();
    expect(screen.getByRole('table', { name: 'Historial de movimientos del lote' })).toBeInTheDocument();
    expect(screen.getByText('Diferencia detectada en conteo físico')).toBeInTheDocument();
    expect(screen.getByText('Ana Pérez')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Ajuste manual de existencias' })).not.toBeInTheDocument();
  });

  it('submits a lower physical count and refreshes the lot balance and history', async () => {
    const user = userEvent.setup();
    const result: BatchStockAdjustmentResult = {
      ...movement,
      stockBefore: 20,
      stockAfter: 18,
      quantity: -2,
      productStock: 28,
    };
    vi.mocked(inventoryApi.adjustBatchStock).mockResolvedValue(result);
    vi.mocked(inventoryApi.listBatchMovements).mockResolvedValueOnce([movement]).mockResolvedValueOnce([{
      ...result,
      userName: movement.userName,
    }]);
    renderPage(['inventory:read', 'inventory:adjust-stock']);

    const quantity = await screen.findByLabelText(/Nuevo saldo del lote/);
    await user.clear(quantity);
    await user.type(quantity, '18');
    await user.type(screen.getByLabelText(/Motivo del ajuste/), 'Diferencia detectada en conteo físico');
    expect(screen.getByRole('status')).toHaveTextContent('Diferencia que se registrará: -2 unidades');
    await user.click(screen.getByRole('button', { name: 'Confirmar ajuste' }));

    await waitFor(() => expect(inventoryApi.adjustBatchStock).toHaveBeenCalledWith('batch-1', {
      newQuantity: 18,
      reason: 'Diferencia detectada en conteo físico',
    }));
    expect(await screen.findByRole('row', { name: /Unidades disponibles en el lote.*18/ })).toBeInTheDocument();
    expect(screen.getByRole('row', { name: /Stock total del producto.*28/ })).toBeInTheDocument();
    expect(await screen.findByText('Ajuste manual')).toBeInTheDocument();
    expect(inventoryApi.listBatchMovements).toHaveBeenCalledTimes(2);
    expect(showToast).toHaveBeenCalledWith('Ajuste de existencias registrado correctamente.', 'success');
  });

  it.each([
    ['negative balance', '-3', 'Conteo físico', 'El saldo no puede ser negativo; ingresa un número entero mayor o igual a cero'],
    ['decimal balance', '5.5', 'Conteo físico', 'El saldo debe ser un número entero mayor o igual a cero, sin decimales'],
    ['text balance', 'abc', 'Conteo físico', 'Ingresa un número entero mayor o igual a cero; no se permiten letras'],
    ['missing reason', '18', '', 'Debe ingresar el motivo del ajuste'],
    ['numeric-only reason', '18', '12345', 'El motivo debe incluir letras, no solo números'],
  ])('rejects a %s without changing stock', async (_scenario, newQuantity, reason, message) => {
    const user = userEvent.setup();
    renderPage(['inventory:read', 'inventory:adjust-stock']);

    const quantity = await screen.findByLabelText(/Nuevo saldo del lote/);
    await user.clear(quantity);
    if (newQuantity) await user.type(quantity, newQuantity);
    if (reason) await user.type(screen.getByLabelText(/Motivo del ajuste/), reason);
    await user.click(screen.getByRole('button', { name: 'Confirmar ajuste' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(message);
    expect(inventoryApi.adjustBatchStock).not.toHaveBeenCalled();
    expect(within(screen.getByRole('row', { name: /Unidades disponibles en el lote/ })).getByText('20')).toBeInTheDocument();
  });

  it('shows the adjustment control only to users with inventory:adjust-stock', async () => {
    renderPage(['inventory:read']);

    await screen.findByText('L-2026-001');

    expect(screen.queryByRole('button', { name: 'Confirmar ajuste' })).not.toBeInTheDocument();
    expect(inventoryApi.getBatch).toHaveBeenCalledWith('batch-1');
  });

  it('distinguishes a sale movement that records product-wide stock from a lot adjustment', async () => {
    vi.mocked(inventoryApi.listBatchMovements).mockResolvedValue([
      {
        ...movement,
        id: 'sale-1',
        type: 'VENTA',
        quantity: 2,
        stockBefore: 30,
        stockAfter: 28,
        reason: 'Venta registrada',
      },
      movement,
    ]);
    renderPage();

    const saleRow = await screen.findByRole('row', { name: /Venta.*Producto.*30.*-2.*28/ });
    expect(saleRow).toHaveTextContent('Venta registrada');
    expect(screen.getByRole('row', { name: /Ajuste manual.*Lote.*20.*-2.*18/ })).toBeInTheDocument();
  });
});
