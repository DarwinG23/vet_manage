import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import configuration from '../../src/config/configuration.js';
import { GlobalExceptionFilter } from '../../src/common/errors/global-exception.filter.js';
import { Prisma } from '../../src/generated/prisma/client.js';
import { PrismaService } from '../../src/infrastructure/database/prisma/prisma.service.js';
import { AccessService } from '../../src/modules/identity/services/access.service.js';
import { TokenService } from '../../src/modules/identity/services/token.service.js';
import { PurchaseOrdersModule } from '../../src/modules/purchase-orders/purchase-orders.module.js';

const ACTIVE_SUPPLIER = '123e4567-e89b-12d3-a456-426614174000';
const INACTIVE_SUPPLIER = '123e4567-e89b-12d3-a456-426614174009';
const DOG_FOOD = '123e4567-e89b-12d3-a456-426614174001';
const SHAMPOO = '123e4567-e89b-12d3-a456-426614174002';
const INACTIVE_PRODUCT = '123e4567-e89b-12d3-a456-426614174003';

type Item = { id: string; productId: string; quantity: number; unitPrice: Prisma.Decimal; subtotal: Prisma.Decimal };
type Order = { id: string; number: number; orderDate: Date; supplierId: string; status: 'PENDING'; total: Prisma.Decimal; items: Item[] };

