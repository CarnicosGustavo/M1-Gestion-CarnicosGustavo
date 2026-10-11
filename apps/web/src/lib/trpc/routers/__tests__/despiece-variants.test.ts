import { afterAll, beforeAll, describe, expect, it, mock } from "bun:test";
import { eq } from "drizzle-orm";
import { createTestDb, makeUser, SCHEMA_DDL } from "./helpers";

const { pg, db } = createTestDb();
mock.module("@/lib/db", () => ({ db, pglite: pg }));

const { productsRouter } = await import("../products");
const { yieldsRouter } = await import("../yields");
const { ordersRouter } = await import("../orders");
const { createCallerFactory } = await import("../../init");
const { buildEffectiveRecipes, isDespieceRecipe } = await import(
	"@/lib/recipes/effective-recipes"
);
const { products, productTransformations, orders, orderItems } = await import(
	"@/lib/db/schema"
);

const UID = "recetas-user";
const user = makeUser(UID, "almacen");
const productsApi = createCallerFactory(productsRouter)({ user });
const yieldsApi = createCallerFactory(yieldsRouter)({ user });
const ordersApi = createCallerFactory(ordersRouter)({ user });

async function product(name: string, over: Record<string, unknown> = {}) {
	const [p] = await db
		.insert(products)
		.values({ name, user_uid: UID, ...over })
		.returning();
	return p;
}

async function recipe(
	parentId: number,
	childId: number,
	{
		type = "BASE",
		pieces = "1",
		ratio = "0.5",
		isVariant = false,
	}: {
		type?: string;
		pieces?: string;
		ratio?: string;
		isVariant?: boolean;
	} = {},
) {
	const [r] = await db
		.insert(productTransformations)
		.values({
			parent_product_id: parentId,
			child_product_id: childId,
			transformation_type: type,
			yield_quantity_pieces: pieces,
			yield_weight_ratio: ratio,
			is_variant: isVariant,
			is_active: true,
		})
		.returning();
	return r;
}

async function stock(id: number) {
	const [p] = await db.select().from(products).where(eq(products.id, id));
	return { pieces: p.stock_pieces ?? 0, kg: Number(p.stock_kg ?? 0) };
}

// JAMON → PIERNA, CODILLO (despiece) + JAMON C/G (variante)
let canal: { id: number };
let jamon: { id: number };
let pierna: { id: number };
let codillo: { id: number };
let jamonCG: { id: number };

beforeAll(async () => {
	await pg.exec(SCHEMA_DDL);
	canal = await product("CANAL PRUEBA", {
		is_parent_product: true,
		stock_pieces: 5,
		stock_kg: "300.000",
		avg_weight_per_piece_kg: "60.000",
	});
	jamon = await product("JAMON", {
		is_parent_product: true,
		stock_pieces: 10,
		stock_kg: "100.000",
		avg_weight_per_piece_kg: "10.000",
	});
	pierna = await product("PIERNA");
	codillo = await product("CODILLO");
	jamonCG = await product("JAMON C/G");

	await recipe(canal.id, jamon.id, { pieces: "2", ratio: "0.3" });
	await recipe(jamon.id, pierna.id, { pieces: "1", ratio: "0.6" });
	await recipe(jamon.id, codillo.id, { pieces: "2", ratio: "0.2" });
	await recipe(jamon.id, jamonCG.id, {
		pieces: "1",
		ratio: "0.9",
		isVariant: true,
	});
	// Estilo que solo tiene variantes: no debe ofrecerse como despiece.
	await recipe(jamon.id, jamonCG.id, {
		type: "SOLO_VARIANTE",
		isVariant: true,
	});
});

afterAll(async () => {
	await pg.close();
});

describe("helpers de recetas efectivas", () => {
	it("isDespieceRecipe excluye variantes", () => {
		expect(isDespieceRecipe({ is_variant: false })).toBe(true);
		expect(isDespieceRecipe({ is_variant: true })).toBe(false);
		expect(isDespieceRecipe({ isVariant: true })).toBe(false);
		expect(isDespieceRecipe({})).toBe(true);
	});

	it("buildEffectiveRecipes: el estilo gana sobre BASE y se dedupe por hijo", () => {
		const rows = [
			{ id: 1, child_product_id: 10, transformation_type: "BASE" },
			{ id: 2, child_product_id: 11, transformation_type: "BASE" },
			{ id: 3, child_product_id: 10, transformation_type: "CUADRADO" },
			{ id: 4, child_product_id: 11, transformation_type: "BASE" },
		];
		const eff = buildEffectiveRecipes(rows, "CUADRADO");
		expect(eff.map((r) => r.id).sort()).toEqual([3, 4]);
		expect(buildEffectiveRecipes(rows, "BASE").map((r) => r.id)).toEqual([
			1, 4,
		]);
	});
});

