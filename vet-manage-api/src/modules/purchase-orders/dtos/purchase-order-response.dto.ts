export type PurchaseOrderStatusValue = 'PENDING';

export class PurchaseOrderSupplierDto {
  id!: string;
  businessName!: string;
  ruc!: string;
}

export class PurchaseOrderItemResponseDto {
  id!: string;
  product!: { id: string; code: string; name: string };
  quantity!: number;
  unitPrice!: string;
  subtotal!: string;
}

export class PurchaseOrderResponseDto {
  id!: string;
  number!: number;
  code!: string;
  orderDate!: string;
  status!: PurchaseOrderStatusValue;
  total!: string;
  supplier!: PurchaseOrderSupplierDto;
  items!: PurchaseOrderItemResponseDto[];
}

export class PurchaseOrderSummaryDto {
  id!: string;
  number!: number;
  code!: string;
  orderDate!: string;
  status!: PurchaseOrderStatusValue;
  total!: string;
  supplier!: PurchaseOrderSupplierDto;
  itemsCount!: number;
}

export class PurchaseOrderListResponseDto {
  items!: PurchaseOrderSummaryDto[];
  page!: number;
  pageSize!: number;
  total!: number;
  totalPages!: number;
}
