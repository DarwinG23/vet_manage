export type CatalogItem = {
  id: string;
  name: string;
  description?: string | null;
};

export type ProductSearchFilters = {
  categoryId?: string;
  brandId?: string;
  batchCode?: string;
};

export type InventoryCategory = CatalogItem & {
  vatRate: string | null;
};

export type Product = {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  unitPrice: string;
  stock: number;
  // HU-03: umbral de inventario bajo; null cuando aún no se configuró.
  minimumStock: number | null;
  category: CatalogItem;
  brand: CatalogItem;
  createdAt: string;
};

export type ProductBatch = {
  id: string;
  code: string;
  expirationDate: string;
  availableQuantity: number;
  expirationStatus: 'EXPIRED' | 'NOT_EXPIRED';
};

// El endpoint de detalle incluye la relación de lotes; el listado no la carga.
export type ProductDetail = Product & {
  batches: ProductBatch[];
};

export type ProductDraft = {
  code: string;
  name: string;
  description: string;
  unitPrice: string;
  category: { id?: string; name?: string };
  brand: { id?: string; name?: string };
};

// HU-02: datos que se envían para registrar la entrada de un lote.
export type BatchEntryDraft = {
  productId: string;
  code: string;
  expirationDate: string;
  initialQuantity: number;
};

export type BatchEntryResult = {
  batch: {
    id: string;
    productId: string;
    code: string;
    expirationDate: string;
    initialQuantity: number;
    availableQuantity: number;
  };
  product: { id: string; code: string; name: string; stock: number };
};

export type BatchDetail = {
  id: string;
  productId: string;
  code: string;
  expirationDate: string;
  initialQuantity: number;
  availableQuantity: number;
  product: { id: string; code: string; name: string; stock: number };
};

export type InventoryMovementType = 'ENTRADA' | 'VENTA' | 'USO_CLINICO' | 'AJUSTE' | 'BAJA';

export type BatchInventoryMovement = {
  id: string;
  batchId: string;
  type: InventoryMovementType;
  quantity: number;
  stockBefore: number;
  stockAfter: number;
  reason: string | null;
  occurredAt: string;
  userId: string;
  userName: string;
};

export type BatchStockAdjustmentDraft = {
  newQuantity: number;
  reason: string;
};

export type BatchStockAdjustmentResult = Omit<BatchInventoryMovement, 'userName'> & {
  productStock: number;
};

export type ExpirationAlert = {
  lotId: string;
  productName: string;
  lotCode: string;
  expirationDate: string;
  availableQuantity: number;
  status: 'UPCOMING' | 'EXPIRED';
  label: 'Próximo a caducar' | 'Caducado';
};

export type BatchWriteOffDraft = {
  batchId: string;
  quantity: number;
  reason: 'Daño' | 'Pérdida';
  observation?: string;
};

export type InventoryMovement = {
  id: string;
  type: 'ENTRADA' | 'VENTA' | 'USO_CLINICO' | 'AJUSTE' | 'BAJA';
  quantity: number;
  reason: string;
  observation: string | null;
  previousBalance: number;
  resultingBalance: number;
  occurredAt: string;
  batch: { id: string; code: string; product: { id: string; code: string; name: string } };
  user: { id: string; firstName: string; lastName: string };
};

export type BatchWriteOffResult = {
  batch: { id: string; productId: string; availableQuantity: number };
  product: { id: string; stock: number };
  movement: InventoryMovement;
};

export type InventoryMovementsPage = {
  items: InventoryMovement[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};
export type SaleDraft = { items: Array<{ productId: string; quantity: number }> };

export type Sale = {
  id: string;
  total: string;
  createdAt: string;
  cashier: string;
  items: Array<{
    id: string;
    productId: string;
    productName: string;
    batchCode: string;
    quantity: number;
    unitPrice: string;
    subtotal: string;
  }>;
};
