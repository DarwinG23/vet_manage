import { describe, expect, it } from 'vitest';
import { BATCH_STOCK_ADJUSTMENT_MESSAGES, validateBatchStockAdjustmentDraft } from './batch-stock-adjustment';

describe('validateBatchStockAdjustmentDraft (HU-11)', () => {
  it.each([
    ['0', 0],
    ['18', 18],
    ['2147483647', 2_147_483_647],
  ])('accepts the balance %s and trims the reason', (newQuantity, expected) => {
    expect(validateBatchStockAdjustmentDraft({ newQuantity, reason: ' Conteo físico ' })).toEqual({
      valid: true,
      value: { newQuantity: expected, reason: 'Conteo físico' },
      errors: {},
    });
  });

  it.each([
    ['', BATCH_STOCK_ADJUSTMENT_MESSAGES.quantityRequired],
  ])('rejects balance %s with its validation message', (newQuantity, message) => {
    expect(validateBatchStockAdjustmentDraft({ newQuantity, reason: 'Conteo físico' })).toMatchObject({
      valid: false,
      errors: { newQuantity: message },
    });
  });

  it.each([
    ['-3', BATCH_STOCK_ADJUSTMENT_MESSAGES.quantityNegative],
    ['5.5', BATCH_STOCK_ADJUSTMENT_MESSAGES.quantityDecimal],
    ['5,5', BATCH_STOCK_ADJUSTMENT_MESSAGES.quantityDecimal],
    ['abc', BATCH_STOCK_ADJUSTMENT_MESSAGES.quantityNotNumeric],
    ['2147483648', BATCH_STOCK_ADJUSTMENT_MESSAGES.quantityTooLarge],
  ])('explains why balance %s is invalid', (newQuantity, message) => {
    expect(validateBatchStockAdjustmentDraft({ newQuantity, reason: 'Conteo físico' })).toMatchObject({
      valid: false,
      errors: { newQuantity: message },
    });
  });

  it.each([
    ['empty reason', '  ', BATCH_STOCK_ADJUSTMENT_MESSAGES.reasonRequired],
    ['numeric-only reason', '12345', BATCH_STOCK_ADJUSTMENT_MESSAGES.reasonMustContainText],
  ])('rejects a %s', (_scenario, reason, message) => {
    expect(validateBatchStockAdjustmentDraft({ newQuantity: '18', reason })).toMatchObject({
      valid: false,
      errors: { reason: message },
    });
  });

  it('accepts a textual reason that also contains numbers', () => {
    expect(validateBatchStockAdjustmentDraft({ newQuantity: '18', reason: 'Diferencia de 2 unidades en lote 123' })).toMatchObject({
      valid: true,
      value: { reason: 'Diferencia de 2 unidades en lote 123' },
    });
  });
});
