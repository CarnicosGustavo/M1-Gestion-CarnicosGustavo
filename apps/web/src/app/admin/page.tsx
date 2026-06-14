"use client";

import { Button } from "@finopenpos/ui/components/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@finopenpos/ui/components/card";
import {
	type ChartConfig,
	ChartContainer,
	ChartLegend,
	ChartLegendContent,
	ChartTooltip,
	ChartTooltipContent,
} from "@finopenpos/ui/components/chart";
import { Skeleton } from "@finopenpos/ui/components/skeleton";
import { cn } from "@finopenpos/ui/lib/utils";
import { useQuery } from "@tanstack/react-query";
import {
	DollarSign,
	EyeIcon,
	EyeOffIcon,
	TrendingDown,
	TrendingUp,
	Wallet,
} from "lucide-react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import {
	Area,
	AreaChart,
	Bar,
	BarChart,
	CartesianGrid,
	Cell,
	Label,
	Pie,
	PieChart,
	XAxis,
	YAxis,
} from "recharts";
import { AntonellaSlot } from "@/components/antonella-slot";
import { authClient } from "@/lib/auth-client";
import { useTRPC } from "@/lib/trpc/client";
import { formatCurrency, formatShortDate } from "@/lib/utils";

/** Saludo según la hora del día (mismo tono que el prototipo: "Buen día, …"). */
function greetingForNow(): string {
	const h = new Date().getHours();
	if (h < 12) return "Buen día";
	if (h < 19) return "Buenas tardes";
	return "Buenas noches";
}

const CHART_COLORS = [
	"var(--chart-1)",
	"var(--chart-2)",
	"var(--chart-3)",
	"var(--chart-4)",
	"var(--chart-5)",
];

