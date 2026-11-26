import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '../../../common/components/toast';
import { ApiError } from '../../../infrastructure/api/http-client';
import { AuthContext } from '../../auth/auth-context';
import { RequirePermission } from '../../auth/components/require-permission';
import { inventoryApi } from '../services/inventory-api';
import type { BatchWriteOffResult, ProductDetail } from '../types';
import { BatchWriteOffPage } from './batch-write-off-page';

vi.mock('../services/inventory-api', () => ({ inventoryApi: {
  listProducts: vi.fn(), getProduct: vi.fn(), registerBatchWriteOff: vi.fn(),
} }));

const product: ProductDetail = {
  id: 'product-1', code: 'PR-001', name: 'Alimento para perro', description: 'Alimento de prueba',
  unitPrice: '10', stock: 20, minimumStock: null,
  category: { id: 'category-1', name: 'Alimentos' }, brand: { id: 'brand-1', name: 'Prueba' }, createdAt: '2026-11-26',
  batches: [
    { id: 'batch-1', code: 'LOT-001', expirationDate: '2027-12-31', availableQuantity: 20, expirationStatus: 'NOT_EXPIRED' },
    { id: 'batch-empty', code: 'LOT-VACIO', expirationDate: '2027-12-31', availableQuantity: 0, expirationStatus: 'NOT_EXPIRED' },
  ],
};
const second: ProductDetail = { ...product, id: 'product-2', code: 'PR-002', name: 'Vitaminas', batches: [
  { ...product.batches[0], id: 'batch-2', code: 'LOT-002' },
] };
const result: BatchWriteOffResult = {
  batch: { id: 'batch-1', productId: product.id, availableQuantity: 17 }, product: { id: product.id, stock: 17 },
  movement: {
    id: 'movement-1', type: 'BAJA', quantity: 3, reason: 'Daño', observation: 'Envase roto',
    previousBalance: 20, resultingBalance: 17, occurredAt: '2026-11-26T15:00:00Z',
    batch: { id: 'batch-1', code: 'LOT-001', product: { id: product.id, code: product.code, name: product.name } },
    user: { id: 'user-1', firstName: 'Bodeguero', lastName: 'Prueba' },
  },
};

function renderPage(allowed = true) {
  return render(
    <MemoryRouter initialEntries={['/inventory/write-offs/new']}>
      <AuthContext.Provider value={{ status: 'authenticated', session: null, login: vi.fn(), logout: vi.fn(), hasPermission: () => allowed }}>
        <ToastProvider>
          <Routes>
            <Route path="/inventory/write-offs/new" element={<RequirePermission permission="inventory:register-exit"><BatchWriteOffPage /></RequirePermission>} />
            <Route path="/inventory/products" element={<><h2>Catálogo de productos</h2><Link to="/inventory/write-offs/new">Volver al registro de baja</Link></>} />
          </Routes>
        </ToastProvider>
      </AuthContext.Provider>
    </MemoryRouter>,
  );
}

async function fill(user: ReturnType<typeof userEvent.setup>, { quantity = '3', reason = 'Daño', observation = 'Envase roto', batchId = 'batch-1' } = {}) {
  await user.selectOptions(await screen.findByRole('combobox', { name: 'Producto' }), product.id);
  await screen.findByRole('option', { name: /LOT-001/ });
  await user.selectOptions(screen.getByRole('combobox', { name: 'Lote' }), batchId);
  if (quantity) await user.type(screen.getByRole('textbox', { name: 'Cantidad' }), quantity);
  if (reason) await user.selectOptions(screen.getByRole('combobox', { name: 'Motivo' }), reason);
  if (observation) await user.type(screen.getByRole('textbox', { name: 'Observación' }), observation);
}

