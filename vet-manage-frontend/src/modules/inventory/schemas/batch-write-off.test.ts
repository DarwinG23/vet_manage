import { describe, expect, it } from 'vitest';
import { validateBatchWriteOffDraft } from './batch-write-off';
import type { ProductBatch } from '../types';

const batch: ProductBatch = { id: 'batch-1', code: 'LOT-001', expirationDate: '2027-12-31', availableQuantity: 20, expirationStatus: 'NOT_EXPIRED' };
const draft = { productId: 'product-1', batchId: batch.id, quantity: '3', reason: 'Daño', observation: '  Envase roto  ' };

describe('Validación del formulario de bajas HU-19a', () => {
  it('convierte la cantidad a entero y conserva solo los campos de la API', () => {
    expect(validateBatchWriteOffDraft(draft, batch)).toEqual({
      valid: true, value: { batchId: batch.id, quantity: 3, reason: 'Daño', observation: 'Envase roto' },
    });
  });
  it('permite pérdida sin observación', () => {
    expect(validateBatchWriteOffDraft({ ...draft, reason: 'Pérdida', observation: ' ' }, batch)).toEqual({
      valid: true, value: { batchId: batch.id, quantity: 3, reason: 'Pérdida' },
    });
  });
  it.each(['', ' ', '0', '-1', '1.5', '3.0', 'abc', '1e2', '2147483648'])(
    'rechaza la cantidad inválida %s', (quantity) => {
      expect(validateBatchWriteOffDraft({ ...draft, quantity }, batch)).toMatchObject({
        valid: false, errors: { quantity: 'La cantidad debe ser un número entero mayor que cero' },
      });
    },
  );
  it('rechaza una cantidad superior a las existencias', () => {
    expect(validateBatchWriteOffDraft({ ...draft, quantity: '21' }, batch)).toMatchObject({
      valid: false, errors: { quantity: 'La cantidad solicitada supera las existencias disponibles' },
    });
  });
  it('permite retirar exactamente el saldo disponible', () => {
    expect(validateBatchWriteOffDraft({ ...draft, quantity: '20' }, batch)).toMatchObject({ valid: true });
  });
  it('rechaza un lote vacío', () => {
    expect(validateBatchWriteOffDraft(draft, { ...batch, availableQuantity: 0 })).toMatchObject({
      valid: false, errors: { quantity: 'El lote no tiene unidades disponibles' },
    });
  });
  it('rechaza un lote que no pertenece a las opciones cargadas', () => {
    expect(validateBatchWriteOffDraft({ ...draft, batchId: 'otro-lote' }, batch)).toMatchObject({ valid: false, errors: { batchId: expect.any(String) } });
  });
  it('identifica los campos obligatorios incompletos', () => {
    expect(validateBatchWriteOffDraft({ productId: '', batchId: '', quantity: '', reason: '', observation: '' }))
      .toMatchObject({ valid: false, errors: { productId: expect.any(String), batchId: expect.any(String), quantity: expect.any(String), reason: expect.any(String) } });
  });
  it.each(['', 'Vencimiento', 'Otro'])('rechaza el motivo %s', (reason) => {
    expect(validateBatchWriteOffDraft({ ...draft, reason }, batch)).toMatchObject({ valid: false, errors: { reason: expect.any(String) } });
  });
});
