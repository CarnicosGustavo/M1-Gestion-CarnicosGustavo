"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export async function login(formData: FormData) {
	const email = formData.get("email") as string;
	const password = formData.get("password") as string;

	try {
		await auth.api.signInEmail({
			body: { email, password },
			headers: await headers(),
		});
	} catch (err) {
		const e = err as any;
		const msg = typeof e?.message === "string" ? e.message : "";
		const code = typeof e?.code === "string" ? e.code : "";
		const status =
			typeof e?.status === "number"
				? String(e.status)
				: typeof e?.status === "string"
					? e.status
					: "";
		const causeMsg =
			typeof e?.cause?.message === "string"
				? e.cause.message
				: typeof e?.error?.message === "string"
					? e.error.message
					: "";
		const causeCode =
			typeof e?.cause?.code === "string"
				? e.cause.code
				: typeof e?.error?.code === "string"
					? e.error.code
					: "";

		const reason = [
			code ? `code:${code}` : null,
			status ? `status:${status}` : null,
			msg ? `msg:${msg}` : null,
			causeCode ? `cause_code:${causeCode}` : null,
			causeMsg ? `cause_msg:${causeMsg}` : null,
		]
			.filter(Boolean)
			.join(" | ")
			.slice(0, 800);
		console.error("SignIn failed:", err);
		redirect(
			`/login?error=invalid-credentials&reason=${encodeURIComponent(reason)}`,
		);
	}

	revalidatePath("/admin", "layout");
	redirect("/admin");
}

export async function logout() {
	await auth.api.signOut({
		headers: await headers(),
	});

	revalidatePath("/", "layout");
	redirect("/");
}

/** «Olvidé mi contraseña»: siempre responde igual, exista o no el correo. */
export async function requestReset(formData: FormData) {
	const email = String(formData.get("email") ?? "")
		.trim()
		.toLowerCase();
	if (email) {
		try {
			await auth.api.requestPasswordReset({
				body: { email, redirectTo: "/login/nueva" },
				headers: await headers(),
			});
		} catch (err) {
			console.error("Password reset request failed:", err);
		}
	}
	redirect("/login/olvide?enviado=1");
}

export async function resetPassword(formData: FormData) {
	const token = String(formData.get("token") ?? "");
	const password = String(formData.get("password") ?? "");
	const confirm = String(formData.get("confirm") ?? "");
	const back = (error: string) =>
		redirect(`/login/nueva?token=${encodeURIComponent(token)}&error=${error}`);
	if (!token) redirect("/login/olvide?error=enlace");
	if (password.length < 8) back("corta");
	if (password !== confirm) back("distintas");
	try {
		await auth.api.resetPassword({ body: { newPassword: password, token } });
	} catch (err) {
		console.error("Password reset failed:", err);
		redirect("/login/olvide?error=enlace");
	}
	redirect("/login?cambiada=1");
}
