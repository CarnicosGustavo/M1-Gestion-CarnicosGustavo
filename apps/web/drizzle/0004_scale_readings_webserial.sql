-- Agrega source, captured_by, voided_at y voided_by a scale_readings.
-- Incorpora un índice por renglón para la lectura por Web Serial desde la PC.
-- Esta migración 0004 está PENDIENTE y no ha sido aplicada.
-- Depende de 0003 y debe aplicarse manualmente junto con 0003.
ALTER TABLE "scale_readings" ADD COLUMN "source" varchar(32) DEFAULT 'trss3' NOT NULL;--> statement-breakpoint
ALTER TABLE "scale_readings" ADD COLUMN "captured_by" varchar(255);--> statement-breakpoint
ALTER TABLE "scale_readings" ADD COLUMN "voided_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "scale_readings" ADD COLUMN "voided_by" varchar(255);--> statement-breakpoint
CREATE INDEX "idx_scale_readings_order_item" ON "scale_readings" USING btree ("order_item_id","id");