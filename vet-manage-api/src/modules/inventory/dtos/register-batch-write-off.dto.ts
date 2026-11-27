import { Allow } from 'class-validator';

// Las reglas de HU-19a se validan juntas para informar todos los campos pendientes.
export class RegisterBatchWriteOffDto {
  @Allow()
  batchId?: unknown;

  @Allow()
  quantity?: unknown;

  @Allow()
  reason?: unknown;

  @Allow()
  observation?: unknown;
}
