import { TRPCError } from "@trpc/server";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { z } from "zod/v4";
import { db } from "@/lib/db";
import { orderItems, orders, scaleReadings } from "@/lib/db/schema";
import { protectedProcedure, router } from "../init";

const GRAMS_PER_UNIT = {
	kg: 1_000,
	g: 1,
	lb: 453.59237,
} as const;

const captureInput = z.object({
	eventId: z.uuid(),
	orderItemId: z.number().int().positive(),
	pieceCount: z.number().int().min(0).max(10_000).nullable(),
	weight: z.number().finite(),
	unit: z.enum(["kg", "g", "lb"]),
	weightG: z.number().int().min(1).max(2_000_000),
	stable: z.boolean(),
	manual: z.boolean(),
	raw: z.string().max(128).nullable(),
	capturedAt: z.iso.datetime({ offset: true }),
	seq: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
	containerId: z
		.string()
		.trim()
		.min(1)
		.max(32)
		.regex(/^[a-z0-9_-]+$/)
		.nullable()
		.default(null),
	tareG: z.number().int().min(0).max(2_000_000).nullable().default(null),
});

async function getOwnedOrderItem(orderItemId: number, userId: string) {
	const [row] = await db
		.select({
			id: orderItems.id,
			orderId: orderItems.order_id,
		})
		.from(orderItems)
		.innerJoin(orders, eq(orders.id, orderItems.order_id))
		.where(
			and(
				eq(orderItems.id, orderItemId),
				inArray(orders.user_uid, [userId, "system"]),
			),
		)
		.limit(1);

	if (!row) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: "Renglón no encontrado",
		});
	}

	return row;
}

export const scaleSerialRouter = router({
	capture: protectedProcedure
		.input(captureInput)
		.mutation(async ({ ctx, input }) => {
			const expectedWeightG = input.weight * GRAMS_PER_UNIT[input.unit];

			if (Math.abs(expectedWeightG - input.weightG) > 2) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "weightG no coincide con el peso y la unidad recibidos",
				});
			}

			const orderItem = await getOwnedOrderItem(input.orderItemId, ctx.user.id);
			const inserted = await db
				.insert(scaleReadings)
				.values({
					event_id: input.eventId,
					device_id: "pc-webserial",
					source: "pc-webserial",
					seq: input.seq,
					weight: input.weight.toFixed(3),
					unit: input.unit,
					weight_g: input.weightG,
					stable: input.stable,
					net: false,
					raw: input.raw,
					captured_at: new Date(input.capturedAt),
					order_id: orderItem.orderId,
					order_item_id: orderItem.id,
					piece_count: input.pieceCount,
					captured_by: ctx.user.id,
					container_id: input.containerId,
					tare_g: input.tareG,
				})
				.onConflictDoNothing({ target: scaleReadings.event_id })
				.returning({ id: scaleReadings.id });

			if (inserted[0]) {
				return {
					status: "stored" as const,
					id: inserted[0].id,
				};
			}

			const [existing] = await db
				.select({
					id: scaleReadings.id,
					source: scaleReadings.source,
					capturedBy: scaleReadings.captured_by,
				})
				.from(scaleReadings)
				.where(eq(scaleReadings.event_id, input.eventId))
				.limit(1);

			if (
				existing?.source === "pc-webserial" &&
				existing.capturedBy === ctx.user.id
			) {
				return {
					status: "duplicate" as const,
					id: existing.id,
				};
			}

			throw new TRPCError({
				code: "CONFLICT",
				message: "event_id ya usado",
			});
		}),

	void: protectedProcedure
		.input(z.object({ eventId: z.uuid() }))
		.mutation(async ({ ctx, input }) => {
			const updated = await db
				.update(scaleReadings)
				.set({
					voided_at: new Date(),
					voided_by: ctx.user.id,
				})
				.where(
					and(
						eq(scaleReadings.event_id, input.eventId),
						eq(scaleReadings.source, "pc-webserial"),
						eq(scaleReadings.captured_by, ctx.user.id),
						isNull(scaleReadings.consumed_at),
						isNull(scaleReadings.voided_at),
					),
				)
				.returning({ id: scaleReadings.id });

			if (updated[0]) {
				return { status: "voided" as const };
			}

			const [existing] = await db
				.select({
					id: scaleReadings.id,
					source: scaleReadings.source,
					capturedBy: scaleReadings.captured_by,
					voidedAt: scaleReadings.voided_at,
					voidedBy: scaleReadings.voided_by,
					consumedAt: scaleReadings.consumed_at,
				})
				.from(scaleReadings)
				.where(eq(scaleReadings.event_id, input.eventId))
				.limit(1);

			if (!existing) {
				return { status: "not_found" as const };
			}

			if (
				existing.source === "pc-webserial" &&
				existing.capturedBy === ctx.user.id &&
				existing.voidedAt !== null &&
				existing.voidedBy === ctx.user.id
			) {
				return { status: "already_voided" as const };
			}

			if (existing.consumedAt !== null) {
				throw new TRPCError({
					code: "CONFLICT",
					message: "La captura ya se usó en un pesaje",
				});
			}

			return { status: "not_found" as const };
		}),

	lineCaptures: protectedProcedure
		.input(z.object({ orderItemId: z.number().int().positive() }))
		.query(async ({ ctx, input }) => {
			const [ownedOrderItem] = await db
				.select({ id: orderItems.id })
				.from(orderItems)
				.innerJoin(orders, eq(orders.id, orderItems.order_id))
				.where(
					and(
						eq(orderItems.id, input.orderItemId),
						inArray(orders.user_uid, [ctx.user.id, "system"]),
					),
				)
				.limit(1);

			if (!ownedOrderItem) {
				return [];
			}

			const rows = await db
				.select({
					id: scaleReadings.id,
					eventId: scaleReadings.event_id,
					weightG: scaleReadings.weight_g,
					unit: scaleReadings.unit,
					weight: scaleReadings.weight,
					stable: scaleReadings.stable,
					pieceCount: scaleReadings.piece_count,
					source: scaleReadings.source,
					capturedAt: scaleReadings.captured_at,
					receivedAt: scaleReadings.received_at,
					containerId: scaleReadings.container_id,
					tareG: scaleReadings.tare_g,
				})
				.from(scaleReadings)
				.where(
					and(
						eq(scaleReadings.order_item_id, input.orderItemId),
						// Solo capturas de la PC: en las del gateway T-RSS3 el
						// order_item_id es solo una pista y no se asigna aquí.
						eq(scaleReadings.source, "pc-webserial"),
						isNull(scaleReadings.voided_at),
					),
				)
				.orderBy(asc(scaleReadings.id))
				.limit(200);

			return rows.map((row) => ({ ...row, weight: Number(row.weight) }));
		}),
});
