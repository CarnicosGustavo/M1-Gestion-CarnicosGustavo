import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";
import { router } from "./init";
import { antonicellaRouter } from "./routers/antonella";
import { coldInventoryRouter } from "./routers/cold-inventory";
import { collectionsRouter } from "./routers/collections";
import { customerPricesRouter } from "./routers/customer-prices";
import { customersRouter } from "./routers/customers";
import { dashboardRouter } from "./routers/dashboard";
import { inventoryRouter } from "./routers/inventory";
import { ordersRouter } from "./routers/orders";
import { paymentMethodsRouter } from "./routers/payment-methods";
import { productsRouter } from "./routers/products";
import { scaleRouter } from "./routers/scale";
import { scaleSerialRouter } from "./routers/scale-serial";
import { ticketsRouter } from "./routers/tickets";
import { transactionsRouter } from "./routers/transactions";
import { yieldsRouter } from "./routers/yields";

export const appRouter = router({
	products: productsRouter,
	customers: customersRouter,
	orders: ordersRouter,
	transactions: transactionsRouter,
	paymentMethods: paymentMethodsRouter,
	dashboard: dashboardRouter,
	inventory: inventoryRouter,
	tickets: ticketsRouter,
	yields: yieldsRouter,
	customerPrices: customerPricesRouter,
	coldInventory: coldInventoryRouter,
	collections: collectionsRouter,
	antonella: antonicellaRouter,
	scaleSerial: scaleSerialRouter,
	scale: scaleRouter,
});

export type AppRouter = typeof appRouter;
export type RouterOutputs = inferRouterOutputs<AppRouter>;
export type RouterInputs = inferRouterInputs<AppRouter>;
