import Anthropic from "@anthropic-ai/sdk";
import {
	antonellaConfig,
	antonellaDatasetRows,
	antonellaDatasets,
	antonellaMemories,
} from "@finopenpos/db/schema";
import { TRPCError } from "@trpc/server";
import { and, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { z } from "zod/v4";
import { db } from "@/lib/db";
import {
	creditAccounts,
	creditCharges,
	creditPayments,
	customerPrices,
	customers,
	inventoryTransactions,
	orderItems,
	orders,
	priceListItems,
	priceLists,
	products,
	productTransformations,
} from "@/lib/db/schema";
import { protectedProcedure, router } from "../init";

// System prompt por defecto (precargado). El usuario lo puede editar en
// /admin/settings/antonella; si lo deja vacío, se usa éste.
export const DEFAULT_SYSTEM_PROMPT = `Eres Antonella, un asistente inteligente para Carnicos Gustavo (CEDIS - distribuidora de carne de cerdo).

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
- Recetas: definidas en product_transformations
- Clientes: tienen saldo de crédito (cargos − abonos), límite de crédito y una
  lista de precios asignada. Usa las herramientas de cliente para consultar
  estado de cuenta, deudores y precios; NUNCA inventes saldos ni precios.`;

// Metadata para la UI de configuración: categoría y nivel de riesgo de cada
// herramienta integrada. El `name` debe coincidir con `tools[].name`.
export const TOOL_META: Record<
	string,
	{ label: string; category: "lectura" | "accion"; danger: boolean }
> = {
	get_inventory_snapshot: {
		label: "Estado del inventario",
		category: "lectura",
		danger: false,
	},
	get_product_detail: {
		label: "Detalle de un producto",
		category: "lectura",
		danger: false,
	},
	get_demand: {
		label: "Demanda / pedidos abiertos",
		category: "lectura",
		danger: false,
	},
	get_recipes: {
		label: "Árbol de recetas",
		category: "lectura",
		danger: false,
	},
	get_coverage: {
		label: "Cobertura de demanda",
		category: "lectura",
		danger: false,
	},
	get_customer_account: {
		label: "Estado de cuenta de cliente",
		category: "lectura",
		danger: false,
	},
	list_debtors: {
		label: "Clientes con saldo pendiente",
		category: "lectura",
		danger: false,
	},
	get_customer_prices: {
		label: "Precios de un cliente",
		category: "lectura",
		danger: false,
	},
	forecast_demand: {
		label: "Pronóstico de demanda",
		category: "lectura",
		danger: false,
	},
	execute_despiece: {
		label: "Ejecutar despiece",
		category: "accion",
		danger: true,
	},
	convert_to_variant: {
		label: "Convertir a variante",
		category: "accion",
		danger: true,
	},
	remember: { label: "Memorizar un dato", category: "lectura", danger: false },
	recall: { label: "Recordar (buscar memoria)", category: "lectura", danger: false },
	list_memories: { label: "Listar recuerdos", category: "lectura", danger: false },
	forget: { label: "Olvidar un dato", category: "lectura", danger: false },
	create_dataset: {
		label: "Crear tabla de memoria",
		category: "lectura",
		danger: false,
	},
	add_data: { label: "Agregar dato a tabla", category: "lectura", danger: false },
	query_dataset: { label: "Leer tabla de memoria", category: "lectura", danger: false },
	list_datasets: { label: "Listar tablas", category: "lectura", danger: false },
};

// Inicialización perezosa: evita que el SDK lance error al cargar el módulo
// si ANTHROPIC_API_KEY no está presente en build time.
let _client: Anthropic | null = null;
function getClient(): Anthropic {
	if (!_client) {
		const apiKey = process.env.ANTHROPIC_API_KEY;
		if (!apiKey) {
			throw new TRPCError({
				code: "INTERNAL_SERVER_ERROR",
				message:
					"Antonella no está configurada: falta ANTHROPIC_API_KEY en el servidor.",
			});
		}
		_client = new Anthropic({ apiKey });
	}
	return _client;
}

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
		name: "get_customer_account",
		description:
			"Estado de cuenta de un cliente: saldo pendiente, límite de crédito, crédito disponible y últimos movimientos (cargos y abonos)",
		input_schema: {
			type: "object",
			properties: {
				customer_name: {
					type: "string",
					description:
						"Nombre del cliente o negocio (ej. \"Carnicería Balderas\")",
				},
			},
			required: ["customer_name"],
		},
	},
	{
		name: "list_debtors",
		description:
			"Lista los clientes que tienen saldo pendiente (deben dinero), ordenados de mayor a menor, con el total adeudado",
		input_schema: {
			type: "object",
			properties: {},
			required: [],
		},
	},
	{
		name: "get_customer_prices",
		description:
			"Precios de un cliente: su lista de precios asignada y precios propios (overrides). Si se indica un producto, resuelve el precio final que paga ese cliente por ese producto",
		input_schema: {
			type: "object",
			properties: {
				customer_name: {
					type: "string",
					description: "Nombre del cliente o negocio",
				},
				product_name: {
					type: "string",
					description:
						"Opcional. Producto para resolver su precio (ej. \"LOMO\", \"JAMON\")",
				},
			},
			required: ["customer_name"],
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
	// ── MEMORIA ──
	{
		name: "remember",
		description:
			"Guarda en memoria permanente un dato, detalle, preferencia o estadística para recordarlo en futuras conversaciones (ej. 'el proveedor La Barca entrega los martes', 'al cliente X le gusta el jamón S/H').",
		input_schema: {
			type: "object",
			properties: {
				title: { type: "string", description: "Título corto del recuerdo" },
				content: {
					type: "string",
					description: "El dato a recordar, completo",
				},
				category: {
					type: "string",
					description:
						"Categoría: proveedores, clientes, operacion, precios, estadisticas, preferencias, general",
				},
				tags: {
					type: "array",
					items: { type: "string" },
					description: "Etiquetas para encontrarlo después",
				},
			},
			required: ["title", "content"],
		},
	},
	{
		name: "recall",
		description:
			"Busca en la memoria permanente recuerdos relacionados con una consulta (busca en título, contenido y etiquetas).",
		input_schema: {
			type: "object",
			properties: {
				query: { type: "string", description: "Qué buscar" },
			},
			required: ["query"],
		},
	},
	{
		name: "list_memories",
		description:
			"Lista los recuerdos guardados, opcionalmente filtrando por categoría.",
		input_schema: {
			type: "object",
			properties: {
				category: {
					type: "string",
					description: "Categoría a filtrar (opcional)",
				},
			},
			required: [],
		},
	},
	{
		name: "forget",
		description: "Borra un recuerdo por su título exacto.",
		input_schema: {
			type: "object",
			properties: {
				title: {
					type: "string",
					description: "Título exacto del recuerdo a borrar",
				},
			},
			required: ["title"],
		},
	},
	// ── DATASETS (bases de datos que Antonella crea) ──
	{
		name: "create_dataset",
		description:
			"Crea una 'base de datos' (tabla) para memorizar cosas cotidianas de forma estructurada (ej. un registro de mermas diarias, control de temperatura de cámaras, bitácora de proveedores).",
		input_schema: {
			type: "object",
			properties: {
				name: {
					type: "string",
					description: "Nombre de la tabla (ej. 'mermas_diarias')",
				},
				description: { type: "string", description: "Para qué sirve" },
				columns: {
					type: "array",
					items: { type: "string" },
					description:
						"Nombres de las columnas (ej. ['fecha','producto','kg_merma'])",
				},
			},
			required: ["name", "columns"],
		},
	},
	{
		name: "add_data",
		description:
			"Agrega una fila de datos a una tabla creada con create_dataset.",
		input_schema: {
			type: "object",
			properties: {
				dataset: { type: "string", description: "Nombre de la tabla" },
				row: {
					type: "object",
					description: "Objeto con los valores (clave=columna, valor=dato)",
				},
			},
			required: ["dataset", "row"],
		},
	},
	{
		name: "query_dataset",
		description:
			"Lee las filas de una tabla (las últimas N), para consultarlas o analizarlas.",
		input_schema: {
			type: "object",
			properties: {
				dataset: { type: "string", description: "Nombre de la tabla" },
				limit: {
					type: "number",
					description: "Cuántas filas traer (default 50)",
				},
			},
			required: ["dataset"],
		},
	},
	{
		name: "list_datasets",
		description:
			"Lista todas las tablas que Antonella ha creado, con su descripción y columnas.",
		input_schema: { type: "object", properties: {}, required: [] },
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

		case "get_customer_account":
			return await getCustomerAccount(
				toolInput.customer_name as string,
				userId,
			);

		case "list_debtors":
			return await listDebtors(userId);

		case "get_customer_prices":
			return await getCustomerPrices(
				toolInput.customer_name as string,
				toolInput.product_name as string | undefined,
				userId,
			);

		case "forecast_demand":
			return await forecastDemand(toolInput.days as number, userId);

		case "execute_despiece":
			return `🔒 ACCIÓN PROTEGIDA REQUERIDA:\n\nDespiece solicitado:\n- Tipo: ${toolInput.canal_type}\n- Cantidad: ${toolInput.quantity} canales\n\nEsto abrirá un diálogo de confirmación. El usuario debe presionar [Ejecutar] en la UI.`;

		case "convert_to_variant":
			return `🔒 ACCIÓN PROTEGIDA REQUERIDA:\n\nConversión solicitada:\n- Base: ${toolInput.base_product_name} → ${toolInput.variant_product_name}\n- Cantidad: ${toolInput.quantity} piezas\n\nEsto abrirá un diálogo de confirmación. El usuario debe presionar [Producir] en la UI.`;

		case "remember":
			return await rememberFact(toolInput, userId);
		case "recall":
			return await recallMemories(toolInput.query as string, userId);
		case "list_memories":
			return await listMemories(toolInput.category as string | undefined, userId);
		case "forget":
			return await forgetMemory(toolInput.title as string, userId);
		case "create_dataset":
			return await createDataset(toolInput, userId);
		case "add_data":
			return await addDatasetRow(toolInput, userId);
		case "query_dataset":
			return await queryDataset(toolInput, userId);
		case "list_datasets":
			return await listDatasets(userId);

		default:
			return `Herramienta desconocida: ${toolName}`;
	}
}

// ───── Implementación: CLIENTES / CRÉDITO / PRECIOS ─────

const fmtMoney = (n: number) =>
	n.toLocaleString("es-MX", { style: "currency", currency: "MXN" });

async function findCustomer(name: string, userId: string) {
	const q = `%${(name || "").trim()}%`;
	return (
		await db
			.select()
			.from(customers)
			.where(and(eq(customers.user_uid, userId), ilike(customers.name, q)))
			.limit(1)
	)[0];
}

async function balanceFor(customerId: number): Promise<number> {
	const [c] = await db
		.select({ total: sql<string>`coalesce(sum(${creditCharges.amount}), 0)` })
		.from(creditCharges)
		.where(eq(creditCharges.customer_id, customerId));
	const [p] = await db
		.select({ total: sql<string>`coalesce(sum(${creditPayments.amount}), 0)` })
		.from(creditPayments)
		.where(eq(creditPayments.customer_id, customerId));
	return Number(c?.total ?? 0) - Number(p?.total ?? 0);
}

async function getCustomerAccount(
	name: string,
	userId: string,
): Promise<string> {
	const cust = await findCustomer(name, userId);
	if (!cust) return `No encontré ningún cliente que coincida con "${name}".`;

	const balance = await balanceFor(cust.id);
	const [acct] = await db
		.select()
		.from(creditAccounts)
		.where(eq(creditAccounts.customer_id, cust.id))
		.limit(1);
	const limit = acct ? Number(acct.credit_limit) : 0;

	const charges = await db
		.select()
		.from(creditCharges)
		.where(eq(creditCharges.customer_id, cust.id));
	const payments = await db
		.select()
		.from(creditPayments)
		.where(eq(creditPayments.customer_id, cust.id));
	const ledger = [
		...charges.map((c) => ({
			fecha: String(c.charge_date ?? ""),
			txt: `cargo ${fmtMoney(Number(c.amount))}${c.concept ? ` — ${c.concept}` : ""}`,
		})),
		...payments.map((p) => ({
			fecha: String(p.payment_date ?? ""),
			txt: `abono ${fmtMoney(Number(p.amount))}${p.method ? ` (${p.method})` : ""}`,
		})),
	]
		.sort((a, b) => b.fecha.localeCompare(a.fecha))
		.slice(0, 8);

	const lines = [
		`Cliente: ${cust.name}`,
		`Saldo pendiente: ${fmtMoney(balance)}`,
	];
	if (limit > 0) {
		lines.push(`Límite de crédito: ${fmtMoney(limit)}`);
		lines.push(
			`Crédito disponible: ${fmtMoney(Math.max(0, limit - balance))}`,
		);
	} else {
		lines.push("Sin límite de crédito configurado.");
	}
	if (ledger.length) {
		lines.push("Últimos movimientos:");
		lines.push(...ledger.map((l) => `  • ${l.fecha}: ${l.txt}`));
	} else {
		lines.push("Sin movimientos de cobranza registrados.");
	}
	return lines.join("\n");
}

async function listDebtors(userId: string): Promise<string> {
	const custs = await db
		.select({ id: customers.id, name: customers.name })
		.from(customers)
		.where(eq(customers.user_uid, userId));
	if (!custs.length) return "Sin clientes registrados.";

	const ids = custs.map((c) => c.id);
	const chargeRows = await db
		.select({
			cid: creditCharges.customer_id,
			total: sql<string>`coalesce(sum(${creditCharges.amount}), 0)`,
		})
		.from(creditCharges)
		.where(inArray(creditCharges.customer_id, ids))
		.groupBy(creditCharges.customer_id);
	const payRows = await db
		.select({
			cid: creditPayments.customer_id,
			total: sql<string>`coalesce(sum(${creditPayments.amount}), 0)`,
		})
		.from(creditPayments)
		.where(inArray(creditPayments.customer_id, ids))
		.groupBy(creditPayments.customer_id);

	const charged = new Map(chargeRows.map((r) => [r.cid, Number(r.total)]));
	const paid = new Map(payRows.map((r) => [r.cid, Number(r.total)]));

	const debtors = custs
		.map((c) => ({
			name: c.name,
			balance: (charged.get(c.id) ?? 0) - (paid.get(c.id) ?? 0),
		}))
		.filter((c) => c.balance > 0.005)
		.sort((a, b) => b.balance - a.balance);

	if (!debtors.length) return "Ningún cliente tiene saldo pendiente. 🎉";

	const total = debtors.reduce((s, d) => s + d.balance, 0);
	const top = debtors.slice(0, 20);
	const lines = top.map((d) => `  • ${d.name}: ${fmtMoney(d.balance)}`);
	if (debtors.length > top.length)
		lines.push(`  …y ${debtors.length - top.length} más`);
	return [
		`Clientes con saldo pendiente: ${debtors.length}`,
		`Total por cobrar: ${fmtMoney(total)}`,
		...lines,
	].join("\n");
}

async function getCustomerPrices(
	name: string,
	productName: string | undefined,
	userId: string,
): Promise<string> {
	const cust = await findCustomer(name, userId);
	if (!cust) return `No encontré ningún cliente que coincida con "${name}".`;

	let listName = "ninguna";
	if (cust.price_list_id) {
		const [pl] = await db
			.select({ name: priceLists.name })
			.from(priceLists)
			.where(eq(priceLists.id, cust.price_list_id))
			.limit(1);
		if (pl) listName = pl.name;
	}

	if (productName?.trim()) {
		const [prod] = await db
			.select({
				id: products.id,
				name: products.name,
				price_per_kg: products.price_per_kg,
				price_per_piece: products.price_per_piece,
			})
			.from(products)
			.where(
				and(
					eq(products.user_uid, userId),
					ilike(products.name, `%${productName.trim()}%`),
				),
			)
			.limit(1);
		if (!prod)
			return `Cliente ${cust.name} (lista: ${listName}). No encontré el producto "${productName}".`;

		const [ovr] = await db
			.select()
			.from(customerPrices)
			.where(
				and(
					eq(customerPrices.customer_id, cust.id),
					eq(customerPrices.product_id, prod.id),
				),
			)
			.limit(1);
		let perKg: number | null = ovr?.price_per_kg ? Number(ovr.price_per_kg) : null;
		let perPiece: number | null = ovr?.price_per_piece
			? Number(ovr.price_per_piece)
			: null;
		let source: string | null =
			ovr && (perKg !== null || perPiece !== null)
				? "precio propio del cliente"
				: null;

		if (!source && cust.price_list_id) {
			const [li] = await db
				.select()
				.from(priceListItems)
				.where(
					and(
						eq(priceListItems.price_list_id, cust.price_list_id),
						eq(priceListItems.product_id, prod.id),
					),
				)
				.limit(1);
			if (li && (li.unit_price_per_kg || li.unit_price_per_piece)) {
				perKg = li.unit_price_per_kg ? Number(li.unit_price_per_kg) : null;
				perPiece = li.unit_price_per_piece
					? Number(li.unit_price_per_piece)
					: null;
				source = `lista "${listName}"`;
			}
		}
		if (!source) {
			perKg = prod.price_per_kg ? Number(prod.price_per_kg) : null;
			perPiece = prod.price_per_piece ? Number(prod.price_per_piece) : null;
			source = "precio base del producto";
		}

		const parts: string[] = [];
		if (perKg !== null) parts.push(`${fmtMoney(perKg)}/kg`);
		if (perPiece !== null) parts.push(`${fmtMoney(perPiece)}/pza`);
		const priceTxt = parts.length ? parts.join(" · ") : "sin precio definido";
		return `Cliente: ${cust.name}\nProducto: ${prod.name}\nPrecio: ${priceTxt}\nOrigen: ${source}`;
	}

	const overrides = await db
		.select({
			pname: products.name,
			per_kg: customerPrices.price_per_kg,
			per_piece: customerPrices.price_per_piece,
		})
		.from(customerPrices)
		.innerJoin(products, eq(customerPrices.product_id, products.id))
		.where(eq(customerPrices.customer_id, cust.id))
		.limit(30);

	const lines = [
		`Cliente: ${cust.name}`,
		`Lista de precios asignada: ${listName}`,
	];
	if (overrides.length) {
		lines.push(`Precios propios (overrides): ${overrides.length}`);
		lines.push(
			...overrides.map((o) => {
				const p: string[] = [];
				if (o.per_kg) p.push(`${fmtMoney(Number(o.per_kg))}/kg`);
				if (o.per_piece) p.push(`${fmtMoney(Number(o.per_piece))}/pza`);
				return `  • ${o.pname}: ${p.join(" · ") || "—"}`;
			}),
		);
	} else {
		lines.push("Sin precios propios; usa la lista asignada o el precio base.");
	}
	return lines.join("\n");
}

// ───── Implementación: MEMORIA ─────

async function rememberFact(
	input: Record<string, unknown>,
	userId: string,
): Promise<string> {
	const title = String(input.title || "").trim();
	const content = String(input.content || "").trim();
	if (!title || !content) return "❌ Falta título o contenido.";
	const category = String(input.category || "general").trim() || "general";
	const tags = Array.isArray(input.tags) ? (input.tags as string[]) : [];

	// Si ya existe un recuerdo con ese título, lo actualiza
	const existing = (
		await db
			.select({ id: antonellaMemories.id })
			.from(antonellaMemories)
			.where(
				and(
					eq(antonellaMemories.user_uid, userId),
					eq(antonellaMemories.title, title),
				),
			)
			.limit(1)
	)[0];

	if (existing) {
		await db
			.update(antonellaMemories)
			.set({ content, category, tags, updated_at: new Date() })
			.where(eq(antonellaMemories.id, existing.id));
		return `✅ Recuerdo actualizado: "${title}"`;
	}

	await db.insert(antonellaMemories).values({
		user_uid: userId,
		title,
		content,
		category,
		tags,
	});
	return `✅ Recordado: "${title}" (categoría: ${category})`;
}

async function recallMemories(
	query: string,
	userId: string,
): Promise<string> {
	const q = `%${(query || "").trim()}%`;
	const rows = await db
		.select()
		.from(antonellaMemories)
		.where(
			and(
				eq(antonellaMemories.user_uid, userId),
				or(
					ilike(antonellaMemories.title, q),
					ilike(antonellaMemories.content, q),
					ilike(sql`${antonellaMemories.tags}::text`, q),
				),
			),
		)
		.orderBy(desc(antonellaMemories.importance), desc(antonellaMemories.updated_at))
		.limit(10);

	if (!rows.length) return `Sin recuerdos relacionados con "${query}".`;
	return `Recuerdos encontrados:\n${rows
		.map((r) => `• [${r.category}] ${r.title}: ${r.content}`)
		.join("\n")}`;
}

async function listMemories(
	category: string | undefined,
	userId: string,
): Promise<string> {
	const rows = await db
		.select()
		.from(antonellaMemories)
		.where(
			category
				? and(
						eq(antonellaMemories.user_uid, userId),
						eq(antonellaMemories.category, category),
					)
				: eq(antonellaMemories.user_uid, userId),
		)
		.orderBy(desc(antonellaMemories.updated_at))
		.limit(50);

	if (!rows.length) return "Aún no hay recuerdos guardados.";
	return `Recuerdos (${rows.length}):\n${rows
		.map((r) => `• [${r.category}] ${r.title}: ${r.content}`)
		.join("\n")}`;
}

async function forgetMemory(title: string, userId: string): Promise<string> {
	const deleted = await db
		.delete(antonellaMemories)
		.where(
			and(
				eq(antonellaMemories.user_uid, userId),
				eq(antonellaMemories.title, title),
			),
		)
		.returning({ id: antonellaMemories.id });
	return deleted.length
		? `🗑️ Olvidé "${title}".`
		: `No encontré un recuerdo con título "${title}".`;
}

// ───── Implementación: DATASETS ─────

async function createDataset(
	input: Record<string, unknown>,
	userId: string,
): Promise<string> {
	const name = String(input.name || "").trim();
	if (!name) return "❌ Falta el nombre de la tabla.";
	const description = String(input.description || "").trim();
	const columns = Array.isArray(input.columns) ? (input.columns as string[]) : [];
	if (!columns.length) return "❌ Indica al menos una columna.";

	const existing = (
		await db
			.select({ id: antonellaDatasets.id })
			.from(antonellaDatasets)
			.where(
				and(
					eq(antonellaDatasets.user_uid, userId),
					eq(antonellaDatasets.name, name),
				),
			)
			.limit(1)
	)[0];
	if (existing) return `Ya existe una tabla llamada "${name}".`;

	await db.insert(antonellaDatasets).values({
		user_uid: userId,
		name,
		description,
		columns,
	});
	return `✅ Tabla "${name}" creada con columnas: ${columns.join(", ")}`;
}

async function findDataset(name: string, userId: string) {
	return (
		await db
			.select()
			.from(antonellaDatasets)
			.where(
				and(
					eq(antonellaDatasets.user_uid, userId),
					eq(antonellaDatasets.name, name),
				),
			)
			.limit(1)
	)[0];
}

async function addDatasetRow(
	input: Record<string, unknown>,
	userId: string,
): Promise<string> {
	const name = String(input.dataset || "").trim();
	const ds = await findDataset(name, userId);
	if (!ds) return `No existe la tabla "${name}". Créala con create_dataset.`;
	const row =
		input.row && typeof input.row === "object"
			? (input.row as Record<string, unknown>)
			: {};
	await db
		.insert(antonellaDatasetRows)
		.values({ dataset_id: ds.id, data: row });
	return `✅ Fila agregada a "${name}": ${JSON.stringify(row)}`;
}

async function queryDataset(
	input: Record<string, unknown>,
	userId: string,
): Promise<string> {
	const name = String(input.dataset || "").trim();
	const ds = await findDataset(name, userId);
	if (!ds) return `No existe la tabla "${name}".`;
	const limit = Math.min(Number(input.limit) || 50, 200);
	const rows = await db
		.select()
		.from(antonellaDatasetRows)
		.where(eq(antonellaDatasetRows.dataset_id, ds.id))
		.orderBy(desc(antonellaDatasetRows.created_at))
		.limit(limit);

	if (!rows.length) return `La tabla "${name}" está vacía.`;
	return `Tabla "${name}" (${rows.length} fila(s) recientes):\n${rows
		.map((r) => JSON.stringify(r.data))
		.join("\n")}`;
}

async function listDatasets(userId: string): Promise<string> {
	const rows = await db
		.select()
		.from(antonellaDatasets)
		.where(eq(antonellaDatasets.user_uid, userId))
		.orderBy(desc(antonellaDatasets.updated_at));
	if (!rows.length) return "Aún no hay tablas creadas.";
	return `Tablas (${rows.length}):\n${rows
		.map(
			(d) =>
				`• ${d.name} — ${d.description || "sin descripción"} [columnas: ${(d.columns as string[]).join(", ")}]`,
		)
		.join("\n")}`;
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
				sql`${orders.created_at} >= ${startDate.toISOString()}`,
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
				sql`${orders.created_at} >= ${fourWeeksAgo.toISOString()}`,
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

			// Cargar la configuración personalizada del usuario (si existe)
			const cfg = (
				await db
					.select()
					.from(antonellaConfig)
					.where(eq(antonellaConfig.user_uid, userId))
					.limit(1)
			)[0];

			const baseSystemPrompt =
				cfg?.system_prompt && cfg.system_prompt.trim().length > 0
					? cfg.system_prompt
					: DEFAULT_SYSTEM_PROMPT;

			// Cargar las memorias recientes/importantes para que Antonella sea
			// "consciente" de lo que ya sabe (puede usar recall para el detalle).
			const memories = await db
				.select({
					category: antonellaMemories.category,
					title: antonellaMemories.title,
					content: antonellaMemories.content,
				})
				.from(antonellaMemories)
				.where(eq(antonellaMemories.user_uid, userId))
				.orderBy(
					desc(antonellaMemories.importance),
					desc(antonellaMemories.updated_at),
				)
				.limit(30);

			const datasetList = await db
				.select({
					name: antonellaDatasets.name,
					description: antonellaDatasets.description,
				})
				.from(antonellaDatasets)
				.where(eq(antonellaDatasets.user_uid, userId))
				.limit(20);

			const memoryBlock =
				memories.length > 0
					? `\n\n--- LO QUE RECUERDAS (memoria permanente) ---\n${memories
							.map((m) => `• [${m.category}] ${m.title}: ${m.content}`)
							.join(
								"\n",
							)}\n\nUsa la herramienta 'remember' para guardar datos nuevos que el usuario quiera que recuerdes, y 'recall' para buscar más detalle.`
					: `\n\nPuedes guardar datos para recordarlos siempre con la herramienta 'remember'.`;

			const datasetBlock =
				datasetList.length > 0
					? `\n\n--- TUS TABLAS DE MEMORIA ---\n${datasetList
							.map((d) => `• ${d.name}: ${d.description || "sin descripción"}`)
							.join("\n")}`
					: "";

			const systemPrompt = baseSystemPrompt + memoryBlock + datasetBlock;

			const disabled = new Set<string>(
				(cfg?.disabled_tools as string[] | undefined) ?? [],
			);
			const customTools = (cfg?.custom_tools as any[] | undefined) ?? [];
			const model = cfg?.model || "claude-opus-4-8";

			// Herramientas activas = integradas (no desactivadas) + las custom.
			// Las custom son solo declarativas (sin ejecución real todavía): si el
			// modelo las invoca, devolvemos su descripción como resultado.
			const activeTools = [
				...tools.filter((t) => !disabled.has(t.name)),
				...customTools
					.filter((t) => t?.name && t?.description)
					.map((t) => ({
						name: t.name,
						description: t.description,
						input_schema: t.input_schema ?? {
							type: "object",
							properties: {},
							required: [],
						},
					})),
			];
			const customNames = new Set(customTools.map((t) => t?.name));

			// Conversación: array de mensajes que crece con cada tool_use
			const conversation: any[] = [{ role: "user", content: input.message }];

			const toolCalls: any[] = [];
			let requiresConfirmation = false;
			let confirmationData: Record<string, unknown> = {};
			let answerText = "";

			const client = getClient();

			// Loop agéntico: hasta 5 rondas de tool_use para evitar bucles infinitos
			for (let round = 0; round < 5; round++) {
				const response = await client.messages.create({
					model,
					max_tokens: 2000,
					tools: activeTools as any,
					messages: conversation,
					system: systemPrompt,
				});

				// Capturar el texto de esta respuesta
				const textBlock = response.content.find((b: any) => b.type === "text");
				if (textBlock) answerText = (textBlock as any).text;

				// Agregar la respuesta del asistente a la conversación
				conversation.push({
					role: "assistant",
					content: response.content,
				});

				// Recolectar todos los tool_use de esta respuesta
				const toolUses = response.content.filter(
					(b: any) => b.type === "tool_use",
				);

				// Si no pidió herramientas, terminamos
				if (toolUses.length === 0) break;

				// Ejecutar cada herramienta y juntar los resultados
				const toolResults: any[] = [];
				for (const block of toolUses) {
					const toolUse = block as any;
					// Herramienta personalizada: aún no tiene ejecución real; devolvemos
					// su descripción para que el modelo la use como contexto.
					const toolResult = customNames.has(toolUse.name)
						? `[Herramienta personalizada "${toolUse.name}"] ${customTools.find((t) => t?.name === toolUse.name)?.description ?? ""}\n\n(Esta habilidad está declarada pero su ejecución automática aún no está conectada.)`
						: await executeTool(toolUse.name, toolUse.input, userId);

					toolCalls.push({
						name: toolUse.name,
						input: toolUse.input,
						result: toolResult,
					});

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

					toolResults.push({
						type: "tool_result",
						tool_use_id: toolUse.id,
						content: toolResult,
					});
				}

				// Agregar los resultados como mensaje del usuario y continuar el loop
				conversation.push({ role: "user", content: toolResults });
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
			const uid = ctx.user.id;

			if (input.actionName === "execute_despiece") {
				const { canal_type, quantity } = input.actionInput as {
					canal_type: string;
					quantity: number;
				};

				if (!canal_type || !quantity || quantity <= 0) {
					return {
						success: false,
						message: "Parámetros inválidos para despiece",
					};
				}

				const canal = await db
					.select()
					.from(products)
					.where(and(eq(products.user_uid, uid), eq(products.name, canal_type)))
					.limit(1);

				if (!canal.length) {
					return {
						success: false,
						message: `Canal "${canal_type}" no encontrado`,
					};
				}

				if (canal[0].stock_pieces < quantity) {
					return {
						success: false,
						message: `Stock insuficiente: tienes ${canal[0].stock_pieces} pero pediste ${quantity}`,
					};
				}

				// Llamar a products.processDisassembly (ya existe)
				// Para esto necesitaríamos llamar directamente, pero eso es un poco hacky.
				// En su lugar, registrar la auditoría y dejar que se haga manual.

				// Por ahora: registrar en audit_log y responder
				await db.insert(inventoryTransactions).values({
					product_id: canal[0].id,
					quantity_change_pieces: -quantity,
					quantity_change_kg: null,
					transaction_type: "DESPIECE_SOLICITADO",
					reference_id: null,
					notes: `Despiece solicitado por Antonella: ${quantity} ${canal_type}`,
				});

				return {
					success: true,
					message: `✅ Despiece de ${quantity} ${canal_type} registrado. Ejecución manual pendiente en módulo Despiece.`,
				};
			}

			if (input.actionName === "convert_to_variant") {
				const { base_product_name, variant_product_name, quantity } =
					input.actionInput as {
						base_product_name: string;
						variant_product_name: string;
						quantity: number;
					};

				if (!base_product_name || !variant_product_name || !quantity) {
					return {
						success: false,
						message: "Parámetros inválidos para conversión",
					};
				}

				const baseProduct = await db
					.select()
					.from(products)
					.where(
						and(
							eq(products.user_uid, uid),
							eq(products.name, base_product_name),
						),
					)
					.limit(1);

				if (!baseProduct.length) {
					return {
						success: false,
						message: `Producto "${base_product_name}" no encontrado`,
					};
				}

				if (baseProduct[0].stock_pieces < quantity) {
					return {
						success: false,
						message: `Stock insuficiente de ${base_product_name}: tienes ${baseProduct[0].stock_pieces} pero pediste convertir ${quantity}`,
					};
				}

				// Registrar solicitud de conversión
				await db.insert(inventoryTransactions).values({
					product_id: baseProduct[0].id,
					quantity_change_pieces: -quantity,
					quantity_change_kg: null,
					transaction_type: "VARIANTE_SOLICITADA",
					reference_id: null,
					notes: `Conversión solicitada por Antonella: ${quantity} ${base_product_name} → ${variant_product_name}`,
				});

				return {
					success: true,
					message: `✅ Conversión de ${quantity} ${base_product_name} a ${variant_product_name} registrada. Ejecución manual pendiente en módulo Despiece.`,
				};
			}

			return {
				success: false,
				message: "Acción desconocida",
			};
		}),

	// ── Notificaciones internas (iAntonella vigilando el negocio) ──
	// Detecta condiciones reales y devuelve avisos para mostrar en el dashboard.
	notifications: protectedProcedure
		.input(z.void())
		.output(
			z.object({
				items: z.array(
					z.object({
						id: z.string(),
						tone: z.enum(["alerta", "aviso", "sugerencia", "ok"]),
						title: z.string(),
						text: z.string(),
						href: z.string(),
						ask: z.string().optional(),
					}),
				),
			}),
		)
		.query(async ({ ctx }) => {
			const uid = ctx.user.id;
			const items: {
				id: string;
				tone: "alerta" | "aviso" | "sugerencia" | "ok";
				title: string;
				text: string;
				href: string;
				ask?: string;
			}[] = [];

			// 1) Cobranza vencida (saldo con días de antigüedad)
			const overdue = (await db.execute(sql`
				SELECT count(DISTINCT cust.id) AS n,
				       COALESCE(SUM(charges.total - COALESCE(pays.total,0)),0) AS saldo
				FROM customers cust
				JOIN (
				  SELECT customer_id, SUM(amount) AS total, MIN(created_at) AS first_at
				  FROM credit_charges GROUP BY customer_id
				) charges ON charges.customer_id = cust.id
				LEFT JOIN (
				  SELECT customer_id, SUM(amount) AS total FROM credit_payments GROUP BY customer_id
				) pays ON pays.customer_id = cust.id
				WHERE cust.user_uid = ${uid}
				  AND (charges.total - COALESCE(pays.total,0)) > 0.5
			`)) as unknown as { n: number; saldo: string | number }[];
			const overdueN = Number(overdue[0]?.n ?? 0);
			const overdueSaldo = Number(overdue[0]?.saldo ?? 0);
			if (overdueN > 0) {
				items.push({
					id: "cobranza",
					tone: overdueSaldo > 2000 ? "alerta" : "aviso",
					title: "Cobranza pendiente",
					text: `${overdueN} cliente(s) con saldo por cobrar ($${overdueSaldo.toLocaleString("es-MX", { maximumFractionDigits: 0 })}).`,
					href: "/admin/collections",
					ask: "¿Qué clientes debo priorizar en cobranza?",
				});
			}

			// 2) Pedidos por pesar
			const weigh = (await db.execute(sql`
				SELECT count(DISTINCT o.id) AS n
				FROM orders o JOIN order_items oi ON oi.order_id = o.id
				WHERE o.user_uid = ${uid}
				  AND o.status NOT IN ('cancelled','COMPLETADA','COBRADA','ENTREGADA')
				  AND oi.status IN ('PENDIENTE_PESAJE','PENDING')
			`)) as unknown as { n: number }[];
			const weighN = Number(weigh[0]?.n ?? 0);
			if (weighN > 0) {
				items.push({
					id: "pesaje",
					tone: "aviso",
					title: "Pedidos por pesar",
					text: `${weighN} pedido(s) esperan pesaje antes de cobrar.`,
					href: "/admin/weighing-station",
				});
			}

			// 3) Demanda no cubierta → sugerir despiece
			const demand = (await db.execute(sql`
				SELECT COALESCE(SUM(oi.quantity_pieces),0)::int AS pz
				FROM order_items oi JOIN orders o ON o.id = oi.order_id
				WHERE o.user_uid = ${uid}
				  AND o.status NOT IN ('cancelled','completed','COMPLETADA','delivered','paid')
				  AND oi.status NOT IN ('PESADO','WEIGHED','COMPLETADO')
			`)) as unknown as { pz: number }[];
			const demandPz = Number(demand[0]?.pz ?? 0);
			if (demandPz > 0) {
				items.push({
					id: "despiece",
					tone: "sugerencia",
					title: "Despiece sugerido",
					text: `Hay ${demandPz} piezas pedidas por producir. Puedo calcular y ejecutar el despiece.`,
					href: "/admin/despiece",
					ask: "¿Qué conviene despiezar hoy?",
				});
			}

			// 4) Merma alta en alguna receta de canal
			const merma = (await db.execute(sql`
				SELECT parent.name AS canal,
				       ROUND((1 - SUM(pt.yield_weight_ratio))::numeric * 100, 1) AS merma
				FROM product_transformations pt
				JOIN products parent ON parent.id = pt.parent_product_id
				WHERE parent.user_uid = ${uid} AND pt.is_active
				  AND pt.transformation_type <> 'BASE' AND pt.is_variant = false
				GROUP BY parent.name
				HAVING (1 - SUM(pt.yield_weight_ratio)) > 0.12
				ORDER BY merma DESC LIMIT 1
			`)) as unknown as { canal: string; merma: string | number }[];
			if (merma[0]) {
				items.push({
					id: "merma",
					tone: "alerta",
					title: "Revisa el cierre de pesos",
					text: `El ${merma[0].canal} tiene ${Number(merma[0].merma).toFixed(1)}% de merma en su receta (alto). Falta capturar el kg de alguna pieza.`,
					href: "/admin/inventory/recipes",
					ask: "¿Qué piezas faltan por capturar?",
				});
			}

			return { items };
		}),

	// ── Configuración de Antonella ──

	// Lista las herramientas integradas con su metadata (para la UI)
	listTools: protectedProcedure
		.input(z.void())
		.output(
			z.object({
				defaultSystemPrompt: z.string(),
				tools: z.array(
					z.object({
						name: z.string(),
						label: z.string(),
						description: z.string(),
						category: z.enum(["lectura", "accion"]),
						danger: z.boolean(),
					}),
				),
			}),
		)
		.query(async () => {
			return {
				defaultSystemPrompt: DEFAULT_SYSTEM_PROMPT,
				tools: tools.map((t) => ({
					name: t.name,
					label: TOOL_META[t.name]?.label ?? t.name,
					description: t.description,
					category: TOOL_META[t.name]?.category ?? "lectura",
					danger: TOOL_META[t.name]?.danger ?? false,
				})),
			};
		}),

	// Obtiene la configuración guardada del usuario (o valores por defecto)
	getConfig: protectedProcedure
		.input(z.void())
		.output(
			z.object({
				systemPrompt: z.string(),
				disabledTools: z.array(z.string()),
				customTools: z.array(z.any()),
				model: z.string(),
				isDefault: z.boolean(),
			}),
		)
		.query(async ({ ctx }) => {
			const cfg = (
				await db
					.select()
					.from(antonellaConfig)
					.where(eq(antonellaConfig.user_uid, ctx.user.id))
					.limit(1)
			)[0];

			return {
				systemPrompt: cfg?.system_prompt || DEFAULT_SYSTEM_PROMPT,
				disabledTools: (cfg?.disabled_tools as string[]) ?? [],
				customTools: (cfg?.custom_tools as any[]) ?? [],
				model: cfg?.model || "claude-opus-4-8",
				isDefault: !cfg,
			};
		}),

	// Guarda la configuración del usuario (upsert por user_uid)
	saveConfig: protectedProcedure
		.input(
			z.object({
				systemPrompt: z.string(),
				disabledTools: z.array(z.string()),
				customTools: z.array(
					z.object({
						name: z.string().min(1),
						description: z.string().min(1),
						input_schema: z.any().optional(),
					}),
				),
				model: z.string(),
			}),
		)
		.output(z.object({ success: z.boolean() }))
		.mutation(async ({ ctx, input }) => {
			const uid = ctx.user.id;
			const existing = (
				await db
					.select({ id: antonellaConfig.id })
					.from(antonellaConfig)
					.where(eq(antonellaConfig.user_uid, uid))
					.limit(1)
			)[0];

			if (existing) {
				await db
					.update(antonellaConfig)
					.set({
						system_prompt: input.systemPrompt,
						disabled_tools: input.disabledTools,
						custom_tools: input.customTools,
						model: input.model,
						updated_at: new Date(),
					})
					.where(eq(antonellaConfig.user_uid, uid));
			} else {
				await db.insert(antonellaConfig).values({
					user_uid: uid,
					system_prompt: input.systemPrompt,
					disabled_tools: input.disabledTools,
					custom_tools: input.customTools,
					model: input.model,
				});
			}

			return { success: true };
		}),
});