describe("processDisassembly no genera variantes", () => {
	it("despiezar JAMON solo suma a los 2 hijos normales", async () => {
		await productsApi.processDisassembly({
			parentProductId: jamon.id,
			quantityToProcess: 3,
			transformationType: "BASE",
		});
		expect((await stock(pierna.id)).pieces).toBe(3);
		expect((await stock(codillo.id)).pieces).toBe(6);
		expect((await stock(jamonCG.id)).pieces).toBe(0);
		expect((await stock(jamon.id)).pieces).toBe(7);
	});

	it("un estilo con solo variantes aplica BASE (regla actual) pero no la variante", async () => {
		const before = {
			pierna: (await stock(pierna.id)).pieces,
			codillo: (await stock(codillo.id)).pieces,
		};
		await productsApi.processDisassembly({
			parentProductId: jamon.id,
			quantityToProcess: 1,
			transformationType: "SOLO_VARIANTE",
		});
		expect((await stock(pierna.id)).pieces).toBe(before.pierna + 1);
		expect((await stock(codillo.id)).pieces).toBe(before.codillo + 2);
		expect((await stock(jamonCG.id)).pieces).toBe(0);
	});

	it("un padre cuyas únicas recetas son variantes → NOT_FOUND", async () => {
		const lomo = await product("LOMO", {
			is_parent_product: true,
			stock_pieces: 4,
			stock_kg: "20.000",
		});
		const lomoSH = await product("LOMO S/H");
		await recipe(lomo.id, lomoSH.id, { isVariant: true });
		await expect(
			productsApi.processDisassembly({
				parentProductId: lomo.id,
				quantityToProcess: 1,
				transformationType: "BASE",
			}),
		).rejects.toMatchObject({ code: "NOT_FOUND" });
		expect((await stock(lomoSH.id)).pieces).toBe(0);
		expect((await stock(lomo.id)).pieces).toBe(4);
	});
});

describe("processDisassemblyPipeline no genera variantes", () => {
	it("canal → JAMON (intermedio) → solo hijos normales", async () => {
		const before = {
			pierna: (await stock(pierna.id)).pieces,
			codillo: (await stock(codillo.id)).pieces,
		};
		await productsApi.processDisassemblyPipeline({
			canalProductId: canal.id,
			qtyProcessCanal: 1,
			transformationType: "BASE",
			intermediateLeaves: [{ productId: jamon.id, leaveComplete: 0 }],
		});
		// 1 canal → 2 JAMON → se despiezan los 2
		expect((await stock(pierna.id)).pieces).toBe(before.pierna + 2);
		expect((await stock(codillo.id)).pieces).toBe(before.codillo + 4);
		expect((await stock(jamonCG.id)).pieces).toBe(0);
	});
});

describe("getTransformations / tipos disponibles", () => {
	it("por defecto excluye variantes; includeVariants las incluye marcadas", async () => {
		const despiece = await productsApi.getTransformations({
			parentProductId: jamon.id,
		});
		expect(despiece.map((t) => t.child_product_id).sort()).toEqual(
			[pierna.id, codillo.id].sort(),
		);

		const all = await productsApi.getTransformations({
			parentProductId: jamon.id,
			includeVariants: true,
		});
		expect(all.length).toBe(3);
		const cg = all.find((t) => t.child_product_id === jamonCG.id);
		expect(cg?.is_variant).toBe(true);
	});

	it("getAvailableTransformationTypes no ofrece estilos solo de variantes", async () => {
		const types = await productsApi.getAvailableTransformationTypes({
			parentProductId: jamon.id,
		});
		expect(types).toEqual(["BASE"]);
	});
});

describe("convertToVariant sigue funcionando", () => {
	it("mueve piezas de JAMON a JAMON C/G con su ratio", async () => {
		const base = await stock(jamon.id);
		await productsApi.convertToVariant({
			baseProductId: jamon.id,
			variantProductId: jamonCG.id,
			pieces: 2,
		});
		const after = await stock(jamon.id);
		const variant = await stock(jamonCG.id);
		expect(after.pieces).toBe(base.pieces - 2);
		expect(variant.pieces).toBe(2);
		const avg = base.kg / base.pieces;
		expect(variant.kg).toBeCloseTo(2 * avg * 0.9, 3);
	});
});

describe("proyecciones de yields sin variantes", () => {
	it("projectFromCanales no proyecta variantes", async () => {
		const res = await yieldsApi.projectFromCanales({
			canales: [{ canalProductId: canal.id, numCanales: 1 }],
		});
		const ids = res.nodes.map((n) => n.productId);
		expect(ids).toContain(pierna.id);
		expect(ids).toContain(codillo.id);
		expect(ids).not.toContain(jamonCG.id);
		const p = res.nodes.find((n) => n.productId === pierna.id);
		expect(p?.pieces).toBe(2);
	});
});

describe("orders: despiece por pedido sin variantes", () => {
	it("validateDisassemblyRecipes no da por cubierta una variante", async () => {
		const canalA = await product("CANAL AMERICANO PRUEBA", {
			is_parent_product: true,
			stock_pieces: 3,
			stock_kg: "180.000",
		});
		const jamonA = await product("JAMON A", { is_parent_product: true });
		const piernaA = await product("PIERNA A");
		const jamonPinto = await product("JAMON PINTO");
		await recipe(canalA.id, jamonA.id, { type: "AMERICANO", pieces: "2" });
		await recipe(jamonA.id, piernaA.id, { type: "AMERICANO" });
		await recipe(jamonA.id, jamonPinto.id, {
			type: "AMERICANO",
			isVariant: true,
		});

		const [o] = await db
			.insert(orders)
			.values({
				total_amount: "0.00",
				user_uid: UID,
				status: "pending",
			})
			.returning();
		await db.insert(orderItems).values([
			{
				order_id: o.id,
				product_id: piernaA.id,
				product_name: "PIERNA A",
				quantity_pieces: 2,
				status: "PENDING",
			},
			{
				order_id: o.id,
				product_id: jamonPinto.id,
				product_name: "JAMON PINTO",
				quantity_pieces: 1,
				status: "PENDING",
			},
		]);

		const res = await ordersApi.validateDisassemblyRecipes({
			orderId: o.id,
			transformationType: "AMERICANO",
			canalProductId: canalA.id,
		});
		const byName = (n: string) =>
			res.items.find((i: { productName: string }) => i.productName === n);
		expect(byName("PIERNA A")?.ok).toBe(true);
		expect(byName("JAMON PINTO")?.ok).toBe(false);
		expect(res.ok).toBe(false);
	});
});
