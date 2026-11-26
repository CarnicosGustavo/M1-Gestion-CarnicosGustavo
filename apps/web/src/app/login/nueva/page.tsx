"use client";

import { useSearchParams } from "next/navigation";
import { resetPassword } from "../actions";
import {
	fieldInput,
	fieldLabel,
	GreenScreen,
	Notice,
	ScreenLink,
	StationShell,
	SubmitKey,
} from "../shell";

const ERRORS: Record<string, string> = {
	corta: "La contraseña debe tener al menos 8 caracteres.",
	distintas: "Las dos contraseñas no coinciden.",
	invalida: "La contraseña no es válida. Usa entre 8 y 128 caracteres.",
};

/** Llega desde el enlace del correo con ?token=… */
export default function NewPasswordPage() {
	const params = useSearchParams();
	const token = params.get("token") ?? "";
	const error = params.get("error");

	if (!token || error === "INVALID_TOKEN") {
		return (
			<StationShell>
				<GreenScreen title="Contraseña nueva">
					<Notice tone="error">
						El enlace ya no sirve (venció o ya se usó).
					</Notice>
					<ScreenLink href="/login/olvide">Pedir un enlace nuevo</ScreenLink>
				</GreenScreen>
			</StationShell>
		);
	}

	return (
		<StationShell>
			<GreenScreen title="Contraseña nueva" action={resetPassword}>
				{error && ERRORS[error] ? (
					<Notice tone="error">{ERRORS[error]}</Notice>
				) : (
					<p className="mb-4 text-[#9be59b]/80 text-xs">
						Escribe tu contraseña nueva dos veces. Al guardarla se cierran las
						sesiones abiertas.
					</p>
				)}
				<input type="hidden" name="token" value={token} />

				<label htmlFor="password" className={fieldLabel}>
					Contraseña nueva
				</label>
				<input
					id="password"
					name="password"
					type="password"
					required
					minLength={8}
					maxLength={128}
					autoComplete="new-password"
					className={`${fieldInput} mb-4`}
				/>
				<label htmlFor="confirm" className={fieldLabel}>
					Repítela
				</label>
				<input
					id="confirm"
					name="confirm"
					type="password"
					required
					minLength={8}
					maxLength={128}
					autoComplete="new-password"
					className={fieldInput}
				/>

				<SubmitKey label="Guardar contraseña" pendingLabel="Guardando…" />
			</GreenScreen>
		</StationShell>
	);
}