export default function Page() {
	const trpc = useTRPC();
	const { data, isLoading, error, refetch, isFetching } = useQuery(
		trpc.dashboard.stats.queryOptions(),
	);
	const t = useTranslations("dashboard");
	const locale = useLocale();

	// Sesión: para el saludo personalizado del hero.
	const { data: session } = authClient.useSession();

	// Resumen del día (en vivo, datos reales). Se cargan aparte y no bloquean el
	// render del tablero; si fallan, simplemente no se muestra esa parte.
	const { data: ordersData } = useQuery(trpc.orders.list.queryOptions());
	const { data: accountsData } = useQuery(
		trpc.collections.listAccounts.queryOptions(),
	);

	// Privacidad: por defecto SIEMPRE oculto al entrar. El usuario revela con el
	// botón (solo para la sesión actual; al recargar vuelve a ocultarse).
	const [hideAmounts, setHideAmounts] = useState(true);
	const toggleHide = () => setHideAmounts((v) => !v);
	const money = (val: number) =>
		hideAmounts ? "$ • • • •" : formatCurrency(val, locale);

	if (isLoading || isFetching) {
		return (
			<div className="grid flex-1 items-start gap-6">
				<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
					{Array.from({ length: 3 }).map((_, i) => (
						<Card key={i}>
							<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
								<Skeleton className="h-4 w-24" />
								<Skeleton className="h-4 w-4" />
							</CardHeader>
							<CardContent>
								<Skeleton className="mb-2 h-8 w-28" />
								<Skeleton className="h-3 w-40" />
							</CardContent>
						</Card>
					))}
				</div>
				<div className="grid gap-6 lg:grid-cols-2">
					{Array.from({ length: 4 }).map((_, i) => (
						<Card key={i}>
							<CardHeader className="pb-2">
								<Skeleton className="h-5 w-32" />
								<Skeleton className="h-3 w-48" />
							</CardHeader>
							<CardContent>
								<Skeleton className="h-[280px] w-full" />
							</CardContent>
						</Card>
					))}
				</div>
			</div>
		);
	}

	if (!data) {
		return (
			<div className="grid flex-1 items-start gap-6">
				<Card>
					<CardHeader>
						<CardTitle>Panel</CardTitle>
						<CardDescription>
							{String(error?.message ?? "Error desconocido")}
						</CardDescription>
					</CardHeader>
					<CardContent>
						<Button variant="outline" onClick={() => refetch()}>
							Reintentar
						</Button>
					</CardContent>
				</Card>
			</div>
		);
	}

	const profitIsPositive = data.totalProfit >= 0;
	const margen =
		data.totalRevenue > 0 ? (data.totalProfit / data.totalRevenue) * 100 : 0;

	// --- Hero: saludo + resumen del día (del diseño PanelScreen) ---
	const userName =
		session?.user?.name?.trim().split(/\s+/)[0] ||
		session?.user?.email?.split("@")[0] ||
		"Gustavo";
	const todayLabel = new Intl.DateTimeFormat(locale, {
		weekday: "long",
		day: "numeric",
		month: "long",
		year: "numeric",
	}).format(new Date());
	const todayCapitalized =
		todayLabel.charAt(0).toUpperCase() + todayLabel.slice(1);
	const pedidosEnCobro =
		ordersData?.filter((o) => o.status === "LISTA_PARA_COBRO").length ?? 0;
	const cuentasPorCobrar =
		accountsData?.filter((a) => a.balance > 0).length ?? 0;
	const summaryBits = [
		todayCapitalized,
		pedidosEnCobro > 0
			? `${pedidosEnCobro} ${pedidosEnCobro === 1 ? "pedido" : "pedidos"} en cola de cobro`
			: null,
		cuentasPorCobrar > 0
			? `${cuentasPorCobrar} ${cuentasPorCobrar === 1 ? "cuenta" : "cuentas"} por cobrar`
			: null,
	].filter(Boolean) as string[];

	return (
		<div className="relative min-h-[78vh]">
			{/* Contenido (se distorsiona cuando los datos están ocultos) */}
			<div
				aria-hidden={hideAmounts}
				className={cn(
					"grid min-w-0 flex-1 items-start gap-6 overflow-hidden transition",
					hideAmounts && "pointer-events-none select-none blur-md",
				)}
			>
				{/* Hero (del diseño PanelScreen): saludo + resumen del día. El logo
				    vive en el velo de privacidad (abajo), por eso aquí no se repite. */}
				<div className="overflow-hidden rounded-2xl border bg-[var(--cg-cream)] px-6 py-5 shadow-sm">
					<p className="font-bold text-[11px] text-primary uppercase tracking-[0.22em]">
						Centro de Distribución
					</p>
					<h1 className="mt-2 font-display text-3xl text-foreground leading-[0.95] tracking-[0.01em] sm:text-4xl">
						{greetingForNow()}, {userName}
					</h1>
					<p className="mt-2.5 max-w-prose text-muted-foreground text-sm">
						{summaryBits.join("  ·  ")}
					</p>
				</div>

				{/* iAntonella — presencia inline */}
				<AntonellaSlot
					data={{
						tone: "sugerencia",
						titulo: "Resumen del día",
						texto:
							"Estoy vigilando inventario, despiece, pedidos y cobranza. Pregúntame qué conviene producir hoy o si el stock cubre los pedidos abiertos.",
						acciones: [
							"¿Qué conviene despiezar hoy?",
							"¿Cubre mi stock los pedidos?",
							"Resumen de cobranza",
						],
					}}
				/>

				{/* Botón ocultar datos (visible cuando ya se revelaron) */}
				<div className="-mb-2 flex justify-end">
					<Button variant="outline" size="sm" onClick={toggleHide}>
						<EyeOffIcon className="mr-2 h-4 w-4" />
						Ocultar datos
					</Button>
				</div>

				{/* KPI Cards */}
				<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
					<Card>
						<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
							<CardTitle className="font-medium text-sm">
								{t("totalRevenue")}
							</CardTitle>
							<DollarSign className="h-4 w-4 text-muted-foreground" />
						</CardHeader>
						<CardContent>
							<div className="font-bold text-2xl">
								{money(data.totalRevenue)}
							</div>
							<p className="text-muted-foreground text-xs">
								{t("completedIncome")}
							</p>
						</CardContent>
					</Card>
					<Card>
						<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
							<CardTitle className="font-medium text-sm">
								{t("totalExpenses")}
							</CardTitle>
							<Wallet className="h-4 w-4 text-muted-foreground" />
						</CardHeader>
						<CardContent>
							<div className="font-bold text-2xl">
								{money(data.totalExpenses)}
							</div>
							<p className="text-muted-foreground text-xs">
								{t("completedExpenses")}
							</p>
						</CardContent>
					</Card>
					<Card>
						<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
							<CardTitle className="font-medium text-sm">
								{t("netProfit")}
							</CardTitle>
							{profitIsPositive ? (
								<TrendingUp className="h-4 w-4 text-emerald-500" />
							) : (
								<TrendingDown className="h-4 w-4 text-red-500" />
							)}
						</CardHeader>
						<CardContent>
							<div
								className={`font-bold text-2xl ${profitIsPositive ? "text-emerald-600" : "text-red-600"}`}
							>
								{money(data.totalProfit)}
							</div>
							<p className="text-muted-foreground text-xs">
								{`Margen ${margen.toFixed(1)}%`}
							</p>
						</CardContent>
					</Card>
				</div>

				{/* Charts Grid */}
				<div className="grid min-w-0 gap-6 lg:grid-cols-2">
					<CategoryPieChart
						title={t("revenueByCategory")}
						description={t("revenueBreakdown")}
						data={data.revenueByCategory}
						hideAmounts={hideAmounts}
					/>

					<CategoryPieChart
						title={t("expensesByCategory")}
						description={t("expensesBreakdown")}
						data={data.expensesByCategory}
						hideAmounts={hideAmounts}
					/>

					<ProfitMarginChart data={data.profitMargin} />
					<CashFlowChart data={data.cashFlow} hideAmounts={hideAmounts} />
				</div>
			</div>

			{/* Velo de privacidad: logo grande nítido al centro */}
			{hideAmounts && (
				<div className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-6 rounded-2xl bg-[var(--cg-cream)]/80 px-6 py-16 text-center backdrop-blur-[3px]">
					<Image
						src="/brand/logo-principal.png"
						alt="Cárnicos Gustavo"
						width={620}
						height={360}
						priority
						className="h-auto w-[clamp(250px,52vw,520px)] object-contain drop-shadow-md"
					/>
					<p className="font-display text-foreground text-xl tracking-[0.08em] sm:text-2xl">
						DATOS OCULTOS POR PRIVACIDAD
					</p>
					<Button size="lg" onClick={toggleHide} className="rounded-full px-8">
						<EyeIcon className="mr-2 h-5 w-5" />
						Mostrar datos
					</Button>
				</div>
			)}
		</div>
	);
}

