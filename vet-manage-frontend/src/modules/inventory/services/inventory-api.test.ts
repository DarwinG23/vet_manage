import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getJson, patchJson } from '../../../infrastructure/api/http-client';
import type { InventoryCategory, ProductDetail } from '../types';
import { inventoryApi } from './inventory-api';

vi.mock('../../../infrastructure/api/http-client', () => ({
  getJson: vi.fn(),
  patchJson: vi.fn(),
  postJson: vi.fn(),
}));

const categories: InventoryCategory[] = [
  { id: 'category-1', name: 'Accesorios', vatRate: '12.5' },
  { id: 'category-2', name: 'Alimentos', vatRate: null },
];

describe('inventoryApi.getProduct (HU-20)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('requests the existing detail endpoint and returns the unwrapped product inventory contract', async () => {
    const detail: ProductDetail = {
      id: 'product-1',
      code: 'PR-001',
      name: 'Alimento para perro',
      description: null,
      unitPrice: '25.50',
      stock: 15,
      minimumStock: 10,
      category: { id: 'category-1', name: 'Alimentos' },
      brand: { id: 'brand-1', name: 'Dog Chow' },
      createdAt: '2026-11-19T00:00:00.000Z',
      batches: [
        {
          id: 'batch-1', code: 'L-001', expirationDate: '2027-01-01',
          availableQuantity: 10, expirationStatus: 'NOT_EXPIRED',
        },
        {
          id: 'batch-2', code: 'L-002', expirationDate: '2026-11-18',
          availableQuantity: 5, expirationStatus: 'EXPIRED',
        },
      ],
    };
    vi.mocked(getJson).mockResolvedValue(detail as never);

    await expect(inventoryApi.getProduct('product-1')).resolves.toEqual(detail);
    expect(getJson).toHaveBeenCalledWith('/inventory/products/product-1');
  });
});

describe('inventoryApi VAT contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads category VAT values, including an unconfigured null', async () => {
    vi.mocked(getJson).mockResolvedValue(categories as never);

    await expect(inventoryApi.listCategories()).resolves.toEqual(categories);
    expect(getJson).toHaveBeenCalledWith('/inventory/categories');
  });

  it('patches the category VAT with its UUID and a decimal string', async () => {
    vi.mocked(patchJson).mockResolvedValue(categories[0] as never);

    await inventoryApi.updateCategoryVat('category-1', '12.50');

    expect(patchJson).toHaveBeenCalledWith('/inventory/categories/category-1/vat', { vatRate: '12.50' });
  });
});

describe('inventoryApi.updateProductMinimumStock (HU-03)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('envía el nuevo stock mínimo al endpoint dedicado del producto', async () => {
    vi.mocked(patchJson).mockResolvedValue({ id: 'product-1', minimumStock: 10 } as never);

    await expect(inventoryApi.updateProductMinimumStock('product-1', 10)).resolves.toEqual({
      id: 'product-1',
      minimumStock: 10,
    });
    expect(patchJson).toHaveBeenCalledWith('/inventory/products/product-1/minimum-stock', { minimumStock: 10 });
  });

  it('permite guardar 0 como umbral configurado', async () => {
    vi.mocked(patchJson).mockResolvedValue({ id: 'product-1', minimumStock: 0 } as never);

    await inventoryApi.updateProductMinimumStock('product-1', 0);

    expect(patchJson).toHaveBeenCalledWith('/inventory/products/product-1/minimum-stock', { minimumStock: 0 });
  });
});

describe('inventoryApi.listProducts', () => {
  beforeEach(() => vi.clearAllMocks());

  it('construye una consulta con texto, categoría y marca sin perder caracteres', () => {
    inventoryApi.listProducts(' Dog & Chow ', {
      categoryId: 'category-1', brandId: 'brand-1', batchCode: ' L-2026-001 ',
    });

    expect(getJson).toHaveBeenCalledWith(
      '/inventory/products?search=Dog+%26+Chow&categoryId=category-1&brandId=brand-1&batchCode=L-2026-001',
    );
  });

  it('consulta el catálogo completo cuando se limpian los filtros', () => {
    inventoryApi.listProducts(' ', { categoryId: '', brandId: '' });

    expect(getJson).toHaveBeenCalledWith('/inventory/products');
  });
});
