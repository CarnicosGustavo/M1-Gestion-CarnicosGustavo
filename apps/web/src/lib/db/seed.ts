import { db } from ".";
import {
  paymentMethods,
  customers,
  products,
  orders,
  orderItems,
  transactions,
  cities,
  account,
  session,
  user,
  productTransformations,
  inventoryTransactions,
} from "./schema";
import { and, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { faker } from "@faker-js/faker";
import { auth } from "../auth";
import { CLIENT_NAME, COUNTRY, DEMO_EMAIL, DEMO_PASSWORD } from "@/lib/constants";

const DEMO_NAME = CLIENT_NAME;
const LEGACY_DEMO_EMAIL = "test@example.com";

const EXPENSE_CATEGORIES = [
  "canales",
  "gasolina",
  "renta",
  "salarios",
  "mantenimiento",
  "suministros",
] as const;

type SeedMode = "auth" | "full";

async function seedAuthUser(options: { headers?: Headers; forceRecreate?: boolean }) {
  const legacyUser = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, LEGACY_DEMO_EMAIL))
    .limit(1);

  if (legacyUser[0]?.id) {
    await db.delete(session).where(eq(session.userId, legacyUser[0].id));
    await db.delete(account).where(eq(account.userId, legacyUser[0].id));
    await db.delete(user).where(eq(user.id, legacyUser[0].id));
  }

  const existingUser = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, DEMO_EMAIL))
    .limit(1);

  if (existingUser[0]?.id) {
    if (options.forceRecreate) {
      await db.delete(session).where(eq(session.userId, existingUser[0].id));
      await db.delete(account).where(eq(account.userId, existingUser[0].id));
      await db.delete(user).where(eq(user.id, existingUser[0].id));
    } else {
    const passwordAccounts = await db
      .select({ count: sql<number>`count(*)` })
      .from(account)
      .where(and(eq(account.userId, existingUser[0].id), isNotNull(account.password)));

    if (passwordAccounts[0].count > 0) {
      return existingUser[0].id;
    }

    await db.delete(session).where(eq(session.userId, existingUser[0].id));
    await db.delete(account).where(eq(account.userId, existingUser[0].id));
    await db.delete(user).where(eq(user.id, existingUser[0].id));
    }
  }

  const created = (
    await auth.api.signUpEmail({
      body: { name: DEMO_NAME, email: DEMO_EMAIL, password: DEMO_PASSWORD },
      headers: options.headers,
    })
  ).user.id;

  await db
    .update(user)
    .set({ role: "admin", emailVerified: true, lastSignedIn: new Date(), updatedAt: new Date() })
    .where(eq(user.id, created));

  return created;
}