/** Reusable donut chart for category breakdowns. */
function CategoryPieChart({
	title,
	description,
	data,
	hideAmounts,
}: {
	title: string;
	description: string;
	data: Record<string, number>;
	hideAmounts?: boolean;
}) {
	const t = useTranslations("dashboard");
	const tc = useTranslations("common");
	const locale = useLocale();
	const entries = Object.entries(data);
	const total = entries.reduce((sum, [, v]) => sum + v, 0);

	const chartData = entries.map(([category, value], i) => ({
		category,
		value,
		fill: CHART_COLORS[i % CHART_COLORS.length],
	}));

	const chartConfig: ChartConfig = Object.fromEntries(
		entries.map(([category], i) => {
			// Try to translate the category label, fallback to capitalized key
			let label = category.charAt(0).toUpperCase() + category.slice(1);
			try {
				label = t(`categories.${category}`);
			} catch {
				// Fallback already set
			}

			return [
				category,
				{
					label,
					color: CHART_COLORS[i % CHART_COLORS.length],
				},
			];
		}),
	);

	return (
		<Card className="min-w-0 overflow-hidden">
			<CardHeader className="pb-2">
				<CardTitle>{title}</CardTitle>
				<CardDescription>{description}</CardDescription>
			</CardHeader>
			<CardContent>
				{entries.length === 0 ? (
					<EmptyState
						message={t("noDataYet", { section: title.toLowerCase() })}
					/>
				) : (
					<ChartContainer
						config={chartConfig}
						className="mx-auto aspect-square max-h-[280px]"
					>
						<PieChart>
							<ChartTooltip
								content={
									<ChartTooltipContent
										nameKey="category"
										formatter={(value) =>
											hideAmounts
												? "• • • •"
												: formatCurrency(Number(value), locale)
										}
									/>
								}
							/>
							<Pie
								data={chartData}
								dataKey="value"
								nameKey="category"
								innerRadius={60}
								strokeWidth={2}
								stroke="hsl(var(--background))"
							>
								<Label
									content={({ viewBox }) => {
										if (viewBox && "cx" in viewBox && "cy" in viewBox) {
											return (
												<text
													x={viewBox.cx}
													y={viewBox.cy}
													textAnchor="middle"
													dominantBaseline="middle"
												>
													<tspan
														x={viewBox.cx}
														y={viewBox.cy}
														className="fill-foreground font-bold text-xl"
													>
														{hideAmounts
															? "• • • •"
															: formatCurrency(total, locale)}
													</tspan>
													<tspan
														x={viewBox.cx}
														y={(viewBox.cy || 0) + 20}
														className="fill-muted-foreground text-xs"
													>
														{tc("total")}
													</tspan>
												</text>
											);
										}
									}}
								/>
							</Pie>
							<ChartLegend
								content={<ChartLegendContent nameKey="category" />}
							/>
						</PieChart>
					</ChartContainer>
				)}
			</CardContent>
		</Card>
	);
}

