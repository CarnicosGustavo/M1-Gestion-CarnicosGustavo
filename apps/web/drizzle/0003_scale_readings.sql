-- 0003_scale_readings — lecturas de básculas físicas (POST /api/scale/ingest).
-- PENDIENTE: NO aplicada. La aplica Alberto a mano (db:migrate o SQL Editor)
-- antes de activar SCALE_INGEST_ENABLED. Ver docs/scale-ingest.md.
CREATE TABLE "scale_readings" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"event_id" uuid NOT NULL,
	"device_id" varchar(64) NOT NULL,
	"seq" bigint NOT NULL,
	"weight" numeric(12, 3) NOT NULL,
	"unit" varchar(8) NOT NULL,
	"weight_g" integer NOT NULL,
	"stable" boolean NOT NULL,
	"net" boolean DEFAULT false NOT NULL,
	"raw" varchar(128),
	"captured_at" timestamp with time zone,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"order_id" integer,
	"order_item_id" integer,
	"piece_count" integer,
	"consumed_at" timestamp with time zone,
	"consumed_by" varchar(255),
	"consumed_order_item_id" integer,
	CONSTRAINT "scale_readings_event_id_key" UNIQUE("event_id")
);
--> statement-breakpoint
ALTER TABLE "scale_readings" ADD CONSTRAINT "scale_readings_consumed_order_item_id_fkey" FOREIGN KEY ("consumed_order_item_id") REFERENCES "public"."order_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_scale_readings_device_id" ON "scale_readings" USING btree ("device_id","id");--> statement-breakpoint
-- La app se conecta como postgres; nadie más (anon/authenticated) debe leerla.
ALTER TABLE "scale_readings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
REVOKE ALL ON TABLE "scale_readings" FROM anon, authenticated;--> statement-breakpoint
REVOKE ALL ON SEQUENCE "scale_readings_id_seq" FROM anon, authenticated;
