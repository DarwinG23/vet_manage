import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext } from '../../auth/auth-context';
import { RequirePermission } from '../../auth/components/require-permission';
import { inventoryApi } from '../services/inventory-api';
import type { InventoryMovementsPage as MovementsPage } from '../types';
import { InventoryMovementsPage } from './inventory-movements-page';

vi.mock('../services/inventory-api', () => ({ inventoryApi: { listMovements: vi.fn() } }));
const page: MovementsPage = {
  page: 1, pageSize: 20, total: 1, totalPages: 1,
  items: [{
    id: 'movement-1', type: 'BAJA', quantity: 3, reason: 'Daño', observation: 'Envase roto',
    previousBalance: 20, resultingBalance: 17, occurredAt: '2026-11-26T15:00:00Z',
    batch: { id: 'batch-1', code: 'LOT-001', product: { id: 'product-1', code: 'PR-001', name: 'Alimento para perro' } },
    user: { id: 'user-1', firstName: 'Elías', lastName: 'Poma' },
  }],
};

function renderPage(allowed = true) {
  return render(<MemoryRouter><AuthContext.Provider value={{ status: 'authenticated', session: null, login: vi.fn(), logout: vi.fn(), hasPermission: () => allowed }}>
    <RequirePermission permission="inventory:read-reports"><InventoryMovementsPage /></RequirePermission>
  </AuthContext.Provider></MemoryRouter>);
}

describe('Historial de bajas HU-19a', () => {
  beforeEach(() => { vi.resetAllMocks(); vi.mocked(inventoryApi.listMovements).mockResolvedValue(page); });

  it('muestra producto, lote, tipo, cantidad, motivo, observación, saldos, fecha/hora y responsable', async () => {
    renderPage();
    const table = await screen.findByRole('table');
    for (const text of ['Alimento para perro', 'LOT-001', 'Baja', '3', 'Daño', 'Envase roto', '20', '17', 'Elías Poma']) {
      expect(within(table).getByText(text)).toBeInTheDocument();
    }
    expect(table.querySelector('time')).toHaveAttribute('datetime', '2026-11-26T15:00:00Z');
    expect(screen.getByRole('link', { name: 'LOT-001' })).toHaveAttribute('href', '/inventory/batches/batch-1');
    expect(screen.getByRole('button', { name: 'Anterior' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Siguiente' })).toBeDisabled();
  });

  it('muestra Sin observación si el movimiento no la tiene', async () => {
    vi.mocked(inventoryApi.listMovements).mockResolvedValue({ ...page, items: [{ ...page.items[0], observation: null }] });
    renderPage(); await screen.findByText('Sin observación');
  });

  it('informa cuando no hay movimientos', async () => {
    vi.mocked(inventoryApi.listMovements).mockResolvedValue({ ...page, items: [], total: 0, totalPages: 0 });
    renderPage(); await screen.findByText('No existen movimientos registrados');
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('permite reintentar después de un fallo sin presentar el historial como vacío', async () => {
    vi.mocked(inventoryApi.listMovements).mockRejectedValueOnce(new Error('sin conexión'));
    const user = userEvent.setup(); renderPage();
    await screen.findByText('No se pudo cargar el historial');
    expect(screen.queryByText('No existen movimientos registrados')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Reintentar' }));
    await screen.findByText('Envase roto');
  });

  it('consulta la siguiente página y permite volver a la anterior', async () => {
    vi.mocked(inventoryApi.listMovements).mockResolvedValueOnce({ ...page, total: 21, totalPages: 2 })
      .mockResolvedValueOnce({ ...page, page: 2, total: 21, totalPages: 2 })
      .mockResolvedValueOnce({ ...page, total: 21, totalPages: 2 });
    const user = userEvent.setup(); renderPage();
    await screen.findByText('Página 1 de 2');
    await user.click(screen.getByRole('button', { name: 'Siguiente' }));
    await screen.findByText('Página 2 de 2');
    expect(inventoryApi.listMovements).toHaveBeenLastCalledWith(2);
    await user.click(screen.getByRole('button', { name: 'Anterior' }));
    await screen.findByText('Página 1 de 2');
    expect(inventoryApi.listMovements).toHaveBeenLastCalledWith(1);
  });

  it('actualiza el historial desde el servidor', async () => {
    const user = userEvent.setup(); renderPage(); await screen.findByText('Envase roto');
    await user.click(screen.getByRole('button', { name: 'Actualizar historial' }));
    await screen.findByText('Envase roto');
    expect(inventoryApi.listMovements).toHaveBeenCalledTimes(2);
  });

  it('no consulta información sin permiso', () => {
    renderPage(false);
    expect(screen.getByRole('alert')).toHaveTextContent('No tiene permisos para realizar esta acción');
    expect(inventoryApi.listMovements).not.toHaveBeenCalled();
  });
});
