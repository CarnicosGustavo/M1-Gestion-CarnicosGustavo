import { z } from "zod/v4";
import { protectedProcedure, router } from "../init";
import { db } from "@/lib/db";
import { yieldSheets, yieldSheetItems } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

const itemInput = z.object({
	productId: z.number().nullable().optional(),
	productName: z.string().min(1),
	pieces: z.number().int().min(0).default(0),
	kgTotal: z.number().min(0).default(0),
	weighed: z.boolean().default(false),
	sortOrder: z.number().int().default(0),
});

const sheetInput = z.object({
	sheetDate: z.string().optional(),
	numCanales: z.number().int().min(0).default(0),
	kgComprado: z.number().min(0).default(0),
	notes: z.string().optional(),
	items: z.array(itemInput),
});

export const yieldsRouter = router({
	// Lista de hojas recientes con totales
	list: protectedProcedure
		.input(z.void())
		.query(async ({ ctx }) => {
			const sheets = await db
				.select()
				.from(yieldSheets)
				.where(eq(yieldSheets.user_uid, ctx.user.id))
				.orderBy(desc(yieldSheets.id))
				.limit(50);

			const result = [];
			for (const s of sheets) {
				const items = await db
					.select()
					.from(yieldSheetItems)
					.where(eq(yieldSheetItems.sheet_id, s.id));
				const totalKg = items.reduce((a, i) => a + Number(i.kg_total), 0);
				const totalPiezas = items.reduce((a, i) => a + (i.pieces ?? 0), 0);
				result.push({
					id: s.id,
					sheetDate: s.sheet_date,
					numCanales: s.num_canales,
					kgComprado: Number(s.kg_comprado),
					totalKg,
					totalPiezas,
					rendimiento:
						Number(s.kg_comprado) > 0
							? (totalKg / Number(s.kg_comprado)) * 100
							: 0,
				});
			}
			return result;
		}),

	// Detalle de una hoja con sus renglones
	get: protectedProcedure
		.input(z.object({ id: z.number() }))
		.query(async ({ input }) => {
			const [sheet] = await db
				.select()
				.from(yieldSheets)
				.where(eq(yieldSheets.id, input.id))
				.limit(1);
			if (!sheet) return null;
			const items = await db
				.select()
				.from(yieldSheetItems)
				.where(eq(yieldSheetItems.sheet_id, input.id))
				.orderBy(yieldSheetItems.sort_order);
			return { sheet, items };
		}),

	// Crear hoja nueva con sus renglones
	create: protectedProcedure
		.input(sheetInput)
		.mutation(async ({ ctx, input }) => {
			return db.transaction(async (tx) => {
				const [sheet] = await tx
					.insert(yieldSheets)
					.values({
						sheet_date: input.sheetDate ?? undefined,
						num_canales: input.numCanales,
						kg_comprado: input.kgComprado.toFixed(3),
						notes: input.notes,
						user_uid: ctx.user.id,
					})
					.returning();

				if (input.items.length > 0) {
					await tx.insert(yieldSheetItems).values(
						input.items.map((it, idx) => ({
							sheet_id: sheet.id,
							product_id: it.productId ?? null,
							product_name: it.productName,
							pieces: it.pieces,
							kg_total: it.kgTotal.toFixed(3),
							weighed: it.weighed,
							sort_order: it.sortOrder ?? idx,
						})),
					);
				}
				return { id: sheet.id };
			});
		}),

	// Actualizar hoja: reemplaza cabecera + renglones
	update: protectedProcedure
		.input(sheetInput.extend({ id: z.number() }))
		.mutation(async ({ input }) => {
			return db.transaction(async (tx) => {
				await tx
					.update(yieldSheets)
					.set({
						sheet_date: input.sheetDate ?? undefined,
						num_canales: input.numCanales,
						kg_comprado: input.kgComprado.toFixed(3),
						notes: input.notes,
						updated_at: new Date(),
					})
					.where(eq(yieldSheets.id, input.id));

				await tx
					.delete(yieldSheetItems)
					.where(eq(yieldSheetItems.sheet_id, input.id));

				if (input.items.length > 0) {
					await tx.insert(yieldSheetItems).values(
						input.items.map((it, idx) => ({
							sheet_id: input.id,
							product_id: it.productId ?? null,
							product_name: it.productName,
							pieces: it.pieces,
							kg_total: it.kgTotal.toFixed(3),
							weighed: it.weighed,
							sort_order: it.sortOrder ?? idx,
						})),
					);
				}
				return { id: input.id };
			});
		}),

	delete: protectedProcedure
		.input(z.object({ id: z.number() }))
		.mutation(async ({ input }) => {
			await db.delete(yieldSheets).where(eq(yieldSheets.id, input.id));
			return { success: true };
		}),
});
