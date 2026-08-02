-- Purchasing: suppliers, purchase orders and goods receipts. Receiving credits
-- stock through the ledger added in 20260801090000 and stamps each unit with a
-- landed cost, which feeds `product_variants.avg_cost`.
--
-- NOTE: Prisma's diff wanted to DROP INDEX "products_name_trgm_idx" here — the
-- raw-SQL trigram GIN index from 20260719010000 that Prisma cannot express, so
-- every generated migration tries to drop it. Deliberately omitted; dropping it
-- silently degrades fuzzy product search to a sequential scan.

-- CreateEnum
CREATE TYPE "purchase_order_status" AS ENUM ('DRAFT', 'SUBMITTED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED');

-- AlterTable
ALTER TABLE "product_variants" ADD COLUMN     "avg_cost" DECIMAL(12,2),
ADD COLUMN     "reorder_point" INTEGER,
ADD COLUMN     "reorder_quantity" INTEGER;

-- CreateTable
CREATE TABLE "suppliers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(160) NOT NULL,
    "slug" VARCHAR(180) NOT NULL,
    "contact_name" VARCHAR(160),
    "email" VARCHAR(255),
    "phone" VARCHAR(32),
    "address" TEXT,
    "payment_terms" VARCHAR(64),
    "lead_time_days" INTEGER,
    "notes" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_variants" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "supplier_id" UUID NOT NULL,
    "variant_id" UUID NOT NULL,
    "supplier_sku" VARCHAR(80),
    "unit_cost" DECIMAL(12,2),
    "min_order_quantity" INTEGER,
    "is_preferred" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "supplier_variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_orders" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "supplier_id" UUID NOT NULL,
    "po_number" VARCHAR(32) NOT NULL,
    "status" "purchase_order_status" NOT NULL DEFAULT 'DRAFT',
    "currency" VARCHAR(3) NOT NULL DEFAULT 'PKR',
    "expected_at" TIMESTAMPTZ,
    "shipping_cost" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "duty_cost" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "other_cost" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "created_by" UUID,
    "submitted_at" TIMESTAMPTZ,
    "closed_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "purchase_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_order_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "purchase_order_id" UUID NOT NULL,
    "variant_id" UUID NOT NULL,
    "quantity_ordered" INTEGER NOT NULL,
    "quantity_received" INTEGER NOT NULL DEFAULT 0,
    "unit_cost" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "purchase_order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "goods_receipts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "purchase_order_id" UUID NOT NULL,
    "received_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "received_by" UUID,
    "note" TEXT,

    CONSTRAINT "goods_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "goods_receipt_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "goods_receipt_id" UUID NOT NULL,
    "purchase_order_item_id" UUID NOT NULL,
    "variant_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit_landed_cost" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "goods_receipt_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "suppliers_slug_key" ON "suppliers"("slug");

-- CreateIndex
CREATE INDEX "suppliers_is_active_idx" ON "suppliers"("is_active");

-- CreateIndex
CREATE INDEX "supplier_variants_variant_id_idx" ON "supplier_variants"("variant_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_supplier_variant" ON "supplier_variants"("supplier_id", "variant_id");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_orders_po_number_key" ON "purchase_orders"("po_number");

-- CreateIndex
CREATE INDEX "purchase_orders_supplier_id_idx" ON "purchase_orders"("supplier_id");

-- CreateIndex
CREATE INDEX "purchase_orders_status_created_at_idx" ON "purchase_orders"("status", "created_at");

-- CreateIndex
CREATE INDEX "purchase_order_items_variant_id_idx" ON "purchase_order_items"("variant_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_po_variant" ON "purchase_order_items"("purchase_order_id", "variant_id");

-- CreateIndex
CREATE INDEX "goods_receipts_purchase_order_id_received_at_idx" ON "goods_receipts"("purchase_order_id", "received_at");

-- CreateIndex
CREATE INDEX "goods_receipt_items_goods_receipt_id_idx" ON "goods_receipt_items"("goods_receipt_id");

-- CreateIndex
CREATE INDEX "goods_receipt_items_purchase_order_item_id_idx" ON "goods_receipt_items"("purchase_order_item_id");

-- CreateIndex
CREATE INDEX "goods_receipt_items_variant_id_idx" ON "goods_receipt_items"("variant_id");

-- AddForeignKey
ALTER TABLE "supplier_variants" ADD CONSTRAINT "supplier_variants_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_variants" ADD CONSTRAINT "supplier_variants_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_purchase_order_id_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "purchase_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_purchase_order_id_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "purchase_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_received_by_fkey" FOREIGN KEY ("received_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipt_items" ADD CONSTRAINT "goods_receipt_items_goods_receipt_id_fkey" FOREIGN KEY ("goods_receipt_id") REFERENCES "goods_receipts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipt_items" ADD CONSTRAINT "goods_receipt_items_purchase_order_item_id_fkey" FOREIGN KEY ("purchase_order_item_id") REFERENCES "purchase_order_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipt_items" ADD CONSTRAINT "goods_receipt_items_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- One preferred supplier per variant. Partial unique — Prisma can't express it,
-- so it lives here and must survive future generated migrations.
CREATE UNIQUE INDEX "uq_variant_preferred_supplier" ON "supplier_variants" ("variant_id") WHERE "is_preferred";

-- Money and quantity sanity, matching the conventions set in 20260719000000.
ALTER TABLE "product_variants" ADD CONSTRAINT "ck_variants_avg_cost_nonneg" CHECK ("avg_cost" IS NULL OR "avg_cost" >= 0);
ALTER TABLE "product_variants" ADD CONSTRAINT "ck_variants_reorder_point_nonneg" CHECK ("reorder_point" IS NULL OR "reorder_point" >= 0);
ALTER TABLE "product_variants" ADD CONSTRAINT "ck_variants_reorder_qty_pos" CHECK ("reorder_quantity" IS NULL OR "reorder_quantity" > 0);

ALTER TABLE "supplier_variants" ADD CONSTRAINT "ck_supplier_variants_cost_nonneg" CHECK ("unit_cost" IS NULL OR "unit_cost" >= 0);
ALTER TABLE "supplier_variants" ADD CONSTRAINT "ck_supplier_variants_moq_pos" CHECK ("min_order_quantity" IS NULL OR "min_order_quantity" > 0);

ALTER TABLE "purchase_orders" ADD CONSTRAINT "ck_po_shipping_nonneg" CHECK ("shipping_cost" >= 0);
ALTER TABLE "purchase_orders" ADD CONSTRAINT "ck_po_duty_nonneg" CHECK ("duty_cost" >= 0);
ALTER TABLE "purchase_orders" ADD CONSTRAINT "ck_po_other_nonneg" CHECK ("other_cost" >= 0);

-- Over-receiving is a data error, not a business case: it means the delivery
-- didn't match the order and the PO needs amending first.
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "ck_po_items_ordered_pos" CHECK ("quantity_ordered" > 0);
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "ck_po_items_received_range" CHECK ("quantity_received" >= 0 AND "quantity_received" <= "quantity_ordered");
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "ck_po_items_cost_nonneg" CHECK ("unit_cost" >= 0);

ALTER TABLE "goods_receipt_items" ADD CONSTRAINT "ck_receipt_items_quantity_pos" CHECK ("quantity" > 0);
ALTER TABLE "goods_receipt_items" ADD CONSTRAINT "ck_receipt_items_cost_nonneg" CHECK ("unit_landed_cost" >= 0);
