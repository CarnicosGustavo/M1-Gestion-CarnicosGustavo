"use client";

import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { CLIENT_NAME, PROJECT_CREDIT } from "@/lib/constants";
import { login } from "./actions";

/**
 * Portada con el mismo lenguaje que la pantalla única de la báscula:
 * carcasa oscura, pantalla verde tipo instrumento y tecla naranja.
 */
export default function LoginPage() {
	const t = useTranslations("login");
	const searchParams = useSearchParams();
	const error = searchParams.get("error");
	const reason = searchParams.get("reason");

	return (
		<div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#101315] px-4 py-8 text-[#d5ffd1]">
			{/* Fondo: rejilla tenue como la carcasa de la estación */}
			<div
				aria-hidden
				className="pointer-events-none absolute inset-0 opacity-[0.07]"
				style={{
					backgroundImage:
						"linear-gradient(#9be59b 1px, transparent 1px), linear-gradient(90deg, #9be59b 1px, transparent 1px)",
					backgroundSize: "48px 48px",
				}}
			/>

			<main className="relative w-full max-w-[34rem] rounded-xl border border-[#2b3238] bg-gradient-to-b from-[#252b30] to-[#1a1f23] p-3 shadow-[0_24px_60px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.06)]">
				{/* Placa superior */}
				<header className="flex items-center justify-between gap-3 px-2 pt-1 pb-3">
					<div className="flex items-center gap-3">
						<Image
							src="/brand/logo-principal.png"
							alt={CLIENT_NAME}
							width={120}
							height={68}
							priority
							className="h-12 w-auto object-contain drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]"
						/>
						<div className="leading-tight">
							<p className="font-black text-[#f2f4f5] text-lg uppercase italic tracking-[0.08em]">
								Cárnicos Gustavo
							</p>
							<p className="text-[#8b949c] text-[11px] uppercase tracking-[0.3em]">
								CEDIS · estación
							</p>
						</div>
					</div>
					<span className="flex items-center gap-1.5 text-[#8b949c] text-[10px] uppercase tracking-[0.2em]">
						<span className="size-2 animate-pulse rounded-full bg-[#4cc35d] shadow-[0_0_6px_#4cc35d]" />
						En línea
					</span>
				</header>

				{/* Pantalla verde */}
				<form
					action={login}
					className="rounded-md border-2 border-[#0a120d] bg-[#0f2016] p-5 font-mono shadow-[inset_0_0_30px_rgba(0,0,0,0.65)]"
				>
					<div className="mb-4 flex items-baseline justify-between border-[#355440] border-b border-dashed pb-2">
						<h1 className="font-bold text-[#c9ff99] text-sm uppercase tracking-[0.25em]">
							{t("title")}
						</h1>
						<Clock />
					</div>

					{error ? (
						<div
							role="alert"
							className="mb-4 rounded border border-[#e2554f]/70 bg-[#3a1514]/80 px-3 py-2 text-[#ffb3ae] text-xs"
						>
							{error}
							{reason ? (
								<div className="mt-1 break-words text-[10px] opacity-70">
									{reason}
								</div>
							) : null}
						</div>
					) : (
						<p className="mb-4 text-[#9be59b]/80 text-xs">{t("subtitle")}</p>
					)}

					<label
						htmlFor="email"
						className="block text-[#9be59b] text-[11px] uppercase tracking-[0.2em]"
					>
						{t("email")}
					</label>
					<input
						id="email"
						name="email"
						type="email"
						required
						autoComplete="email"
						placeholder={t("emailPlaceholder")}
						className="mt-1 mb-4 w-full rounded border border-[#4d7652] bg-[#0b1710] px-3 py-2.5 text-[#d5ffd1] text-base outline-none placeholder:text-[#4d7652] focus:border-[#f39a1e] focus:shadow-[0_0_0_2px_rgba(243,154,30,0.25)]"
					/>

					<label
						htmlFor="password"
						className="block text-[#9be59b] text-[11px] uppercase tracking-[0.2em]"
					>
						{t("password")}
					</label>
					<input
						id="password"
						name="password"
						type="password"
						required
						autoComplete="current-password"
						className="mt-1 w-full rounded border border-[#4d7652] bg-[#0b1710] px-3 py-2.5 text-[#d5ffd1] text-base outline-none focus:border-[#f39a1e] focus:shadow-[0_0_0_2px_rgba(243,154,30,0.25)]"
					/>

					<SubmitKey label={t("submit")} />
				</form>

				<footer className="flex items-center justify-between px-2 pt-3 text-[#6c757d] text-[10px] uppercase tracking-[0.2em]">
					<span>Báscula · pedidos · cobranza</span>
					<span>{PROJECT_CREDIT}</span>
				</footer>
			</main>
		</div>
	);
}

/** Tecla naranja como las de la fila de módulos. */
function SubmitKey({ label }: { label: string }) {
	const { pending } = useFormStatus();
	return (
		<button
			type="submit"
			disabled={pending}
			className="mt-6 flex w-full items-center justify-between rounded-md border border-[#ffb85c] bg-gradient-to-b from-[#f7a93a] to-[#d9800f] px-4 py-3 font-sans text-[#2a1600] shadow-[0_3px_0_#8a4f05,0_6px_14px_rgba(0,0,0,0.45)] transition active:translate-y-[2px] active:shadow-[0_1px_0_#8a4f05] disabled:opacity-60"
		>
			<span className="font-black text-base uppercase tracking-wider">
				{pending ? "Entrando…" : label}
			</span>
			<kbd className="rounded border border-[#8a4f05]/60 bg-[#2a1600]/15 px-1.5 py-0.5 font-bold text-[10px]">
				Enter
			</kbd>
		</button>
	);
}

/** Hora y fecha como en la pantalla de la estación (solo en el cliente). */
function Clock() {
	const [now, setNow] = useState<Date | null>(null);
	useEffect(() => {
		setNow(new Date());
		const id = setInterval(() => setNow(new Date()), 30_000);
		return () => clearInterval(id);
	}, []);
	if (!now) return <span className="text-[#9be59b]/60 text-xs">--:--</span>;
	return (
		<span className="text-[#9be59b]/80 text-xs tabular-nums">
			{now.toLocaleDateString("es-MX", { day: "2-digit", month: "short" })} ·{" "}
			{now.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}
		</span>
	);
}
