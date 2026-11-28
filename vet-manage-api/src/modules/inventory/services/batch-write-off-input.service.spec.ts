import { describe, expect, it } from 'vitest';
import { validateBatchWriteOffInput, WRITE_OFF_MESSAGES } from './batch-write-off-input.service.js';

const batchId = '123e4567-e89b-42d3-a456-426614174000';
const valid = { batchId, quantity: 3, reason: 'Daño', observation: 'Envase roto' };

describe('Validación de bajas de lote (HU-19a)', () => {
  it.each(['Daño', 'Pérdida', 'Vencimiento'])('acepta el motivo %s y normaliza la observación', (reason) => {
    expect(validateBatchWriteOffInput({ ...valid, reason, observation: '  Envase roto  ' }))
      .toEqual({ valid: true, value: { ...valid, reason, observation: 'Envase roto' }, errors: {} });
  });

  it.each([undefined, null, '', '   '])('permite omitir la observación: %s', (observation) => {
    expect(validateBatchWriteOffInput({ ...valid, observation }))
      .toMatchObject({ valid: true, value: { observation: null } });
  });

  it('acepta cantidades enteras enviadas como texto sin convertir otros tipos', () => {
    expect(validateBatchWriteOffInput({ ...valid, quantity: ' 3 ' }))
      .toMatchObject({ valid: true, value: { quantity: 3 } });
  });

  it.each([undefined, null, '', 0, -1, 1.5, '3.0', 'abc', '1e2', true, [], {}, NaN, Infinity, 2_147_483_648])(
    'rechaza la cantidad inválida %j', (quantity) => {
      expect(validateBatchWriteOffInput({ ...valid, quantity }))
        .toMatchObject({ valid: false, errors: { quantity: WRITE_OFF_MESSAGES.quantityInvalid } });
    },
  );

  it.each([undefined, null, '', 'no-es-uuid', [], true])('rechaza un lote inválido: %j', (value) => {
    expect(validateBatchWriteOffInput({ ...valid, batchId: value }))
      .toMatchObject({ valid: false, errors: { batchId: WRITE_OFF_MESSAGES.batchRequired } });
  });

  it.each([undefined, null, '', 'Otro'])('rechaza un motivo fuera de HU-19a: %s', (reason) => {
    expect(validateBatchWriteOffInput({ ...valid, reason }))
      .toMatchObject({ valid: false, errors: { reason: WRITE_OFF_MESSAGES.reasonRequired } });
  });

  it('rechaza una observación de tipo incorrecto', () => {
    expect(validateBatchWriteOffInput({ ...valid, observation: 42 }))
      .toMatchObject({ valid: false, errors: { observation: WRITE_OFF_MESSAGES.observationInvalid } });
  });

  it('informa todos los campos obligatorios incompletos', () => {
    expect(validateBatchWriteOffInput({})).toMatchObject({
      valid: false,
      errors: {
        batchId: WRITE_OFF_MESSAGES.batchRequired,
        quantity: WRITE_OFF_MESSAGES.quantityInvalid,
        reason: WRITE_OFF_MESSAGES.reasonRequired,
      },
    });
  });
});
