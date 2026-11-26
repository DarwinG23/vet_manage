import { Allow } from 'class-validator';

// Los campos se aceptan tal como llegan y se validan en validatePurchaseOrderInput,
// que indica qué dato de qué producto debe corregirse (HU-27, escenario 2).
export class CreatePurchaseOrderDto {
  @Allow()
  supplierId?: unknown;

  // Lista de { productId, quantity, unitPrice }.
  @Allow()
  items?: unknown;
}
