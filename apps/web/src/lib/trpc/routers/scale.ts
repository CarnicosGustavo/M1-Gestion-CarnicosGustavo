import { and, desc, eq, gt, isNull, ne, sql } from "drizzle-orm";
import { z } from "zod/v4";
import { db } from "@/lib/db";
import { scaleReadings } from "@/lib/db/schema";
import { isIngestEnabled, parseDeviceTokenHashes } from "@/lib/scale/ingest";
import { protectedProcedure, router } from "../init";

// Lecturas más viejas que esto no se ofrecen en la Báscula (evita usar un peso
// de otra pieza que quedó sin consumir).
export const SCALE_READING_MAX_AGE_MINUTES = 10;

const latestReadingSchema = z
	.object({
		id: z.number(),
		device_id: z.string(),
		seq: z.number(),
		weight: z.string(),
		unit: z.string(),
		weight_g: z.number(),
		stable: z.boolean(),
		net: z.boolean(),
		captured_at: z.date().nullable(),
		received_at: z.date(),
	})
	.nullable();

export const scaleRouter = router({
	// Estado de la integración para la pantalla de Báscula. Solo IDs de
	// dispositivo (nunca hashes). Si la ingesta está apagada no consulta la BD.
	status: protectedProcedure
		.input(z.void())
		.output(z.object({ enabled: z.boolean(), devices: z.array(z.string()) }))
		.query(() => {
			const enabled = isIngestEnabled(process.env);
			return {
				enabled,
				devices: enabled
					? [
							...parseDeviceTokenHashes(
								process.env.SCALE_DEVICE_TOKENS_SHA256,
							).keys(),
						]
					: [],
			};
		}),

	// Última lectura ESTABLE y sin consumir del dispositivo (máx. 10 min).
	latest: protectedProcedure
		.input(z.object({ deviceId: z.string().min(1).max(64) }))
		.output(latestReadingSchema)
		.query(async ({ input }) => {
			if (!isIngestEnabled(process.env)) return null;
			const [row] = await db
				.select({
					id: scaleReadings.id,
					device_id: scaleReadings.device_id,
					seq: scaleReadings.seq,
					weight: scaleReadings.weight,
					unit: scaleReadings.unit,
					weight_g: scaleReadings.weight_g,
					stable: scaleReadings.stable,
					net: scaleReadings.net,
					captured_at: scaleReadings.captured_at,
					received_at: scaleReadings.received_at,
				})
				.from(scaleReadings)
				.where(
					and(
						eq(scaleReadings.device_id, input.deviceId),
						eq(scaleReadings.stable, true),
						isNull(scaleReadings.consumed_at),
						isNull(scaleReadings.voided_at),
						ne(scaleReadings.source, "pc-webserial"),
						gt(
							scaleReadings.received_at,
							sql`now() - make_interval(mins => ${SCALE_READING_MAX_AGE_MINUTES})`,
						),
					),
				)
				.orderBy(desc(scaleReadings.id))
				.limit(1);
			return row ?? null;
		}),
});
