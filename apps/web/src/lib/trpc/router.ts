import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";
import { router } from "./init";
import { citiesRouter } from "./routers/cities";
import { customersRouter } from "./routers/customers";
import { dashboardRouter } from "./routers/dashboard";
import { inventoryRouter } from "./routers/inventory";
import { ordersRouter } from "./routers/orders";
import { paymentMethodsRouter } from "./routers/payment-methods";
import { productsRouter } from "./routers/products";
import { transactionsRouter } from "./routers/transactions";
import { purchaseOrdersRouter } from "./routers/purchase-orders";
import { ticketsRouter } from "./routers/tickets";

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
});

export type AppRouter = typeof appRouter;
export type RouterOutputs = inferRouterOutputs<AppRouter>;
export type RouterInputs = inferRouterInputs<AppRouter>;
