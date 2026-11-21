"use client";

import { useCallback, useEffect, useState } from "react";
import {
	PESAJE_THEME_STORAGE_KEY,
	PESAJE_THEMES,
	type PesajeThemeId,
} from "./types";

export function isPesajeThemeId(value: string | null): value is PesajeThemeId {
	return PESAJE_THEMES.some((theme) => theme.id === value);
}

export function readStoredPesajeTheme(): PesajeThemeId {
	if (typeof window === "undefined") return "m1";
	try {
		const stored = localStorage.getItem(PESAJE_THEME_STORAGE_KEY);
		return isPesajeThemeId(stored) ? stored : "m1";
	} catch {
		return "m1";
	}
}

export function nextPesajeTheme(current: PesajeThemeId): PesajeThemeId {
	const index = PESAJE_THEMES.findIndex((theme) => theme.id === current);
	const next = PESAJE_THEMES[(index + 1) % PESAJE_THEMES.length];
	return next.id;
}

export function usePesajeTheme() {
	const [theme, setThemeState] = useState<PesajeThemeId>("m1");

	useEffect(() => {
		setThemeState(readStoredPesajeTheme());
	}, []);

	const setTheme = useCallback((next: PesajeThemeId) => {
		setThemeState(next);
		try {
			localStorage.setItem(PESAJE_THEME_STORAGE_KEY, next);
		} catch {
			// ignore quota / private mode
		}
	}, []);

	const cycleTheme = useCallback(() => {
		setThemeState((current) => {
			const next = nextPesajeTheme(current);
			try {
				localStorage.setItem(PESAJE_THEME_STORAGE_KEY, next);
			} catch {
				// ignore
			}
			return next;
		});
	}, []);

	return { theme, setTheme, cycleTheme };
}
