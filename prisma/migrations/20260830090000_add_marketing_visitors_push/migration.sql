-- Anonymous visitor intelligence + browser push infrastructure.
-- Built for recoverable guest carts without requiring email/phone/login.

CREATE TABLE "marketing_visitors" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "anonymous_id" VARCHAR(64) NOT NULL,
  "guest_id" VARCHAR(64),
  "user_id" UUID,
  "cart_id" UUID,
  "fbp" VARCHAR(255),
  "fbc" VARCHAR(255),
  "utm_source" VARCHAR(120),
  "utm_medium" VARCHAR(120),
  "utm_campaign" VARCHAR(160),
  "utm_content" VARCHAR(160),
  "utm_term" VARCHAR(160),
  "first_path" VARCHAR(512),
  "last_path" VARCHAR(512),
  "referrer" VARCHAR(512),
  "device_type" VARCHAR(32),
  "notification_permission" VARCHAR(16) NOT NULL DEFAULT 'default',
  "intent_score" INTEGER NOT NULL DEFAULT 0,
  "first_seen_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "last_seen_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "push_subscribed_at" TIMESTAMPTZ,

  CONSTRAINT "marketing_visitors_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "marketing_visitors_anonymous_id_key" ON "marketing_visitors"("anonymous_id");
CREATE UNIQUE INDEX "marketing_visitors_guest_id_key" ON "marketing_visitors"("guest_id");
CREATE INDEX "marketing_visitors_guest_id_idx" ON "marketing_visitors"("guest_id");
CREATE INDEX "marketing_visitors_user_id_idx" ON "marketing_visitors"("user_id");
CREATE INDEX "marketing_visitors_cart_id_idx" ON "marketing_visitors"("cart_id");
CREATE INDEX "marketing_visitors_intent_score_last_seen_at_idx" ON "marketing_visitors"("intent_score", "last_seen_at");
CREATE INDEX "marketing_visitors_last_seen_at_idx" ON "marketing_visitors"("last_seen_at");

CREATE TABLE "web_push_tokens" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "visitor_id" UUID NOT NULL,
  "token" VARCHAR(512) NOT NULL,
  "firebase_installation_id" VARCHAR(128),
  "permission" VARCHAR(16) NOT NULL DEFAULT 'granted',
  "platform" VARCHAR(64),
  "user_agent" VARCHAR(512),
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "last_seen_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revoked_at" TIMESTAMPTZ,

  CONSTRAINT "web_push_tokens_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "web_push_tokens_visitor_id_fkey"
    FOREIGN KEY ("visitor_id") REFERENCES "marketing_visitors"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "web_push_tokens_token_key" ON "web_push_tokens"("token");
CREATE INDEX "web_push_tokens_visitor_id_is_active_idx" ON "web_push_tokens"("visitor_id", "is_active");
CREATE INDEX "web_push_tokens_is_active_last_seen_at_idx" ON "web_push_tokens"("is_active", "last_seen_at");

CREATE TABLE "visitor_event_logs" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "visitor_id" UUID,
  "guest_id" VARCHAR(64),
  "event_name" VARCHAR(64) NOT NULL,
  "product_id" UUID,
  "variant_id" UUID,
  "cart_id" UUID,
  "value" DECIMAL(12,2),
  "currency" VARCHAR(3),
  "score_delta" INTEGER NOT NULL DEFAULT 0,
  "page_path" VARCHAR(512),
  "metadata" JSONB,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "visitor_event_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "visitor_event_logs_visitor_id_created_at_idx" ON "visitor_event_logs"("visitor_id", "created_at");
CREATE INDEX "visitor_event_logs_guest_id_created_at_idx" ON "visitor_event_logs"("guest_id", "created_at");
CREATE INDEX "visitor_event_logs_event_name_created_at_idx" ON "visitor_event_logs"("event_name", "created_at");
CREATE INDEX "visitor_event_logs_product_id_created_at_idx" ON "visitor_event_logs"("product_id", "created_at");

CREATE TABLE "product_notification_subscriptions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "visitor_id" UUID NOT NULL,
  "product_id" UUID NOT NULL,
  "variant_id" UUID,
  "type" VARCHAR(32) NOT NULL,
  "status" VARCHAR(16) NOT NULL DEFAULT 'ACTIVE',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "ended_at" TIMESTAMPTZ,

  CONSTRAINT "product_notification_subscriptions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "uq_product_push_subscription"
  ON "product_notification_subscriptions"("visitor_id", "product_id", "variant_id", "type");
CREATE INDEX "product_notification_subscriptions_product_id_type_status_idx"
  ON "product_notification_subscriptions"("product_id", "type", "status");
CREATE INDEX "product_notification_subscriptions_visitor_id_status_idx"
  ON "product_notification_subscriptions"("visitor_id", "status");
