import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../infrastructure/api/http-client';
import { purchaseOrdersApi } from '../services/purchase-orders-api';
import type { PurchaseOrder } from '../types';
import { PurchaseOrderDetailPage } from './purchase-order-detail-page';

vi.mock('../services/purchase-orders-api', () => ({ purchaseOrdersApi: { list: vi.fn(), get: vi.fn(), create: vi.fn() } }));

const order: PurchaseOrder = {
  id: 'order-1', number: 1, code: 'OC-000001', orderDate: '2026-11-26T15:00:00.000Z', status: 'PENDING', total: '137.30',
  supplier: { id: 's-1', businessName: 'Distribuidora Vet', ruc: '0012345678001' },
  items: [
    { id: 'i-1', product: { id: 'p-1', code: 'PR-001', name: 'Alimento para perro' }, quantity: 10, unitPrice: '12.50', subtotal: '125.00' },
    { id: 'i-2', product: { id: 'p-2', code: 'PR-002', name: 'Shampoo' }, quantity: 3, unitPrice: '4.10', subtotal: '12.30' },
  ],
};

const renderDetail = () => render(
  <MemoryRouter initialEntries={['/inventory/purchase-orders/order-1']}>
    <Routes><Route path="/inventory/purchase-orders/:id" element={<PurchaseOrderDetailPage />} /></Routes>
  </MemoryRouter>,
);

describe('PurchaseOrderDetailPage (HU-27)', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('escenario 3: muestra número, fecha, proveedor, productos, cantidades, precios, total y estado', async () => {
    vi.mocked(purchaseOrdersApi.get).mockResolvedValue(order);
    renderDetail();

    expect(await screen.findByRole('heading', { name: 'Orden de compra OC-000001' })).toBeInTheDocument();
    expect(purchaseOrdersApi.get).toHaveBeenCalledWith('order-1');
    expect(screen.getByText('Distribuidora Vet')).toBeInTheDocument();
    expect(screen.getByText(/2026/)).toBeInTheDocument();
    expect(screen.getAllByText('Pendiente').length).toBeGreaterThan(0);
    expect(screen.getByText('Alimento para perro')).toBeInTheDocument();
    expect(screen.getByText('Shampoo')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText(/12,50/)).toBeInTheDocument();
    expect(screen.getByText(/137,30/)).toBeInTheDocument();
  });

  it('informa cuando la orden no existe', async () => {
    vi.mocked(purchaseOrdersApi.get).mockRejectedValue(new ApiError('Orden de compra no encontrada', 404));
    renderDetail();

    expect(await screen.findByRole('alert')).toHaveTextContent('Orden de compra no encontrada');
  });
});
