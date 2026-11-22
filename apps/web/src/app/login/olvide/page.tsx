"use client";

import { useSearchParams } from "next/navigation";
import { requestReset } from "../actions";
import {
	fieldInput,
	fieldLabel,
	GreenScreen,
	Notice,
	ScreenLink,
	StationShell,
	SubmitKey,
} from "../shell";

/** Pide el enlace para poner una contraseña nueva. */
export default function ForgotPasswordPage() {
	const params = useSearchParams();
	const sent = params.get("enviado");
	const badLink = params.get("error") === "enlace";

	return (
		<StationShell>
			<GreenScreen title="Olvidé mi contraseña" action={requestReset}>
				{sent ? (
					<Notice tone="ok">
						Si el correo está registrado, te llegará un enlace en unos minutos.
						Vale 1 hora. Revisa también «spam».
					</Notice>
				) : badLink ? (
					<Notice tone="error">
						El enlace ya no sirve (venció o ya se usó). Pide uno nuevo.
					</Notice>
				) : (
					<p className="mb-4 text-[#9be59b]/80 text-xs">
						Escribe tu correo y te mandamos un enlace para poner una contraseña
						nueva.
					</p>
				)}

				<label htmlFor="email" className={fieldLabel}>
					Correo
				</label>
				<input
					id="email"
					name="email"
					type="email"
					required
					autoComplete="email"
					placeholder="tu@correo.com"
					className={fieldInput}
				/>

				<SubmitKey label="Enviar enlace" />
				<p className="mt-4 text-center">
					<ScreenLink href="/login">Volver a iniciar sesión</ScreenLink>
				</p>
			</GreenScreen>
		</StationShell>
	);
}
