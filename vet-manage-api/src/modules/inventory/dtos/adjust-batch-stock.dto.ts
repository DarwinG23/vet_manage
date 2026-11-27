import { Allow } from 'class-validator';

// La validación manual devuelve los mensajes específicos definidos para HU-11.
export class AdjustBatchStockDto {
  @Allow()
  newQuantity?: unknown;

  @Allow()
  reason?: unknown;
}
