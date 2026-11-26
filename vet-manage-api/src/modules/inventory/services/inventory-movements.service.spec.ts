import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Logger } from '@nestjs/common';
import { InventoryMovementsService } from './inventory-movements.service.js';

const batchId = '123e4567-e89b-42d3-a456-426614174000';
const userId = '123e4567-e89b-42d3-a456-426614174001';
const input = { batchId, quantity: 3, reason: 'Daño', observation: 'Envase roto' };

function setup(availableQuantity = 20, stock = 30) {
  const batch = { id: batchId, productId: 'product-1', availableQuantity, product: { isActive: true } };
  const movement = {
    id: 'movement-1', loteId: batchId, tipo: 'BAJA', cantidad: input.quantity,
    saldoAnterior: availableQuantity, saldoResultante: availableQuantity - input.quantity,
    motivo: input.reason, observacion: input.observation, usuarioId: userId,
    fechaHora: new Date('2026-11-26T15:00:00.000Z'),
    lote: { id: batchId, code: 'LOT-001', product: { id: 'product-1', code: 'PR-001', name: 'Alimento' } },
    usuario: { id: userId, person: { firstName: 'Bodeguero', lastName: 'Prueba' } },
  };
  const tx = {
    batch: {
      findUnique: vi.fn().mockResolvedValue(batch),
      updateManyAndReturn: vi.fn().mockResolvedValue([{ ...batch, availableQuantity: movement.saldoResultante }]),
    },
    product: {
      updateManyAndReturn: vi.fn().mockResolvedValue([{ id: 'product-1', stock: stock - input.quantity }]),
    },
    movimientoInventario: {
      create: vi.fn().mockResolvedValue(movement),
      findMany: vi.fn().mockResolvedValue([movement]),
      count: vi.fn().mockResolvedValue(1),
    },
  };
  const prisma = { $transaction: vi.fn((callback) => callback(tx)) };
  return { service: new InventoryMovementsService(prisma as never), prisma, tx, movement };
}

