import { Logger } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { randomUUID } from 'node:crypto';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaClient } from '../../src/generated/prisma/client.js';
import { InventoryMovementsService } from '../../src/modules/inventory/services/inventory-movements.service.js';
import { InventoryService } from '../../src/modules/inventory/services/inventory.service.js';

// Solo se ejecuta con una URL explícita de pruebas; nunca toma DATABASE_URL de la aplicación.
const connectionString = process.env.INVENTORY_TEST_DATABASE_URL;

describe.skipIf(!connectionString)('HU-19a con PostgreSQL real', () => {
  let prisma: PrismaClient;
  let service: InventoryMovementsService;
  let categoryId: string;
  let brandId: string;
  let userId: string;
  let personId: string;
  let productId: string;
  let batchId: string;
  const prefix = 'HU19a-' + randomUUID();

  beforeAll(async () => {
    if (!connectionString || !new URL(connectionString).pathname.includes('test')) {
      throw new Error('INVENTORY_TEST_DATABASE_URL debe apuntar a una base de pruebas');
    }
    prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
    service = new InventoryMovementsService(prisma as never);
    categoryId = (await prisma.category.create({ data: { name: prefix } })).id;
    brandId = (await prisma.marca.create({ data: { name: prefix } })).id;
    const person = await prisma.person.create({ data: {
      identification: randomUUID().replaceAll('-', '').slice(0, 10),
      firstName: 'Bodeguero', lastName: 'HU19a', email: prefix + '@test.local',
      user: { create: {} },
    }, include: { user: true } });
    personId = person.id;
    userId = person.user!.id;
  });

  beforeEach(async () => {
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
    const product = await prisma.product.create({ data: {
      code: randomUUID(), name: prefix, description: 'Producto exclusivo de prueba',
      unitPrice: '10.00', categoryId, brandId, stock: 20,
      batches: { create: {
        code: 'LOT-HU19a', expirationDate: new Date('2027-12-31'), initialQuantity: 20, availableQuantity: 20,
      } },
    }, include: { batches: true } });
    productId = product.id;
    batchId = product.batches[0].id;
  });

  afterEach(async () => {
    if (productId) {
      await prisma.movimientoInventario.deleteMany({ where: { lote: { productId } } });
      await prisma.batch.deleteMany({ where: { productId } });
      await prisma.product.delete({ where: { id: productId } });
    }
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    if (!prisma) return;
    if (userId) await prisma.user.delete({ where: { id: userId } });
    if (personId) await prisma.person.delete({ where: { id: personId } });
    if (categoryId) await prisma.category.delete({ where: { id: categoryId } });
    if (brandId) await prisma.marca.delete({ where: { id: brandId } });
    await prisma.$disconnect();
  });

  async function balances() {
    const batch = await prisma.batch.findUniqueOrThrow({ where: { id: batchId } });
    const product = await prisma.product.findUniqueOrThrow({ where: { id: productId } });
    const movements = await prisma.movimientoInventario.findMany({ where: { loteId: batchId } });
    return { batch: batch.availableQuantity, initialQuantity: batch.initialQuantity, stock: product.stock, movements };
  }

  it('daño: descuenta 20 → 17, conserva la entrada inicial y persiste toda la trazabilidad', async () => {
    await service.registerWriteOff({ batchId, quantity: 3, reason: 'Daño', observation: 'Envase roto' }, userId);
    const state = await balances();
    expect(state).toMatchObject({ batch: 17, stock: 17, initialQuantity: 20 });
    expect(state.movements).toHaveLength(1);
    expect(state.movements[0]).toMatchObject({
      loteId: batchId, usuarioId: userId, tipo: 'BAJA', cantidad: 3,
      motivo: 'Daño', observacion: 'Envase roto', saldoAnterior: 20, saldoResultante: 17,
    });
    const history = await service.listMovements({ batchId });
    expect(history.items[0]).toMatchObject({
      batch: { product: { id: productId } }, user: { id: userId, firstName: 'Bodeguero' },
      occurredAt: expect.any(String),
    });
  });

  it('pérdida: descuenta 8 → 6 sin exigir observación', async () => {
    await prisma.batch.update({ where: { id: batchId }, data: { availableQuantity: 8 } });
    await prisma.product.update({ where: { id: productId }, data: { stock: 8 } });
    await service.registerWriteOff({ batchId, quantity: 2, reason: 'Pérdida' }, userId);
    expect(await balances()).toMatchObject({ batch: 6, stock: 6, movements: [{ motivo: 'Pérdida', observacion: null }] });
  });

  it('la consulta de existencias HU-20 refleja las unidades retiradas del producto y lote', async () => {
    await service.registerWriteOff({ batchId, quantity: 3, reason: 'Daño' }, userId);
    const inventory = new InventoryService(prisma as never);
    const product = await inventory.getProduct(productId);
    expect(product.stock).toBe(17);
    expect(product.batches).toEqual([expect.objectContaining({ id: batchId, availableQuantity: 17 })]);
  });

  it('permite retirar exactamente el saldo disponible y luego rechaza el lote vacío', async () => {
    await service.registerWriteOff({ batchId, quantity: 20, reason: 'Daño' }, userId);
    await expect(service.registerWriteOff({ batchId, quantity: 1, reason: 'Daño' }, userId))
      .rejects.toMatchObject({ statusCode: 409, message: 'El lote no tiene unidades disponibles' });
    expect(await balances()).toMatchObject({ batch: 0, stock: 0, movements: [{ cantidad: 20 }] });
  });

  it('rechaza una baja superior al saldo sin registrar movimientos', async () => {
    await prisma.batch.update({ where: { id: batchId }, data: { availableQuantity: 4 } });
    await prisma.product.update({ where: { id: productId }, data: { stock: 4 } });
    await expect(service.registerWriteOff({ batchId, quantity: 6, reason: 'Daño' }, userId)).rejects.toMatchObject({ statusCode: 409 });
    expect(await balances()).toMatchObject({ batch: 4, stock: 4, movements: [] });
  });

  it('rechaza entradas inválidas, datos incompletos y Vencimiento sin modificar datos', async () => {
    for (const input of [
      { batchId, quantity: 0, reason: 'Daño' },
      { batchId, quantity: -1, reason: 'Daño' },
      { batchId, quantity: 1.5, reason: 'Daño' },
      { batchId, quantity: 'abc', reason: 'Daño' },
      { batchId, quantity: 1 },
      { quantity: 1, reason: 'Daño' },
      { batchId, quantity: 1, reason: 'Vencimiento' },
    ]) {
      await expect(service.registerWriteOff(input, userId)).rejects.toMatchObject({ statusCode: 400 });
    }
    expect(await balances()).toMatchObject({ batch: 20, stock: 20, movements: [] });
  });

  it('revierte ambos descuentos cuando falla la FK del usuario al guardar el movimiento', async () => {
    await expect(service.registerWriteOff({ batchId, quantity: 3, reason: 'Daño' }, randomUUID()))
      .rejects.toMatchObject({ statusCode: 500, message: 'No se pudo registrar la baja' });
    expect(await balances()).toMatchObject({ batch: 20, stock: 20, movements: [] });
  });

  it('revierte el descuento del lote cuando el stock total no permite la baja', async () => {
    await prisma.product.update({ where: { id: productId }, data: { stock: 1 } });
    await expect(service.registerWriteOff({ batchId, quantity: 3, reason: 'Daño' }, userId)).rejects.toMatchObject({ statusCode: 409 });
    expect(await balances()).toMatchObject({ batch: 20, stock: 1, movements: [] });
  });

  it('dos bajas simultáneas no consumen más unidades que las disponibles', async () => {
    const results = await Promise.allSettled([
      service.registerWriteOff({ batchId, quantity: 15, reason: 'Daño' }, userId),
      service.registerWriteOff({ batchId, quantity: 15, reason: 'Pérdida' }, userId),
    ]);
    expect(results.filter(({ status }) => status === 'fulfilled')).toHaveLength(1);
    expect(results.filter(({ status }) => status === 'rejected')).toHaveLength(1);
    expect(await balances()).toMatchObject({ batch: 5, stock: 5, movements: [{ saldoAnterior: 20, saldoResultante: 5 }] });
  });

  it('dos bajas simultáneas válidas conservan una cadena coherente de saldos', async () => {
    await Promise.all([
      service.registerWriteOff({ batchId, quantity: 3, reason: 'Daño' }, userId),
      service.registerWriteOff({ batchId, quantity: 4, reason: 'Pérdida' }, userId),
    ]);
    const state = await balances();
    expect(state).toMatchObject({ batch: 13, stock: 13 });
    const ordered = state.movements.sort((a, b) => b.saldoAnterior - a.saldoAnterior);
    expect(ordered).toHaveLength(2);
    expect(ordered[0].saldoAnterior).toBe(20);
    expect(ordered[0].saldoResultante).toBe(ordered[1].saldoAnterior);
    expect(ordered[1].saldoResultante).toBe(13);
  });

  it('bajas concurrentes de distintos lotes protegen el stock compartido del producto', async () => {
    const other = await prisma.batch.create({ data: {
      productId, code: 'LOT-OTHER', expirationDate: new Date('2027-12-31'), initialQuantity: 20, availableQuantity: 20,
    } });
    // Simula un total legado insuficiente: una operación debe fallar y revertir su lote.
    const results = await Promise.allSettled([
      service.registerWriteOff({ batchId, quantity: 15, reason: 'Daño' }, userId),
      service.registerWriteOff({ batchId: other.id, quantity: 15, reason: 'Pérdida' }, userId),
    ]);
    expect(results.filter(({ status }) => status === 'fulfilled')).toHaveLength(1);
    const product = await prisma.product.findUniqueOrThrow({ where: { id: productId } });
    const batches = await prisma.batch.findMany({ where: { productId } });
    expect(product.stock).toBe(5);
    expect(batches.map(({ availableQuantity }) => availableQuantity).sort((a, b) => a - b)).toEqual([5, 20]);
    expect(await prisma.movimientoInventario.count({ where: { lote: { productId } } })).toBe(1);
  });

  it('consultar sin confirmar una baja no cambia saldos ni crea movimientos', async () => {
    await expect(service.listMovements({ batchId })).resolves.toMatchObject({ items: [], total: 0 });
    expect(await balances()).toMatchObject({ batch: 20, stock: 20, movements: [] });
  });

  it('el historial respeta el lote, orden y paginación', async () => {
    await service.registerWriteOff({ batchId, quantity: 1, reason: 'Daño' }, userId);
    await service.registerWriteOff({ batchId, quantity: 2, reason: 'Pérdida' }, userId);
    const first = await service.listMovements({ batchId, page: 1, pageSize: 1 });
    const second = await service.listMovements({ batchId, page: 2, pageSize: 1 });
    expect(first).toMatchObject({ total: 2, totalPages: 2, items: [{ reason: 'Pérdida' }] });
    expect(second).toMatchObject({ total: 2, items: [{ reason: 'Daño' }] });
    expect((await service.listMovements({ batchId: randomUUID() })).total).toBe(0);
  });
});
