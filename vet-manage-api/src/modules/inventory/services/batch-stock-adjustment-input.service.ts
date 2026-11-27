export type BatchStockAdjustmentInput = {
  newQuantity?: unknown;
  reason?: unknown;
};

export type BatchStockAdjustmentField = 'newQuantity' | 'reason';

export type ValidBatchStockAdjustment = {
  newQuantity: number;
  reason: string;
};

export type BatchStockAdjustmentValidation =
  | { valid: true; value: ValidBatchStockAdjustment; errors: Record<string, never> }
  | { valid: false; value: null; errors: Partial<Record<BatchStockAdjustmentField, string>> };

export const BATCH_STOCK_ADJUSTMENT_MESSAGES = {
  quantityRequired: 'Debe ingresar el nuevo saldo del lote',
  quantityNegative: 'El saldo no puede ser negativo; ingresa un número entero mayor o igual a cero',
  quantityDecimal: 'El saldo debe ser un número entero mayor o igual a cero, sin decimales',
  quantityNotNumeric: 'Ingresa un número entero mayor o igual a cero; no se permiten letras',
  quantityTooLarge: 'El saldo supera el máximo permitido para un lote',
  reasonRequired: 'Debe ingresar el motivo del ajuste',
  reasonMustContainText: 'El motivo debe incluir letras, no solo números',
} as const;

const MAX_QUANTITY = 2_147_483_647;
const INTEGER_PATTERN = /^\d+$/;

function validateQuantity(value: unknown): { quantity?: number; error?: string } {
  if (value === undefined || value === null || (typeof value === 'string' && value.trim() === '')) {
    return { error: BATCH_STOCK_ADJUSTMENT_MESSAGES.quantityRequired };
  }

  let quantity: number;
  if (typeof value === 'number') {
    if (value < 0) return { error: BATCH_STOCK_ADJUSTMENT_MESSAGES.quantityNegative };
    if (!Number.isFinite(value)) return { error: BATCH_STOCK_ADJUSTMENT_MESSAGES.quantityNotNumeric };
    if (!Number.isInteger(value)) return { error: BATCH_STOCK_ADJUSTMENT_MESSAGES.quantityDecimal };
    quantity = value;
  } else {
    if (typeof value !== 'string') return { error: BATCH_STOCK_ADJUSTMENT_MESSAGES.quantityNotNumeric };
    const raw = value.trim();
    const numericValue = Number(raw.replace(',', '.'));
    if (Number.isFinite(numericValue) && numericValue < 0) {
      return { error: BATCH_STOCK_ADJUSTMENT_MESSAGES.quantityNegative };
    }
    if (/^[+-]?(?:\d+[.,]\d*|[.,]\d+)$/.test(raw)) {
      return { error: BATCH_STOCK_ADJUSTMENT_MESSAGES.quantityDecimal };
    }
    if (!INTEGER_PATTERN.test(raw)) return { error: BATCH_STOCK_ADJUSTMENT_MESSAGES.quantityNotNumeric };
    quantity = Number(raw);
  }

  if (!Number.isSafeInteger(quantity) || quantity > MAX_QUANTITY) {
    return { error: BATCH_STOCK_ADJUSTMENT_MESSAGES.quantityTooLarge };
  }

  return { quantity };
}

export function validateBatchStockAdjustmentInput(
  input: unknown,
): BatchStockAdjustmentValidation {
  const values = typeof input === 'object' && input !== null ? input as BatchStockAdjustmentInput : {};
  const errors: Partial<Record<BatchStockAdjustmentField, string>> = {};
  const { quantity, error: quantityError } = validateQuantity(values.newQuantity);
  const reason = typeof values.reason === 'string' ? values.reason.trim() : '';

  if (quantityError) errors.newQuantity = quantityError;
  if (!reason) errors.reason = BATCH_STOCK_ADJUSTMENT_MESSAGES.reasonRequired;
  else if (!/\p{L}/u.test(reason)) errors.reason = BATCH_STOCK_ADJUSTMENT_MESSAGES.reasonMustContainText;

  if (Object.keys(errors).length > 0 || quantity === undefined) {
    return { valid: false, value: null, errors };
  }

  return { valid: true, value: { newQuantity: quantity, reason }, errors: {} };
}
