import Anthropic from "@anthropic-ai/sdk";
import { TRPCError } from "@trpc/server";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod/v4";
import { db } from "@/lib/db";
import {
	inventoryTransactions,
	orderItems,
	orders,
	products,
	productTransformations,
} from "@/lib/db/schema";
import { protectedProcedure, router } from "../init";

const client = new Anthropic({
	apiKey: process.env.ANTHROPIC_API_KEY,
});

// ────────────────────────────────────────────
// HERRAMIENTAS DISPONIBLES (Tool Use schema)
// ────────────────────────────────────────────

const tools = [
	{
		name: "get_inventory_snapshot",
		description:
			"Obtiene el estado actual completo del inventario: canales y piezas con stock actual",
		input_schema: {
			type: "object",
			properties: {},
			required: [],
		},
	},
	{
		name: "get_product_detail",
		description:
			"Obtiene detalle de un producto: stock, recetas, variantes, velocidad de venta",
		input_schema: {
			type: "object",
			properties: {
				product_name: {
					type: "string",
					description:
						'Nombre del producto (ej. "JAMON", "PIERNA", "CANAL AMERICANO")',
				},
			},
			required: ["product_name"],
		},
	},
	{
		name: "get_demand",
		description:
			"Obtiene órdenes abiertas y demanda de piezas por período (hoy, esta semana, este mes)",
		input_schema: {
			type: "object",
			properties: {
				period: {
					type: "string",
					enum: ["hoy", "esta_semana", "este_mes"],
					description: "Período de análisis",
				},
			},
			required: ["period"],
		},
	},
	{
		name: "get_recipes",
		description:
			"Obtiene el árbol completo de despiece de un producto (recetas y variantes anidadas)",
		input_schema: {
			type: "object",
			properties: {
				product_name: {
					type: "string",
					description: "Nombre del producto (ej. PIERNA, JAMON)",
				},
			},
			required: ["product_name"],
		},
	},
	{
		name: "get_coverage",
		description:
			"Analiza si el stock actual cubre la demanda abierta, por producto",
		input_schema: {
			type: "object",
			properties: {},
			required: [],
		},
	},
	{
		name: "forecast_demand",
		description:
			"Predice demanda futura en días: 7, 14 o 30 días basado en historial",
		input_schema: {
			type: "object",
			properties: {
				days: {
					type: "number",
					enum: [7, 14, 30],
					description: "Horizonte de predicción en días",
				},
			},
			required: ["days"],
		},
	},
	{
		name: "execute_despiece",
		description:
			"🔒 ACCIÓN PROTEGIDA: Ejecuta despiece de N canales. REQUIERE confirmación del usuario.",
		input_schema: {
			type: "object",
			properties: {
				canal_type: {
					type: "string",
					enum: [
						"CANAL AMERICANO",
						"CANAL NACIONAL LADO LOMO",
						"CANAL NACIONAL LADO ESPILOMO",
					],
					description: "Tipo de canal a despiece",
				},
				quantity: {
					type: "number",
					description: "Cuántos canales despiece",
				},
			},
			required: ["canal_type", "quantity"],
		},
	},
	{
		name: "convert_to_variant",
		description:
			"🔒 ACCIÓN PROTEGIDA: Convierte N piezas a una variante (ej. JAMON → S/H). REQUIERE confirmación.",
		input_schema: {
			type: "object",
			properties: {
				base_product_name: {
					type: "string",
					description: "Producto base (ej. JAMON)",
				},
				variant_product_name: {
					type: "string",
					description: "Variante destino (ej. JAMON S/H)",
				},
				quantity: {
					type: "number",
					description: "Cuántas piezas convertir",
				},
			},
			required: ["base_product_name", "variant_product_name", "quantity"],
		},
	},
];

// ────────────────────────────────────────────
// EJECUCIÓN DE HERRAMIENTAS
// ────────────────────────────────────────────

