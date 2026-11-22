// Solo servidor: usa RESEND_API_KEY.
/**
 * Correo saliente (Resend, solo fetch). Si falta RESEND_API_KEY no se envía
 * nada y se avisa en el log, sin escribir el enlace.
 */

export function emailEnabled(): boolean {
	return Boolean(process.env.RESEND_API_KEY);
}

export async function sendEmail(params: {
	to: string;
	subject: string;
	html: string;
	text: string;
}): Promise<void> {
	const apiKey = process.env.RESEND_API_KEY;
	if (!apiKey) {
		console.warn(
			`Correo no configurado (falta RESEND_API_KEY): ${params.subject}`,
		);
		return;
	}
	const res = await fetch("https://api.resend.com/emails", {
		method: "POST",
		headers: {
			Authorization: `Bearer ${apiKey}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			from:
				process.env.MAIL_FROM ||
				"Cárnicos Gustavo <no-responder@carnicosgustavo.com>",
			to: [params.to],
			subject: params.subject,
			html: params.html,
			text: params.text,
		}),
	});
	if (!res.ok) {
		const body = await res.text().catch(() => "");
		console.error(`Resend ${res.status}: ${body.slice(0, 300)}`);
	}
}

function escapeHtml(value: string): string {
	return value.replace(
		/[&<>"']/g,
		(ch) =>
			({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
				ch
			] as string,
	);
}

export async function sendPasswordResetEmail(
	user: {
		email: string;
		name: string;
	},
	url: string,
): Promise<void> {
	const name = escapeHtml(user.name || user.email);
	const href = escapeHtml(url);
	await sendEmail({
		to: user.email,
		subject: "Cambia tu contraseña · Cárnicos Gustavo",
		text: `Hola ${user.name || ""}:\n\nPara poner una contraseña nueva abre este enlace (vale 1 hora):\n${url}\n\nSi no lo pediste, ignora este correo.`,
		html: `<div style="font-family:system-ui,sans-serif;max-width:480px;margin:auto;padding:24px;color:#1a1f23">
<p style="font-weight:900;font-style:italic;text-transform:uppercase;letter-spacing:.08em">Cárnicos Gustavo</p>
<p>Hola ${name}:</p>
<p>Para poner una contraseña nueva usa este botón. El enlace vale 1 hora.</p>
<p><a href="${href}" style="display:inline-block;background:#e88d1b;color:#2a1600;font-weight:800;text-decoration:none;padding:12px 20px;border-radius:6px">Cambiar contraseña</a></p>
<p style="color:#6c757d;font-size:13px">Si no lo pediste, ignora este correo; tu contraseña sigue igual.</p>
</div>`,
	});
}
