-- Inventory ledger. Every change to a variant's stock now gets an immutable
-- row here; `product_variants.stock_quantity` stays as a cache because the
-- storefront, the product feeds and the low-stock index all read it directly.
-- Invariant: SUM("delta") per variant == product_variants.stock_quantity.

-- CreateEnum
CREATE TYPE "stock_movement_reason" AS ENUM ('OPENING_BALANCE', 'PURCHASE_RECEIPT', 'SALE', 'ORDER_RESTOCK', 'ADJUSTMENT', 'DAMAGE', 'LOSS', 'SUPPLIER_RETURN', 'IMPORT_SYNC');

-- CreateTable
CREATE TABLE "stock_movements" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "variant_id" UUID NOT NULL,
    "delta" INTEGER NOT NULL,
    "balance_after" INTEGER NOT NULL,
    "reason" "stock_movement_reason" NOT NULL,
    "ref_type" VARCHAR(24),
    "ref_id" UUID,
    "unit_cost" DECIMAL(12,2),
    "note" TEXT,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "stock_movements_variant_id_created_at_idx" ON "stock_movements"("variant_id", "created_at");

-- CreateIndex
CREATE INDEX "stock_movements_ref_type_ref_id_idx" ON "stock_movements"("ref_type", "ref_id");

-- CreateIndex
CREATE INDEX "stock_movements_reason_created_at_idx" ON "stock_movements"("reason", "created_at");

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- A zero-delta row carries no information and would only add noise to the
-- history; callers that compute a no-op adjustment must skip the write.
ALTER TABLE "stock_movements" ADD CONSTRAINT "ck_stock_movements_delta_nonzero" CHECK ("delta" <> 0);
ALTER TABLE "stock_movements" ADD CONSTRAINT "ck_stock_movements_balance_nonneg" CHECK ("balance_after" >= 0);

-- Backfill so the ledger reconciles against the cached column from day one.
-- Variants sitting at zero get no row — an empty history summing to zero is
-- already correct, and skipping them keeps the CHECK on delta satisfied.
INSERT INTO "stock_movements" ("variant_id", "delta", "balance_after", "reason", "ref_type", "note")
SELECT "id", "stock_quantity", "stock_quantity", 'OPENING_BALANCE', 'MIGRATION', 'Opening balance captured when the stock ledger was introduced'
FROM "product_variants"
WHERE "stock_quantity" <> 0;
