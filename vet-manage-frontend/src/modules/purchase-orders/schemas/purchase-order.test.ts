import { describe, expect, it } from 'vitest';
import { ApiError } from '../../../infrastructure/api/http-client';
import {
  PURCHASE_ORDER_MESSAGES as M,
  buildPurchaseOrderInput,
  draftTotalCents,
  hasPurchaseOrderErrors,
  purchaseOrderApiErrors,
  validatePurchaseOrderDraft,
  type PurchaseOrderDraft,
} from './purchase-order';

const draft = (overrides: Partial<PurchaseOrderDraft> = {}): PurchaseOrderDraft => ({
  supplierId: 's-1',
  lines: [
    { key: 'a', productId: 'p-1', quantity: '10', unitPrice: '12.50' },
    { key: 'b', productId: 'p-2', quantity: '3', unitPrice: '4.1' },
  ],
  ...overrides,
});

describe('purchase-order schema (HU-27)', () => {
  it('acepta una orden válida, calcula el total y arma el cuerpo de la API', () => {
    expect(hasPurchaseOrderErrors(validatePurchaseOrderDraft(draft()))).toBe(false);
    expect(draftTotalCents(draft())).toBe(13730);
    expect(buildPurchaseOrderInput(draft())).toEqual({
      supplierId: 's-1',
      items: [{ productId: 'p-1', quantity: 10, unitPrice: '12.50' }, { productId: 'p-2', quantity: 3, unitPrice: '4.1' }],
    });
  });

  it('exige proveedor y al menos un producto', () => {
    expect(validatePurchaseOrderDraft(draft({ supplierId: '', lines: [] }))).toEqual({
      supplierId: M.supplierRequired, items: M.itemsRequired, lines: {},
    });
  });

  it('marca la línea con producto faltante o repetido, cantidad o precio inválidos', () => {
    const errors = validatePurchaseOrderDraft(draft({
      lines: [
        { key: 'a', productId: '', quantity: '2.5', unitPrice: '0' },
        { key: 'b', productId: 'p-2', quantity: 'abc', unitPrice: '1.999' },
        { key: 'c', productId: 'p-2', quantity: '-5', unitPrice: '-3' },
      ],
    }));
    expect(errors.lines).toEqual({
      a: { productId: M.productRequired, quantity: M.quantityInvalid, unitPrice: M.priceInvalid },
      b: { quantity: M.quantityInvalid, unitPrice: M.priceFormat },
      c: { productId: M.productDuplicated, quantity: M.quantityInvalid, unitPrice: M.priceInvalid },
    });
  });

  it('ubica los errores de la API en el proveedor o en la línea correspondiente', () => {
    const cause = new ApiError('Revisa los datos de la orden de compra', 400, {
      errors: ['El proveedor seleccionado está inactivo', 'Producto 2: el producto seleccionado no existe o está inactivo'],
    });
    expect(purchaseOrderApiErrors(cause, draft())).toEqual({
      supplierId: 'El proveedor seleccionado está inactivo',
      lines: { b: { productId: 'El producto seleccionado no existe o está inactivo' } },
    });
  });
});
