import { cn } from "@finopenpos/ui/lib/utils";

/**
 * Dígitos de 7 segmentos en SVG, como el LCD de la I-QY. Cada posición dibuja
 * los 7 segmentos: los apagados quedan como «8» fantasma.
 */
const SEGMENTS: Record<string, string> = {
	a: "9,10 15,4 45,4 51,10 45,16 15,16",
	b: "52,13 58,19 58,43 52,49 46,43 46,19",
	c: "52,51 58,57 58,81 52,87 46,81 46,57",
	d: "9,90 15,84 45,84 51,90 45,96 15,96",
	e: "8,51 14,57 14,81 8,87 2,81 2,57",
	f: "8,13 14,19 14,43 8,49 2,43 2,19",
	g: "9,50 15,44 45,44 51,50 45,56 15,56",
};

const SEGMENT_KEYS = ["a", "b", "c", "d", "e", "f", "g"] as const;

const CHAR_SEGMENTS: Record<string, string> = {
	"0": "abcdef",
	"1": "bc",
	"2": "abged",
	"3": "abgcd",
	"4": "fgbc",
	"5": "afgcd",
	"6": "afgedc",
	"7": "abc",
	"8": "abcdefg",
	"9": "abcdfg",
	"-": "g",
	O: "abcdef",
	L: "fed",
	E: "afged",
	H: "fbgec",
	P: "abfge",
	" ": "",
};

const CELL_W = 72;

type Cell = { segments: string; dot: boolean };

export function toCells(text: string, digits: number): Cell[] {
	const cells: Cell[] = [];
	for (const char of text.toUpperCase()) {
		if (char === "." || char === ",") {
			const last = cells[cells.length - 1];
			if (last) last.dot = true;
			else cells.push({ segments: "", dot: true });
			continue;
		}
		cells.push({ segments: CHAR_SEGMENTS[char] ?? "", dot: false });
	}
	while (cells.length < digits) cells.unshift({ segments: "", dot: false });
	return cells;
}

export function SegmentDisplay({
	text,
	digits = 5,
	className,
	onClassName = "fill-[#151713]",
	ghostClassName = "fill-[#252922] opacity-[0.1]",
}: {
	text: string;
	digits?: number;
	className?: string;
	onClassName?: string;
	ghostClassName?: string;
}) {
	const cells = toCells(text, digits);
	const width = cells.length * CELL_W;
	return (
		<svg
			aria-hidden="true"
			viewBox={`-4 0 ${width + 4} 100`}
			preserveAspectRatio="xMaxYMid meet"
			className={cn("h-full w-full", className)}
		>
			{cells.map((cell, index) => (
				<g key={index} transform={`translate(${index * CELL_W} 0) skewX(-5)`}>
					{SEGMENT_KEYS.map((segment) => (
						<polygon
							key={segment}
							points={SEGMENTS[segment]}
							className={
								cell.segments.includes(segment) ? onClassName : ghostClassName
							}
						/>
					))}
					<circle
						cx={64}
						cy={91}
						r={5}
						className={cell.dot ? onClassName : ghostClassName}
					/>
				</g>
			))}
		</svg>
	);
}
