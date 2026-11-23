CREATE TYPE "SaleStatus" AS ENUM ('PAID', 'PENDING');
CREATE TYPE "InventoryMovementType" AS ENUM ('ENTRADA', 'VENTA', 'USO_CLINICO', 'AJUSTE', 'BAJA');
CREATE TYPE "ReturnStatus" AS ENUM ('DEVUELTO', 'EN_PROCESO', 'RECHAZADO', 'ACTIVO');
CREATE TYPE "ReturnType" AS ENUM ('CLIENTE', 'VETERINARIA');

ALTER TABLE "categories" ADD COLUMN "allow_returns" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "categories" ADD COLUMN "vat" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "products" ADD COLUMN "minimum_stock" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "batches" ADD COLUMN "promotion_id" UUID;

CREATE TABLE "sales" (
  "id" UUID NOT NULL,
  "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "status" "SaleStatus" NOT NULL DEFAULT 'PAID',
  "subtotal" DECIMAL(12,2) NOT NULL,
  "discount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "total" DECIMAL(12,2) NOT NULL,
  "payment_detail_id" UUID,
  "payment_id" UUID,
  CONSTRAINT "sales_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "promotions" (
  "id" UUID NOT NULL,
  "percentage" DECIMAL(5,2) NOT NULL,
  "start_date" DATE NOT NULL,
  "end_date" DATE NOT NULL,
  "promotional_price" DECIMAL(12,2) NOT NULL,
  CONSTRAINT "promotions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "payment_details" (
  "id" UUID NOT NULL,
  "email" VARCHAR(255),
  "registered_at" TIMESTAMP(3) NOT NULL,
  "address" VARCHAR(255),
  "first_name" VARCHAR(100) NOT NULL,
  "last_name" VARCHAR(100) NOT NULL,
  "identification" VARCHAR(20) NOT NULL,
  "phone" VARCHAR(30),
  CONSTRAINT "payment_details_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "product_returns" (
  "id" UUID NOT NULL,
  "batch_id" UUID NOT NULL,
  "quantity" INTEGER NOT NULL,
  "reason" TEXT NOT NULL,
  "return_status" "ReturnStatus" NOT NULL,
  "return_type" "ReturnType" NOT NULL,
  "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "sale_detail_id" UUID NOT NULL,
  CONSTRAINT "product_returns_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "sale_details" (
  "id" UUID NOT NULL,
  "quantity" INTEGER NOT NULL,
  "applied_unit_price" DECIMAL(12,2) NOT NULL,
  "discount_percentage" DECIMAL(5,2) NOT NULL DEFAULT 0,
  "subtotal" DECIMAL(12,2) NOT NULL,
  "sale_id" UUID NOT NULL,
  "product_id" UUID NOT NULL,
  "batch_id" UUID NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "sale_details_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "inventory_movements" (
  "id" UUID NOT NULL,
  "batch_id" UUID NOT NULL,
  "type" "InventoryMovementType" NOT NULL,
  "quantity" INTEGER NOT NULL,
  "stock_before" INTEGER NOT NULL,
  "stock_after" INTEGER NOT NULL,
  "reason" TEXT,
  "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "user_id" UUID NOT NULL,
  CONSTRAINT "inventory_movements_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "sales_occurred_at_idx" ON "sales"("occurred_at");
CREATE INDEX "sales_status_idx" ON "sales"("status");
CREATE UNIQUE INDEX "sales_payment_detail_id_key" ON "sales"("payment_detail_id");
CREATE INDEX "batches_promotion_id_idx" ON "batches"("promotion_id");
CREATE INDEX "sale_details_sale_id_idx" ON "sale_details"("sale_id");
CREATE INDEX "sale_details_product_id_idx" ON "sale_details"("product_id");
CREATE INDEX "sale_details_batch_id_idx" ON "sale_details"("batch_id");
CREATE INDEX "inventory_movements_batch_id_idx" ON "inventory_movements"("batch_id");
CREATE INDEX "inventory_movements_user_id_idx" ON "inventory_movements"("user_id");
CREATE INDEX "inventory_movements_occurred_at_idx" ON "inventory_movements"("occurred_at");

ALTER TABLE "sale_details" ADD CONSTRAINT "sale_details_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "sales"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sale_details" ADD CONSTRAINT "sale_details_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "sale_details" ADD CONSTRAINT "sale_details_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "sales" ADD CONSTRAINT "sales_payment_detail_id_fkey" FOREIGN KEY ("payment_detail_id") REFERENCES "payment_details"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "batches" ADD CONSTRAINT "batches_promotion_id_fkey" FOREIGN KEY ("promotion_id") REFERENCES "promotions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "product_returns" ADD CONSTRAINT "product_returns_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "product_returns" ADD CONSTRAINT "product_returns_sale_detail_id_fkey" FOREIGN KEY ("sale_detail_id") REFERENCES "sale_details"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
