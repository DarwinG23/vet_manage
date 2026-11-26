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
  product: { id: string; code: string; name: string };
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