async function executeTool(
	toolName: string,
	toolInput: Record<string, unknown>,
	userId: string,
): Promise<string> {
	switch (toolName) {
		case "get_inventory_snapshot":
			return await getInventorySnapshot(userId);

		case "get_product_detail":
			return await getProductDetail(toolInput.product_name as string, userId);

		case "get_demand":
			return await getDemand(toolInput.period as string, userId);

		case "get_recipes":
			return await getRecipes(toolInput.product_name as string, userId);

		case "get_coverage":
			return await getCoverage(userId);

		case "forecast_demand":
			return await forecastDemand(toolInput.days as number, userId);

		case "execute_despiece":
			return `🔒 ACCIÓN PROTEGIDA REQUERIDA:\n\nDespiece solicitado:\n- Tipo: ${toolInput.canal_type}\n- Cantidad: ${toolInput.quantity} canales\n\nEsto abrirá un diálogo de confirmación. El usuario debe presionar [Ejecutar] en la UI.`;

		case "convert_to_variant":
			return `🔒 ACCIÓN PROTEGIDA REQUERIDA:\n\nConversión solicitada:\n- Base: ${toolInput.base_product_name} → ${toolInput.variant_product_name}\n- Cantidad: ${toolInput.quantity} piezas\n\nEsto abrirá un diálogo de confirmación. El usuario debe presionar [Producir] en la UI.`;

		default:
			return `Herramienta desconocida: ${toolName}`;
	}
}

async function getInventorySnapshot(userId: string): Promise<string> {
	const prods = await db
		.select({
			id: products.id,
			name: products.name,
			stock_pieces: products.stock_pieces,
			stock_kg: products.stock_kg,
			is_parent: products.is_parent_product,
		})
		.from(products)
		.where(eq(products.user_uid, userId));

	const canals = prods.filter(
		(p) =>
			p.name.startsWith("CANAL ") ||
			p.name === "POLINESIO" ||
			p.name === "GENÉRICO",
	);
	const pieces = prods.filter(
		(p) =>
			!p.name.startsWith("CANAL ") &&
			p.name !== "POLINESIO" &&
			p.name !== "GENÉRICO",
	);

	const canalSummary = canals
		.map(
			(c) =>
				`  • ${c.name}: ${c.stock_pieces} pz (~${Number(c.stock_kg || 0).toFixed(0)} kg)`,
		)
		.join("\n");

	const pieceSummary = pieces
		.slice(0, 10)
		.map((p) => `  • ${p.name}: ${p.stock_pieces} pz`)
		.join("\n");

	const totalCanals = canals.reduce((s, c) => s + c.stock_pieces, 0);
	const totalPieces = pieces.reduce((s, p) => s + p.stock_pieces, 0);

	return `
┌─────────────────────────────────────┐
│ INVENTARIO ACTUAL (${new Date().toLocaleDateString("es-ES")})      │
├─────────────────────────────────────┤
│ CANALES:
${canalSummary}
│ Total canales: ${totalCanals} pz
│
│ PIEZAS PRINCIPALES:
${pieceSummary}
│ Total piezas: ${totalPieces} pz
└─────────────────────────────────────┘
`;
}

