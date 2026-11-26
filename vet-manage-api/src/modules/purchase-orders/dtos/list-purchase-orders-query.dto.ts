import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

const toNumber = (fallback: number) => ({ value }: { value: unknown }) =>
  value === undefined || value === '' ? fallback : Number(value);

export type PurchaseOrderStatusFilter = 'PENDING';

export class ListPurchaseOrdersQueryDto {
  @IsOptional()
  @Transform(toNumber(1))
  @IsInt({ message: 'page debe ser un número entero' })
  @Min(1, { message: 'page debe ser mayor o igual a 1' })
  page = 1;

  @IsOptional()
  @Transform(toNumber(20))
  @IsInt({ message: 'pageSize debe ser un número entero entre 1 y 100' })
  @Min(1, { message: 'pageSize debe estar entre 1 y 100' })
  @Max(100, { message: 'pageSize debe estar entre 1 y 100' })
  pageSize = 20;

  @IsOptional()
  @IsUUID('all', { message: 'supplierId debe ser un identificador válido' })
  supplierId?: string;

  @IsOptional()
  @IsIn(['PENDING'], { message: 'status debe ser PENDING' })
  status?: PurchaseOrderStatusFilter;
}