export async function seed(
  options: { headers?: Headers; mode?: SeedMode; forceAuthUser?: boolean } = {},
) {
  const mode = options.mode ?? "auth";
  const userId = await seedAuthUser({
    headers: options.headers,
    forceRecreate: options.forceAuthUser === true,
  });

  if (mode === "auth") {
    return { userId };
  }

  const existing = await db
    .select({ count: sql<number>`count(*)` })
    .from(paymentMethods);

  if (existing[0].count === 0) {
    await db.insert(paymentMethods).values([
      { name: "Transferencia bancaria" },
      { name: "Tarjeta de crédito" },
      { name: "Efectivo" },
    ]);
  } else {
    await db
      .update(paymentMethods)
      .set({ name: "Transferencia bancaria" })
      .where(eq(paymentMethods.name, "Tarjeta de débito"));
    await db
      .update(paymentMethods)
      .set({ name: "Tarjeta de crédito" })
      .where(eq(paymentMethods.name, "Credit Card"));
    await db
      .update(paymentMethods)
      .set({ name: "Efectivo" })
      .where(eq(paymentMethods.name, "Cash"));
  }

  const paymentMethodRows = await db
    .select({ id: paymentMethods.id })
    .from(paymentMethods);
  const paymentMethodIds = paymentMethodRows.map((pm) => pm.id);

  // ── Products ─────────────────────────────────────────────────────────────
  const demoProducts: Array<{ description: string }> = [
    { description: "AHUMADA" },
    { description: "BARRIGA" },
    { description: "BARRIGA C/C" },
    { description: "BUCHE" },
    { description: "C/LOMO" },
    { description: "C/LOMO C/H" },
    { description: "CABEZA" },
    { description: "CACHETE" },
    { description: "CANAL" },
    { description: "CAÑAS" },
    { description: "CAPOTE" },
    { description: "CODILLO" },
    { description: "CORBATAS" },
    { description: "COSTILLAR" },
    { description: "CUERO RECORTE" },
    { description: "CUERO CUADRADO" },
    { description: "CUEROS C/PANZA" },
    { description: "CUEROS S/PANZA" },
    { description: "DESGRASE" },
    { description: "ESPALDILLA" },
    { description: "ESPILOMO" },
    { description: "ESPINAZO" },
    { description: "FILETE" },
    { description: "GRASA" },
    { description: "HUESO AMERICANO" },
    { description: "JAMON" },
    { description: "JAMON C/G" },
    { description: "JAMON PINTO" },
    { description: "JAMON S/H" },
    { description: "LARDO" },
    { description: "LENGUA" },
    { description: "LOMO" },
    { description: "LOMO USA" },
    { description: "LOMO S/CABEZA" },
    { description: "LOMO PINTO" },
    { description: "MANOS" },
    { description: "MANTECA" },
    { description: "MASCARA" },
    { description: "MASCARA COMPLETA" },
    { description: "MASCARA RECORTE" },
    { description: "NANA" },
    { description: "OREJAS" },
    { description: "PAPADA" },
    { description: "PATAS" },
    { description: "PECHO" },
    { description: "PECHO C/CUERO" },
    { description: "PIERNA" },
    { description: "PRENSA MOLIDA" },
    { description: "PRENSA NATURAL" },
    { description: "PULPA" },
    { description: "PULPA C/G" },
    { description: "PULPA DE ESPALDILLA" },
    { description: "PULPA DE JAMON" },
    { description: "RABOS CARNUDOS" },
    { description: "RABOS PELONES" },
    { description: "RETAZO" },
    { description: "RIÑON" },
    { description: "SANCOCHO" },
    { description: "SESOS" },
    { description: "TOCINO" },
    { description: "TOCINO AZUL" },
    { description: "TRIPAS" },
    { description: "TROMPAS" },
  ];

  const productValues = demoProducts.map((p) => {
    // Extract category from description (e.g. "LOMO USA" -> "lomo")
    const desc = p.description.toLowerCase();
    let category = "otros";
    if (desc.includes("lomo")) category = "lomo";
    else if (desc.includes("pierna")) category = "pierna";
    else if (desc.includes("jamon")) category = "jamon";
    else if (desc.includes("tocino")) category = "tocino";
    else if (desc.includes("espaldilla")) category = "espaldilla";
    else if (desc.includes("costillar")) category = "costillar";
    else if (desc.includes("cabeza")) category = "cabeza";
    else if (desc.includes("tripas")) category = "tripas";
    else if (desc.includes("pulpa")) category = "pulpa";
    else if (desc.includes("cuero")) category = "cuero";
    else if (desc.includes("rabo")) category = "rabo";

    return {
      name: p.description,
      description: p.description,
      price: faker.number.int({ min: 4500, max: 28000 }),
      in_stock: faker.number.int({ min: 50, max: 1000 }),
      user_uid: userId,
      category,
      unit_of_measure: "KG",
      // Default dual stock
      stock_pieces: faker.number.int({ min: 5, max: 20 }),
      stock_kg: faker.number.int({ min: 50000, max: 500000 }), // x1000
      is_parent_product: p.description === "CANAL" || p.description === "CABEZA" || p.description === "PIERNA" || p.description === "ESPALDILLA" || p.description === "COSTILLAR",
      is_sellable_by_unit: true,
      is_sellable_by_weight: true,
      default_sale_unit: "KG",
    };
  });

  // Force re-seed for demo user
  const existingOrderRows = await db
    .select({ id: orders.id })
    .from(orders)
    .where(eq(orders.user_uid, userId));
  const orderIds = existingOrderRows.map((o) => o.id);

  if (orderIds.length > 0) {
    await db
      .delete(orderItems)
      .where(inArray(orderItems.order_id, orderIds));
  }

  await db.delete(inventoryTransactions);
  await db.delete(productTransformations);
  await db.delete(transactions).where(eq(transactions.user_uid, userId));
  await db.delete(orders).where(eq(orders.user_uid, userId));
  
  // Cleanup any product with "XX" in name (global cleanup)
  await db.delete(products).where(sql`name LIKE '%XX%'`);

  await db.delete(products).where(eq(products.user_uid, userId));
  await db.delete(customers).where(eq(customers.user_uid, userId));

  const CLIENT_TYPES = ["Carnicería", "Taquería", "Restaurante", "Mercado", "Abarrotes", "Distribuidora"];
  const CLIENT_NAMES = ["Juanito", "La Bendición", "Doña María", "El Torito", "Los Primos", "San José", "El Güero", "La Pasadita", "El Pastor", "La Esperanza"];

  const customerValues = Array.from({ length: 20 }, () => ({
    name: `${faker.helpers.arrayElement(CLIENT_TYPES)} ${faker.helpers.arrayElement(CLIENT_NAMES)}`,
    email: faker.internet.email().toLowerCase(),
    phone: faker.phone.number({ style: "national" }),
    user_uid: userId,
    status: faker.helpers.arrayElement(["active", "active", "active", "inactive"]),
    created_at: faker.date.recent({ days: 90 }),
  }));

  const insertedCustomers = await db
    .insert(customers)
    .values(customerValues)
    .returning();

  const insertedProducts = await db
    .insert(products)
    .values(productValues)
    .returning();

  // ── Product Transformations (Disassembly Recipes) ────────────────────────
  const canal = insertedProducts.find((p) => p.description === "CANAL");
  const lomo = insertedProducts.find((p) => p.description === "LOMO");
  const pierna = insertedProducts.find((p) => p.description === "PIERNA");
  const jamon = insertedProducts.find((p) => p.description === "JAMON");

  if (canal && lomo && pierna && jamon) {
    await db.insert(productTransformations).values([
      {
        parent_product_id: canal.id,
        child_product_id: lomo.id,
        yield_quantity_pieces: 2, // 2 lomos por canal
        yield_weight_ratio: 0.15, // 15% del peso del canal
        transformation_type: "DESPIECE_NACIONAL",
      },
      {
        parent_product_id: canal.id,
        child_product_id: pierna.id,
        yield_quantity_pieces: 2, // 2 piernas por canal
        yield_weight_ratio: 0.3, // 30% del peso del canal
        transformation_type: "DESPIECE_NACIONAL",
      },
    ]);
  }

  // ── Orders + Order Items + Selling Transactions ──────────────────────────
  const orderCount = 60; // Más pedidos para ver mejor el dashboard
  for (let i = 0; i < orderCount; i++) {
    const customer = faker.helpers.arrayElement(insertedCustomers);
    const pmId = faker.helpers.arrayElement(paymentMethodIds);
    const itemCount = faker.number.int({ min: 1, max: 8 }); // Pedidos más grandes
    const chosenProducts = faker.helpers.arrayElements(
      insertedProducts,
      itemCount
    );

    const items = chosenProducts.map((p) => ({
      product_id: p.id,
      quantity: faker.number.int({ min: 5, max: 50 }), // Mayoreo: 5 a 50kg por producto
      price: p.price,
    }));

    const totalAmount = items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );

    const createdAt = faker.date.recent({ days: 60 });

    const [order] = await db
      .insert(orders)
      .values({
        customer_id: customer.id,
        total_amount: totalAmount,
        user_uid: userId,
        status: faker.helpers.weightedArrayElement([
          { value: "completed", weight: 9 }, // Casi todos completados para ver flujo de caja
          { value: "pending", weight: 0.8 },
          { value: "cancelled", weight: 0.2 },
        ]),
        created_at: createdAt,
      })
      .returning();

    await db.insert(orderItems).values(
      items.map((item) => ({
        order_id: order.id,
        ...item,
      }))
    );

    if (order.status === "completed") {
      await db.insert(transactions).values({
        description: `Venta al mayoreo - Pedido #${order.id}`,
        order_id: order.id,
        payment_method_id: pmId,
        amount: totalAmount,
        user_uid: userId,
        type: "income",
        category: "selling",
        status: "completed",
        created_at: createdAt,
      });
    }
  }

  // ── Expense Transactions ─────────────────────────────────────────────────
  const expenseCount = 30;
  for (let i = 0; i < expenseCount; i++) {
    const category = faker.helpers.arrayElement(EXPENSE_CATEGORIES);
    const descriptions: Record<string, () => string> = {
      canales: () => "Compra de canales de cerdo para despiece",
      gasolina: () => "Combustible Diesel - Unidades de reparto",
      renta: () => `Pago de renta - Nave Industrial - ${faker.date.month()}`,
      salarios: () => "Pago de nómina semanal - Personal operativa",
      mantenimiento: () => "Servicio preventivo cámara fría y básculas",
      suministros: () => "Compra de rollos de empaque y sanitizantes",
    };

    await db.insert(transactions).values({
      description: descriptions[category](),
      payment_method_id: faker.helpers.arrayElement(paymentMethodIds),
      amount: faker.number.int({ min: 5000, max: 45000 }), // Gastos operativos reales
      user_uid: userId,
      type: "expense",
      category,
      status: "completed",
      created_at: faker.date.recent({ days: 60 }),
    });
  }

  const cityCount = COUNTRY === "MX" ? 0 : await seedCities();

  console.log(
    `Seeded: 3 payment methods, 1 demo user (${DEMO_EMAIL} / ${DEMO_PASSWORD}), ` +
      `${customerValues.length} customers, ${productValues.length} products, ` +
      `${orderCount} orders, ${expenseCount} expense transactions, ` +
      `${cityCount} cities`
  );

  return { userId };
}

