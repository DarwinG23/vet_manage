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

const WRITE_OFF_REASONS = ['Daño', 'Pérdida', 'Vencimiento'] as const;
type WriteOffReason = (typeof WRITE_OFF_REASONS)[number];

function isWriteOffReason(reason: string): reason is WriteOffReason {
  return WRITE_OFF_REASONS.includes(reason as WriteOffReason);
}

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
  if (!isWriteOffReason(draft.reason)) {
    errors.reason = 'Debe seleccionar un motivo válido';
  } else if (draft.reason === 'Vencimiento' && batch && batch.expirationStatus !== 'EXPIRED') {
    errors.reason = 'El motivo Vencimiento solo aplica a lotes caducados';
  }

  if (Object.keys(errors).length > 0 || !isWriteOffReason(draft.reason)) {
    return { valid: false, errors };
  }
  const observation = draft.observation.trim();
  return {
    valid: true,
    value: { batchId: draft.batchId, quantity, reason: draft.reason, ...(observation ? { observation } : {}) },
  };
}
