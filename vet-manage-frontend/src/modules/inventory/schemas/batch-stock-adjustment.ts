export type BatchStockAdjustmentInput = {
  newQuantity: string;
  reason: string;
};

export type BatchStockAdjustmentDraft = {
  newQuantity: number;
  reason: string;
};

export type BatchStockAdjustmentField = keyof BatchStockAdjustmentInput;
export type BatchStockAdjustmentErrors = Partial<Record<BatchStockAdjustmentField, string>>;

export type BatchStockAdjustmentValidation =
  | { valid: true; value: BatchStockAdjustmentDraft; errors: Record<string, never> }
  | { valid: false; value: null; errors: BatchStockAdjustmentErrors };

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

export function validateBatchStockAdjustmentDraft(
  input: BatchStockAdjustmentInput,
): BatchStockAdjustmentValidation {
  const errors: BatchStockAdjustmentErrors = {};
  const rawQuantity = input.newQuantity.trim();
  const reason = input.reason.trim();
  let newQuantity: number | undefined;

  if (!rawQuantity) {
    errors.newQuantity = BATCH_STOCK_ADJUSTMENT_MESSAGES.quantityRequired;
  } else {
    const numericValue = Number(rawQuantity.replace(',', '.'));
    if (Number.isFinite(numericValue) && numericValue < 0) {
      errors.newQuantity = BATCH_STOCK_ADJUSTMENT_MESSAGES.quantityNegative;
    } else if (/^[+-]?(?:\d+[.,]\d*|[.,]\d+)$/.test(rawQuantity)) {
      errors.newQuantity = BATCH_STOCK_ADJUSTMENT_MESSAGES.quantityDecimal;
    } else if (!/^\d+$/.test(rawQuantity)) {
      errors.newQuantity = BATCH_STOCK_ADJUSTMENT_MESSAGES.quantityNotNumeric;
    } else {
      const parsed = Number(rawQuantity);
      if (!Number.isSafeInteger(parsed) || parsed > MAX_QUANTITY) {
        errors.newQuantity = BATCH_STOCK_ADJUSTMENT_MESSAGES.quantityTooLarge;
      } else {
        newQuantity = parsed;
      }
    }
  }

  if (!reason) errors.reason = BATCH_STOCK_ADJUSTMENT_MESSAGES.reasonRequired;
  else if (!/\p{L}/u.test(reason)) errors.reason = BATCH_STOCK_ADJUSTMENT_MESSAGES.reasonMustContainText;

  if (Object.keys(errors).length > 0 || newQuantity === undefined) {
    return { valid: false, value: null, errors };
  }

  return { valid: true, value: { newQuantity, reason }, errors: {} };
}
