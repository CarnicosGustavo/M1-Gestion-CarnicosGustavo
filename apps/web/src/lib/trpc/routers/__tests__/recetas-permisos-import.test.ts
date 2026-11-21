import { afterAll, beforeAll, describe, expect, it, mock } from "bun:test";
import { eq } from "drizzle-orm";
import { createTestDb, makeUser, SCHEMA_DDL } from "./helpers";

const { pg, db } = createTestDb();
// En producción (postgres-js) db.execute devuelve el arreglo de filas; PGlite
// devuelve { rows }. Se adapta solo para este test.
const appDb = Object.create(db);
appDb.execute = async (q: any) => (await db.execute(q)).rows;
mock.module("@/lib/db", () => ({ db: appDb, pglite: pg }));

const { yieldsRouter } = await import("../yields");
const { inventoryRouter } = await import("../inventory");
const { productsRouter } = await import("../products");
const { createCallerFactory } = await import("../../init");
const { channelPurchases, products, productTransformations, yieldSheets } =
	await import("@/lib/db/schema");

const yieldsAs = (role: "admin" | "almacen" | "cajero", id = `u-${role}`) =>
	createCallerFactory(yieldsRouter)({ user: makeUser(id, role) });
const inventoryAdmin = createCallerFactory(inventoryRouter)({
	user: makeUser("u-admin", "admin"),
});

const FORBIDDEN = { code: "FORBIDDEN" };
const pid: Record<string, number> = {};

async function addProduct(name: string, extra: Record<string, unknown> = {}) {
	const [p] = await db
		.insert(products)
		.values({ name, user_uid: "u-admin", ...extra } as any)
		.returning({ id: products.id });
	pid[name] = p.id;
	return p.id;
}

async function addRecipe(
	parent: string,
	child: string,
	opts: { type?: string; ratio?: number; isVariant?: boolean } = {},
) {
	const [r] = await db
		.insert(productTransformations)
		.values({
			parent_product_id: pid[parent],
			child_product_id: pid[child],
			yield_quantity_pieces: "1",
			yield_weight_ratio: (opts.ratio ?? 0.1).toFixed(4),
			transformation_type: opts.type ?? "BASE",
			is_variant: opts.isVariant ?? false,
			is_active: true,
		})
		.returning({ id: productTransformations.id });
	return r.id;
}

async function recipe(id: number) {
	const [r] = await db
		.select()
		.from(productTransformations)
		.where(eq(productTransformations.id, id));
	return r;
}

beforeAll(async () => {
	await pg.exec(SCHEMA_DDL);
	for (const n of ["CANAL", "PIERNA", "LOMO", "CHULETA", "PULPA", "MOLIDA"]) {
		await addProduct(n);
	}
});
afterAll(async () => {
	await pg.close();
});

describe("yields: permisos por rol", () => {
	for (const role of ["almacen", "cajero"] as const) {
		it(`${role} recibe FORBIDDEN en calibrateFromDay`, async () => {
			await expect(
				yieldsAs(role).calibrateFromDay({ date: "2026-10-01" }),
			).rejects.toMatchObject(FORBIDDEN);
		});
		it(`${role} recibe FORBIDDEN en savePurchases`, async () => {
			await expect(
				yieldsAs(role).savePurchases({ date: "2026-10-01", rows: [] }),
			).rejects.toMatchObject(FORBIDDEN);
		});
		it(`${role} recibe FORBIDDEN en create/update/delete de hojas`, async () => {
			const sheet = {
				numCanales: 1,
				kgComprado: 100,
				items: [],
			} as any;
			await expect(yieldsAs(role).create(sheet)).rejects.toMatchObject(
				FORBIDDEN,
			);
			await expect(
				yieldsAs(role).update({ ...sheet, id: 1 }),
			).rejects.toMatchObject(FORBIDDEN);
			await expect(yieldsAs(role).delete({ id: 1 })).rejects.toMatchObject(
				FORBIDDEN,
			);
		});
	}

	it("cajero recibe FORBIDDEN en saveCedis; almacén y admin pasan el guard", async () => {
		const input = { date: "2026-10-01", rows: [] } as any;
		await expect(yieldsAs("cajero").saveCedis(input)).rejects.toMatchObject(
			FORBIDDEN,
		);
		for (const role of ["almacen", "admin"] as const) {
			let err: unknown = null;
			try {
				await yieldsAs(role).saveCedis(input);
			} catch (e) {
				err = e;
			}
			expect((err as any)?.code).not.toBe("FORBIDDEN");
		}
	});

	it("admin puede ejecutar savePurchases", async () => {
		const res = await yieldsAs("admin").savePurchases({
			date: "2026-10-01",
			rows: [],
		});
		expect(res).toBeDefined();
	});

	it("get solo devuelve la hoja a su dueño o a un admin", async () => {
		const [s] = await db
			.insert(yieldSheets)
			.values({ num_canales: 1, kg_comprado: "100.000", user_uid: "otro" })
			.returning({ id: yieldSheets.id });
		expect(await yieldsAs("cajero").get({ id: s.id })).toBeNull();
		expect(await yieldsAs("almacen").get({ id: s.id })).toBeNull();
		expect(await yieldsAs("cajero", "otro").get({ id: s.id })).not.toBeNull();
		expect(await yieldsAs("admin").get({ id: s.id })).not.toBeNull();
	});
});

