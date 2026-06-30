import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";
import { router } from "./init";
import { antonicellaRouter } from "./routers/antonella";
import { citiesRouter } from "./routers/cities";
import { coldInventoryRouter } from "./routers/cold-inventory";
import { collectionsRouter } from "./routers/collections";
import { customerPricesRouter } from "./routers/customer-prices";
import { customersRouter } from "./routers/customers";
import { dashboardRouter } from "./routers/dashboard";
import { inventoryRouter } from "./routers/inventory";
import { ordersRouter } from "./routers/orders";
import { paymentMethodsRouter } from "./routers/payment-methods";
import { productsRouter } from "./routers/products";
import { purchaseOrdersRouter } from "./routers/purchase-orders";
import { ticketsRouter } from "./routers/tickets";
import { transactionsRouter } from "./routers/transactions";
import { validacionRouter } from "./routers/validacion";
import { yieldsRouter } from "./routers/yields";

export const appRouter = router({
	products: productsRouter,
	customers: customersRouter,
	orders: ordersRouter,
	transactions: transactionsRouter,
	paymentMethods: paymentMethodsRouter,
	purchaseOrders: purchaseOrdersRouter,
	dashboard: dashboardRouter,
	cities: citiesRouter,
	inventory: inventoryRouter,
	tickets: ticketsRouter,
	yields: yieldsRouter,
	customerPrices: customerPricesRouter,
	coldInventory: coldInventoryRouter,
	collections: collectionsRouter,
	validacion: validacionRouter,
	antonella: antonicellaRouter,
});

export type AppRouter = typeof appRouter;
export type RouterOutputs = inferRouterOutputs<AppRouter>;
export type RouterInputs = inferRouterInputs<AppRouter>;
