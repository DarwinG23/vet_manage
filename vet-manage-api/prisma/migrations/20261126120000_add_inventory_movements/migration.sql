CREATE TYPE "TipoMovimiento" AS ENUM ('ENTRADA', 'VENTA', 'USO_CLINICO', 'AJUSTE', 'BAJA');

CREATE TABLE "inventory_movements" (
    "id" UUID NOT NULL,
    "batch_id" UUID NOT NULL,
    "type" "TipoMovimiento" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "previous_balance" INTEGER NOT NULL,
    "resulting_balance" INTEGER NOT NULL,
    "reason" VARCHAR(50) NOT NULL,
    "observation" TEXT,
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user_id" UUID NOT NULL,
    CONSTRAINT "inventory_movements_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "inventory_movements_positive_quantity" CHECK ("quantity" > 0),
    CONSTRAINT "inventory_movements_nonnegative_balances" CHECK ("previous_balance" >= 0 AND "resulting_balance" >= 0),
    CONSTRAINT "inventory_movements_write_off_balance" CHECK (
        "type" <> 'BAJA' OR ("previous_balance" >= "quantity" AND "resulting_balance" = "previous_balance" - "quantity")
    )
);

CREATE INDEX "inventory_movements_batch_id_occurred_at_idx" ON "inventory_movements"("batch_id", "occurred_at");
CREATE INDEX "inventory_movements_user_id_idx" ON "inventory_movements"("user_id");
CREATE INDEX "inventory_movements_occurred_at_idx" ON "inventory_movements"("occurred_at");

ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_batch_id_fkey"
    FOREIGN KEY ("batch_id") REFERENCES "batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
