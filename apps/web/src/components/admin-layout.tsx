"use client";

import { Button } from "@finopenpos/ui/components/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@finopenpos/ui/components/dropdown-menu";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@finopenpos/ui/components/tooltip";
import {
	BanknoteIcon,
	BookOpenIcon,
	BotIcon,
	ClipboardListIcon,
	CreditCardIcon,
	DollarSignIcon,
	HandCoinsIcon,
	LayoutDashboardIcon,
	type LucideIcon,
	MenuIcon,
	MoonIcon,
	PackageIcon,
	PaletteIcon,
	PiggyBankIcon,
	ScaleIcon,
	ScissorsIcon,
	SettingsIcon,
	ShoppingBagIcon,
	ShoppingCartIcon,
	SnowflakeIcon,
	SunIcon,
	TagIcon,
	UsersIcon,
	XIcon,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import { logout } from "@/app/login/actions";
import { cn } from "@finopenpos/ui/lib/utils";
import { AntonellaProvider } from "@/components/antonella-dock";
import { type Palette, useTheme } from "@/components/theme-provider";
import { CLIENT_NAME } from "@/lib/constants";

interface NavItem {
	href: string;
	labelKey:
		| "dashboard"
		| "purchase"
		| "cashier"
		| "products"
		| "recipes"
		| "customers"
		| "orders"
		| "paymentMethods"
		| "pos"
		| "settings"
		| "disassembly"
		| "weighingStation"
		| "yield"
		| "prices"
		| "coldInventory"
		| "collections"
		| "checkout"
		| "antonella";
	icon: LucideIcon;
}

// Operación del día (barra lateral): lo básico para un día de trabajo fluido
const opNav: NavItem[] = [
	{ href: "/admin", labelKey: "dashboard", icon: LayoutDashboardIcon },
	{ href: "/admin/purchase", labelKey: "purchase", icon: PiggyBankIcon },
	{ href: "/admin/orders", labelKey: "orders", icon: ShoppingBagIcon },
	{ href: "/admin/despiece", labelKey: "disassembly", icon: ScissorsIcon },
	{
		href: "/admin/weighing-station",
		labelKey: "weighingStation",
		icon: ScaleIcon,
	},
	{ href: "/admin/checkout", labelKey: "checkout", icon: BanknoteIcon },
	{ href: "/admin/yield", labelKey: "yield", icon: ClipboardListIcon },
	{ href: "/admin/collections", labelKey: "collections", icon: HandCoinsIcon },
	{ href: "/admin/customers", labelKey: "customers", icon: UsersIcon },
	{ href: "/admin/pos", labelKey: "pos", icon: ShoppingCartIcon },
	{ href: "/admin/antonella", labelKey: "antonella", icon: BotIcon },
];

// Configuración (agrupado en un menú): catálogo, recetas, precios, ajustes…
const cfgNav: NavItem[] = [
	{ href: "/admin/products", labelKey: "products", icon: PackageIcon },
	{ href: "/admin/inventory/recipes", labelKey: "recipes", icon: BookOpenIcon },
	{ href: "/admin/prices", labelKey: "prices", icon: TagIcon },
	{
		href: "/admin/cold-inventory",
		labelKey: "coldInventory",
		icon: SnowflakeIcon,
	},
	{ href: "/admin/cashier", labelKey: "cashier", icon: DollarSignIcon },
	{
		href: "/admin/payment-methods",
		labelKey: "paymentMethods",
		icon: CreditCardIcon,
	},
	{ href: "/admin/settings", labelKey: "settings", icon: SettingsIcon },
];

const navItems: NavItem[] = [...opNav, ...cfgNav];

// Insignia del cerdo (isotipo) — arriba del rail, enlaza al panel
function PigBadge({ size = 42 }: { size?: number }) {
	return (
		<span
			className="inline-flex items-center justify-center overflow-hidden rounded-xl bg-[var(--cg-chrome2)]"
			style={{ width: size, height: size }}
		>
			<Image
				src="/brand/pig-head.png"
				alt="Cárnicos Gustavo"
				width={size}
				height={size}
				className="h-full w-full object-contain p-1"
			/>
		</span>
	);
}

// Control de tema: paleta (cálida/neutra) × modo (claro/oscuro)
function ThemeControl() {
	const { palette, mode, setPalette, setMode } = useTheme();
	const [open, setOpen] = useState(false);

	const palettes: { id: Palette; name: string; swatch: string[] }[] = [
		{ id: "warm", name: "Cálida", swatch: ["#9E3326", "#211C19", "#ECE5D8"] },
		{ id: "neutral", name: "Neutra", swatch: ["#C0271C", "#161616", "#E7E7E5"] },
	];

	return (
		<div className="relative">
			<button
				type="button"
				onClick={() => setOpen((o) => !o)}
				title="Apariencia"
				className="flex h-9 w-9 items-center justify-center rounded-full border bg-secondary text-muted-foreground transition-colors hover:text-foreground"
			>
				<PaletteIcon className="h-4 w-4" />
			</button>
			{open && (
				<>
					<button
						type="button"
						aria-label="Cerrar"
						className="fixed inset-0 z-40 cursor-default"
						onClick={() => setOpen(false)}
					/>
					<div className="absolute right-0 top-[calc(100%+10px)] z-50 w-56 rounded-2xl border bg-popover p-3.5 shadow-xl">
						<p className="mb-2.5 font-bold text-[10px] text-muted-foreground uppercase tracking-[0.1em]">
							Paleta
						</p>
						<div className="mb-4 flex gap-2">
							{palettes.map((p) => (
								<button
									key={p.id}
									type="button"
									onClick={() => setPalette(p.id)}
									className={cn(
										"flex-1 rounded-xl border-2 bg-secondary p-2 transition-colors",
										palette === p.id ? "border-primary" : "border-border",
									)}
								>
									<div className="mb-1.5 flex justify-center gap-1">
										{p.swatch.map((s) => (
											<span
												key={s}
												className="h-3.5 w-3.5 rounded-full border"
												style={{ background: s }}
											/>
										))}
									</div>
									<span
										className={cn(
											"font-bold text-xs",
											palette === p.id ? "text-primary" : "text-foreground",
										)}
									>
										{p.name}
									</span>
								</button>
							))}
						</div>
						<p className="mb-2.5 font-bold text-[10px] text-muted-foreground uppercase tracking-[0.1em]">
							Modo
						</p>
						<div className="flex gap-2">
							{([
								["light", "Claro", SunIcon],
								["dark", "Oscuro", MoonIcon],
							] as const).map(([id, lab, Ic]) => (
								<button
									key={id}
									type="button"
									onClick={() => setMode(id)}
									className={cn(
										"flex flex-1 items-center justify-center gap-1.5 rounded-lg border py-2.5 font-bold text-xs transition-colors",
										mode === id
											? "border-[var(--cg-chrome)] bg-[var(--cg-chrome)] text-[var(--cg-chrome-fg)]"
											: "border-border bg-secondary text-foreground",
									)}
								>
									<Ic className="h-3.5 w-3.5" />
									{lab}
								</button>
							))}
						</div>
					</div>
				</>
			)}
		</div>
	);
}

export function AdminLayout({ children }: { children: React.ReactNode }) {
	const pathname = usePathname();
	const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
	const userMenuTriggerId = useId();
	const t = useTranslations("nav");

	const pageNames: Record<string, string> = Object.fromEntries(
		navItems.map((item) => [item.href, t(item.labelKey)]),
	);
	const cfgActive = cfgNav.some((i) => i.href === pathname);

	// El configurador se abre en su propia ventana: sin menú ni cabecera del
	// dashboard, a pantalla completa.
	if (pathname === "/admin/configurador") {
		return <div className="min-h-screen w-full bg-muted/40">{children}</div>;
	}

	return (
		<div className="flex h-screen w-full flex-col bg-background">
			<header className="grid h-[60px] shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-2 border-b bg-card px-3 sm:px-4">
				<div className="flex min-w-0 items-center gap-2">
					<Button
						variant="ghost"
						size="icon"
						className="shrink-0 sm:hidden"
						onClick={() => setMobileMenuOpen(true)}
					>
						<MenuIcon className="h-5 w-5" />
						<span className="sr-only">{t("openMenu")}</span>
					</Button>
					<h1 className="min-w-0 truncate font-display text-xl tracking-wide">
						{pageNames[pathname] ?? ""}
					</h1>
				</div>

				{/* Logo de marca centrado */}
				<Link
					href="/admin"
					className="flex flex-col items-center justify-self-center leading-none"
				>
					<span className="font-semibold text-[9px] text-primary tracking-[0.32em]">
						CÁRNICOS
					</span>
					<span className="font-display text-[17px] tracking-[0.04em]">
						GUSTAVO
					</span>
				</Link>

				<div className="flex items-center gap-2.5 justify-self-end">
					<ThemeControl />
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button
								variant="outline"
								size="icon"
								className="shrink-0 overflow-hidden rounded-full"
								id={`user-menu-trigger-${userMenuTriggerId}`}
							>
								<Image
									src="/placeholder-user.jpg"
									width={36}
									height={36}
									alt="Avatar"
									className="overflow-hidden rounded-full"
								/>
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end">
							<DropdownMenuLabel>{t("myAccount")}</DropdownMenuLabel>
							<DropdownMenuSeparator />
							<DropdownMenuItem asChild>
								<Link href="/admin/settings">{t("settings")}</Link>
							</DropdownMenuItem>
							<DropdownMenuItem asChild>
								<Link href="/api/docs">{t("support")}</Link>
							</DropdownMenuItem>
							<DropdownMenuSeparator />
							<DropdownMenuItem onClick={() => logout()}>
								{t("logout")}
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</div>
			</header>

			{/* Mobile drawer overlay */}
			{mobileMenuOpen && (
				<div className="fixed inset-0 z-50 sm:hidden">
					<button
						type="button"
						className="fixed inset-0 bg-black/50"
						aria-label="Close menu"
						onClick={() => setMobileMenuOpen(false)}
					/>
					<nav className="fixed inset-y-0 left-0 flex w-64 flex-col gap-2 overflow-y-auto border-r bg-background p-4">
						<div className="mb-4 flex items-center justify-between">
							<Link
								href="/admin"
								className="flex items-center gap-2 font-semibold text-lg"
								onClick={() => setMobileMenuOpen(false)}
							>
								<span>{CLIENT_NAME}</span>
							</Link>
							<Button
								variant="ghost"
								size="icon"
								onClick={() => setMobileMenuOpen(false)}
							>
								<XIcon className="h-5 w-5" />
							</Button>
						</div>
						<p className="px-3 pt-1 font-semibold text-[11px] text-muted-foreground/70 uppercase tracking-wider">
							Operación
						</p>
						{opNav.map(({ href, labelKey, icon: Icon }) => (
							<Link
								key={href}
								href={href}
								onClick={() => setMobileMenuOpen(false)}
								className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
									pathname === href
										? "bg-accent font-medium text-accent-foreground"
										: "text-muted-foreground hover:bg-muted hover:text-foreground"
								}`}
							>
								<Icon className="h-5 w-5 shrink-0" />
								{t(labelKey)}
							</Link>
						))}
						<p className="mt-2 px-3 pt-1 font-semibold text-[11px] text-muted-foreground/70 uppercase tracking-wider">
							Configuración
						</p>
						{cfgNav.map(({ href, labelKey, icon: Icon }) => (
							<Link
								key={href}
								href={href}
								onClick={() => setMobileMenuOpen(false)}
								className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
									pathname === href
										? "bg-accent font-medium text-accent-foreground"
										: "text-muted-foreground hover:bg-muted hover:text-foreground"
								}`}
							>
								<Icon className="h-5 w-5 shrink-0" />
								{t(labelKey)}
							</Link>
						))}
					</nav>
				</div>
			)}

			<div className="flex min-h-0 flex-1">
				{/* Rail oscuro fijo (escritorio) */}
				<nav className="hidden w-[64px] shrink-0 flex-col items-center gap-1.5 bg-[var(--cg-chrome)] px-2 py-3.5 sm:flex">
					<Link href="/admin" className="mb-1.5" title="Panel">
						<PigBadge size={42} />
					</Link>
					<TooltipProvider delayDuration={200}>
						{opNav.map(({ href, labelKey, icon: Icon }) => {
							const on = pathname === href;
							return (
								<Tooltip key={href}>
									<TooltipTrigger asChild>
										<Link
											href={href}
											className={cn(
												"flex h-[46px] w-[46px] items-center justify-center rounded-[13px] transition-colors",
												on
													? "bg-primary text-[var(--cg-chrome-fg)]"
													: "text-[var(--cg-rail-dim)] hover:bg-[var(--cg-chrome2)] hover:text-[var(--cg-chrome-fg)]",
											)}
										>
											<Icon className="h-[21px] w-[21px]" />
											<span className="sr-only">{t(labelKey)}</span>
										</Link>
									</TooltipTrigger>
									<TooltipContent side="right">{t(labelKey)}</TooltipContent>
								</Tooltip>
							);
						})}

						<div className="my-1.5 h-px w-6 bg-[var(--cg-rail-dim)] opacity-30" />

						{/* Configuración: popover con el submenú */}
						<DropdownMenu>
							<Tooltip>
								<TooltipTrigger asChild>
									<DropdownMenuTrigger asChild>
										<button
											type="button"
											className={cn(
												"flex h-[46px] w-[46px] items-center justify-center rounded-[13px] transition-colors",
												cfgActive
													? "bg-primary text-[var(--cg-chrome-fg)]"
													: "text-[var(--cg-rail-dim)] hover:bg-[var(--cg-chrome2)] hover:text-[var(--cg-chrome-fg)]",
											)}
										>
											<SettingsIcon className="h-[21px] w-[21px]" />
											<span className="sr-only">Configuración</span>
										</button>
									</DropdownMenuTrigger>
								</TooltipTrigger>
								<TooltipContent side="right">Configuración</TooltipContent>
							</Tooltip>
							<DropdownMenuContent side="right" align="end" className="w-52">
								<DropdownMenuLabel>Configuración</DropdownMenuLabel>
								<DropdownMenuSeparator />
								{cfgNav.map(({ href, labelKey, icon: Icon }) => (
									<DropdownMenuItem key={href} asChild>
										<Link
											href={href}
											className={cn(
												"flex items-center gap-2",
												pathname === href && "font-medium text-foreground",
											)}
										>
											<Icon className="h-4 w-4" />
											{t(labelKey)}
										</Link>
									</DropdownMenuItem>
								))}
							</DropdownMenuContent>
						</DropdownMenu>
					</TooltipProvider>
				</nav>

				<main className="flex-1 overflow-y-auto px-4 py-5 sm:px-6 lg:px-8">
					<div className="mx-auto max-w-[1180px]">
						<AntonellaProvider>{children}</AntonellaProvider>
					</div>
				</main>
			</div>
		</div>
	);
}