describe('Órdenes de compra (HU-27, e2e)', () => {
  let app: INestApplication;
  let permissions: Set<string>;
  let orders: Order[];
  let products: Array<{ id: string; code: string; name: string; stock: number; isActive: boolean }>;
  const suppliers = [
    { id: ACTIVE_SUPPLIER, businessName: 'Distribuidora Vet', ruc: '0012345678001', isActive: true },
    { id: INACTIVE_SUPPLIER, businessName: 'Proveedor Inactivo', ruc: '0098765432001', isActive: false },
  ];

  const tokens = { verify: vi.fn(async () => 'user-1') };
  const access = {
    findActiveUser: vi.fn(async () => ({ id: 'user-1' })),
    getPermissionKeys: vi.fn(async () => permissions),
  };

  // Base de datos en memoria con la forma que usa PurchaseOrdersRepository.
  const supplierRef = (id: string) => {
    const { businessName, ruc } = suppliers.find((s) => s.id === id)!;
    return { id, businessName, ruc };
  };
  const toRecord = (order: Order) => ({
    ...order,
    supplier: supplierRef(order.supplierId),
    items: order.items.map((item) => {
      const { id, code, name } = products.find((p) => p.id === item.productId)!;
      return { ...item, product: { id, code, name } };
    }),
    _count: { items: order.items.length },
  });
  const productUpdate = vi.fn();
  const prisma = {
    supplier: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => suppliers.find((s) => s.id === where.id) ?? null),
    },
    product: {
      findMany: vi.fn(async ({ where }: { where: { id: { in: string[] }; isActive: boolean } }) =>
        products.filter((p) => where.id.in.includes(p.id) && p.isActive).map(({ id }) => ({ id }))),
      update: productUpdate,
    },
    purchaseOrder: {
      create: vi.fn(async ({ data }: { data: { supplierId: string; status: 'PENDING'; total: Prisma.Decimal; items: { create: Omit<Item, 'id'>[] } } }) => {
        const order: Order = {
          id: `00000000-0000-4000-8000-${String(orders.length + 1).padStart(12, '0')}`,
          number: orders.length + 1,
          orderDate: new Date(),
          supplierId: data.supplierId,
          status: data.status,
          total: data.total,
          items: data.items.create.map((item, index) => ({ id: `item-${index + 1}`, ...item })),
        };
        orders.push(order);
        return toRecord(order);
      }),
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
        const order = orders.find((o) => o.id === where.id);
        return order ? toRecord(order) : null;
      }),
      findMany: vi.fn(async () => [...orders].reverse().map(toRecord)),
      count: vi.fn(async () => orders.length),
    },
    $transaction: vi.fn(async (operations: Promise<unknown>[]) => Promise.all(operations)),
  };

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://user:pass@localhost:5432/vet_manage';
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'secret-for-testing-only-at-least-32-chars-long';
    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true, load: [configuration] }), PurchaseOrdersModule],
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
    orders = [];
    products = [
      { id: DOG_FOOD, code: 'PR-001', name: 'Alimento para perro', stock: 40, isActive: true },
      { id: SHAMPOO, code: 'PR-002', name: 'Shampoo', stock: 5, isActive: true },
      { id: INACTIVE_PRODUCT, code: 'PR-003', name: 'Descontinuado', stock: 0, isActive: false },
    ];
    permissions = new Set(['purchase-orders:create', 'purchase-orders:read']);
    productUpdate.mockClear();
  });

  afterAll(async () => {
    await app?.close();
  });

  const validOrder = {
    supplierId: ACTIVE_SUPPLIER,
    items: [
      { productId: DOG_FOOD, quantity: 10, unitPrice: '12.50' },
      { productId: SHAMPOO, quantity: 3, unitPrice: 4.1 },
    ],
  };
  const post = (body: unknown) =>
    request(app.getHttpServer()).post('/purchase-orders').set('Authorization', 'Bearer t').send(body as object);
  const get = (path: string) => request(app.getHttpServer()).get(path).set('Authorization', 'Bearer t');
  const stocks = () => products.map(({ stock }) => stock);

  it('escenario 1: crea la orden con número único, fecha, total y estado Pendiente (201)', async () => {
    const res = await post(validOrder).expect(201);

    expect(res.body.message).toBe('Orden de compra registrada correctamente');
    expect(res.body.data).toMatchObject({
      number: 1,
      code: 'OC-000001',
      status: 'PENDING',
      total: '137.30',
      supplier: { id: ACTIVE_SUPPLIER, businessName: 'Distribuidora Vet' },
    });
    expect(Number.isNaN(Date.parse(res.body.data.orderDate))).toBe(false);
    expect(res.body.data.items).toHaveLength(2);

    const second = await post(validOrder).expect(201);
    expect(second.body.data.code).toBe('OC-000002');
  });

  it.each([
    ['sin proveedor', { ...validOrder, supplierId: '' }, 400, 'Debe seleccionar un proveedor'],
    ['proveedor inactivo', { ...validOrder, supplierId: INACTIVE_SUPPLIER }, 409, 'El proveedor seleccionado está inactivo'],
    ['sin productos', { ...validOrder, items: [] }, 400, 'Debe agregar al menos un producto'],
    ['línea sin producto', { ...validOrder, items: [{ quantity: 1, unitPrice: 1 }] }, 400, 'Producto 1: debe seleccionar un producto'],
    ['producto inactivo', { ...validOrder, items: [{ productId: INACTIVE_PRODUCT, quantity: 1, unitPrice: 1 }] }, 400, 'Producto 1: el producto seleccionado no existe o está inactivo'],
    ['cantidad cero', { ...validOrder, items: [{ productId: DOG_FOOD, quantity: 0, unitPrice: 1 }] }, 400, 'Producto 1: la cantidad debe ser un número entero mayor que cero'],
    ['cantidad decimal', { ...validOrder, items: [{ productId: DOG_FOOD, quantity: 2.5, unitPrice: 1 }] }, 400, 'Producto 1: la cantidad debe ser un número entero mayor que cero'],
    ['precio cero', { ...validOrder, items: [{ productId: DOG_FOOD, quantity: 1, unitPrice: 0 }] }, 400, 'Producto 1: el precio unitario debe ser mayor que cero'],
    ['precio negativo', { ...validOrder, items: [{ productId: DOG_FOOD, quantity: 1, unitPrice: -3 }] }, 400, 'Producto 1: el precio unitario debe ser mayor que cero'],
  ])('escenario 2: %s no crea la orden e indica el dato a corregir', async (_name, body, status, message) => {
    const res = await post(body).expect(status);

    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe(message);
    expect(orders).toHaveLength(0);
  });

  it('escenario 2: con varios errores los lista todos', async () => {
    const res = await post({ items: [{ productId: DOG_FOOD, quantity: 0, unitPrice: 0 }] }).expect(400);

    expect(res.body.message).toBe('Revisa los datos de la orden de compra');
    expect(res.body.errors).toEqual([
      'Debe seleccionar un proveedor',
      'Producto 1: la cantidad debe ser un número entero mayor que cero',
      'Producto 1: el precio unitario debe ser mayor que cero',
    ]);
    expect(orders).toHaveLength(0);
  });

  it('escenario 3: consulta la orden con número, fecha, proveedor, productos, cantidades, precios, total y estado', async () => {
    const { body: created } = await post(validOrder).expect(201);

    const res = await get(`/purchase-orders/${created.data.id}`).expect(200);

    expect(res.body.data).toEqual(created.data);
    expect(res.body.data.items).toEqual([
      expect.objectContaining({ product: { id: DOG_FOOD, code: 'PR-001', name: 'Alimento para perro' }, quantity: 10, unitPrice: '12.50', subtotal: '125.00' }),
      expect.objectContaining({ product: { id: SHAMPOO, code: 'PR-002', name: 'Shampoo' }, quantity: 3, unitPrice: '4.10', subtotal: '12.30' }),
    ]);

    const list = await get('/purchase-orders').expect(200);
    expect(list.body.data).toMatchObject({ total: 1, items: [{ code: 'OC-000001', status: 'PENDING', total: '137.30', itemsCount: 2 }] });
  });

  it('escenario 3: una orden inexistente responde 404 y un id inválido 400', async () => {
    await get('/purchase-orders/123e4567-e89b-12d3-a456-426614174777').expect(404);
    await get('/purchase-orders/no-es-uuid').expect(400);
  });

  it('escenario 4: crear la orden no modifica las existencias de los productos', async () => {
    const before = stocks();

    await post(validOrder).expect(201);

    expect(stocks()).toEqual(before);
    expect(productUpdate).not.toHaveBeenCalled();
  });

  it('requiere sesión (401) y los permisos de órdenes de compra (403)', async () => {
    await request(app.getHttpServer()).post('/purchase-orders').send(validOrder).expect(401);

    permissions = new Set(['purchase-orders:read']);
    await post(validOrder).expect(403);
    permissions = new Set(['purchase-orders:create']);
    await get('/purchase-orders').expect(403);
    expect(orders).toHaveLength(0);
  });
});
