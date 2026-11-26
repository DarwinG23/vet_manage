-- Unifica la tabla de HU-19a con la incorporada por HU-08 sin eliminar movimientos.
DO $migration$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'inventory_movements' AND column_name = 'previous_balance') THEN
    ALTER TABLE "inventory_movements" RENAME COLUMN "previous_balance" TO "stock_before";
    ALTER TABLE "inventory_movements" RENAME COLUMN "resulting_balance" TO "stock_after";
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'inventory_movements' AND column_name = 'type' AND udt_name = 'TipoMovimiento') THEN
    ALTER TABLE "inventory_movements" DROP CONSTRAINT IF EXISTS "inventory_movements_write_off_balance";
    ALTER TABLE "inventory_movements" ALTER COLUMN "type" TYPE "InventoryMovementType" USING "type"::text::"InventoryMovementType";
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'inventory_movements'::regclass AND conname = 'inventory_movements_user_id_fkey') THEN
    ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END
$migration$;

ALTER TABLE "inventory_movements" ADD COLUMN IF NOT EXISTS "observation" TEXT;
ALTER TABLE "inventory_movements" ALTER COLUMN "reason" TYPE TEXT;
ALTER TABLE "inventory_movements" ALTER COLUMN "reason" DROP NOT NULL;

-- Las reglas de esta historia se aplican a BAJA; los demás movimientos conservan sus reglas.
ALTER TABLE "inventory_movements" DROP CONSTRAINT IF EXISTS "inventory_movements_positive_quantity";
ALTER TABLE "inventory_movements" DROP CONSTRAINT IF EXISTS "inventory_movements_nonnegative_balances";
ALTER TABLE "inventory_movements" DROP CONSTRAINT IF EXISTS "inventory_movements_write_off_balance";
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_write_off_balance" CHECK (
  "type" <> 'BAJA' OR (
    "quantity" > 0 AND "stock_before" >= "quantity" AND "stock_after" >= 0
    AND "stock_after" = "stock_before" - "quantity"
  )
);
CREATE INDEX IF NOT EXISTS "inventory_movements_batch_id_occurred_at_idx" ON "inventory_movements"("batch_id", "occurred_at");
