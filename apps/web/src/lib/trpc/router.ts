import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";
import { router } from "./init";
import { citiesRouter } from "./routers/cities";
import { customersRouter } from "./routers/customers";
import { dashboardRouter } from "./routers/dashboard";
import { fiscalRouter } from "./routers/fiscal";
import { fiscalSettingsRouter } from "./routers/fiscal-settings";
import { inventoryRouter } from "./routers/inventory";
import { ordersRouter } from "./routers/orders";
import { paymentMethodsRouter } from "./routers/payment-methods";
import { productsRouter } from "./routers/products";
import { transactionsRouter } from "./routers/transactions";
import { purchaseOrdersRouter } from "./routers/purchase-orders";

export const appRouter = router({
	products: productsRouter,
	customers: customersRouter,
	orders: ordersRouter,
	transactions: transactionsRouter,
	paymentMethods: paymentMethodsRouter,
	purchaseOrders: purchaseOrdersRouter,
	dashboard: dashboardRouter,
	fiscalSettings: fiscalSettingsRouter,
	fiscal: fiscalRouter,
	cities: citiesRouter,
	inventory: inventoryRouter,
});

export type AppRouter = typeof appRouter;
export type RouterOutputs = inferRouterOutputs<AppRouter>;
export type RouterInputs = inferRouterInputs<AppRouter>;
