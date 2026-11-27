import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { GlobalExceptionFilter } from '../../src/common/errors/global-exception.filter.js';
import configuration from '../../src/config/configuration.js';
import { PrismaModule } from '../../src/infrastructure/database/prisma/prisma.module.js';
import { PrismaService } from '../../src/infrastructure/database/prisma/prisma.service.js';
import { AccessService } from '../../src/modules/identity/services/access.service.js';
import { TokenService } from '../../src/modules/identity/services/token.service.js';
import { InventoryModule } from '../../src/modules/inventory/inventory.module.js';

let sequence = 0;
const unique = () => `${Date.now()}${sequence++}`;
const testPermissions = new Set<string>();
const actor = { id: '', personId: '' };

describe('Ajuste manual de existencias por lote (HU-11, e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let categoryId: string;
  let brandId: string;
  let productId: string;
  let batchId: string;
  let otherBatchId: string;

  const tokens = { verify: vi.fn(async () => actor.id) };
  const access = {
    findActiveUser: vi.fn(async () => ({ ...actor })),
    getPermissionKeys: vi.fn(async () => testPermissions),
  };

  const postAdjustment = (body: unknown, token = 'valid') => {
    const call = request(app.getHttpServer()).post(`/inventory/batches/${batchId}/adjustments`);
    return token ? call.set('Authorization', `Bearer ${token}`).send(body as object) : call.send(body as object);
  };
  const getHistory = (token = 'valid') => {
    const call = request(app.getHttpServer()).get(`/inventory/batches/${batchId}/movements`);
    return token ? call.set('Authorization', `Bearer ${token}`) : call;
  };

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.DATABASE_URL ||= 'postgresql://vetmanage:vetmanage_dev_password@localhost:55432/vet_manage?schema=public';
    process.env.JWT_SECRET ||= 'secret-for-testing-only-at-least-32-chars-long';

    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true, load: [configuration] }), PrismaModule, InventoryModule],
    })
      .overrideProvider(TokenService).useValue(tokens)
      .overrideProvider(AccessService).useValue(access)
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalFilters(new GlobalExceptionFilter());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
    await app.init();
    prisma = app.get(PrismaService);
    await prisma.$connect();

    const suffix = unique();
    const person = await prisma.person.create({
      data: { identification: `98${suffix.slice(-8)}`, firstName: 'Ana', lastName: 'Bodega', email: `hu11.${suffix}@test.local` },
    });
    actor.personId = person.id;
    actor.id = (await prisma.user.create({
      data: { personId: person.id, status: 'ACTIVE', password: 'not-used', mustChangePassword: false },
    })).id;
    categoryId = (await prisma.category.create({ data: { name: `HU11 categoría ${suffix}` } })).id;
    brandId = (await prisma.marca.create({ data: { name: `HU11 marca ${suffix}` } })).id;
    const product = await prisma.product.create({
      data: {
        code: `HU11-${suffix}`,
        name: 'Producto de prueba HU-11',
        unitPrice: '10.00',
        categoryId,
        brandId,
        stock: 30,
      },
    });
    productId = product.id;
    batchId = (await prisma.batch.create({
      data: {
        productId,
        code: `HU11-A-${suffix}`,
        expirationDate: new Date('2030-01-01T00:00:00.000Z'),
        initialQuantity: 20,
        availableQuantity: 20,
      },
    })).id;
    otherBatchId = (await prisma.batch.create({
      data: {
        productId,
        code: `HU11-B-${suffix}`,
        expirationDate: new Date('2030-02-01T00:00:00.000Z'),
        initialQuantity: 10,
        availableQuantity: 10,
      },
    })).id;
  });

  beforeEach(async () => {
    testPermissions.clear();
    testPermissions.add('inventory:read');
    testPermissions.add('inventory:adjust-stock');
    if (prisma && batchId) {
      await prisma.inventoryMovement.deleteMany({ where: { batchId } });
      await prisma.batch.update({ where: { id: batchId }, data: { availableQuantity: 20 } });
      await prisma.batch.update({ where: { id: otherBatchId }, data: { availableQuantity: 10 } });
      await prisma.product.update({ where: { id: productId }, data: { stock: 30 } });
    }
  });

  afterAll(async () => {
    if (prisma) {
      if (batchId) await prisma.inventoryMovement.deleteMany({ where: { batchId } });
      if (productId) await prisma.batch.deleteMany({ where: { productId } });
      if (productId) await prisma.product.deleteMany({ where: { id: productId } });
      if (categoryId) await prisma.category.deleteMany({ where: { id: categoryId } });
      if (brandId) await prisma.marca.deleteMany({ where: { id: brandId } });
      if (actor.id) await prisma.user.deleteMany({ where: { id: actor.id } });
      if (actor.personId) await prisma.person.deleteMany({ where: { id: actor.personId } });
    }
    await app?.close();
  });

  it('ajusta el lote, actualiza el total del producto y muestra el actor en el historial', async () => {
    const response = await postAdjustment({ newQuantity: 18, reason: 'Diferencia detectada en conteo físico' }).expect(201);

    expect(response.body.data).toMatchObject({
      batchId,
      type: 'AJUSTE',
      quantity: -2,
      stockBefore: 20,
      stockAfter: 18,
      reason: 'Diferencia detectada en conteo físico',
      userId: actor.id,
      productStock: 28,
    });
    expect((await prisma.batch.findUniqueOrThrow({ where: { id: batchId } })).availableQuantity).toBe(18);
    expect((await prisma.batch.findUniqueOrThrow({ where: { id: otherBatchId } })).availableQuantity).toBe(10);
    expect((await prisma.product.findUniqueOrThrow({ where: { id: productId } })).stock).toBe(28);

    const history = await getHistory().expect(200);
    expect(history.body.data[0]).toMatchObject({
      type: 'AJUSTE', quantity: -2, stockBefore: 20, stockAfter: 18,
      reason: 'Diferencia detectada en conteo físico', userName: 'Ana Bodega',
    });
  });

  it.each([
    ['negative balance', { newQuantity: -3, reason: 'Conteo' }],
    ['decimal balance', { newQuantity: 5.5, reason: 'Conteo' }],
    ['text balance', { newQuantity: 'abc', reason: 'Conteo' }],
    ['missing balance', { newQuantity: '', reason: 'Conteo' }],
    ['missing reason', { newQuantity: 18, reason: ' ' }],
    ['numeric-only reason', { newQuantity: 18, reason: '12345' }],
  ])('rejects a %s without changing either stock or movement history', async (_scenario, body) => {
    await postAdjustment(body).expect(400);

    expect((await prisma.batch.findUniqueOrThrow({ where: { id: batchId } })).availableQuantity).toBe(20);
    expect((await prisma.product.findUniqueOrThrow({ where: { id: productId } })).stock).toBe(30);
    expect(await prisma.inventoryMovement.count({ where: { batchId } })).toBe(0);
  });

  it('allows zero and keeps lot balance and product total consistent', async () => {
    const response = await postAdjustment({ newQuantity: 0, reason: 'Conteo físico sin unidades' }).expect(201);

    expect(response.body.data).toMatchObject({ quantity: -20, stockBefore: 20, stockAfter: 0, productStock: 10 });
    expect((await prisma.batch.findUniqueOrThrow({ where: { id: batchId } })).availableQuantity).toBe(0);
    expect((await prisma.product.findUniqueOrThrow({ where: { id: productId } })).stock).toBe(10);
  });

  it('requires authentication and the adjustment permission, while history needs only inventory:read', async () => {
    await postAdjustment({ newQuantity: 18, reason: 'Conteo' }, '').expect(401);

    testPermissions.delete('inventory:adjust-stock');
    await postAdjustment({ newQuantity: 18, reason: 'Conteo' }).expect(403);
    await getHistory().expect(200);
    expect(await prisma.inventoryMovement.count({ where: { batchId } })).toBe(0);
  });
});
