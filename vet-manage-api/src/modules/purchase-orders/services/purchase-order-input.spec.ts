import { describe, expect, it } from 'vitest';
import {
  PURCHASE_ORDER_MESSAGES as M,
  centsToDecimalString,
  formatPurchaseOrderCode,
  validatePurchaseOrderInput,
} from './purchase-order-input.js';

const SUPPLIER = '123e4567-e89b-12d3-a456-426614174000';
const PRODUCT_A = '123e4567-e89b-12d3-a456-426614174001';
const PRODUCT_B = '123e4567-e89b-12d3-a456-426614174002';

const valid = () => ({
  supplierId: SUPPLIER,
  items: [
    { productId: PRODUCT_A, quantity: 10, unitPrice: '12.50' },
    { productId: PRODUCT_B, quantity: '3', unitPrice: 4.1 },
  ],
});

describe('validatePurchaseOrderInput (HU-27)', () => {
  it('escenario 1: acepta una orden válida y calcula subtotales y total en centavos', () => {
    const result = validatePurchaseOrderInput(valid());

    expect(result.valid).toBe(true);
    expect(result.value?.items).toEqual([
      { productId: PRODUCT_A, quantity: 10, unitPriceCents: 1250n, subtotalCents: 12500n },
      { productId: PRODUCT_B, quantity: 3, unitPriceCents: 410n, subtotalCents: 1230n },
    ]);
    expect(result.value?.totalCents).toBe(13730n);
  });

  it('escenario 2: exige un proveedor', () => {
    for (const supplierId of [undefined, '', 'no-es-uuid']) {
      expect(validatePurchaseOrderInput({ ...valid(), supplierId }).errors).toEqual([M.supplierRequired]);
    }
  });

  it('escenario 2: exige al menos un producto', () => {
    for (const items of [undefined, [], 'texto']) {
      expect(validatePurchaseOrderInput({ ...valid(), items }).errors).toEqual([M.itemsRequired]);
    }
  });

  it('escenario 2: indica la línea sin producto o con producto repetido', () => {
    const missing = validatePurchaseOrderInput({ supplierId: SUPPLIER, items: [{ quantity: 1, unitPrice: 1 }] });
    expect(missing.errors).toEqual([M.productRequired(1)]);

    const duplicated = validatePurchaseOrderInput({
      supplierId: SUPPLIER,
      items: [{ productId: PRODUCT_A, quantity: 1, unitPrice: 1 }, { productId: PRODUCT_A, quantity: 2, unitPrice: 1 }],
    });
    expect(duplicated.errors).toEqual([M.productDuplicated(2)]);
  });

  it('escenario 2: rechaza cantidades vacías, cero, negativas, decimales o con letras', () => {
    for (const quantity of [undefined, '', 0, '0', -5, 2.5, '2.5', 'abc', true]) {
      const result = validatePurchaseOrderInput({ supplierId: SUPPLIER, items: [{ productId: PRODUCT_A, quantity, unitPrice: 1 }] });
      expect(result.errors, String(quantity)).toEqual([M.quantityInvalid(1)]);
    }
    const tooLarge = validatePurchaseOrderInput({ supplierId: SUPPLIER, items: [{ productId: PRODUCT_A, quantity: 1_000_001, unitPrice: 1 }] });
    expect(tooLarge.errors).toEqual([M.quantityTooLarge(1)]);
  });

  it('escenario 2: rechaza precios vacíos, cero, negativos, con letras o con más de dos decimales', () => {
    for (const unitPrice of [undefined, '', 0, '0.00', -1, 'abc']) {
      const result = validatePurchaseOrderInput({ supplierId: SUPPLIER, items: [{ productId: PRODUCT_A, quantity: 1, unitPrice }] });
      expect(result.errors, String(unitPrice)).toEqual([M.priceInvalid(1)]);
    }
    const format = validatePurchaseOrderInput({ supplierId: SUPPLIER, items: [{ productId: PRODUCT_A, quantity: 1, unitPrice: '1.999' }] });
    expect(format.errors).toEqual([M.priceFormat(1)]);
  });

  it('informa todos los datos por corregir a la vez', () => {
    const result = validatePurchaseOrderInput({
      items: [{ productId: PRODUCT_A, quantity: 0, unitPrice: 5 }, { productId: PRODUCT_B, quantity: 1, unitPrice: 0 }],
    });
    expect(result.errors).toEqual([M.supplierRequired, M.quantityInvalid(1), M.priceInvalid(2)]);
  });

  it('formatea el número de la orden y los importes', () => {
    expect(formatPurchaseOrderCode(1)).toBe('OC-000001');
    expect(formatPurchaseOrderCode(1234567)).toBe('OC-1234567');
    expect(centsToDecimalString(13730n)).toBe('137.30');
    expect(centsToDecimalString(5n)).toBe('0.05');
  });
});
