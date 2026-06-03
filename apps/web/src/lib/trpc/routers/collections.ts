import { z } from "zod/v4";
import { protectedProcedure, router } from "../init";
import { db } from "@/lib/db";
import {
	creditAccounts,
	creditCharges,
	creditPayments,
} from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";

export const collectionsRouter = router({
	// Resumen de cuentas por cobrar: cliente, saldo, antigüedad
	listAccounts: protectedProcedure.input(z.void()).query(async ({ ctx }) => {
		const rows = await db.execute(sql`
			SELECT
				c.id                                   AS customer_id,
				c.name                                 AS name,
				c.phone                                AS phone,
				COALESCE(ca.credit_limit, 0)           AS credit_limit,
				COALESCE(ca.terms_days, 0)             AS terms_days,
				COALESCE(ch.total_charges, 0)          AS total_charges,
				COALESCE(pa.total_payments, 0)         AS total_payments,
				ch.oldest_open                         AS oldest_charge
			FROM customers c
			LEFT JOIN credit_accounts ca ON ca.customer_id = c.id
			LEFT JOIN (
				SELECT customer_id, SUM(amount) AS total_charges, MIN(charge_date) AS oldest_open
				FROM credit_charges GROUP BY customer_id
			) ch ON ch.customer_id = c.id
			LEFT JOIN (
				SELECT customer_id, SUM(amount) AS total_payments
				FROM credit_payments GROUP BY customer_id
			) pa ON pa.customer_id = c.id
			WHERE (c.user_uid = ${ctx.user.id} OR c.user_uid = 'system')
			ORDER BY (COALESCE(ch.total_charges,0) - COALESCE(pa.total_payments,0)) DESC
		`);

		return (rows as any[]).map((r) => {
			const charges = Number(r.total_charges) || 0;
			const payments = Number(r.total_payments) || 0;
			const balance = charges - payments;
			let diasVencido = 0;
			if (r.oldest_charge) {
				const d = new Date(r.oldest_charge);
				diasVencido = Math.max(
					0,
					Math.floor((Date.now() - d.getTime()) / 86400000),
				);
			}
			return {
				customerId: Number(r.customer_id),
				name: r.name as string | null,
				phone: r.phone as string | null,
				creditLimit: Number(r.credit_limit) || 0,
				termsDays: Number(r.terms_days) || 0,
				totalCharges: charges,
				totalPayments: payments,
				balance,
				diasVencido,
			};
		});
	}),

	// Estado de cuenta de un cliente: cargos + abonos en orden, con saldo
	getStatement: protectedProcedure
		.input(z.object({ customerId: z.number() }))
		.query(async ({ input }) => {
			const charges = await db
				.select()
				.from(creditCharges)
				.where(eq(creditCharges.customer_id, input.customerId));
			const payments = await db
				.select()
				.from(creditPayments)
				.where(eq(creditPayments.customer_id, input.customerId));

			const ledger = [
				...charges.map((c) => ({
					tipo: "cargo" as const,
					id: c.id,
					fecha: c.charge_date,
					concepto: c.concept ?? (c.source === "pedido" ? `Pedido #${c.order_id}` : "Cargo"),
					cargo: Number(c.amount),
					abono: 0,
					orderId: c.order_id ?? null,
					source: c.source,
				})),
				...payments.map((p) => ({
					tipo: "abono" as const,
					id: p.id,
					fecha: p.payment_date,
					concepto: p.method ? `Abono (${p.method})` : "Abono",
					cargo: 0,
					abono: Number(p.amount),
					orderId: null as number | null,
					source: "abono",
				})),
			].sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)));

			const totalCargos = charges.reduce((s, c) => s + Number(c.amount), 0);
			const totalAbonos = payments.reduce((s, p) => s + Number(p.amount), 0);

			return {
				ledger,
				totalCargos,
				totalAbonos,
				balance: totalCargos - totalAbonos,
			};
		}),

	// Capturar un ticket viejo / cargo manual
	addCharge: protectedProcedure
		.input(
			z.object({
				customerId: z.number(),
				amount: z.number().positive(),
				concept: z.string().optional(),
				chargeDate: z.string().optional(),
				source: z.enum(["pedido", "ticket_viejo"]).default("ticket_viejo"),
				orderId: z.number().optional(),
			}),
		)
		.mutation(async ({ input }) => {
			const [row] = await db
				.insert(creditCharges)
				.values({
					customer_id: input.customerId,
					order_id: input.orderId ?? null,
					amount: input.amount.toFixed(2),
					concept: input.concept,
					charge_date: input.chargeDate ?? undefined,
					source: input.source,
				})
				.returning();
			return { id: row.id };
		}),

	// Registrar un abono / pago
	addPayment: protectedProcedure
		.input(
			z.object({
				customerId: z.number(),
				amount: z.number().positive(),
				method: z.string().optional(),
				paymentDate: z.string().optional(),
				notes: z.string().optional(),
			}),
		)
		.mutation(async ({ input }) => {
			const [row] = await db
				.insert(creditPayments)
				.values({
					customer_id: input.customerId,
					amount: input.amount.toFixed(2),
					method: input.method,
					payment_date: input.paymentDate ?? undefined,
					notes: input.notes,
				})
				.returning();
			return { id: row.id };
		}),

	// Corregir un cargo mal capturado
	updateCharge: protectedProcedure
		.input(
			z.object({
				id: z.number(),
				amount: z.number().positive(),
				concept: z.string().optional(),
				chargeDate: z.string().optional(),
			}),
		)
		.mutation(async ({ input }) => {
			await db
				.update(creditCharges)
				.set({
					amount: input.amount.toFixed(2),
					concept: input.concept,
					charge_date: input.chargeDate ?? undefined,
				})
				.where(eq(creditCharges.id, input.id));
			return { success: true };
		}),

	// Eliminar / anular un cargo
	deleteCharge: protectedProcedure
		.input(z.object({ id: z.number() }))
		.mutation(async ({ input }) => {
			await db.delete(creditCharges).where(eq(creditCharges.id, input.id));
			return { success: true };
		}),

	// Corregir un abono mal capturado
	updatePayment: protectedProcedure
		.input(
			z.object({
				id: z.number(),
				amount: z.number().positive(),
				method: z.string().optional(),
				paymentDate: z.string().optional(),
				notes: z.string().optional(),
			}),
		)
		.mutation(async ({ input }) => {
			await db
				.update(creditPayments)
				.set({
					amount: input.amount.toFixed(2),
					method: input.method,
					payment_date: input.paymentDate ?? undefined,
					notes: input.notes,
				})
				.where(eq(creditPayments.id, input.id));
			return { success: true };
		}),

	// Eliminar / anular un abono
	deletePayment: protectedProcedure
		.input(z.object({ id: z.number() }))
		.mutation(async ({ input }) => {
			await db.delete(creditPayments).where(eq(creditPayments.id, input.id));
			return { success: true };
		}),

	// Configurar límite de crédito y plazo del cliente
	setAccount: protectedProcedure
		.input(
			z.object({
				customerId: z.number(),
				creditLimit: z.number().min(0).default(0),
				termsDays: z.number().int().min(0).default(0),
			}),
		)
		.mutation(async ({ input }) => {
			await db
				.insert(creditAccounts)
				.values({
					customer_id: input.customerId,
					credit_limit: input.creditLimit.toFixed(2),
					terms_days: input.termsDays,
				})
				.onConflictDoUpdate({
					target: creditAccounts.customer_id,
					set: {
						credit_limit: input.creditLimit.toFixed(2),
						terms_days: input.termsDays,
						updated_at: sql`now()`,
					},
				});
			return { success: true };
		}),
});
