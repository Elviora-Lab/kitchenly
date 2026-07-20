-- Homepage flash sale: a scheduled window over a curated set of products.

CREATE TABLE "flash_sales" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "title" VARCHAR(120) NOT NULL DEFAULT 'Flash Sale',
    "starts_at" TIMESTAMPTZ NOT NULL,
    "ends_at" TIMESTAMPTZ NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "flash_sales_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "flash_sale_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "flash_sale_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "discount_percent" INTEGER NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "flash_sale_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "flash_sales_is_active_starts_at_ends_at_idx" ON "flash_sales"("is_active", "starts_at", "ends_at");

CREATE INDEX "flash_sale_items_flash_sale_id_position_idx" ON "flash_sale_items"("flash_sale_id", "position");

CREATE UNIQUE INDEX "flash_sale_items_flash_sale_id_product_id_key" ON "flash_sale_items"("flash_sale_id", "product_id");

ALTER TABLE "flash_sale_items" ADD CONSTRAINT "flash_sale_items_flash_sale_id_fkey" FOREIGN KEY ("flash_sale_id") REFERENCES "flash_sales"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "flash_sale_items" ADD CONSTRAINT "flash_sale_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Hand-written guards (raw-SQL-only concerns live in the migration, per the
-- convention already used for the trigram index and default-address constraint).
-- A zero-or-negative window would make `now BETWEEN starts AND ends` nonsense,
-- and a >90% discount is almost always a fat-fingered entry rather than intent.
ALTER TABLE "flash_sales" ADD CONSTRAINT "flash_sales_window_check" CHECK ("ends_at" > "starts_at");

ALTER TABLE "flash_sale_items" ADD CONSTRAINT "flash_sale_items_discount_check" CHECK ("discount_percent" BETWEEN 1 AND 90);