describe('Registro de baja HU-19a', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(inventoryApi.listProducts).mockResolvedValue([product, second]);
    vi.mocked(inventoryApi.getProduct).mockImplementation(async (id) => id === second.id ? second : product);
    vi.mocked(inventoryApi.registerBatchWriteOff).mockResolvedValue(result);
  });

  it('confirma daño, envía la baja y actualiza saldos sin recargar la página', async () => {
    const user = userEvent.setup();
    renderPage();
    await fill(user);
    await user.click(screen.getByRole('button', { name: 'Registrar baja' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).getByText(/El saldo del lote pasará de 20 a 17 unidades/)).toBeInTheDocument();
    expect(inventoryApi.registerBatchWriteOff).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole('button', { name: 'Confirmar baja' }));
    await screen.findByText(/Se retiraron 3 unidades del lote/);
    expect(inventoryApi.registerBatchWriteOff).toHaveBeenCalledExactlyOnceWith({ batchId: 'batch-1', quantity: 3, reason: 'Daño', observation: 'Envase roto' });
    expect(screen.getByRole('option', { name: 'LOT-001 · 17 unidades disponibles' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Cantidad' })).toHaveValue('');
    expect(screen.getByRole('textbox', { name: 'Observación' })).toHaveValue('');
    expect(inventoryApi.getProduct).toHaveBeenCalledTimes(1);
  });

  it('registra una pérdida de 2 unidades sobre 8 sin observación', async () => {
    vi.mocked(inventoryApi.getProduct).mockResolvedValue({ ...product, stock: 8, batches: [{ ...product.batches[0], availableQuantity: 8 }] });
    vi.mocked(inventoryApi.registerBatchWriteOff).mockResolvedValue({
      ...result, batch: { ...result.batch, availableQuantity: 6 }, product: { ...result.product, stock: 6 },
      movement: { ...result.movement, quantity: 2, reason: 'Pérdida', observation: null, previousBalance: 8, resultingBalance: 6 },
    });
    const user = userEvent.setup(); renderPage();
    await fill(user, { quantity: '2', reason: 'Pérdida', observation: '' });
    await user.click(screen.getByRole('button', { name: 'Registrar baja' }));
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Confirmar baja' }));
    await screen.findByText(/Se retiraron 2 unidades del lote/);
    expect(inventoryApi.registerBatchWriteOff).toHaveBeenCalledExactlyOnceWith({ batchId: 'batch-1', quantity: 2, reason: 'Pérdida' });
    expect(screen.getByRole('option', { name: 'LOT-001 · 6 unidades disponibles' })).toBeInTheDocument();
  });

  it.each(['0', '-2', '1.5', 'abc', '3.0', '2147483648'])('rechaza la cantidad %s antes de confirmar', async (quantity) => {
    const user = userEvent.setup(); renderPage();
    await fill(user, { quantity });
    await user.click(screen.getByRole('button', { name: 'Registrar baja' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('La cantidad debe ser un número entero mayor que cero');
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(inventoryApi.registerBatchWriteOff).not.toHaveBeenCalled();
  });

  it('identifica los datos obligatorios incompletos', async () => {
    const user = userEvent.setup(); renderPage();
    await user.click(await screen.findByRole('button', { name: 'Registrar baja' }));
    expect(screen.getByText('Debe seleccionar un producto')).toBeInTheDocument();
    expect(screen.getByText('Debe seleccionar un lote válido')).toBeInTheDocument();
    expect(screen.getByText('Debe seleccionar el motivo Daño o Pérdida')).toBeInTheDocument();
    expect(inventoryApi.registerBatchWriteOff).not.toHaveBeenCalled();
  });

  it('rechaza cantidades que superan el lote', async () => {
    const user = userEvent.setup(); renderPage(); await fill(user, { quantity: '21' });
    await user.click(screen.getByRole('button', { name: 'Registrar baja' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('La cantidad solicitada supera las existencias disponibles');
    expect(inventoryApi.registerBatchWriteOff).not.toHaveBeenCalled();
  });

  it('informa que un lote no tiene unidades y bloquea su baja', async () => {
    const user = userEvent.setup(); renderPage(); await fill(user, { batchId: 'batch-empty', quantity: '1' });
    await user.click(screen.getByRole('button', { name: 'Registrar baja' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('El lote no tiene unidades disponibles');
    expect(inventoryApi.registerBatchWriteOff).not.toHaveBeenCalled();
  });

  it('cancelar la confirmación no envía la baja y Cancelar descarta el formulario', async () => {
    const user = userEvent.setup(); renderPage(); await fill(user);
    await user.click(screen.getByRole('button', { name: 'Registrar baja' }));
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'No' }));
    expect(inventoryApi.registerBatchWriteOff).not.toHaveBeenCalled();
    await user.click(screen.getByRole('link', { name: 'Cancelar' }));
    await screen.findByRole('heading', { name: 'Catálogo de productos' });
    await user.click(screen.getByRole('link', { name: 'Volver al registro de baja' }));
    expect(await screen.findByRole('combobox', { name: 'Producto' })).toHaveValue('');
    expect(screen.getByRole('textbox', { name: 'Cantidad' })).toHaveValue('');
    expect(inventoryApi.registerBatchWriteOff).not.toHaveBeenCalled();
  });

  it('impide envíos duplicados mientras se procesa la confirmación', async () => {
    let finish!: (value: BatchWriteOffResult) => void;
    vi.mocked(inventoryApi.registerBatchWriteOff).mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    const user = userEvent.setup(); renderPage(); await fill(user);
    await user.dblClick(screen.getByRole('button', { name: 'Registrar baja' }));
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Confirmar baja' }));
    expect(await screen.findByRole('button', { name: 'Registrando…' })).toBeDisabled();
    expect(screen.getByRole('textbox', { name: 'Cantidad' })).toBeDisabled();
    expect(inventoryApi.registerBatchWriteOff).toHaveBeenCalledTimes(1);
    await act(async () => finish(result));
    await screen.findByText(/Se retiraron 3 unidades del lote/);
  });

  it('conserva los datos cuando falla la operación y vuelve a consultar el saldo', async () => {
    vi.mocked(inventoryApi.registerBatchWriteOff).mockRejectedValue(new ApiError('No se pudo registrar la baja', 500));
    const user = userEvent.setup(); renderPage(); await fill(user);
    await user.click(screen.getByRole('button', { name: 'Registrar baja' }));
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Confirmar baja' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo registrar la baja');
    expect(screen.getByRole('textbox', { name: 'Cantidad' })).toHaveValue('3');
    expect(screen.getByRole('textbox', { name: 'Observación' })).toHaveValue('Envase roto');
    await waitFor(() => expect(inventoryApi.getProduct).toHaveBeenCalledTimes(2));
    expect(screen.queryByText('Baja registrada correctamente')).not.toBeInTheDocument();
  });

  it('actualiza las existencias cuando el servidor rechaza un saldo que cambió', async () => {
    vi.mocked(inventoryApi.registerBatchWriteOff).mockRejectedValue(new ApiError('La cantidad solicitada supera las existencias disponibles', 409));
    vi.mocked(inventoryApi.getProduct).mockResolvedValueOnce(product).mockResolvedValueOnce({ ...product, stock: 5, batches: [{ ...product.batches[0], availableQuantity: 5 }] });
    const user = userEvent.setup(); renderPage(); await fill(user, { quantity: '15' });
    await user.click(screen.getByRole('button', { name: 'Registrar baja' }));
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Confirmar baja' }));
    await screen.findByRole('option', { name: 'LOT-001 · 5 unidades disponibles' });
    expect(screen.getByRole('alert')).toHaveTextContent('La cantidad solicitada supera las existencias disponibles');
  });

  it('permite reintentar la carga de lotes después de un error', async () => {
    vi.mocked(inventoryApi.getProduct).mockRejectedValueOnce(new Error('sin conexión'));
    const user = userEvent.setup(); renderPage();
    await user.selectOptions(await screen.findByRole('combobox', { name: 'Producto' }), product.id);
    await screen.findByText('No se pudieron cargar los lotes.');
    await user.click(screen.getByRole('button', { name: 'Reintentar' }));
    await screen.findByRole('option', { name: /LOT-001/ });
  });

  it('ignora una respuesta vieja al seleccionar otro producto', async () => {
    let finishFirst!: (value: ProductDetail) => void;
    vi.mocked(inventoryApi.getProduct).mockReturnValueOnce(new Promise((resolve) => { finishFirst = resolve; })).mockResolvedValueOnce(second);
    const user = userEvent.setup(); renderPage();
    const select = await screen.findByRole('combobox', { name: 'Producto' });
    await user.selectOptions(select, product.id);
    await user.selectOptions(select, second.id);
    await screen.findByRole('option', { name: /LOT-002/ });
    await act(async () => finishFirst(product));
    expect(screen.queryByRole('option', { name: /LOT-001/ })).not.toBeInTheDocument();
    expect(select).toHaveValue(second.id);
  });

  it('permite reintentar la carga inicial de productos', async () => {
    vi.mocked(inventoryApi.listProducts).mockRejectedValueOnce(new Error('sin conexión'));
    const user = userEvent.setup(); renderPage();
    await screen.findByText('No se pudieron cargar los productos');
    await user.click(screen.getByRole('button', { name: 'Reintentar' }));
    await screen.findByRole('combobox', { name: 'Producto' });
  });

  it('distingue el catálogo vacío de un fallo de conexión', async () => {
    vi.mocked(inventoryApi.listProducts).mockResolvedValue([]);
    renderPage();
    await screen.findByText('No hay productos registrados para seleccionar un lote.');
    expect(screen.queryByRole('button', { name: 'Registrar baja' })).not.toBeInTheDocument();
  });

  it('muestra que un producto no tiene lotes', async () => {
    vi.mocked(inventoryApi.getProduct).mockResolvedValue({ ...product, batches: [] });
    const user = userEvent.setup(); renderPage();
    await user.selectOptions(await screen.findByRole('combobox', { name: 'Producto' }), product.id);
    await screen.findByText('Este producto no tiene lotes registrados.');
    expect(inventoryApi.registerBatchWriteOff).not.toHaveBeenCalled();
  });

  it('restringe la página antes de cargar datos si falta el permiso', async () => {
    renderPage(false);
    expect(screen.getByRole('alert')).toHaveTextContent('No tiene permisos para realizar esta acción');
    expect(inventoryApi.listProducts).not.toHaveBeenCalled();
  });
});
