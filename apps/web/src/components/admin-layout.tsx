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
	BookOpenIcon,
	CreditCardIcon,
	DollarSignIcon,
	LayoutDashboardIcon,
	type LucideIcon,
	MenuIcon,
	PackageIcon,
	ReceiptTextIcon,
	ScaleIcon,
	ScissorsIcon,
	SettingsIcon,
	ShoppingBagIcon,
	ShoppingCartIcon,
	UsersIcon,
	XIcon,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import { logout } from "@/app/login/actions";
import { CLIENT_NAME } from "@/lib/constants";

interface NavItem {
	href: string;
	labelKey:
		| "dashboard"
		| "cashier"
		| "products"
		| "recipes"
		| "customers"
		| "orders"
		| "paymentMethods"
		| "pos"
		| "invoices"
		| "fiscalSettings"
		| "disassembly"
		| "weighingStation";
	icon: LucideIcon;
}

const navItems: NavItem[] = [
	{ href: "/admin", labelKey: "dashboard", icon: LayoutDashboardIcon },
	{ href: "/admin/cashier", labelKey: "cashier", icon: DollarSignIcon },
	{ href: "/admin/products", labelKey: "products", icon: PackageIcon },
	{ href: "/admin/inventory/recipes", labelKey: "recipes", icon: BookOpenIcon },
	{ href: "/admin/disassembly", labelKey: "disassembly", icon: ScissorsIcon },
	{
		href: "/admin/weighing-station",
		labelKey: "weighingStation",
		icon: ScaleIcon,
	},
	{ href: "/admin/customers", labelKey: "customers", icon: UsersIcon },
	{ href: "/admin/orders", labelKey: "orders", icon: ShoppingBagIcon },
	{
		href: "/admin/payment-methods",
		labelKey: "paymentMethods",
		icon: CreditCardIcon,
	},
	{ href: "/admin/pos", labelKey: "pos", icon: ShoppingCartIcon },
	{ href: "/admin/fiscal", labelKey: "invoices", icon: ReceiptTextIcon },
	{
		href: "/admin/fiscal/settings",
		labelKey: "fiscalSettings",
		icon: SettingsIcon,
	},
];

export function AdminLayout({ children }: { children: React.ReactNode }) {
	const pathname = usePathname();
	const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
	const userMenuTriggerId = useId();
	const t = useTranslations("nav");

	const pageNames: Record<string, string> = Object.fromEntries(
		navItems.map((item) => [item.href, t(item.labelKey)]),
	);

	return (
		<div className="flex min-h-screen w-full flex-col bg-muted/40">
			<header className="sticky top-0 z-30 grid h-14 grid-cols-[1fr_auto_1fr] items-center gap-2 border-b bg-background px-3 sm:px-4">
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
					<h1 className="min-w-0 truncate font-bold text-base sm:text-lg">
						{pageNames[pathname]}
					</h1>
				</div>

				<Link
					href="/admin"
					className="justify-self-center truncate font-semibold text-sm sm:text-base"
				>
					{CLIENT_NAME}
				</Link>

				<div className="flex items-center gap-2 justify-self-end">
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button
								variant="outline"
								size="icon"
								className="shrink-0 overflow-hidden rounded-full"
								id={`user-menu-trigger-${userMenuTriggerId}`}
							>
								<Image
									src={`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/placeholder-user.jpg`}
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
							<DropdownMenuItem>{t("settings")}</DropdownMenuItem>
							<DropdownMenuItem>{t("support")}</DropdownMenuItem>
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
						{navItems.map(({ href, labelKey, icon: Icon }) => (
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

			<div className="flex flex-col sm:gap-4 sm:py-4 sm:pl-14">
				<aside className="fixed inset-y-0 left-0 z-10 mt-[56px] hidden w-14 flex-col border-r bg-background sm:flex">
					<nav className="flex flex-col items-center gap-4 px-2 sm:py-5">
						<TooltipProvider>
							{navItems.map(({ href, labelKey, icon: Icon }) => (
								<Tooltip key={href}>
									<TooltipTrigger asChild>
										<Link
											href={href}
											className={`flex h-9 w-9 items-center justify-center rounded-lg ${
												pathname === href
													? "bg-accent text-accent-foreground"
													: "text-muted-foreground"
											} transition-colors hover:text-foreground md:h-8 md:w-8`}
										>
											<Icon className="h-5 w-5" />
											<span className="sr-only">{t(labelKey)}</span>
										</Link>
									</TooltipTrigger>
									<TooltipContent side="right">{t(labelKey)}</TooltipContent>
								</Tooltip>
							))}
						</TooltipProvider>
					</nav>
				</aside>
				<main className="flex-1 overflow-x-hidden p-3 sm:px-6 sm:py-0">
					{children}
				</main>
			</div>
		</div>
	);
}