async function getProductDetail(
	productName: string,
	userId: string,
): Promise<string> {
	// Búsqueda fuzzy: exact match primero, luego substring insensible a mayúsculas
	let prod = await db
		.select()
		.from(products)
		.where(and(eq(products.user_uid, userId), eq(products.name, productName)))
		.limit(1);

	if (!prod.length) {
		// Búsqueda fuzzy (substring)
		const allProds = await db
			.select()
			.from(products)
			.where(eq(products.user_uid, userId));
		const matches = allProds.filter((p) =>
			p.name.toUpperCase().includes(productName.toUpperCase()),
		);
		if (matches.length === 1) {
			prod = [matches[0]];
		} else if (matches.length > 1) {
			const list = matches.map((m) => m.name).join(", ");
			return `❓ "${productName}" es ambiguo. Coincidencias: ${list}. Sé más específico.`;
		} else {
			return `❌ Producto "${productName}" no encontrado`;
		}
	}

	const p = prod[0];

	const variants = await db
		.select({
			child: products.name,
			ratio: productTransformations.yield_weight_ratio,
			is_variant: productTransformations.is_variant,
		})
		.from(productTransformations)
		.innerJoin(
			products,
			eq(productTransformations.child_product_id, products.id),
		)
		.where(
			and(
				eq(productTransformations.parent_product_id, p.id),
				eq(productTransformations.is_active, true),
			),
		);

	const variantLines = variants
		.filter((v) => v.is_variant)
		.map(
			(v) => `    → ${v.child} (${(Number(v.ratio) * 100).toFixed(0)}%, var)`,
		)
		.join("\n");

	const cutLines = variants
		.filter((v) => !v.is_variant)
		.map((v) => `    → ${v.child} (${(Number(v.ratio) * 100).toFixed(0)}%)`)
		.join("\n");

	return `
┌─────────────────────────────────────┐
│ ${productName}
├─────────────────────────────────────┤
│ Stock:         ${p.stock_pieces} pz
│               ~${Number(p.stock_kg || 0).toFixed(0)} kg
│ Promedio:      ${p.stock_pieces > 0 ? (Number(p.stock_kg || 0) / p.stock_pieces).toFixed(2) : "?"} kg/pz
│
${cutLines ? `│ Despiece:\n${cutLines}\n│` : ""}
${variantLines ? `│ Variantes:\n${variantLines}\n│` : ""}
│ Última compra: sin datos
│ Velocidad: sin datos
└─────────────────────────────────────┘
`;
}

async function getDemand(period: string, userId: string): Promise<string> {
	const now = new Date();
	const startDate = new Date();

	if (period === "hoy") {
		startDate.setHours(0, 0, 0, 0);
	} else if (period === "esta_semana") {
		startDate.setDate(now.getDate() - now.getDay());
		startDate.setHours(0, 0, 0, 0);
	} else {
		startDate.setDate(1);
		startDate.setHours(0, 0, 0, 0);
	}

	const openOrders = await db
		.select({
			order_id: orders.id,
			product_id: orderItems.product_id,
			product_name: products.name,
			quantity_pieces: orderItems.quantity_pieces,
			quantity_kg: orderItems.quantity_kg,
		})
		.from(orders)
		.innerJoin(orderItems, eq(orders.id, orderItems.order_id))
		.innerJoin(products, eq(orderItems.product_id, products.id))
		.where(
			and(
				eq(orders.user_uid, userId),
				// Status NOT IN (cancelled, completed, delivered, paid)
				sql`${orders.status} NOT IN ('CANCELADA', 'COMPLETADA', 'ENTREGADA', 'COBRADA')`,
				sql`${orders.created_at} >= ${startDate}`,
			),
		);

	const grouped: Record<string, { pz: number; kg: number }> = {};
	for (const item of openOrders) {
		if (!grouped[item.product_name]) {
			grouped[item.product_name] = { pz: 0, kg: 0 };
		}
		grouped[item.product_name].pz += item.quantity_pieces || 0;
		grouped[item.product_name].kg += Number(item.quantity_kg || 0);
	}

	const summary = Object.entries(grouped)
		.sort(([, a], [, b]) => b.pz - a.pz)
		.map(
			([name, { pz, kg }]) =>
				`  ${pz.toString().padStart(3)} pz ${name.padEnd(20)} (~${kg.toFixed(0)} kg)`,
		)
		.join("\n");

	const totalPz = Object.values(grouped).reduce((s, x) => s + x.pz, 0);
	const totalKg = Object.values(grouped).reduce((s, x) => s + x.kg, 0);
	const uniqueOrders = new Set(openOrders.map((o) => o.order_id)).size;

	const criticalItems = Object.entries(grouped).filter(
		([, { pz }]) => pz > 50,
	).length;

	return `
┌───────────────────────────────────────┐
│ DEMANDA: ${period.toUpperCase()}
├───────────────────────────────────────┤
│ Órdenes abiertas: ${uniqueOrders}
│ Items críticos (>50 pz): ${criticalItems}
│
│ PIEZAS PEDIDAS (ordenado):
${summary || "  (ninguna)"}
│
│ TOTALES: ${totalPz} pz | ~${totalKg.toFixed(0)} kg
│ Promedio/orden: ${uniqueOrders > 0 ? (totalPz / uniqueOrders).toFixed(1) : 0} pz
└───────────────────────────────────────┘
`;
}

