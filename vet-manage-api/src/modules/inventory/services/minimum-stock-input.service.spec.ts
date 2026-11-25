import { describe, expect, it } from 'vitest';
import { MINIMUM_STOCK_MESSAGES as M, validateMinimumStockInput } from './minimum-stock-input.service.js';

describe('validateMinimumStockInput (HU-03)', () => {
  it.each([1, 10, '10', ' 10 ', '0010', 2_147_483_647, '2147483647'])(
    'escenarios 1 y 2: acepta el entero positivo %s',
    (input) => {
      expect(validateMinimumStockInput(input)).toEqual({
        valid: true,
        value: Number(String(input).trim()),
        error: null,
      });
    },
  );

  it('acepta 0 como umbral de inventario bajo', () => {
    for (const input of [0, '0', ' 0 ']) {
      expect(validateMinimumStockInput(input)).toEqual({ valid: true, value: 0, error: null });
    }
  });

  it.each([undefined, null, '', '   '])('escenario 3: rechaza el valor vacío %s', (input) => {
    expect(validateMinimumStockInput(input)).toEqual({
      valid: false,
      value: null,
      error: M.notPositiveInteger,
    });
  });

  it.each(['abc', '5abc', '5 6', 'texto', '$10', '10%', '1e3', true, {}, []])(
    'escenario 3: rechaza letras y símbolos %s',
    (input) => {
      expect(validateMinimumStockInput(input)).toEqual({
        valid: false,
        value: null,
        error: M.notPositiveInteger,
      });
    },
  );

  it.each([-1, '-1', -5, '-5', -2.5, '-2.5'])('escenario 4: rechaza el negativo %s', (input) => {
    expect(validateMinimumStockInput(input)).toEqual({
      valid: false,
      value: null,
      error: M.negative,
    });
  });

  it.each([2.5, '2.5', 0.5, '.5', 2_147_483_648, '2147483648'])(
    'escenario 5: rechaza el decimal o fuera de rango %s',
    (input) => {
      expect(validateMinimumStockInput(input)).toEqual({
        valid: false,
        value: null,
        error: M.notPositiveInteger,
      });
    },
  );
});