function ProfitMarginChart({
	data,
}: {
	data: { date: string; margin: number }[];
}) {
	const t = useTranslations("dashboard");
	const locale = useLocale();

	const chartConfig = {
		margin: {
			label: t("marginPercent"),
			color: "var(--chart-1)",
		},
	} satisfies ChartConfig;

	return (
		<Card className="min-w-0 overflow-hidden">
			<CardHeader className="pb-2">
				<CardTitle>{t("profitMargin")}</CardTitle>
				<CardDescription>{t("dailyProfitMargin")}</CardDescription>
			</CardHeader>
			<CardContent>
				{data.length === 0 ? (
					<EmptyState
						message={t("noDataYet", {
							section: t("profitMargin").toLowerCase(),
						})}
					/>
				) : (
					<ChartContainer config={chartConfig} className="h-[280px] w-full">
						<BarChart accessibilityLayer data={data}>
							<CartesianGrid vertical={false} strokeDasharray="3 3" />
							<XAxis
								dataKey="date"
								tickLine={false}
								tickMargin={10}
								axisLine={false}
								tickFormatter={(v) => formatShortDate(v, locale)}
							/>
							<YAxis
								tickLine={false}
								axisLine={false}
								tickFormatter={(v) => `${v}%`}
								width={50}
							/>
							<ChartTooltip
								content={
									<ChartTooltipContent
										labelFormatter={(label) =>
											formatShortDate(String(label), locale)
										}
										formatter={(value) => `${value}%`}
									/>
								}
							/>
							<Bar dataKey="margin" radius={[4, 4, 0, 0]}>
								{data.map((entry, i) => (
									<Cell
										key={`cell-${i}`}
										fill={
											entry.margin >= 0 ? "var(--chart-2)" : "var(--chart-5)"
										}
									/>
								))}
							</Bar>
						</BarChart>
					</ChartContainer>
				)}
			</CardContent>
		</Card>
	);
}

function CashFlowChart({
	data,
	hideAmounts,
}: {
	data: { date: string; amount: number }[];
	hideAmounts?: boolean;
}) {
	const t = useTranslations("dashboard");
	const locale = useLocale();

	const chartConfig = {
		amount: {
			label: t("cashFlow"),
			color: "var(--chart-3)",
		},
	} satisfies ChartConfig;

	return (
		<Card className="min-w-0 overflow-hidden">
			<CardHeader className="pb-2">
				<CardTitle>{t("cashFlow")}</CardTitle>
				<CardDescription>{t("dailyTransactionVolume")}</CardDescription>
			</CardHeader>
			<CardContent>
				{data.length === 0 ? (
					<EmptyState
						message={t("noDataYet", { section: t("cashFlow").toLowerCase() })}
					/>
				) : (
					<ChartContainer config={chartConfig} className="h-[280px] w-full">
						<AreaChart
							accessibilityLayer
							data={data}
							margin={{ left: 12, right: 12 }}
						>
							<CartesianGrid vertical={false} strokeDasharray="3 3" />
							<XAxis
								dataKey="date"
								tickLine={false}
								axisLine={false}
								tickMargin={8}
								tickFormatter={(v) => formatShortDate(v, locale)}
							/>
							<YAxis
								tickLine={false}
								axisLine={false}
								tickFormatter={(v) =>
									hideAmounts ? "•••" : formatCurrency(v, locale)
								}
								width={60}
							/>
							<ChartTooltip
								content={
									<ChartTooltipContent
										labelFormatter={(label) =>
											formatShortDate(String(label), locale)
										}
										formatter={(value) =>
											hideAmounts
												? "• • • •"
												: formatCurrency(Number(value), locale)
										}
									/>
								}
							/>
							<defs>
								<linearGradient id="fillAmount" x1="0" y1="0" x2="0" y2="1">
									<stop
										offset="5%"
										stopColor="var(--color-amount)"
										stopOpacity={0.8}
									/>
									<stop
										offset="95%"
										stopColor="var(--color-amount)"
										stopOpacity={0.1}
									/>
								</linearGradient>
							</defs>
							<Area
								dataKey="amount"
								type="monotone"
								fill="url(#fillAmount)"
								stroke="var(--color-amount)"
								strokeWidth={2}
							/>
						</AreaChart>
					</ChartContainer>
				)}
			</CardContent>
		</Card>
	);
}

function EmptyState({ message }: { message: string }) {
	return (
		<div className="flex h-[280px] items-center justify-center">
			<p className="text-muted-foreground text-sm">{message}</p>
		</div>
	);
}
