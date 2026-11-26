import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '../../../generated/prisma/client.js';
import type { CreatePurchaseOrderData } from '../repositories/purchase-orders.repository.js';
import { PURCHASE_ORDER_MESSAGES as M } from './purchase-order-input.js';
import { PurchaseOrdersService } from './purchase-orders.service.js';

const SUPPLIER = '123e4567-e89b-12d3-a456-426614174000';
const INACTIVE_SUPPLIER = '123e4567-e89b-12d3-a456-426614174009';
const PRODUCT_A = '123e4567-e89b-12d3-a456-426614174001';
const PRODUCT_B = '123e4567-e89b-12d3-a456-426614174002';
const ORDER_DATE = new Date('2026-11-26T15:00:00.000Z');

const supplierInfo = { id: SUPPLIER, businessName: 'Distribuidora Vet', ruc: '0012345678001' };
const productInfo: Record<string, { id: string; code: string; name: string }> = {
  [PRODUCT_A]: { id: PRODUCT_A, code: 'PR-001', name: 'Alimento para perro' },
  [PRODUCT_B]: { id: PRODUCT_B, code: 'PR-002', name: 'Shampoo' },
};

function build() {
  const repository = {
    findSupplier: vi.fn(async (id: string) =>
      id === SUPPLIER ? { id, isActive: true } : id === INACTIVE_SUPPLIER ? { id, isActive: false } : null),
    findActiveProductIds: vi.fn(async (ids: string[]) => new Set(ids.filter((id) => id in productInfo))),
    create: vi.fn(async (data: CreatePurchaseOrderData) => ({
      id: 'order-1',
      number: 7,
      orderDate: ORDER_DATE,
      status: 'PENDING' as const,
      total: new Prisma.Decimal(data.total),
      supplier: supplierInfo,
      items: data.items.map((item, index) => ({
        id: `item-${index + 1}`,
        quantity: item.quantity,
        unitPrice: new Prisma.Decimal(item.unitPrice),
        subtotal: new Prisma.Decimal(item.subtotal),
        product: productInfo[item.productId],
      })),
    })),
    findById: vi.fn(),
    findMany: vi.fn(),
    hasPendingOrders: vi.fn(async () => true),
  };
  return { repository, service: new PurchaseOrdersService(repository as never) };
}

const order = {
  supplierId: SUPPLIER,
  items: [
    { productId: PRODUCT_A, quantity: 10, unitPrice: '12.50' },
    { productId: PRODUCT_B, quantity: 3, unitPrice: '4.10' },
  ],
};

describe('PurchaseOrdersService (HU-27)', () => {
  let ctx: ReturnType<typeof build>;
  beforeEach(() => { ctx = build(); });

  it('escenario 1: guarda la orden pendiente con número, fecha, productos y total calculado', async () => {
    const result = await ctx.service.create(order);

    expect(ctx.repository.create).toHaveBeenCalledWith({
      supplierId: SUPPLIER,
      total: '137.30',
      items: [
        { productId: PRODUCT_A, quantity: 10, unitPrice: '12.50', subtotal: '125.00' },
        { productId: PRODUCT_B, quantity: 3, unitPrice: '4.10', subtotal: '12.30' },
      ],
    });
    expect(result).toMatchObject({
      number: 7,
      code: 'OC-000007',
      orderDate: ORDER_DATE.toISOString(),
      status: 'PENDING',
      total: '137.30',
      supplier: supplierInfo,
    });
    expect(result.items.map(({ product, quantity, unitPrice, subtotal }) => [product.code, quantity, unitPrice, subtotal]))
      .toEqual([['PR-001', 10, '12.50', '125.00'], ['PR-002', 3, '4.10', '12.30']]);
  });

  it('escenario 2: con datos inválidos no consulta ni guarda nada', async () => {
    await expect(ctx.service.create({ supplierId: SUPPLIER, items: [] }))
      .rejects.toMatchObject({ statusCode: 400, message: M.itemsRequired });
    expect(ctx.repository.findSupplier).not.toHaveBeenCalled();
    expect(ctx.repository.create).not.toHaveBeenCalled();
  });

  it('escenario 2: rechaza un proveedor inexistente o inactivo', async () => {
    await expect(ctx.service.create({ ...order, supplierId: '123e4567-e89b-12d3-a456-426614174999' }))
      .rejects.toMatchObject({ statusCode: 404, message: M.supplierNotFound });
    await expect(ctx.service.create({ ...order, supplierId: INACTIVE_SUPPLIER }))
      .rejects.toMatchObject({ statusCode: 409, message: M.supplierInactive });
    expect(ctx.repository.create).not.toHaveBeenCalled();
  });

  it('escenario 2: indica qué producto no existe o está inactivo', async () => {
    const missing = '123e4567-e89b-12d3-a456-426614174888';
    await expect(ctx.service.create({ ...order, items: [order.items[0], { productId: missing, quantity: 1, unitPrice: 1 }] }))
      .rejects.toMatchObject({ statusCode: 400, message: M.productUnavailable(2) });
    expect(ctx.repository.create).not.toHaveBeenCalled();
  });

  it('escenario 3: consulta una orden existente y devuelve 404 si no existe', async () => {
    const created = await ctx.service.create(order);
    ctx.repository.findById.mockImplementation(async () => ctx.repository.create.mock.results[0].value);

    await expect(ctx.service.findById('order-1')).resolves.toEqual(created);
    ctx.repository.findById.mockResolvedValue(null);
    await expect(ctx.service.findById('order-2')).rejects.toMatchObject({ statusCode: 404, message: 'Orden de compra no encontrada' });
  });

  it('lista las órdenes paginadas con su resumen', async () => {
    ctx.repository.findMany.mockResolvedValue({
      orders: [{
        id: 'order-1', number: 7, orderDate: ORDER_DATE, status: 'PENDING', total: new Prisma.Decimal('137.3'),
        supplier: supplierInfo, _count: { items: 2 },
      }],
      total: 21,
    });

    const result = await ctx.service.list({ page: 2, pageSize: 20 });

    expect(result).toEqual({
      items: [{ id: 'order-1', number: 7, code: 'OC-000007', orderDate: ORDER_DATE.toISOString(), status: 'PENDING', total: '137.30', supplier: supplierInfo, itemsCount: 2 }],
      page: 2, pageSize: 20, total: 21, totalPages: 2,
    });
  });

  it('expone si un proveedor tiene órdenes pendientes (integración con HU-26)', async () => {
    await expect(ctx.service.hasPendingOrders(SUPPLIER)).resolves.toBe(true);
    expect(ctx.repository.hasPendingOrders).toHaveBeenCalledWith(SUPPLIER);
  });
});
