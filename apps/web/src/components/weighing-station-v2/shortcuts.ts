export type PesajeAction =
	| { type: "focus-tile"; tile: 1 | 2 | 3 | 4 | 5 }
	| { type: "move"; direction: -1 | 1 }
	| { type: "move-line"; direction: -1 | 1 }
	| { type: "confirm" }
	| { type: "capture" }
	| {
			type: "overlay";
			overlay: "tickets" | "orders" | "scale" | "cheatsheet" | "batch";
	  }
	| { type: "cycle-theme" }
	| { type: "close" };

function isTypingTarget(target: EventTarget | null): boolean {
	if (!target || typeof target !== "object") return false;
	const element = target as {
		isContentEditable?: boolean;
		tagName?: string;
		closest?: (selector: string) => unknown;
	};
	if (element.isContentEditable) return true;
	const tag = element.tagName;
	if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
	return Boolean(
		element.closest?.("[role='textbox'], [contenteditable='true']"),
	);
}

function modifierKey(
	event: Pick<KeyboardEvent, "metaKey" | "altKey">,
): boolean {
	return event.metaKey || event.altKey;
}

/**
 * Interpreta un atajo de la estación v2.
 * Súper (Meta) es el modificador principal; Alt es el respaldo porque el
 * navegador o el sistema suelen tragarse Meta. Devuelve null si el evento
 * no corresponde a un atajo (o no debe interceptarse).
 */
export function matchPesajeShortcut(
	event: Pick<
		KeyboardEvent,
		"key" | "code" | "metaKey" | "altKey" | "ctrlKey" | "shiftKey" | "target"
	>,
	options?: { overlayOpen?: boolean },
): PesajeAction | null {
	const overlayOpen = options?.overlayOpen ?? false;
	const key = event.key;
	const typing = isTypingTarget(event.target);
	const mod = modifierKey(event);

	if (key === "Escape") {
		return { type: "close" };
	}

	if (key === "?" && !event.ctrlKey && !typing) {
		return { type: "overlay", overlay: "cheatsheet" };
	}

	if (mod && !event.ctrlKey) {
		const digit =
			key === "1" || key === "2" || key === "3" || key === "4" || key === "5"
				? Number(key)
				: null;
		if (digit) {
			return { type: "focus-tile", tile: digit as 1 | 2 | 3 | 4 | 5 };
		}

		const letter = key.length === 1 ? key.toLowerCase() : key;
		if (letter === "j" || key === "ArrowDown") {
			return { type: "move", direction: 1 };
		}
		if (letter === "k" || key === "ArrowUp") {
			return { type: "move", direction: -1 };
		}
		if (letter === "t" && event.shiftKey) {
			return { type: "cycle-theme" };
		}
		if (letter === "t") {
			return { type: "overlay", overlay: "tickets" };
		}
		if (letter === "o") {
			return { type: "overlay", overlay: "orders" };
		}
		if (letter === "b") {
			return { type: "overlay", overlay: "scale" };
		}
		if (letter === "p") {
			return { type: "overlay", overlay: "batch" };
		}
		if (letter === "/" || key === "?") {
			return { type: "overlay", overlay: "cheatsheet" };
		}
	}

	if (overlayOpen) {
		return null;
	}

	if (typing && !mod) {
		return null;
	}

	if (key === "ArrowDown" || key === "j") {
		return { type: "move", direction: 1 };
	}
	if (key === "ArrowUp" || key === "k") {
		return { type: "move", direction: -1 };
	}
	if (key === "ArrowRight") {
		return { type: "move-line", direction: 1 };
	}
	if (key === "ArrowLeft") {
		return { type: "move-line", direction: -1 };
	}
	if (key === "Enter") {
		return { type: "confirm" };
	}
	if (key === " " || key === "Spacebar") {
		return { type: "capture" };
	}

	return null;
}

export const SHORTCUT_ROWS: Array<{
	keys: string;
	fallback: string;
	action: string;
}> = [
	{ keys: "Súper+1…5", fallback: "Alt+1…5", action: "Enfocar tesela 1 a 5" },
	{
		keys: "Súper+J / K",
		fallback: "Alt+J / K o flechas",
		action: "Mover la selección",
	},
	{ keys: "← / →", fallback: "", action: "Cambiar de renglón" },
	{ keys: "Enter", fallback: "", action: "Seleccionar o confirmar" },
	{ keys: "Espacio", fallback: "", action: "Capturar peso estable" },
	{ keys: "Súper+T", fallback: "Alt+T", action: "Tickets del pedido" },
	{ keys: "Súper+O", fallback: "Alt+O", action: "Cola de pedidos" },
	{ keys: "Súper+B", fallback: "Alt+B", action: "Ajustes de la báscula" },
	{ keys: "Súper+P", fallback: "Alt+P", action: "Pesaje de producción" },
	{ keys: "Súper+Shift+T", fallback: "Alt+Shift+T", action: "Cambiar tema" },
	{ keys: "Esc", fallback: "", action: "Cerrar superposición" },
	{ keys: "Súper+/ o ?", fallback: "Alt+/", action: "Hoja de atajos" },
];
