import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiException } from '../../src/common/errors/api-exception.js';
import { GlobalExceptionFilter } from '../../src/common/errors/global-exception.filter.js';
import { ROLES } from '../../src/config/roles.catalog.js';
import { JwtAuthGuard } from '../../src/modules/identity/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../../src/modules/identity/guards/permissions.guard.js';
import { AccessService } from '../../src/modules/identity/services/access.service.js';
import { TokenService } from '../../src/modules/identity/services/token.service.js';
import { InventoryMovementsController } from '../../src/modules/inventory/inventory-movements.controller.js';
import { InventoryMovementsService } from '../../src/modules/inventory/services/inventory-movements.service.js';

const batchId = '123e4567-e89b-42d3-a456-426614174000';
const userId = '123e4567-e89b-42d3-a456-426614174001';
const input = { batchId, quantity: 3, reason: 'Daño', observation: 'Envase roto' };

describe('HTTP de bajas e historial (HU-19a)', () => {
  let app: INestApplication;
  const movements = { registerWriteOff: vi.fn(), listMovements: vi.fn() };
  const tokens = { verify: vi.fn(async (role: string) => ROLES.some(({ name }) => name === role) ? role : null) };
  const access = {
    findActiveUser: vi.fn(async () => ({ id: userId, personId: 'person-1' })),
    getPermissionKeys: vi.fn(),
  };
  let currentRole: string;

  beforeAll(async () => {
    // Se ejecutan ambos guards; sus consultas a identidad están aisladas con mocks.
    access.getPermissionKeys.mockImplementation(async () => new Set(
      ROLES.find(({ name }) => name === currentRole)?.permissions ?? [],
    ));
    const module = await Test.createTestingModule({
      controllers: [InventoryMovementsController],
      providers: [
        JwtAuthGuard, PermissionsGuard,
        { provide: InventoryMovementsService, useValue: movements },
        { provide: TokenService, useValue: tokens },
        { provide: AccessService, useValue: access },
      ],
    }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
    app.useGlobalFilters(new GlobalExceptionFilter());
    await app.init();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    currentRole = 'warehouse_keeper';
    movements.registerWriteOff.mockResolvedValue({ batch: { id: batchId, availableQuantity: 17 } });
    movements.listMovements.mockResolvedValue({ items: [], page: 1, pageSize: 20, total: 0, totalPages: 0 });
  });
  afterAll(async () => app?.close());

  const post = (body: object = input) => request(app.getHttpServer())
    .post('/api/v1/inventory/write-offs').set('Authorization', 'Bearer ' + currentRole).send(body);
  const get = (query = '') => request(app.getHttpServer())
    .get('/api/v1/inventory/movements' + query).set('Authorization', 'Bearer ' + currentRole);

  it('el Bodeguero registra la baja y el servidor determina el usuario responsable', async () => {
    const response = await post().expect(201);
    expect(response.body).toMatchObject({ success: true, message: 'Baja registrada correctamente', data: { batch: { availableQuantity: 17 } } });
    expect(movements.registerWriteOff).toHaveBeenCalledWith(input, userId);
  });

  it('exige sesión iniciada para registrar bajas', async () => {
    await request(app.getHttpServer()).post('/api/v1/inventory/write-offs').send(input).expect(401);
    expect(movements.registerWriteOff).not.toHaveBeenCalled();
  });

  it.each(['manager', 'cashier', 'veterinarian', 'administrator', 'client'])(
    'el rol %s no puede registrar bajas por defecto', async (role) => {
      currentRole = role;
      await post().expect(403);
      expect(movements.registerWriteOff).not.toHaveBeenCalled();
    },
  );

  it('impide enviar un usuario responsable desde el cuerpo', async () => {
    await post({ ...input, userId: 'otro-usuario' }).expect(400);
    expect(movements.registerWriteOff).not.toHaveBeenCalled();
  });

  it('comunica los errores de persistencia con el mensaje de la HU', async () => {
    movements.registerWriteOff.mockRejectedValueOnce(ApiException.internalServerError('No se pudo registrar la baja'));
    const response = await post().expect(500);
    expect(response.body.message).toBe('No se pudo registrar la baja');
  });

  it('el Gerente consulta el historial con el filtro del lote y paginación', async () => {
    currentRole = 'manager';
    const response = await get('?batchId=' + batchId + '&page=2&pageSize=5').expect(200);
    expect(response.body.success).toBe(true);
    expect(movements.listMovements).toHaveBeenCalledWith(expect.objectContaining({ batchId, page: 2, pageSize: 5 }));
    expect(movements.registerWriteOff).not.toHaveBeenCalled();
  });

  it('el historial vacío tiene un mensaje claro', async () => {
    currentRole = 'manager';
    const response = await get().expect(200);
    expect(response.body.message).toBe('No existen movimientos registrados');
    expect(response.body.data.items).toEqual([]);
  });

  it.each(['cashier', 'veterinarian', 'warehouse_keeper', 'client'])(
    'el rol %s no consulta el historial sin permiso de reportes', async (role) => {
      currentRole = role;
      await get().expect(403);
      expect(movements.listMovements).not.toHaveBeenCalled();
    },
  );

  it('exige sesión para consultar el historial', async () => {
    await request(app.getHttpServer()).get('/api/v1/inventory/movements').expect(401);
  });

  it.each(['?batchId=incorrecto', '?page=0', '?page=1.5', '?page=abc', '?pageSize=0', '?pageSize=101'])(
    'rechaza los parámetros de historial inválidos %s', async (query) => {
      currentRole = 'manager';
      await get(query).expect(400);
      expect(movements.listMovements).not.toHaveBeenCalled();
    },
  );
});
