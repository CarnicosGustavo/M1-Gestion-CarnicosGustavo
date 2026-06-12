"use client";

import { createContext, useContext, useEffect, useState } from "react";

export type Palette = "warm" | "neutral";
export type Mode = "light" | "dark";

const PALETTE_KEY = "cg_palette";
const MODE_KEY = "cg_mode";

// Script inline que aplica el tema ANTES del primer paint (evita el "flash").
// Lee localStorage y fija .dark + data-palette en <html>.
export function ThemeScript() {
	const code = `(function(){try{
		var p = localStorage.getItem('${PALETTE_KEY}') || 'warm';
		var m = localStorage.getItem('${MODE_KEY}') || 'light';
		var el = document.documentElement;
		if (p === 'neutral') el.setAttribute('data-palette','neutral'); else el.removeAttribute('data-palette');
		if (m === 'dark') el.classList.add('dark'); else el.classList.remove('dark');
	}catch(e){}})();`;
	// biome-ignore lint/security/noDangerouslySetInnerHtml: script de tema controlado, sin datos de usuario
	return <script dangerouslySetInnerHTML={{ __html: code }} />;
}

interface ThemeCtx {
	palette: Palette;
	mode: Mode;
	setPalette: (p: Palette) => void;
	setMode: (m: Mode) => void;
	toggleMode: () => void;
}

const Ctx = createContext<ThemeCtx | null>(null);

function apply(palette: Palette, mode: Mode) {
	const el = document.documentElement;
	if (palette === "neutral") el.setAttribute("data-palette", "neutral");
	else el.removeAttribute("data-palette");
	el.classList.toggle("dark", mode === "dark");
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
	const [palette, setPaletteState] = useState<Palette>("warm");
	const [mode, setModeState] = useState<Mode>("light");

	// Sincroniza el estado de React con lo que el ThemeScript ya aplicó
	useEffect(() => {
		const p = (localStorage.getItem(PALETTE_KEY) as Palette) || "warm";
		const m = (localStorage.getItem(MODE_KEY) as Mode) || "light";
		setPaletteState(p);
		setModeState(m);
	}, []);

	const setPalette = (p: Palette) => {
		setPaletteState(p);
		localStorage.setItem(PALETTE_KEY, p);
		apply(p, mode);
	};
	const setMode = (m: Mode) => {
		setModeState(m);
		localStorage.setItem(MODE_KEY, m);
		apply(palette, m);
	};
	const toggleMode = () => setMode(mode === "dark" ? "light" : "dark");

	return (
		<Ctx.Provider value={{ palette, mode, setPalette, setMode, toggleMode }}>
			{children}
		</Ctx.Provider>
	);
}

export function useTheme() {
	const ctx = useContext(Ctx);
	if (!ctx) throw new Error("useTheme debe usarse dentro de ThemeProvider");
	return ctx;
}
