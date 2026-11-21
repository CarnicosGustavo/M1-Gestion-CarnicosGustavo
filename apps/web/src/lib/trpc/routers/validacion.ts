import { sql } from "drizzle-orm";
import { z } from "zod/v4";
import { db } from "@/lib/db";
import { adminProcedure, router } from "../init";

// ============================================================
// Validación de saldos legacy (MyBusinessPOS → crédito)
// Fuente: vistas v_validacion_saldos / v_validacion_docs (envuelven
// staging.legacy_credit_*). La validación se persiste con la RPC atómica
// public.validar_saldo_legacy (crea/actualiza la cuenta de crédito, siembra el
// saldo inicial como cargo idempotente y marca validado en staging).
// Montos: las vistas vienen en PESOS; aquí se exponen en CENTAVOS (convención
// de formatCurrency en M1).
// ============================================================

const num = (v: unknown) => Number(v ?? 0);
const toCents = (v: unknown) => Math.round(Number(v ?? 0) * 100);

function rowsOf(res: unknown): Record<string, unknown>[] {
	if (Array.isArray(res)) return res as Record<string, unknown>[];
	const r = res as { rows?: Record<string, unknown>[] };
	return r?.rows ?? [];
}

function docEstado(
	importeCents: number,
	saldoCents: number,
	venc: string | null,
): string {
	if (saldoCents <= 0) return "Aplicado";
	if (saldoCents < importeCents) return "Parcial";
	if (venc && new Date(venc) < new Date()) return "Vencido";
	return "Pendiente";
}

const docSchema = z.object({
	fecha: z.string().nullable(),
	venc: z.string().nullable(),
	tipo: z.string().nullable(),
	ref: z.string().nullable(),
	importe: z.number(),
	saldo: z.number(),
	estado: z.string(),
	obs: z.string(),
});

const clienteSchema = z.object({
	id: z.string(),
	customerId: z.number(),
	nombre: z.string(),
	saldo: z.number(),
	limite: z.number(),
	dias: z.number(),
	ndoc: z.number(),
	validado: z.boolean(),
	importado: z.boolean(),
	validadoPor: z.string().nullable(),
	validadoAt: z.string().nullable(),
	docs: z.array(docSchema),
});

export const validacionRouter = router({
	list: adminProcedure
		.meta({
			openapi: {
				method: "GET",
				path: "/validacion",
				tags: ["Validacion"],
				summary: "List legacy balances to validate",
			},
		})
		.input(z.void())
		.output(z.array(clienteSchema))
		.query(async () => {
			const [cliRes, docRes] = await Promise.all([
				db.execute(sql`select * from v_validacion_saldos`),
				db.execute(sql`select * from v_validacion_docs`),
			]);
			const cli = rowsOf(cliRes);
			const docs = rowsOf(docRes);

			const byCust = new Map<number, z.infer<typeof docSchema>[]>();
			for (const d of docs) {
				const cid = Number(d.customer_id);
				const importe = toCents(d.importe);
				const saldo = toCents(d.saldo);
				const venc = d.venc != null ? String(d.venc) : null;
				const arr = byCust.get(cid) ?? [];
				arr.push({
					fecha: d.fecha != null ? String(d.fecha) : null,
					venc,
					tipo: d.tipo != null ? String(d.tipo) : null,
					ref: d.ref != null ? String(d.ref) : null,
					importe,
					saldo,
					estado: docEstado(importe, saldo, venc),
					obs: d.obs != null ? String(d.obs) : "",
				});
				byCust.set(cid, arr);
			}
			for (const arr of byCust.values()) {
				arr.sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)));
			}

			return cli
				.map((c) => {
					const cid = Number(c.customer_id);
					const docsC = byCust.get(cid) ?? [];
					return {
						id: c.id != null ? String(c.id) : String(cid).padStart(6, "0"),
						customerId: cid,
						nombre: c.nombre != null ? String(c.nombre) : `Cliente #${cid}`,
						saldo: toCents(c.saldo),
						limite: toCents(c.limite),
						dias: num(c.dias),
						ndoc: num(c.ndoc) || docsC.length,
						validado: !!c.validado,
						importado: !!c.importado,
						validadoPor: c.validado_por != null ? String(c.validado_por) : null,
						validadoAt:
							c.validado_at != null ? String(c.validado_at).slice(0, 10) : null,
						docs: docsC,
					};
				})
				.sort((a, b) => b.saldo - a.saldo);
		}),

	validate: adminProcedure
		.meta({
			openapi: {
				method: "POST",
				path: "/validacion/validate",
				tags: ["Validacion"],
				summary: "Promote a legacy balance to credit",
			},
		})
		.input(z.object({ customerId: z.number().int() }))
		.output(z.object({ ok: z.boolean(), customerId: z.number() }))
		.mutation(async ({ ctx, input }) => {
			const usuario = ctx.user.name || ctx.user.email || "admin";
			await db.execute(
				sql`select validar_saldo_legacy(${input.customerId}::int, ${usuario}::text)`,
			);
			return { ok: true, customerId: input.customerId };
		}),
});