async function getRecipes(
	productName: string,
	userId: string,
): Promise<string> {
	const prod = await db
		.select()
		.from(products)
		.where(and(eq(products.user_uid, userId), eq(products.name, productName)))
		.limit(1);

	if (!prod.length) return `❌ Producto "${productName}" no encontrado`;

	const recipes = await db
		.select({
			id: productTransformations.id,
			child_id: productTransformations.child_product_id,
			child_name: products.name,
			pieces: productTransformations.yield_quantity_pieces,
			ratio: productTransformations.yield_weight_ratio,
			is_variant: productTransformations.is_variant,
		})
		.from(productTransformations)
		.innerJoin(
			products,
			eq(productTransformations.child_product_id, products.id),
		)
		.where(
			and(
				eq(productTransformations.parent_product_id, prod[0].id),
				eq(productTransformations.is_active, true),
			),
		);

	const cuts = recipes.filter((r) => !r.is_variant);
	const variants = recipes.filter((r) => r.is_variant);

	const cutLines = cuts
		.map(
			(c) =>
				`  ├─ ${c.child_name.padEnd(15)} ${c.pieces} pz (${(Number(c.ratio) * 100).toFixed(0)}%)`,
		)
		.join("\n");

	const variantLines = variants
		.map(
			(v) =>
				`  │  ├─ ${v.child_name.padEnd(13)} (${(Number(v.ratio) * 100).toFixed(0)}%, var)`,
		)
		.join("\n");

	const totalRatio = cuts
		.filter((c) => !c.is_variant)
		.reduce((s, c) => s + Number(c.ratio), 0);
	const merma = Math.max(0, 100 - totalRatio * 100);

	return `
┌───────────────────────────────────────┐
│ RECETA: ${productName}
├───────────────────────────────────────┤
│
${cutLines}
${variantLines ? `${variantLines}\n` : ""}
│ Merma: ${merma.toFixed(1)}%
│ Rendimiento: ${(totalRatio * 100).toFixed(1)}%
│ Stock actual: ${prod[0].stock_pieces} pz
│ Si despieza TODO: ${prod[0].stock_pieces * Number(cuts[0]?.pieces || 1)} pz del corte
└───────────────────────────────────────┘
`;
}

async function getCoverage(userId: string): Promise<string> {
	const inventory = await db
		.select({
			name: products.name,
			stock: products.stock_pieces,
		})
		.from(products)
		.where(eq(products.user_uid, userId));

	const demand = await db
		.select({
			product_name: products.name,
			total_pz: sql<number>`SUM(${orderItems.quantity_pieces})`,
		})
		.from(orderItems)
		.innerJoin(orders, eq(orderItems.order_id, orders.id))
		.innerJoin(products, eq(orderItems.product_id, products.id))
		.where(
			and(
				eq(orders.user_uid, userId),
				sql`${orders.status} NOT IN ('CANCELADA', 'COMPLETADA', 'ENTREGADA', 'COBRADA')`,
			),
		)
		.groupBy(products.name);

	if (!demand.length) {
		return `
┌───────────────────────────────────────┐
│ COBERTURA DE DEMANDA
├───────────────────────────────────────┤
│ ✅ SIN DEMANDA ABIERTA
│ (no hay órdenes pendientes)
└───────────────────────────────────────┘
`;
	}

	const analysis = demand
		.map(({ product_name, total_pz }) => {
			const stock = (
				inventory.find((i) => i.name === product_name) || { stock: 0 }
			).stock;
			const shortage = Math.max(0, (total_pz || 0) - stock);
			const status = shortage === 0 ? "✅" : "❌";

			let msg = `${status} ${product_name.padEnd(20)} ${total_pz ?? 0} pz`;
			if (shortage > 0) {
				msg += ` (stock ${stock}, faltan ${shortage})`;
			}
			return `  ${msg}`;
		})
		.join("\n");

	const totalDemand = demand.reduce((s, d) => s + (d.total_pz ?? 0), 0);
	const totalStock = inventory.reduce((s, i) => s + i.stock, 0);
	const coverageRate =
		totalStock > 0 ? ((totalStock / totalDemand) * 100).toFixed(1) : "0";

	return `
┌───────────────────────────────────────┐
│ COBERTURA DE DEMANDA
├───────────────────────────────────────┤
│ Demanda total: ${totalDemand} pz
│ Stock disponible: ${totalStock} pz
│ Cobertura: ${coverageRate}%
│
${analysis}
│
└───────────────────────────────────────┘
`;
}

