ALTER TABLE "shipments"
  ADD COLUMN "tracking_status_text" VARCHAR(120),
  ADD COLUMN "tracking_journey" VARCHAR(255),
  ADD COLUMN "tracking_synced_at" TIMESTAMPTZ;
