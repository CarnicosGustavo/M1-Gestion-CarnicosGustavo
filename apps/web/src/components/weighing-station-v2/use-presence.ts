"use client";

import { useEffect, useRef, useState } from "react";

export type PresenceState = "enter" | "idle" | "leave";

export interface Presence<T> {
	key: string | number;
	item: T;
	state: PresenceState;
}

/** Duración de la salida; coincide con `duration-300` de las clases. */
export const PRESENCE_MS = 300;

/**
 * Mantiene en pantalla, por un momento, los elementos que acaban de salir de
 * una lista para animar su salida, y marca los que acaban de entrar.
 * En el primer render nada se anima (la pantalla aparece quieta).
 */
export function usePresence<T>(
	items: T[],
	getKey: (item: T) => string | number,
): Presence<T>[] {
	const firstRender = useRef(true);
	const prevKeys = useRef<Set<string | number>>(new Set());
	const [leaving, setLeaving] = useState<
		Map<string | number, { item: T; index: number }>
	>(new Map());
	const prevItems = useRef<Map<string | number, T>>(new Map());
	const [entering, setEntering] = useState<Set<string | number>>(new Set());

	const keys = items.map(getKey);
	const keySig = keys.join("|");

	// biome-ignore lint/correctness/useExhaustiveDependencies: keySig resume items
	useEffect(() => {
		const current = new Set(keys);
		if (firstRender.current) {
			firstRender.current = false;
		} else {
			const gone = [...prevKeys.current].filter((key) => !current.has(key));
			const fresh = keys.filter((key) => !prevKeys.current.has(key));
			if (gone.length > 0) {
				// Se calcula aquí: los refs cambian antes de que corra el updater.
				const prevOrder = [...prevKeys.current];
				const snapshot = gone.flatMap((key) => {
					const item = prevItems.current.get(key);
					return item === undefined
						? []
						: [[key, { item, index: prevOrder.indexOf(key) }] as const];
				});
				setLeaving((map) => {
					const next = new Map(map);
					for (const [key, value] of snapshot) next.set(key, value);
					return next;
				});
				setTimeout(() => {
					setLeaving((map) => {
						const next = new Map(map);
						for (const key of gone) next.delete(key);
						return next;
					});
				}, PRESENCE_MS);
			}
			if (fresh.length > 0) {
				setEntering((set) => new Set([...set, ...fresh]));
				setTimeout(() => {
					setEntering((set) => {
						const next = new Set(set);
						for (const key of fresh) next.delete(key);
						return next;
					});
				}, PRESENCE_MS + 200);
			}
		}
		prevKeys.current = current;
		prevItems.current = new Map(items.map((item) => [getKey(item), item]));
	}, [keySig]);

	const out: Presence<T>[] = items.map((item) => {
		const key = getKey(item);
		return {
			key,
			item,
			state: entering.has(key) ? "enter" : "idle",
		};
	});
	// Lo que sale se queda en su lugar mientras se desvanece.
	const gone = [...leaving.entries()]
		.filter(([key]) => !keys.includes(key))
		.sort((a, b) => a[1].index - b[1].index);
	for (const [key, { item, index }] of gone) {
		out.splice(Math.min(index, out.length), 0, { key, item, state: "leave" });
	}
	return out;
}

/**
 * Clases de transición: la pieza sale hacia donde va (abajo = a la báscula,
 * derecha = a la venta) y entra desde donde viene.
 */
export function presenceClass(
	state: PresenceState,
	from: "left" | "right" | "top" | "bottom" = "left",
	to: "left" | "right" | "top" | "bottom" = "right",
): string {
	if (state === "enter") {
		return {
			left: "animate-in fade-in slide-in-from-left-8 duration-300",
			right: "animate-in fade-in slide-in-from-right-8 duration-300",
			top: "animate-in fade-in slide-in-from-top-6 duration-300",
			bottom: "animate-in fade-in slide-in-from-bottom-6 duration-300",
		}[from];
	}
	if (state === "leave") {
		return `pointer-events-none fill-mode-forwards ${
			{
				left: "animate-out fade-out slide-out-to-left-8 duration-300",
				right: "animate-out fade-out slide-out-to-right-8 duration-300",
				top: "animate-out fade-out slide-out-to-top-6 duration-300",
				bottom: "animate-out fade-out slide-out-to-bottom-6 duration-300",
			}[to]
		}`;
	}
	return "";
}