async function forecastDemand(days: number, userId: string): Promise<string> {
	// ML-lite: promedio de últimas 4 semanas + tendencia + ponderación reciente
	const fourWeeksAgo = new Date();
	fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
	const twoWeeksAgo = new Date();
	twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

	const historical = await db
		.select({
			product_name: products.name,
			total_pz: sql<number>`SUM(${orderItems.quantity_pieces})`,
			created_at: orders.created_at,
		})
		.from(orderItems)
		.innerJoin(orders, eq(orderItems.order_id, orders.id))
		.innerJoin(products, eq(orderItems.product_id, products.id))
		.where(
			and(
				eq(orders.user_uid, userId),
				sql`${orders.created_at} >= ${fourWeeksAgo}`,
				sql`${orders.status} NOT IN ('CANCELADA')`,
			),
		)
		.groupBy(products.name, orders.created_at);

	const productHistory: Record<string, { all: number; recent: number }> = {};
	for (const h of historical) {
		if (!productHistory[h.product_name]) {
			productHistory[h.product_name] = { all: 0, recent: 0 };
		}
		productHistory[h.product_name].all += h.total_pz || 0;
		if (h.created_at && h.created_at >= twoWeeksAgo) {
			productHistory[h.product_name].recent += h.total_pz || 0;
		}
	}

	const avgWeekly = Object.entries(productHistory).map(
		([name, { all, recent }]) => {
			const avg = all / 4;
			// Ponder reciente 60% + histórico 40%
			const weighted = (recent / 2) * 0.6 + avg * 0.4;
			const forecast = weighted * (days / 7);
			return {
				name,
				avg: weighted,
				forecast,
				confidence: recent > 0 ? "⭐⭐⭐⭐" : "⭐⭐",
			};
		},
	);

	avgWeekly.sort((a, b) => b.forecast - a.forecast);

	const forecastLines = avgWeekly
		.slice(0, 8)
		.map(
			(f) =>
				`  ${f.name.padEnd(20)} ${f.forecast.toFixed(0)} pz (${f.confidence})`,
		)
		.join("\n");

	const totalForecast = avgWeekly.reduce((s, f) => s + f.forecast, 0);
	const confidence = avgWeekly.some((f) => f.confidence === "⭐⭐⭐⭐")
		? "Alta (datos recientes)"
		: "Baja (datos históricos)";

	return `
┌───────────────────────────────────────┐
│ FORECAST: ${days} DÍAS
├───────────────────────────────────────┤
│ Total predicho: ${totalForecast.toFixed(0)} pz
│ Confianza: ${confidence}
│ Método: Ponderado (reciente 60% + histórico 40%)
│
│ TOP PRODUCTOS:
${forecastLines}
│
│ RECOMENDACIÓN:
│ Compra ~${(totalForecast * 1.3).toFixed(0)} pz (+30% buffer)
└───────────────────────────────────────┘
`;
}

// ────────────────────────────────────────────
// PROCEDURES
// ────────────────────────────────────────────

