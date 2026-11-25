"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const DEMO_HOST = "fin-open-pos.johnenrique.tech";
const STORAGE_KEY = "cookie-consent";

const messages = {
	text: "Este sistema utiliza cookies técnicas para la gestión de su sesión de usuario.",
	accept: "Entendido",
	learnMore: "Privacidad",
} as const;

export function CookieConsent() {
	const [visible, setVisible] = useState(false);
	const [mounted, setMounted] = useState(false);
	const pathname = usePathname();
	const onLogin = pathname?.startsWith("/login") ?? false;
	const t = messages;

	useEffect(() => {
		const consent = localStorage.getItem(STORAGE_KEY);
		if (!consent) {
			setVisible(true);
			requestAnimationFrame(() => {
				requestAnimationFrame(() => setMounted(true));
			});
		}
	}, []);

	const handleAccept = () => {
		localStorage.setItem(STORAGE_KEY, "accepted");
		setMounted(false);
		setTimeout(() => setVisible(false), 300);
	};

	if (!visible) return null;

	const privacyUrl = `${window.location.origin}/docs/legal/privacy`;

	return (
		<div
			data-cookie-consent=""
			className={`fixed right-0 bottom-0 left-0 z-50 transition-transform duration-300 ease-out motion-reduce:transition-none ${
				mounted ? "translate-y-0" : "translate-y-full"
			}`}
		>
			<div
				className={
					onLogin
						? "border-[#2b3238] border-t bg-[#1a1f23]/95 px-4 py-4 text-[#d5ffd1] backdrop-blur-md"
						: "border-border border-t bg-background/95 px-4 py-4 backdrop-blur-md"
				}
			>
				<div className="mx-auto flex max-w-4xl flex-col items-center gap-3 sm:flex-row sm:gap-4">
					<p
						className={
							onLogin
								? "flex-1 text-center text-[#a8b0b8] text-sm sm:text-left"
								: "flex-1 text-center text-muted-foreground text-sm sm:text-left"
						}
					>
						{t.text}
					</p>
					<div className="flex shrink-0 items-center gap-3">
						<a
							href={privacyUrl}
							className={
								onLogin
									? "rounded border border-[#2b3238] px-3 py-1.5 text-[#a8b0b8] text-sm transition-colors hover:text-[#d5ffd1]"
									: "rounded border border-border px-3 py-1.5 text-muted-foreground text-sm transition-colors hover:text-foreground"
							}
						>
							{t.learnMore}
						</a>
						<button
							type="button"
							onClick={handleAccept}
							className={
								onLogin
									? "rounded border border-[#ffb85c] bg-gradient-to-b from-[#f7a93a] to-[#d9800f] px-4 py-1.5 font-medium text-[#2a1600] text-sm"
									: "rounded bg-primary px-4 py-1.5 font-medium text-primary-foreground text-sm transition-colors hover:bg-primary/90"
							}
						>
							{t.accept}
						</button>
					</div>
				</div>
			</div>
		</div>
	);
}
