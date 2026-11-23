import { describe, expect, it } from 'vitest';
import { validateSaleInput } from './sale-input.service.js';

describe('validateSaleInput', () => {
  it('acepta una o varias líneas con cantidades enteras positivas', () => {
    expect(validateSaleInput({ items: [{ productId: 'p1', quantity: 3 }, { productId: 'p2', quantity: 1 }] })).toEqual({
      valid: true,
      items: [{ productId: 'p1', quantity: 3 }, { productId: 'p2', quantity: 1 }],
    });
  });

  it.each([0, -1, 2.5, '2', null])('rechaza la cantidad inválida %p', (quantity) => {
    expect(validateSaleInput({ items: [{ productId: 'p1', quantity }] })).toEqual({
      valid: false,
      message: 'La cantidad debe ser un número entero mayor que cero',
    });
  });

  it('rechaza productos repetidos para mantener un detalle inequívoco', () => {
    expect(validateSaleInput({ items: [{ productId: 'p1', quantity: 1 }, { productId: 'p1', quantity: 2 }] })).toEqual({
      valid: false,
      message: 'No repitas productos en la venta',
    });
  });
});
