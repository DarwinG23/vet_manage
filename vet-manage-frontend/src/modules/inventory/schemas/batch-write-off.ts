import type { BatchWriteOffDraft, ProductBatch } from '../types';

export type BatchWriteOffFormInput = {
  productId: string;
  batchId: string;
  quantity: string;
  reason: string;
  observation: string;
};

export type BatchWriteOffFieldErrors = Partial<Record<keyof BatchWriteOffFormInput, string>>;

type WriteOffValidation =
  | { valid: true; value: BatchWriteOffDraft }
  | { valid: false; errors: BatchWriteOffFieldErrors };

export function validateBatchWriteOffDraft(draft: BatchWriteOffFormInput, batch?: ProductBatch): WriteOffValidation {
  const errors: BatchWriteOffFieldErrors = {};
  const rawQuantity = draft.quantity.trim();
  const quantity = Number(rawQuantity);
  if (!draft.productId) errors.productId = 'Debe seleccionar un producto';
  if (!draft.batchId || !batch || batch.id !== draft.batchId) errors.batchId = 'Debe seleccionar un lote válido';
  if (!/^\d+$/.test(rawQuantity) || !Number.isInteger(quantity) || quantity <= 0 || quantity > 2_147_483_647) {
    errors.quantity = 'La cantidad debe ser un número entero mayor que cero';
  } else if (batch && batch.availableQuantity === 0) {
    errors.quantity = 'El lote no tiene unidades disponibles';
  } else if (batch && quantity > batch.availableQuantity) {
    errors.quantity = 'La cantidad solicitada supera las existencias disponibles';
  }
  if (draft.reason !== 'Daño' && draft.reason !== 'Pérdida') errors.reason = 'Debe seleccionar el motivo Daño o Pérdida';

  if (Object.keys(errors).length > 0 || (draft.reason !== 'Daño' && draft.reason !== 'Pérdida')) {
    return { valid: false, errors };
  }
  const observation = draft.observation.trim();
  return {
    valid: true,
    value: { batchId: draft.batchId, quantity, reason: draft.reason, ...(observation ? { observation } : {}) },
  };
}