export const antonicellaRouter = router({
	chat: protectedProcedure
		.input(
			z.object({
				message: z.string().min(1),
				historyId: z.string().optional(),
			}),
		)
		.output(
			z.object({
				answer: z.string(),
				toolCalls: z.array(z.any()).optional(),
				requiresConfirmation: z.boolean().optional(),
				confirmationData: z.any().optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.user.id;

			// Llamar a Claude con tools
			let response = await client.messages.create({
				model: "claude-opus-4-8",
				max_tokens: 2000,
				tools: tools as any,
				messages: [
					{
						role: "user",
						content: input.message,
					},
				],
				system: `Eres Antonella, un asistente inteligente para Carnicos Gustavo (CEDIS - distribuidora de carne de cerdo).

Tu rol: Ayudar a optimizar inventario, producción y órdenes.

Reglas:
1. Responde en ESPAÑOL, profesional y directo
2. Para cada pregunta, usa las herramientas disponibles (tool_use)
3. Si el usuario pide una acción (despiece, conversión), PRIMERO llama a la herramienta
   que abre el diálogo (sin ejecutar aún), LUEGO explica lo que va a pasar
4. Nunca ejecutes acciones sin confirmación del usuario
5. Sé conciso pero completo
6. Si no tienes datos, di "Sin datos registrados"

Contexto de negocio:
- Productos: CANALES (americano, nacional lomo, nacional espilomo)
- Despiece: CANALES → PIERNAS, LOMOS, CUEROS, etc.
- Segundo nivel: PIERNA → JAMON (+ variantes S/H, C/G, PINTO)
- Demanda: órdenes abiertas (status != CANCELADA/COMPLETADA/etc)
- Stock: pieces (pz) + kg calculados
- Recetas: definidas en product_transformations`,
			});

			// Procesar content blocks
			const textBlock = response.content.find((b: any) => b.type === "text");
			let answerText = textBlock ? (textBlock as any).text : "";

			const toolCalls: any[] = [];
			let requiresConfirmation = false;
			let confirmationData: Record<string, unknown> = {};

			for (const block of response.content) {
				if (block.type === "tool_use") {
					const toolUse = block as any;
					const toolResult = await executeTool(
						toolUse.name,
						toolUse.input,
						userId,
					);

					toolCalls.push({
						name: toolUse.name,
						input: toolUse.input,
						result: toolResult,
					});

					// Si es acción protegida, marcar para confirmación
					if (
						toolUse.name === "execute_despiece" ||
						toolUse.name === "convert_to_variant"
					) {
						requiresConfirmation = true;
						confirmationData = {
							toolName: toolUse.name,
							toolInput: toolUse.input,
						};
					}

					// Continuar conversación con resultado
					response = await client.messages.create({
						model: "claude-opus-4-8",
						max_tokens: 2000,
						tools: tools as any,
						messages: [
							...response.messages,
							{
								role: "assistant",
								content: response.content,
							},
							{
								role: "user",
								content: [
									{
										type: "tool_result",
										tool_use_id: toolUse.id,
										content: toolResult,
									},
								],
							},
						],
						system:
							"Eres Antonella, asistente de Carnicos Gustavo. (mismo contexto)",
					});

					const newTextBlock = response.content.find(
						(b: any) => b.type === "text",
					);
					if (newTextBlock) {
						answerText = (newTextBlock as any).text;
					}
				}
			}

			return {
				answer: answerText,
				toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
				requiresConfirmation,
				confirmationData: requiresConfirmation ? confirmationData : undefined,
			};
		}),

	executeAction: protectedProcedure
		.input(
			z.object({
				actionName: z.enum(["execute_despiece", "convert_to_variant"]),
				actionInput: z.any(),
			}),
		)
		.output(z.object({ success: z.boolean(), message: z.string() }))
		.mutation(async ({ ctx, input }) => {
			// Aquí iría la ejecución real de la acción
			// Por ahora, retorna un placeholder
			return {
				success: false,
				message: "Acción no ejecutada aún (Fase A: solo lectura)",
			};
		}),
});
