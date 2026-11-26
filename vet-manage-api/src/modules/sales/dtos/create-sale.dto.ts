import { Allow } from 'class-validator';

export class CreateSaleDto {
  // La validación de negocio produce mensajes específicos y evita que los
  // valores decimales o negativos lleguen a la transacción.
  @Allow()
  items?: unknown;
}
