import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import configuration from '../../src/config/configuration.js';
import { GlobalExceptionFilter } from '../../src/common/errors/global-exception.filter.js';
import { InventoryModule } from '../../src/modules/inventory/inventory.module.js';
import { PrismaService } from '../../src/infrastructure/database/prisma/prisma.service.js';
import { AccessService } from '../../src/modules/identity/services/access.service.js';
import { TokenService } from '../../src/modules/identity/services/token.service.js';

const PRODUCT_ID = '123e4567-e89b-12d3-a456-426614174000';
const MISSING = '123e4567-e89b-12d3-a456-426614174999';

describe('PATCH /inventory/products/:id/minimum-stock (HU-03, e2e)', () => {
  let app: INestApplication;
  let permissions: Set<string>;
  let products: Array<{ id: string; minimumStock: number | null; isActive: boolean }>;

  const tokens = { verify: vi.fn(async () => 'user-1') };
  const access = {
    findActiveUser: vi.fn(async () => ({ id: 'user-1' })),
    getPermissionKeys: vi.fn(async () => permissions),
  };

  // Base de datos en memoria con la forma que usa InventoryService.
  const tx = {
    product: {
      findFirst: vi.fn(async ({ where }: { where: { id: string; isActive: boolean } }) => {
        const product = products.find((item) => item.id === where.id && item.isActive);
        return product ? { id: product.id, minimumStock: product.minimumStock } : null;
      }),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: { minimumStock: number } }) => {
        const product = products.find((item) => item.id === where.id && item.isActive);
        if (!product) throw { code: 'P2025' };
        product.minimumStock = data.minimumStock;
        return { id: product.id, minimumStock: product.minimumStock };
      }),
    },
  };
  const prisma = { $transaction: vi.fn(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx)) };

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://user:pass@localhost:5432/vet_manage';
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'secret-for-testing-only-at-least-32-chars-long';
    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true, load: [configuration] }), InventoryModule],
    })
      .overrideProvider(PrismaService).useValue(prisma)
      .overrideProvider(TokenService).useValue(tokens)
      .overrideProvider(AccessService).useValue(access)
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
    app.useGlobalFilters(new GlobalExceptionFilter());
    await app.init();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    products = [{ id: PRODUCT_ID, minimumStock: null, isActive: true }];
    permissions = new Set(['inventory:manage-products']);
  });

  afterAll(async () => {
    await app?.close();
  });

  const patch = (id: string, body: Record<string, unknown>) =>
    request(app.getHttpServer())
      .patch(`/inventory/products/${id}/minimum-stock`)
      .set('Authorization', 'Bearer t')
      .send(body);

  const expectStockUnchanged = () => {
    expect(products[0].minimumStock).toBeNull();
    expect(tx.product.update).not.toHaveBeenCalled();
  };

  it('escenario 1: configura el stock mínimo de un producto sin umbral (200)', async () => {
    const res = await patch(PRODUCT_ID, { minimumStock: 10 }).expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe('Stock mínimo registrado correctamente');
    expect(res.body.data).toEqual({ id: PRODUCT_ID, minimumStock: 10 });
    expect(products[0].minimumStock).toBe(10);
  });

  it('escenario 2: actualiza el stock mínimo existente y devuelve el nuevo valor (200)', async () => {
    products[0].minimumStock = 10;

    const res = await patch(PRODUCT_ID, { minimumStock: 25 }).expect(200);

    expect(res.body.message).toBe('Stock mínimo actualizado correctamente');
    expect(res.body.data).toEqual({ id: PRODUCT_ID, minimumStock: 25 });
    expect(products[0].minimumStock).toBe(25);
  });

  it('acepta 0 como umbral de inventario bajo (200)', async () => {
    products[0].minimumStock = 10;

    const res = await patch(PRODUCT_ID, { minimumStock: 0 }).expect(200);

    expect(res.body.data).toEqual({ id: PRODUCT_ID, minimumStock: 0 });
    expect(products[0].minimumStock).toBe(0);
  });

  it.each([
    ['vacío', '', 'El stock mínimo debe ser un número entero positivo'],
    ['letras', 'abc', 'El stock mínimo debe ser un número entero positivo'],
    ['símbolos', '$10', 'El stock mínimo debe ser un número entero positivo'],
    ['decimal', 2.5, 'El stock mínimo debe ser un número entero positivo'],
    ['negativo', -5, 'El stock mínimo no puede ser negativo'],
  ])('escenarios 3, 4 y 5: rechaza el valor %s sin modificar el producto (400)', async (_caso, value, message) => {
    const res = await patch(PRODUCT_ID, { minimumStock: value }).expect(400);

    expect(res.body.message).toBe(message);
    expectStockUnchanged();
  });

  it('responde 404 sin modificar nada cuando el producto no existe', async () => {
    const res = await patch(MISSING, { minimumStock: 10 }).expect(404);

    expect(res.body.message).toBe('Producto no encontrado');
    expectStockUnchanged();
  });

  it('responde 404 cuando el producto está inactivo', async () => {
    products[0].isActive = false;

    await patch(PRODUCT_ID, { minimumStock: 10 }).expect(404);
    expectStockUnchanged();
  });

  it('requiere sesión (401)', async () => {
    await request(app.getHttpServer())
      .patch(`/inventory/products/${PRODUCT_ID}/minimum-stock`)
      .send({ minimumStock: 10 })
      .expect(401);
    expectStockUnchanged();
  });

  it('requiere el permiso inventory:manage-products (403)', async () => {
    permissions = new Set(['inventory:read']);

    await patch(PRODUCT_ID, { minimumStock: 10 }).expect(403);
    expectStockUnchanged();
  });
});
