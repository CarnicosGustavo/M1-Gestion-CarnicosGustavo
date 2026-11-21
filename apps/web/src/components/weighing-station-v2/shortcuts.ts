import type { FnPage, TileId } from "./types";

/** Teclas físicas de la báscula y de la pantalla de funciones (7). */
export type PesajeCommand =
	| "power" // ON/OFF: conectar / desconectar la báscula
	| "zero" // →0←: limpiar el peso manual
	| "tare" // →T←: tomar el peso actual como tara
	| "hold" // HOLD: congelar el display
	| "undo" // deshacer la última captura
	| "charge" // ir a cobro / ticket
	| "antonella"
	| "classic";

export type PesajeAction =
	| { type: "focus-tile"; tile: TileId }
	| { type: "move"; direction: -1 | 1 }
	| { type: "move-line"; direction: -1 | 1 }
	| { type: "confirm" }
	| { type: "capture" }
	| { type: "overlay"; overlay: "tickets" | "orders" | "batch" }
	| { type: "page"; page: FnPage }
	| { type: "command"; command: PesajeCommand }
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

/** Enter/Espacio deben activar el control, no registrar peso ni capturar. */
export function isActivateTarget(target: EventTarget | null): boolean {
	if (!target || typeof target !== "object") return false;
	const element = target as {
		tagName?: string;
		closest?: (selector: string) => unknown;
	};
	const tag = element.tagName;
	if (tag === "BUTTON" || tag === "A" || tag === "SUMMARY") return true;
	return Boolean(
		element.closest?.("button, a, [role='button'], [role='link']"),
	);
}

function modifierKey(
	event: Pick<KeyboardEvent, "metaKey" | "altKey">,
): boolean {
	return event.metaKey || event.altKey;
}

/**
 * Letra o dígito físico de la tecla. Se prefiere `code` porque en macOS
 * Alt+letra produce otro carácter en `key` (Alt+C → «ç»).
 */
function physicalKey(event: Pick<KeyboardEvent, "key" | "code">): string {
	const code = event.code ?? "";
	if (/^Key[A-Z]$/.test(code)) return code.slice(3).toLowerCase();
	if (/^Digit[0-9]$/.test(code)) return code.slice(5);
	if (code === "Slash") return "/";
	return event.key.length === 1 ? event.key.toLowerCase() : event.key;
}

/** Atajos con Súper (o Alt) → acción. Una sola tabla para el código y la ayuda. */
const MOD_KEYS: Record<string, PesajeAction> = {
	"1": { type: "focus-tile", tile: 1 },
	"2": { type: "focus-tile", tile: 2 },
	"3": { type: "focus-tile", tile: 3 },
	"4": { type: "focus-tile", tile: 4 },
	"5": { type: "focus-tile", tile: 5 },
	"7": { type: "focus-tile", tile: 7 },
	j: { type: "move", direction: 1 },
	k: { type: "move", direction: -1 },
	t: { type: "overlay", overlay: "tickets" },
	o: { type: "overlay", overlay: "orders" },
	p: { type: "overlay", overlay: "batch" },
	h: { type: "page", page: "inicio" },
	c: { type: "page", page: "recipiente" },
	b: { type: "page", page: "conexion" },
	x: { type: "page", page: "diagnostico" },
	m: { type: "page", page: "tema" },
	n: { type: "page", page: "teclado" },
	"/": { type: "page", page: "atajos" },
	"0": { type: "command", command: "zero" },
	r: { type: "command", command: "tare" },
	l: { type: "command", command: "hold" },
	z: { type: "command", command: "undo" },
	g: { type: "command", command: "charge" },
	i: { type: "command", command: "antonella" },
	v: { type: "command", command: "classic" },
};

/**
 * Interpreta un atajo de la estación v2.
 * Súper (Meta) es el modificador principal; Alt es el respaldo porque el
 * navegador o el sistema suelen tragarse Meta. Ctrl nunca se usa.
 * Devuelve null si el evento no corresponde a un atajo.
 */
