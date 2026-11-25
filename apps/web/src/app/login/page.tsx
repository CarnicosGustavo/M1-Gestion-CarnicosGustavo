"use client";

import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { login } from "./actions";
import {
	fieldInput,
	fieldLabel,
	GreenScreen,
	Notice,
	ScreenLink,
	StationShell,
	SubmitKey,
} from "./shell";

/**
 * Portada con el mismo lenguaje que la pantalla única de la báscula:
 * carcasa oscura, pantalla verde tipo instrumento y tecla naranja.
 */
export default function LoginPage() {
	const t = useTranslations("login");
	const searchParams = useSearchParams();
	const error = searchParams.get("error");
	const reason = searchParams.get("reason");
	const changed = searchParams.get("cambiada");

	return (
		<StationShell>
			<GreenScreen title={t("title")} action={login}>
				{error ? (
					<Notice tone="error">
						{error}
						{reason ? (
							<div className="mt-1 break-words text-[10px] opacity-70">
								{reason}
							</div>
						) : null}
					</Notice>
				) : changed ? (
					<Notice tone="ok">Contraseña cambiada. Entra con la nueva.</Notice>
				) : (
					<p className="mb-4 text-[#9be59b]/80 text-xs">{t("subtitle")}</p>
				)}

				<label htmlFor="email" className={fieldLabel}>
					{t("email")}
				</label>
				<input
					id="email"
					name="email"
					type="email"
					required
					autoComplete="email"
					placeholder={t("emailPlaceholder")}
					className={`${fieldInput} mb-4`}
				/>

				<div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
					<label htmlFor="password" className={fieldLabel}>
						{t("password")}
					</label>
					<ScreenLink href="/login/olvide">
						¿Olvidaste tu contraseña?
					</ScreenLink>
				</div>
				<input
					id="password"
					name="password"
					type="password"
					required
					autoComplete="current-password"
					className={fieldInput}
				/>

				<SubmitKey label={t("submit")} />
			</GreenScreen>
		</StationShell>
	);
}
