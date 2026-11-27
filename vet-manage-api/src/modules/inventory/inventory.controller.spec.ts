import 'reflect-metadata';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import { BadRequestException, ParseUUIDPipe } from '@nestjs/common';
import type { ArgumentMetadata, ExecutionContext } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { PERMISSIONS_METADATA } from '../identity/decorators/require-permissions.decorator.js';
import { JwtAuthGuard } from '../identity/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../identity/guards/permissions.guard.js';
import { InventoryController } from './inventory.controller.js';

describe('InventoryController RBAC (HU-01)', () => {
  const permissionOf = (method: string) =>
    Reflect.getMetadata(PERMISSIONS_METADATA, InventoryController.prototype[method as keyof InventoryController]) as string[];

  it('protects catalog reads with inventory:read', () => {
    for (const method of ['listCategories', 'listBrands', 'listProducts', 'getProduct']) {
      expect(permissionOf(method), method).toEqual(['inventory:read']);
    }
  });

  it('protects lot movement history with inventory:read and adjustments with inventory:adjust-stock', () => {
    expect(permissionOf('listBatchMovements')).toEqual(['inventory:read']);
    expect(permissionOf('adjustBatchStock')).toEqual(['inventory:adjust-stock']);
  });

  it('returns lot movements in the standard response envelope', async () => {
    const movements = [{ id: 'movement-1', type: 'AJUSTE', quantity: -2, userName: 'Ana Pérez' }];
    const listBatchMovements = vi.fn().mockResolvedValue(movements);
    const controller = new InventoryController({ listBatchMovements } as never);

    await expect(controller.listBatchMovements('batch-1')).resolves.toMatchObject({
      statusCode: 200,
      success: true,
      data: movements,
    });
    expect(listBatchMovements).toHaveBeenCalledWith('batch-1');
  });

  it('records an adjustment with the authenticated user and returns 201', async () => {
    const adjustment = { id: 'movement-1', batchId: 'batch-1', type: 'AJUSTE', quantity: -2 };
    const adjustBatchStock = vi.fn().mockResolvedValue(adjustment);
    const controller = new InventoryController({ adjustBatchStock } as never);

    await expect(controller.adjustBatchStock(
      'batch-1',
      { newQuantity: 18, reason: 'Conteo físico' },
      { user: { id: 'user-1', personId: 'person-1' } } as never,
    )).resolves.toMatchObject({
      statusCode: 201,
      success: true,
      message: 'Existencias del lote ajustadas correctamente',
      data: adjustment,
    });
    expect(adjustBatchStock).toHaveBeenCalledWith('batch-1', { newQuantity: 18, reason: 'Conteo físico' }, 'user-1');
  });

  it('protects product inventory detail with JWT and inventory:read', () => {
    const handler = Object.getOwnPropertyDescriptor(InventoryController.prototype, 'getProduct')?.value;

    expect(permissionOf('getProduct')).toEqual(['inventory:read']);
    expect(Reflect.getMetadata(GUARDS_METADATA, handler)).toEqual([JwtAuthGuard, PermissionsGuard]);
  });

  it('returns product inventory details using the standard success envelope', async () => {
    const detail = {
      id: 'product-1',
      code: 'PR-001',
      name: 'Alimento para perro',
      description: null,
      unitPrice: '25.5',
      stock: 15,
      minimumStock: 10,
      category: { id: 'category-1', name: 'Alimentos' },
      brand: { id: 'brand-1', name: 'Dog Chow' },
      createdAt: '2026-01-01T00:00:00.000Z',
      batches: [{ id: 'lot-1', code: 'L-001', expirationDate: '2027-01-01', availableQuantity: 15, expirationStatus: 'NOT_EXPIRED' }],
    };
    const getProduct = vi.fn().mockResolvedValue(detail);
    const controller = new InventoryController({ getProduct } as never);

    await expect(controller.getProduct('product-1')).resolves.toMatchObject({
      statusCode: 200,
      success: true,
      data: detail,
    });
    expect(getProduct).toHaveBeenCalledWith('product-1');
  });

  it('protects catalog writes with their specific management permission', () => {
    expect(permissionOf('createCategory')).toEqual(['inventory:manage-categories']);
    expect(permissionOf('updateCategory')).toEqual(['inventory:manage-categories']);
    expect(permissionOf('createBrand')).toEqual(['inventory:manage-brands']);
    expect(permissionOf('updateBrand')).toEqual(['inventory:manage-brands']);
    expect(permissionOf('createProduct')).toEqual(['inventory:manage-products']);
    expect(permissionOf('updateProduct')).toEqual(['inventory:manage-products']);
  });

  it('protects VAT updates with the dedicated permission', () => {
    expect(permissionOf('updateCategoryVat')).toEqual(['inventory:configure-vat']);
  });

  it('protects minimum stock updates with inventory:manage-products (HU-03)', () => {
    expect(permissionOf('updateProductMinimumStock')).toEqual(['inventory:manage-products']);
  });

  it('accepts a UUID and rejects a malformed category id', async () => {
    const pipe = new ParseUUIDPipe();
    const metadata: ArgumentMetadata = { type: 'param', data: 'id', metatype: String };
    const id = '123e4567-e89b-42d3-a456-426614174000';

    await expect(pipe.transform(id, metadata)).resolves.toBe(id);
    await expect(pipe.transform('not-a-uuid', metadata)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('returns VAT updates using the standard API response envelope', async () => {
    const category = { id: 'category-1', name: 'Accesorios', vatRate: '12.5' };
    const updateCategoryVat = vi.fn().mockResolvedValue(category);
    const inventoryService = { updateCategoryVat };
    const controller = new InventoryController(inventoryService as never);

    await expect(controller.updateCategoryVat('category-1', { vatRate: '12.5' })).resolves.toEqual({
      statusCode: 200,
      success: true,
      message: 'IVA actualizado correctamente',
      data: category,
    });
    expect(updateCategoryVat).toHaveBeenCalledWith('category-1', '12.5');
  });

  it('returns minimum stock updates with the message for registration or update (HU-03)', async () => {
    const updateProductMinimumStock = vi.fn()
      .mockResolvedValueOnce({ id: 'product-1', minimumStock: 10, isFirstConfiguration: true })
      .mockResolvedValueOnce({ id: 'product-1', minimumStock: 20, isFirstConfiguration: false });
    const controller = new InventoryController({ updateProductMinimumStock } as never);

    await expect(controller.updateProductMinimumStock('product-1', { minimumStock: 10 })).resolves.toEqual({
      statusCode: 200,
      success: true,
      message: 'Stock mínimo registrado correctamente',
      data: { id: 'product-1', minimumStock: 10 },
    });
    await expect(controller.updateProductMinimumStock('product-1', { minimumStock: 20 })).resolves.toEqual({
      statusCode: 200,
      success: true,
      message: 'Stock mínimo actualizado correctamente',
      data: { id: 'product-1', minimumStock: 20 },
    });
    expect(updateProductMinimumStock).toHaveBeenNthCalledWith(1, 'product-1', 10);
    expect(updateProductMinimumStock).toHaveBeenNthCalledWith(2, 'product-1', 20);
  });

  it('allows a user with the configured permission and rejects a user without it', async () => {
    const vatUpdateHandler = Object.getOwnPropertyDescriptor(InventoryController.prototype, 'updateCategoryVat')?.value;
    const context = {
      getHandler: () => vatUpdateHandler,
      getClass: () => InventoryController,
      switchToHttp: () => ({ getRequest: () => ({ user: { id: 'user-1' } }) }),
    } as unknown as ExecutionContext;
    const access = { getPermissionKeys: vi.fn() };
    const guard = new PermissionsGuard(new Reflector(), access as never);

    access.getPermissionKeys.mockResolvedValue(new Set(['inventory:configure-vat']));
    await expect(guard.canActivate(context)).resolves.toBe(true);

    access.getPermissionKeys.mockResolvedValue(new Set(['inventory:read']));
    await expect(guard.canActivate(context)).rejects.toMatchObject({ statusCode: 403 });
  });

  it('allows product detail only when the authenticated user has inventory:read', async () => {
    const handler = Object.getOwnPropertyDescriptor(InventoryController.prototype, 'getProduct')?.value;
    const context = {
      getHandler: () => handler,
      getClass: () => InventoryController,
      switchToHttp: () => ({ getRequest: () => ({ user: { id: 'user-1' } }) }),
    } as unknown as ExecutionContext;
    const access = { getPermissionKeys: vi.fn() };
    const guard = new PermissionsGuard(new Reflector(), access as never);

    access.getPermissionKeys.mockResolvedValue(new Set(['inventory:read']));
    await expect(guard.canActivate(context)).resolves.toBe(true);

    access.getPermissionKeys.mockResolvedValue(new Set(['inventory:manage-products']));
    await expect(guard.canActivate(context)).rejects.toMatchObject({ statusCode: 403 });
  });

  it('rejects unauthenticated access to the protected product detail handler', async () => {
    const handler = Object.getOwnPropertyDescriptor(InventoryController.prototype, 'getProduct')?.value;
    const guards = Reflect.getMetadata(GUARDS_METADATA, handler) as unknown[];
    expect(guards).toContain(JwtAuthGuard);

    const context = {
      switchToHttp: () => ({ getRequest: () => ({ headers: {} }) }),
    } as unknown as ExecutionContext;
    const jwtGuard = new JwtAuthGuard({ verify: vi.fn() } as never, { findActiveUser: vi.fn() } as never);

    await expect(jwtGuard.canActivate(context)).rejects.toMatchObject({ statusCode: 401 });
  });
});