export function matchPesajeShortcut(
	event: Pick<
		KeyboardEvent,
		| "key"
		| "code"
		| "metaKey"
		| "altKey"
		| "ctrlKey"
		| "shiftKey"
		| "target"
		| "repeat"
	>,
	options?: { overlayOpen?: boolean; isPending?: boolean },
): PesajeAction | null {
	const overlayOpen = options?.overlayOpen ?? false;
	const key = event.key;
	const typing = isTypingTarget(event.target);
	const mod = modifierKey(event);

	if (key === "Escape") {
		return { type: "close" };
	}
	if (event.repeat) return null;
	if (options?.isPending) return null;
	if (event.ctrlKey) return null;

	if (key === "?" && !typing && !mod) {
		return { type: "page", page: "atajos" };
	}

	if (mod) {
		const physical = physicalKey(event);
		if (physical === "t" && event.shiftKey) return { type: "cycle-theme" };
		if (physical === "b" && event.shiftKey) {
			return { type: "command", command: "power" };
		}
		if (key === "ArrowDown") return { type: "move", direction: 1 };
		if (key === "ArrowUp") return { type: "move", direction: -1 };
		if (key === "?") return { type: "page", page: "atajos" };
		const action = MOD_KEYS[physical];
		if (action) return action;
		return null;
	}

	if (overlayOpen || typing) {
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
		if (isActivateTarget(event.target)) return null;
		return { type: "confirm" };
	}
	if (key === " " || key === "Spacebar") {
		if (isActivateTarget(event.target)) return null;
		return { type: "capture" };
	}

	return null;
}

/** Etiqueta corta para los kbd de los botones («Súper+H»). */
export function shortcutLabel(physical: string): string {
	if (physical === "Espacio" || physical === "Enter" || physical === "Esc") {
		return physical;
	}
	return `Súper+${physical.toUpperCase()}`;
}

export const SHORTCUT_ROWS: Array<{
	keys: string;
	fallback: string;
	action: string;
}> = [
	{
		keys: "Súper+1…5, Súper+7",
		fallback: "Alt+1…5, Alt+7",
		action: "Enfocar módulo 1 a 5 o la pantalla 7",
	},
	{
		keys: "Súper+J / K",
		fallback: "Alt+J / K o flechas",
		action: "Mover la selección del módulo enfocado",
	},
	{ keys: "← / →", fallback: "", action: "Cambiar de producto pendiente" },
	{ keys: "Enter (f ↵)", fallback: "", action: "Seleccionar o registrar peso" },
	{ keys: "Espacio (M+)", fallback: "", action: "Capturar peso estable" },
	{ keys: "Súper+0 (→0←)", fallback: "Alt+0", action: "Cero: limpiar peso" },
	{ keys: "Súper+R (→T←)", fallback: "Alt+R", action: "Tomar tara del peso" },
	{ keys: "Súper+L (HOLD)", fallback: "Alt+L", action: "Congelar display" },
	{
		keys: "Súper+Shift+B (ON/OFF)",
		fallback: "Alt+Shift+B",
		action: "Conectar / desconectar báscula",
	},
	{ keys: "Súper+Z", fallback: "Alt+Z", action: "Deshacer última captura" },
	{ keys: "Súper+H", fallback: "Alt+H", action: "7 · Inicio" },
	{ keys: "Súper+C", fallback: "Alt+C", action: "7 · Recipiente y tara" },
	{ keys: "Súper+B", fallback: "Alt+B", action: "7 · Conexión serial" },
	{ keys: "Súper+X", fallback: "Alt+X", action: "7 · Diagnóstico de tramas" },
	{ keys: "Súper+M", fallback: "Alt+M", action: "7 · Tema" },
	{ keys: "Súper+N", fallback: "Alt+N", action: "7 · Teclado / peso manual" },
	{ keys: "Súper+/ o ?", fallback: "Alt+/", action: "7 · Atajos" },
	{ keys: "Súper+T", fallback: "Alt+T", action: "Tickets (pantalla completa)" },
	{ keys: "Súper+O", fallback: "Alt+O", action: "Cola de pedidos" },
	{ keys: "Súper+P", fallback: "Alt+P", action: "Pesaje de producción" },
	{ keys: "Súper+G", fallback: "Alt+G", action: "Cobro e impresión de ticket" },
	{ keys: "Súper+I", fallback: "Alt+I", action: "iAntonella" },
	{ keys: "Súper+V", fallback: "Alt+V", action: "Versión clásica" },
	{ keys: "Súper+Shift+T", fallback: "Alt+Shift+T", action: "Cambiar tema" },
	{ keys: "Esc", fallback: "", action: "Cerrar / volver a Inicio" },
];
