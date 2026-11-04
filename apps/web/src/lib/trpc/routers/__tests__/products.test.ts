import { afterAll, beforeAll, describe, expect, it, mock } from "bun:test";
import { createTestDb, makeUser, SCHEMA_DDL } from "./helpers";

const { pg, db } = createTestDb();
mock.module("@/lib/db", () => ({ db, pglite: pg }));

const { productsRouter } = await import("../products");
const { createCallerFactory } = await import("../../init");

const caller = createCallerFactory(productsRouter)({
	user: makeUser("user-1"),
});
const callerAs = (uid: string) =>
	createCallerFactory(productsRouter)({ user: makeUser(uid) });

beforeAll(async () => {
	await pg.exec(SCHEMA_DDL);
});
afterAll(async () => {
	await pg.close();
});

describe("products.list", () => {
	it("returns empty array initially", async () => {
		const list = await caller.list();
		expect(list).toEqual([]);
		expect(list.length).toBe(0);
	});

	it("filters by user_uid — does not leak cross-user data", async () => {
		await caller.create({ name: "P1", price_per_kg: 100, in_stock: 10 });
		const other = callerAs("other-user");
		await other.create({ name: "P-other", price_per_kg: 50, in_stock: 5 });

		const list = await caller.list();
		expect(list.length).toBe(1);
		expect(list[0].name).toBe("P1");
		expect(list.some((p) => p.name === "P-other")).toBe(false);

		const otherList = await other.list();
		expect(otherList.length).toBe(1);
		expect(otherList[0].name).toBe("P-other");
	});

	it("returns correct shape with all expected fields", async () => {
		const list = await caller.list();
		const p = list[0];
		expect(typeof p.id).toBe("number");
		expect(typeof p.name).toBe("string");
		expect(Number.isNaN(Number(p.price_per_kg))).toBe(false);
		expect(Number.isNaN(Number(p.in_stock))).toBe(false);
		expect(typeof p.user_uid).toBe("string");
		expect(p.created_at).toBeInstanceOf(Date);
	});
});

describe("products.create", () => {
	it("creates and persists — visible in list()", async () => {
		const before = await caller.list();
		const p = await caller.create({
			name: "Widget",
			price_per_kg: 1500,
			in_stock: 20,
		});
		expect(p.name).toBe("Widget");
		expect(Number(p.price_per_kg)).toBe(1500);
		expect(Number(p.in_stock)).toBe(20);
		expect(p.user_uid).toBe("user-1");
		expect(p.id).toBeGreaterThan(0);

		const after = await caller.list();
		expect(after.length).toBe(before.length + 1);
		const found = after.find((x) => x.id === p.id);
		expect(found).toBeDefined();
		expect(found?.name).toBe("Widget");
		expect(Number(found?.price_per_kg)).toBe(1500);
	});

	it("omitted optional fields are null in DB", async () => {
		const p = await caller.create({
			name: "Bare",
			price_per_kg: 100,
			in_stock: 0,
		});
		expect(p.description).toBeNull();
		// category puede tener default en la BD ("General"); lo importante es que
		// no se inventa un valor distinto
		expect([null, "General"]).toContain(p.category);

		const list = await caller.list();
		const persisted = list.find((x) => x.id === p.id)!;
		expect(persisted.description).toBeNull();
		expect([null, "General"]).toContain(persisted.category);
	});

	it("provided optional fields persist correctly", async () => {
		const p = await caller.create({
			name: "Full",
			price_per_kg: 999,
			in_stock: 5,
			description: "desc",
			category: "cat",
		});
		expect(p.description).toBe("desc");
		expect(p.category).toBe("cat");

		const list = await caller.list();
		const persisted = list.find((x) => x.id === p.id)!;
		expect(persisted.description).toBe("desc");
		expect(persisted.category).toBe("cat");
	});

	it("rejects name: empty string — no record created", async () => {
		const before = await caller.list();
		await expect(
			caller.create({ name: "", price_per_kg: 100, in_stock: 1 }),
		).rejects.toThrow();
		const after = await caller.list();
		expect(after.length).toBe(before.length);
	});

	it("rejects in_stock: -1 — no record created", async () => {
		const before = await caller.list();
		await expect(
			caller.create({ name: "Bad", price_per_kg: 100, in_stock: -1 }),
		).rejects.toThrow();
		const after = await caller.list();
		expect(after.length).toBe(before.length);
	});
});

describe("products.update", () => {
	it("updates fields and change persists in list()", async () => {
		const p = await caller.create({
			name: "Old",
			price_per_kg: 100,
			in_stock: 1,
		});
		const updated = await caller.update({
			id: p.id,
			name: "New",
			price_per_kg: 200,
		});
		expect(updated.name).toBe("New");
		expect(Number(updated.price_per_kg)).toBe(200);

		const list = await caller.list();
		const persisted = list.find((x) => x.id === p.id)!;
		expect(persisted.name).toBe("New");
		expect(Number(persisted.price_per_kg)).toBe(200);
		expect(Number(persisted.in_stock)).toBe(1); // unchanged field preserved
	});

	it("cross-user update fails and original data is untouched", async () => {
		const p = await caller.create({
			name: "Mine",
			price_per_kg: 100,
			in_stock: 1,
		});
		const other = callerAs("attacker");
		await expect(other.update({ id: p.id, name: "Hacked" })).rejects.toThrow();

		const list = await caller.list();
		const original = list.find((x) => x.id === p.id)!;
		expect(original.name).toBe("Mine");
		expect(Number(original.price_per_kg)).toBe(100);
	});
});

describe("products.delete", () => {
	it("deletes a product — no longer in list()", async () => {
		const p = await caller.create({
			name: "ToDelete",
			price_per_kg: 100,
			in_stock: 1,
		});
		const before = await caller.list();
		expect(before.some((x) => x.id === p.id)).toBe(true);

		await caller.delete({ id: p.id });

		const after = await caller.list();
		expect(after.some((x) => x.id === p.id)).toBe(false);
		expect(after.length).toBe(before.length - 1);
	});

	it("is idempotent — deleting same id twice does not error", async () => {
		const p = await caller.create({
			name: "DelTwice",
			price_per_kg: 100,
			in_stock: 1,
		});
		await caller.delete({ id: p.id });
		const result = await caller.delete({ id: p.id });
		expect(result.success).toBe(true);

		const list = await caller.list();
		expect(list.some((x) => x.id === p.id)).toBe(false);
	});
});
