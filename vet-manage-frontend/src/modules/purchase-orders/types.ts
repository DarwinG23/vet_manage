// HU-27: órdenes de compra a proveedores.
export type PurchaseOrderStatus = 'PENDING';

export const PURCHASE_ORDER_STATUS_LABELS: Record<PurchaseOrderStatus, string> = {
  PENDING: 'Pendiente',
};

export type PurchaseOrderSupplier = { id: string; businessName: string; ruc: string };

export type PurchaseOrderItem = {
  id: string;
  product: { id: string; code: string; name: string };
  quantity: number;
  unitPrice: string;
  subtotal: string;
};

export type PurchaseOrder = {
  id: string;
  number: number;
  code: string;
  orderDate: string;
  status: PurchaseOrderStatus;
  total: string;
  supplier: PurchaseOrderSupplier;
  items: PurchaseOrderItem[];
};

export type PurchaseOrderSummary = Omit<PurchaseOrder, 'items'> & { itemsCount: number };

export type PurchaseOrderListResponse = {
  items: PurchaseOrderSummary[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type PurchaseOrderInput = {
  supplierId: string;
  items: { productId: string; quantity: number; unitPrice: string }[];
};
