import { describe, expect, it } from 'vitest';
import {
  formatMinimumStock,
  MINIMUM_STOCK_MESSAGES as M,
  validateMinimumStockInput,
} from './minimum-stock';

describe('minimum stock input', () => {
  it.each(['1', '10', ' 10 ', '0', '2147483647'])('acepta el entero %s', (value) => {
    expect(validateMinimumStockInput(value)).toEqual({
      valid: true,
      value: Number(value.trim()),
      error: null,
    });
  });

  it.each(['', '   ', 'abc', '5abc', '$10', '2.5', '1e3'])('rechaza %s con el mensaje de entero', (value) => {
    expect(validateMinimumStockInput(value)).toEqual({
      valid: false,
      value: null,
      error: M.notPositiveInteger,
    });
  });

  it.each(['-1', '-5', '-2.5'])('rechaza el negativo %s con su propio mensaje', (value) => {
    expect(validateMinimumStockInput(value)).toEqual({
      valid: false,
      value: null,
      error: M.negative,
    });
  });

  it('formats an unconfigured minimum separately from a configured zero', () => {
    expect(formatMinimumStock(null)).toBe('Sin configurar');
    expect(formatMinimumStock(undefined)).toBe('Sin configurar');
    expect(formatMinimumStock(0)).toBe('0');
    expect(formatMinimumStock(10)).toBe('10');
  });
});