describe("inventory.recipesImport: alcance por padre", () => {
	it("solo desactiva recetas de padres incluidos en el archivo", async () => {
		const canalPierna = await addRecipe("CANAL", "PIERNA", {
			type: "DESPIECE_NACIONAL",
		});
		const canalLomo = await addRecipe("CANAL", "LOMO", {
			type: "DESPIECE_NACIONAL",
		});
		const lomoChuleta = await addRecipe("LOMO", "CHULETA");
		const pulpaMolida = await addRecipe("PULPA", "MOLIDA", {
			isVariant: true,
			ratio: 1,
		});

		const res = await inventoryAdmin.recipesImport({
			canales: [
				{
					transformation_type: "DESPIECE_NACIONAL",
					parent: "Canal",
					piezas: [
						{
							child: "PIERNA",
							yield_quantity_pieces: 2,
							yield_weight_ratio: 0.2,
						},
					],
				},
			],
			ramificaciones: [],
		});

		expect(res).toMatchObject({
			total: 1,
			inserted: 0,
			updated: 1,
			deactivated: 1,
			missing: [],
		});
		expect((await recipe(canalPierna)).is_active).toBe(true);
		expect(Number((await recipe(canalPierna)).yield_weight_ratio)).toBeCloseTo(
			0.2,
		);
		// Receta del mismo padre que no viene en el archivo → inactiva
		expect((await recipe(canalLomo)).is_active).toBe(false);
		// Padres que no aparecen en el archivo → intactos
		expect((await recipe(lomoChuleta)).is_active).toBe(true);
		expect((await recipe(pulpaMolida)).is_active).toBe(true);
	});

	it("aborta sin escribir nada si hay nombres no encontrados", async () => {
		const before = await db.select().from(productTransformations);
		await expect(
			inventoryAdmin.recipesImport({
				canales: [],
				ramificaciones: [
					{
						parent: "LOMO",
						subpiezas: [
							{
								child: "NO EXISTE",
								yield_quantity_pieces: 1,
								yield_weight_ratio: 0.5,
							},
						],
					},
				],
			}),
		).rejects.toThrow("NO EXISTE");
		const after = await db.select().from(productTransformations);
		expect(after.map((r) => [r.id, r.is_active, r.yield_weight_ratio])).toEqual(
			before.map((r) => [r.id, r.is_active, r.yield_weight_ratio]),
		);
	});
});

describe("variantes: calibrateFromDay y availabilityMap", () => {
	it("availabilityMap marca variantes como por conversión, no como despiece", async () => {
		await db
			.update(products)
			.set({ stock_kg: "10.000" } as any)
			.where(eq(products.id, pid.PULPA));
		const map = await createCallerFactory(productsRouter)({
			user: makeUser("u-admin", "admin"),
		}).availabilityMap();
		const molida = map.find((m) => m.productId === pid.MOLIDA);
		expect(molida?.derivable).toBe(false);
		expect(molida?.porConversion).toBe(true);
	});

	it("calibrateFromDay no recalibra recetas is_variant", async () => {
		const date = "2026-10-02";
		await db.insert(channelPurchases).values({
			purchase_date: date,
			total_kg: "100.000",
			user_uid: "u-admin",
		} as any);
		// Pesos reales del día: PULPA 10 kg y MOLIDA 9 kg (renglones PESADO)
		await pg.exec(`
			INSERT INTO customers (id, name, user_uid) VALUES (9001, 'C', 'u-admin');
			INSERT INTO orders (id, customer_id, user_uid, created_at)
				VALUES (9001, 9001, 'u-admin', '${date} 12:00:00+00');
			INSERT INTO order_items (order_id, product_id, quantity_kg, status)
				VALUES (9001, ${pid.PULPA}, 10, 'PESADO'), (9001, ${pid.MOLIDA}, 9, 'PESADO'),
					(9001, ${pid.CHULETA}, 5, 'PESADO');
		`);
		const variantId = (
			await db
				.select()
				.from(productTransformations)
				.where(eq(productTransformations.child_product_id, pid.MOLIDA))
		)[0].id;
		const lomoChuleta = (
			await db
				.select()
				.from(productTransformations)
				.where(eq(productTransformations.child_product_id, pid.CHULETA))
		)[0].id;
		const res = await yieldsAs("admin").calibrateFromDay({ date });
		// La receta normal sí se recalibra (LOMO es raíz: 5 kg / 100 kg canal)
		expect(res.updated).toBe(1);
		expect(Number((await recipe(lomoChuleta)).yield_weight_ratio)).toBeCloseTo(
			0.05,
		);
		// La variante conserva su ratio
		expect(Number((await recipe(variantId)).yield_weight_ratio)).toBe(1);
	});
});
