import type { RegisterBatchWriteOffDto } from '../dtos/register-batch-write-off.dto.js';

export const WRITE_OFF_MESSAGES = {
  batchRequired: 'Debe seleccionar un lote válido',
  quantityInvalid: 'La cantidad debe ser un número entero mayor que cero',
  reasonRequired: 'Debe seleccionar el motivo Daño o Pérdida',
  observationInvalid: 'La observación debe ser texto',
} as const;

type ValidBatchWriteOff = {
  batchId: string;
  quantity: number;
  reason: 'Daño' | 'Pérdida';
  observation: string | null;
};

type WriteOffErrors = Partial<Record<keyof RegisterBatchWriteOffDto, string>>;
type BatchWriteOffValidation =
  | { valid: true; value: ValidBatchWriteOff; errors: Record<string, never> }
  | { valid: false; value: null; errors: WriteOffErrors };

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function validateBatchWriteOffInput(input: RegisterBatchWriteOffDto): BatchWriteOffValidation {
  const errors: WriteOffErrors = {};
  const batchId = typeof input.batchId === 'string' ? input.batchId.trim() : '';
  const reason = typeof input.reason === 'string' ? input.reason.trim() : '';
  const rawQuantity = typeof input.quantity === 'string' ? input.quantity.trim() : input.quantity;
  const quantity = typeof rawQuantity === 'string' && /^\d+$/.test(rawQuantity)
    ? Number(rawQuantity)
    : rawQuantity;

  if (!UUID_PATTERN.test(batchId)) errors.batchId = WRITE_OFF_MESSAGES.batchRequired;
  if (typeof quantity !== 'number' || !Number.isInteger(quantity) || quantity <= 0 || quantity > 2_147_483_647) {
    errors.quantity = WRITE_OFF_MESSAGES.quantityInvalid;
  }
  if (reason !== 'Daño' && reason !== 'Pérdida') errors.reason = WRITE_OFF_MESSAGES.reasonRequired;
  if (input.observation != null && typeof input.observation !== 'string') {
    errors.observation = WRITE_OFF_MESSAGES.observationInvalid;
  }

  if (Object.keys(errors).length > 0 || typeof quantity !== 'number' || (reason !== 'Daño' && reason !== 'Pérdida')) {
    return { valid: false, value: null, errors };
  }
  const observation = typeof input.observation === 'string' ? input.observation.trim() || null : null;
  return { valid: true, value: { batchId, quantity, reason, observation }, errors: {} };
}