describe('InventoryMovementsService (HU-19a)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
  });

  it('descuenta del lote y del producto y registra el movimiento con el usuario autenticado', async () => {
    const { service, tx } = setup();
    const result = await service.registerWriteOff(input, userId);

    expect(result.batch).toMatchObject({ id: batchId, availableQuantity: 17 });
    expect(result.product).toEqual({ id: 'product-1', stock: 27 });
    expect(result.movement).toMatchObject({
      type: 'BAJA', quantity: 3, reason: 'Daño', observation: 'Envase roto',
      previousBalance: 20, resultingBalance: 17, occurredAt: '2026-11-26T15:00:00.000Z',
      user: { id: userId, firstName: 'Bodeguero', lastName: 'Prueba' },
      batch: { id: batchId, code: 'LOT-001', product: { id: 'product-1', code: 'PR-001', name: 'Alimento' } },
    });
    expect(tx.movimientoInventario.create).toHaveBeenCalledWith(expect.objectContaining({ data: {
      loteId: batchId, tipo: 'BAJA', cantidad: 3, motivo: 'Daño', observacion: 'Envase roto',
      saldoAnterior: 20, saldoResultante: 17, usuarioId: userId,
    } }));
    expect(tx.batch.updateManyAndReturn).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: batchId, availableQuantity: { gte: 3 }, product: { isActive: true } },
      data: { availableQuantity: { decrement: 3 } },
    }));
    expect(tx.product.updateManyAndReturn).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'product-1', stock: { gte: 3 }, isActive: true }, data: { stock: { decrement: 3 } },
    }));
  });

  it('registra una pérdida sin observación', async () => {
    const { service, tx, movement } = setup(8, 8);
    tx.movimientoInventario.create.mockResolvedValue({
      ...movement, cantidad: 2, motivo: 'Pérdida', observacion: null, saldoAnterior: 8, saldoResultante: 6,
    });
    tx.batch.updateManyAndReturn.mockResolvedValue([{ id: batchId, productId: 'product-1', availableQuantity: 6 }]);
    tx.product.updateManyAndReturn.mockResolvedValue([{ id: 'product-1', stock: 6 }]);

    const result = await service.registerWriteOff({ batchId, quantity: 2, reason: 'Pérdida' }, userId);

    expect(result.movement).toMatchObject({ reason: 'Pérdida', observation: null, previousBalance: 8, resultingBalance: 6 });
  });

  it('rechaza datos inválidos antes de abrir una transacción', async () => {
    const { service, prisma } = setup();
    await expect(service.registerWriteOff({ ...input, quantity: 0 }, userId)).rejects.toMatchObject({ statusCode: 400 });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rechaza un lote inexistente sin intentar descontar', async () => {
    const { service, tx } = setup();
    tx.batch.findUnique.mockResolvedValue(null);
    await expect(service.registerWriteOff(input, userId)).rejects.toMatchObject({ statusCode: 404 });
    expect(tx.batch.updateManyAndReturn).not.toHaveBeenCalled();
  });

  it('rechaza un producto inactivo', async () => {
    const { service, tx } = setup();
    tx.batch.findUnique.mockResolvedValue({ id: batchId, productId: 'product-1', availableQuantity: 20, product: { isActive: false } });
    await expect(service.registerWriteOff(input, userId)).rejects.toMatchObject({ statusCode: 409 });
    expect(tx.movimientoInventario.create).not.toHaveBeenCalled();
  });

  it('rechaza un lote sin unidades disponibles', async () => {
    const { service, tx } = setup(0);
    await expect(service.registerWriteOff(input, userId)).rejects.toMatchObject({ statusCode: 409, message: 'El lote no tiene unidades disponibles' });
    expect(tx.batch.updateManyAndReturn).not.toHaveBeenCalled();
  });

  it('rechaza una cantidad mayor que las existencias', async () => {
    const { service, tx } = setup(4);
    await expect(service.registerWriteOff({ ...input, quantity: 6 }, userId)).rejects.toMatchObject({ statusCode: 409 });
    expect(tx.movimientoInventario.create).not.toHaveBeenCalled();
  });

  it('rechaza una baja si otra operación consumió las unidades', async () => {
    const { service, tx } = setup();
    tx.batch.updateManyAndReturn.mockResolvedValue([]);
    await expect(service.registerWriteOff(input, userId)).rejects.toMatchObject({ statusCode: 409 });
    expect(tx.product.updateManyAndReturn).not.toHaveBeenCalled();
    expect(tx.movimientoInventario.create).not.toHaveBeenCalled();
  });

  it('no registra un movimiento si el total del producto no permite el descuento', async () => {
    const { service, tx } = setup();
    tx.product.updateManyAndReturn.mockResolvedValue([]);
    await expect(service.registerWriteOff(input, userId)).rejects.toMatchObject({ statusCode: 409 });
    expect(tx.movimientoInventario.create).not.toHaveBeenCalled();
  });

  it('devuelve un error controlado cuando falla el registro dentro de la transacción', async () => {
    const { service, tx } = setup();
    tx.movimientoInventario.create.mockRejectedValue(new Error('fallo de escritura'));
    await expect(service.registerWriteOff(input, userId)).rejects.toMatchObject({ statusCode: 500, message: 'No se pudo registrar la baja' });
  });

  it('obtiene el saldo anterior a partir del descuento confirmado, no de una lectura anterior', async () => {
    const { service, tx } = setup();
    tx.batch.updateManyAndReturn.mockResolvedValue([{ id: batchId, productId: 'product-1', availableQuantity: 12 }]);
    await service.registerWriteOff(input, userId);
    expect(tx.movimientoInventario.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ saldoAnterior: 15, saldoResultante: 12 }),
    }));
  });

  it('consulta el historial paginado por lote con los datos de trazabilidad', async () => {
    const { service, tx } = setup();
    const result = await service.listMovements({ batchId, page: 2, pageSize: 5 });
    expect(tx.movimientoInventario.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { loteId: batchId }, skip: 5, take: 5, orderBy: [{ fechaHora: 'desc' }, { id: 'desc' }],
    }));
    expect(result).toMatchObject({ page: 2, pageSize: 5, total: 1, totalPages: 1 });
    expect(result.items[0]).toMatchObject({ batch: { product: { name: 'Alimento' } }, user: { id: userId } });
    expect(tx.batch.updateManyAndReturn).not.toHaveBeenCalled();
  });

  it('devuelve un historial vacío sin cambiar existencias', async () => {
    const { service, tx } = setup();
    tx.movimientoInventario.findMany.mockResolvedValue([]);
    tx.movimientoInventario.count.mockResolvedValue(0);
    await expect(service.listMovements({})).resolves.toEqual({ items: [], page: 1, pageSize: 20, total: 0, totalPages: 0 });
    expect(tx.batch.updateManyAndReturn).not.toHaveBeenCalled();
  });

  it('rechaza una página cuyo desplazamiento excede el límite de Prisma', async () => {
    const { service, prisma } = setup();
    await expect(service.listMovements({ page: 2_147_483_647, pageSize: 100 }))
      .rejects.toMatchObject({ statusCode: 400 });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