const STATES = [
  "AC", "AL", "AM", "AP", "BA", "CE", "DF", "ES", "GO", "MA",
  "MG", "MS", "MT", "PA", "PB", "PE", "PI", "PR", "RJ", "RN",
  "RO", "RR", "RS", "SC", "SE", "SP", "TO",
];

async function seedCities(): Promise<number> {
  const existingCities = await db
    .select({ count: sql<number>`count(*)` })
    .from(cities);

  if (existingCities[0].count > 0) return existingCities[0].count;

  let total = 0;

  for (const uf of STATES) {
    try {
      const res = await fetch(
        `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios`
      );
      if (!res.ok) {
        console.warn(`Failed to fetch cities for ${uf}: ${res.status}`);
        continue;
      }

      const data: Array<{ id: number; nome: string }> = await res.json();

      if (data.length > 0) {
        // Insert in batches of 500 to avoid query size limits
        for (let i = 0; i < data.length; i += 500) {
          const batch = data.slice(i, i + 500);
          await db.insert(cities).values(
            batch.map((city) => ({
              id: city.id,
              name: city.nome,
              state_code: uf,
            }))
          );
        }
        total += data.length;
      }
    } catch (err) {
      console.warn(`Error fetching cities for ${uf}:`, err);
    }
  }

  return total;
}
