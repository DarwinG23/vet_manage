import { Allow } from 'class-validator';

// HU-03: el valor se recibe sin transformar y se valida en validateMinimumStockInput,
// que devuelve el mensaje exacto de cada escenario de la historia.
export class UpdateMinimumStockDto {
  @Allow()
  minimumStock?: unknown;
}
