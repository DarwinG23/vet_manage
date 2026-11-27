import { describe, expect, it } from 'vitest';
import { BATCH_STOCK_ADJUSTMENT_MESSAGES, validateBatchStockAdjustmentInput } from './batch-stock-adjustment-input.service.js';

describe('validateBatchStockAdjustmentInput (HU-11)', () => {
  it.each([
    [0, 0],
    ['18', 18],
    [20, 20],
  ])('accepts the non-negative integer balance %s', (newQuantity, expected) => {
    expect(validateBatchStockAdjustmentInput({ newQuantity, reason: ' Conteo físico ' })).toEqual({
      valid: true,
      value: { newQuantity: expected, reason: 'Conteo físico' },
      errors: {},
    });
  });

  it.each([undefined, null, '', '   '])('requires a new balance for input %s', (newQuantity) => {
    expect(validateBatchStockAdjustmentInput({ newQuantity, reason: 'Conteo físico' })).toMatchObject({
      valid: false,
      errors: { newQuantity: BATCH_STOCK_ADJUSTMENT_MESSAGES.quantityRequired },
    });
  });

  it.each([-3, '-3'])('explains that a negative balance is not allowed (%s)', (newQuantity) => {
    expect(validateBatchStockAdjustmentInput({ newQuantity, reason: 'Conteo físico' })).toMatchObject({
      valid: false,
      errors: { newQuantity: BATCH_STOCK_ADJUSTMENT_MESSAGES.quantityNegative },
    });
  });

  it.each([5.5, '5.5', '5,5'])('explains that a decimal balance is not allowed (%s)', (newQuantity) => {
    expect(validateBatchStockAdjustmentInput({ newQuantity, reason: 'Conteo físico' })).toMatchObject({
      valid: false,
      errors: { newQuantity: BATCH_STOCK_ADJUSTMENT_MESSAGES.quantityDecimal },
    });
  });

  it.each(['abc', '12abc'])('explains that letters are not allowed in the balance (%s)', (newQuantity) => {
    expect(validateBatchStockAdjustmentInput({ newQuantity, reason: 'Conteo físico' })).toMatchObject({
      valid: false,
      errors: { newQuantity: BATCH_STOCK_ADJUSTMENT_MESSAGES.quantityNotNumeric },
    });
  });

  it.each(['2147483648', 2_147_483_648])('rejects a balance above the database limit (%s)', (newQuantity) => {
    expect(validateBatchStockAdjustmentInput({ newQuantity, reason: 'Conteo físico' })).toMatchObject({
      valid: false,
      errors: { newQuantity: BATCH_STOCK_ADJUSTMENT_MESSAGES.quantityTooLarge },
    });
  });

  it.each([undefined, null, '', '   ', 12])('requires a non-empty text reason for input %s', (reason) => {
    expect(validateBatchStockAdjustmentInput({ newQuantity: 18, reason })).toMatchObject({
      valid: false,
      errors: { reason: BATCH_STOCK_ADJUSTMENT_MESSAGES.reasonRequired },
    });
  });
});
