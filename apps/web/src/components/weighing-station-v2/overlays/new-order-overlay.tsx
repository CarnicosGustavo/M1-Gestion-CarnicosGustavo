"use client";

import { cn } from "@finopenpos/ui/lib/utils";
import { Minus, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { OverlayFrame } from "./overlay-frame";

export interface CatalogProduct {
	id: number;
	name: string;
	parent_product_id: number | null;
	category: string | null;
	price: number | string | null;
}

export interface CatalogCustomer {
	id: number;
	name: string;
}

export interface DraftLine {
	productId: number;
	pieces: number;
	kg: number | null;
}

export interface OrderDraft {
	customerId: number | null;
	customerQuery?: string;
	lines: DraftLine[];
	/** Lo que Peggy no pudo reconocer (se muestra para corregir a mano). */
	unmatched?: string[];
	/** Frase original de la nota de voz. */
	transcript?: string;
}

/** Quita acentos y mayúsculas para buscar «jamon» = «JAMÓN». */
export function normalize(text: string): string {
	return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

/** Mejor coincidencia primero: empieza igual > palabra que empieza > contiene. */
export function rankMatches<T>(
	items: T[],
	query: string,
	getName: (item: T) => string,
): T[] {
	const q = normalize(query);
	if (!q) return items;
	const scored: Array<[number, T]> = [];
	for (const item of items) {
		const name = normalize(getName(item));
		let score = -1;
		if (name === q) score = 0;
		else if (name.startsWith(q)) score = 1;
		else if (name.split(/[\s/]+/).some((word) => word.startsWith(q))) score = 2;
		else if (name.includes(q)) score = 3;
		if (score >= 0) scored.push([score * 1000 + name.length, item]);
	}
	return scored.sort((a, b) => a[0] - b[0]).map(([, item]) => item);
}

/**
 * Captura rápida: «8 pierna», «2.5k pulpa», «pierna 8», «3 kg jamón».
 * Un número solo = piezas; con «k»/«kg» = kilos.
 */
export function parseQuickEntry(input: string): {
	text: string;
	pieces: number;
	kg: number | null;
} {
	let rest = ` ${input.trim()} `;
	let pieces = 1;
	let kg: number | null = null;
	const kgMatch = rest.match(/\s(\d+(?:[.,]\d+)?)\s*(?:k|kg|kilos?)\s/i);
	if (kgMatch) {
		kg = Number.parseFloat(kgMatch[1].replace(",", "."));
		rest = rest.replace(kgMatch[0], " ");
		pieces = 0;
	}
	const numMatch = rest.match(/\s(\d+)\s/);
	if (numMatch) {
		pieces = Number.parseInt(numMatch[1], 10);
		rest = rest.replace(numMatch[0], " ");
	}
	return { text: rest.trim(), pieces, kg };
}

const HIDDEN_CATEGORIES = new Set(["Duplicado"]);

interface Family {
	id: number | "otros";
	name: string;
	members: CatalogProduct[];
}

/** Familias: cada pieza padre con sus derivados directos; lo suelto en «Otros». */
export function buildFamilies(products: CatalogProduct[]): Family[] {
	const visible = products.filter(
		(product) => !HIDDEN_CATEGORIES.has(product.category ?? ""),
	);
	const children = new Map<number, CatalogProduct[]>();
	for (const product of visible) {
		if (product.parent_product_id === null) continue;
		const list = children.get(product.parent_product_id) ?? [];
		list.push(product);
		children.set(product.parent_product_id, list);
	}
	const byName = (a: CatalogProduct, b: CatalogProduct) =>
		a.name.localeCompare(b.name, "es");
	const families: Family[] = visible
		.filter((product) => (children.get(product.id)?.length ?? 0) > 0)
		.sort(byName)
		.map((head) => ({
			id: head.id,
			name: head.name,
			members: [head, ...(children.get(head.id) ?? []).sort(byName)],
		}));
	const inFamily = new Set(
		families.flatMap((family) => family.members.map((m) => m.id)),
	);
	const loose = visible.filter((product) => !inFamily.has(product.id));
	if (loose.length > 0) {
		families.push({ id: "otros", name: "Otros", members: loose.sort(byName) });
	}
	return families;
}

export function NewOrderOverlay({
	products,
	customers,
	initial,
	busy,
	onCreate,
	onClose,
}: {
	products: CatalogProduct[];
	customers: CatalogCustomer[];
	initial: OrderDraft | null;
	busy: boolean;
	onCreate: (draft: { customerId: number; lines: DraftLine[] }) => void;
	onClose: () => void;
}) {
	const families = useMemo(() => buildFamilies(products), [products]);
	const productById = useMemo(
		() => new Map(products.map((product) => [product.id, product])),
		[products],
	);

	const [customerId, setCustomerId] = useState<number | null>(
		initial?.customerId ?? null,
	);
	const [customerQuery, setCustomerQuery] = useState(
		initial?.customerId ? "" : (initial?.customerQuery ?? ""),
	);
	const [customerIndex, setCustomerIndex] = useState(0);
	const [lines, setLines] = useState<DraftLine[]>(initial?.lines ?? []);
	const [familyId, setFamilyId] = useState<Family["id"] | null>(
		families[0]?.id ?? null,
	);
	const [entry, setEntry] = useState("");
	const [matchIndex, setMatchIndex] = useState(0);
	const customerRef = useRef<HTMLInputElement>(null);
	const entryRef = useRef<HTMLInputElement>(null);

	const customer = customers.find((c) => c.id === customerId) ?? null;
	const customerMatches = useMemo(
		() => rankMatches(customers, customerQuery, (c) => c.name).slice(0, 8),
		[customers, customerQuery],
	);

	useEffect(() => {
		// Con cliente ya elegido (o dictado), el cursor va directo a productos.
		setTimeout(
			() => (customerId ? entryRef.current : customerRef.current)?.focus(),
			50,
		);
		// biome-ignore lint/correctness/useExhaustiveDependencies: solo al abrir
	}, []);

	const parsed = parseQuickEntry(entry);
	const visibleProducts = products.filter(
		(product) => !HIDDEN_CATEGORIES.has(product.category ?? ""),
	);
	const matches = parsed.text
		? rankMatches(visibleProducts, parsed.text, (p) => p.name).slice(0, 8)
		: [];
	const family = families.find((f) => f.id === familyId) ?? null;
	const tiles = parsed.text ? matches : (family?.members ?? []);

	const addLine = (productId: number, pieces: number, kg: number | null) => {
		setLines((current) => {
			const existing = current.find((line) => line.productId === productId);
			if (existing) {
				return current.map((line) =>
					line.productId === productId
						? {
								...line,
								pieces: line.pieces + pieces,
								kg: kg !== null ? (line.kg ?? 0) + kg : line.kg,
							}
						: line,
				);
			}
			return [...current, { productId, pieces, kg }];
		});
	};
	const changePieces = (productId: number, delta: number) => {
		setLines((current) =>
			current
				.map((line) =>
					line.productId === productId
						? { ...line, pieces: Math.max(0, line.pieces + delta) }
						: line,
				)
				.filter((line) => line.pieces > 0 || (line.kg ?? 0) > 0),
		);
	};
	const piecesOf = (productId: number) =>
		lines.find((line) => line.productId === productId)?.pieces ?? 0;

	const canCreate = customerId !== null && lines.length > 0 && !busy;
	const submit = () => {
		if (!canCreate || customerId === null) return;
		onCreate({ customerId, lines });
	};

	// Ctrl+Enter crea el pedido desde cualquier campo de la ventana.
	const submitRef = useRef(submit);
	submitRef.current = submit;
	useEffect(() => {
		const onKey = (event: KeyboardEvent) => {
			if (event.repeat) return;
			if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
				event.preventDefault();
				submitRef.current();
			}
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, []);

	const totalPieces = lines.reduce((sum, line) => sum + line.pieces, 0);

	return (
		<OverlayFrame
			title="Nuevo pedido"
			subtitle="Cliente → escribe «8 pierna» y Enter (o toca las piezas) → Ctrl+Enter crea el pedido · Esc regresa"
			onClose={onClose}
		>
			<div className="grid h-full min-h-0 grid-cols-[minmax(0,1fr)_minmax(20rem,26rem)] gap-0">
				<div className="flex min-h-0 flex-col gap-3 p-4">
					{initial?.transcript ? (
						<div className="rounded-md border border-[#f39a1e]/60 bg-[#fff7e6] px-3 py-2 text-[#5a3b06] text-sm">
							<span className="mr-2 font-bold">🎤 Peggy entendió:</span>«
							{initial.transcript}»
							{initial.unmatched && initial.unmatched.length > 0 ? (
								<span className="mt-1 block text-[#a33] text-xs">
									No reconocí: {initial.unmatched.join(", ")} — agrégalos a
									mano.
								</span>
							) : null}
						</div>
					) : null}

					{/* 1 · Cliente */}
					<div className="relative">
						<label
							htmlFor="nuevo-cliente"
							className="mb-1 block font-semibold text-muted-foreground text-xs uppercase tracking-wider"
						>
							1 · Cliente
						</label>
						{customer ? (
							<div className="flex items-center justify-between rounded-md border-2 border-[#43a047] bg-[#ebfbee] px-3 py-2">
								<span className="font-bold text-lg">{customer.name}</span>
								<button
									type="button"
									className="text-muted-foreground text-sm underline"
									onClick={() => {
										setCustomerId(null);
										setTimeout(() => customerRef.current?.focus(), 0);
									}}
								>
									cambiar
								</button>
							</div>
						) : (
							<>
								<input
									id="nuevo-cliente"
									ref={customerRef}
									value={customerQuery}
									autoComplete="off"
									placeholder="Escribe el nombre del cliente…"
									onChange={(event) => {
										setCustomerQuery(event.target.value);
										setCustomerIndex(0);
									}}
									onKeyDown={(event) => {
										if (event.key === "ArrowDown") {
											event.preventDefault();
											setCustomerIndex((i) =>
												Math.min(i + 1, customerMatches.length - 1),
											);
										} else if (event.key === "ArrowUp") {
											event.preventDefault();
											setCustomerIndex((i) => Math.max(i - 1, 0));
										} else if (
											event.key === "Enter" &&
											!event.ctrlKey &&
											!event.metaKey
										) {
											event.preventDefault();
											const pick = customerMatches[customerIndex];
											if (pick) {
												setCustomerId(pick.id);
												setTimeout(() => entryRef.current?.focus(), 0);
											}
										}
									}}
									className="w-full rounded-md border-2 border-border bg-background px-3 py-2 text-lg outline-none focus:border-[#f39a1e]"
								/>
								{customerQuery ? (
									<ul className="absolute z-20 mt-1 w-full overflow-hidden rounded-md border bg-card shadow-xl">
										{customerMatches.length === 0 ? (
											<li className="px-3 py-2 text-muted-foreground text-sm">
												Sin coincidencias
											</li>
										) : (
											customerMatches.map((c, index) => (
												<li key={c.id}>
													<button
														type="button"
														onClick={() => {
															setCustomerId(c.id);
															setTimeout(() => entryRef.current?.focus(), 0);
														}}
														className={cn(
															"w-full px-3 py-2 text-left",
															index === customerIndex
																? "bg-[#f39a1e] text-[#1b1206]"
																: "hover:bg-muted",
														)}
													>
														{c.name}
													</button>
												</li>
											))
										)}
									</ul>
								) : null}
							</>
						)}
					</div>

					{/* 2 · Captura rápida */}
					<div>
						<label
							htmlFor="nuevo-captura"
							className="mb-1 block font-semibold text-muted-foreground text-xs uppercase tracking-wider"
						>
							2 · Productos — «8 pierna», «2.5k pulpa», ↑↓ elige, Enter agrega
						</label>
						<input
							id="nuevo-captura"
							ref={entryRef}
							value={entry}
							autoComplete="off"
							placeholder="8 pierna"
							onChange={(event) => {
								setEntry(event.target.value);
								setMatchIndex(0);
							}}
							onKeyDown={(event) => {
								if (event.key === "ArrowDown") {
									event.preventDefault();
									setMatchIndex((i) => Math.min(i + 1, matches.length - 1));
								} else if (event.key === "ArrowUp") {
									event.preventDefault();
									setMatchIndex((i) => Math.max(i - 1, 0));
								} else if (
									event.key === "Enter" &&
									!event.ctrlKey &&
									!event.metaKey
								) {
									event.preventDefault();
									const pick = matches[matchIndex];
									if (pick) {
										addLine(pick.id, parsed.pieces, parsed.kg);
										setEntry("");
									}
								}
							}}
							className="w-full rounded-md border-2 border-border bg-background px-3 py-2 font-mono text-lg outline-none focus:border-[#f39a1e]"
						/>
						{parsed.text && matches[matchIndex] ? (
							<p className="mt-1 text-sm">
								Enter agrega{" "}
								<b>
									{parsed.kg !== null
										? `${parsed.kg} kg`
										: `${parsed.pieces} pza`}{" "}
									de {matches[matchIndex].name}
								</b>
							</p>
						) : null}
					</div>

					{/* 3 · Piezas padre → derivados */}
					<div className="grid min-h-0 flex-1 grid-cols-[13rem_minmax(0,1fr)] gap-3">
						<ul
							aria-label="Piezas padre"
							className="min-h-0 space-y-1 overflow-y-auto pr-1"
						>
							{families.map((f) => (
								<li key={f.id}>
									<button
										type="button"
										onClick={() => {
											setFamilyId(f.id);
											setEntry("");
										}}
										className={cn(
											"flex w-full items-center justify-between rounded-md px-3 py-2 text-left font-semibold text-sm",
											f.id === familyId && !parsed.text
												? "bg-[#1f5fa3] text-white"
												: "bg-muted/60 hover:bg-muted",
										)}
									>
										<span className="truncate">{f.name}</span>
										<span className="text-xs opacity-70">
											{f.members.length}
										</span>
									</button>
								</li>
							))}
						</ul>
						<div className="grid min-h-0 auto-rows-min grid-cols-[repeat(auto-fill,minmax(10.5rem,1fr))] gap-2 overflow-y-auto">
							{tiles.map((product, index) => {
								const qty = piecesOf(product.id);
								const highlighted = parsed.text && index === matchIndex;
								return (
									<div
										key={product.id}
										className={cn(
											"flex flex-col rounded-lg border-2 bg-card transition",
											qty > 0 ? "border-[#43a047]" : "border-border",
											highlighted && "ring-2 ring-[#f39a1e]",
										)}
									>
										<button
											type="button"
											onClick={() => addLine(product.id, 1, null)}
											className="flex-1 px-3 pt-2 pb-1 text-left"
										>
											<span className="line-clamp-2 font-bold text-sm leading-tight">
												{product.name}
											</span>
										</button>
										<div className="flex items-center justify-between px-2 pb-2">
											<button
												type="button"
												aria-label={`Quitar una pieza de ${product.name}`}
												disabled={qty === 0}
												onClick={() => changePieces(product.id, -1)}
												className="flex size-8 items-center justify-center rounded-md border disabled:opacity-30"
											>
												<Minus className="size-4" aria-hidden="true" />
											</button>
											<span className="font-black font-mono text-xl tabular-nums">
												{qty}
											</span>
											<button
												type="button"
												aria-label={`Agregar una pieza de ${product.name}`}
												onClick={() => addLine(product.id, 1, null)}
												className="flex size-8 items-center justify-center rounded-md bg-[#43a047] text-white"
											>
												<Plus className="size-4" aria-hidden="true" />
											</button>
										</div>
									</div>
								);
							})}
						</div>
					</div>
				</div>

				{/* Pedido */}
				<aside className="flex min-h-0 flex-col border-border border-l bg-muted/30">
					<div className="border-b px-4 py-3">
						<p className="font-semibold text-muted-foreground text-xs uppercase tracking-wider">
							Pedido
						</p>
						<p className="font-bold text-lg">
							{customer?.name ?? "Sin cliente"}
						</p>
					</div>
					<ul className="min-h-0 flex-1 divide-y overflow-y-auto">
						{lines.length === 0 ? (
							<li className="p-4 text-muted-foreground text-sm">
								Agrega productos con la captura rápida o tocando las piezas.
							</li>
						) : (
							lines.map((line) => {
								const product = productById.get(line.productId);
								return (
									<li
										key={line.productId}
										className="flex items-center gap-2 px-4 py-2"
									>
										<span className="min-w-0 flex-1">
											<span className="line-clamp-2 font-semibold text-sm leading-tight">
												{product?.name ?? `#${line.productId}`}
											</span>
											{line.kg ? (
												<span className="text-muted-foreground text-xs">
													≈ {line.kg} kg
												</span>
											) : null}
										</span>
										<button
											type="button"
											aria-label="Una pieza menos"
											onClick={() => changePieces(line.productId, -1)}
											className="flex size-7 items-center justify-center rounded border"
										>
											<Minus className="size-3.5" aria-hidden="true" />
										</button>
										<span className="w-8 text-center font-black font-mono tabular-nums">
											{line.pieces}
										</span>
										<button
											type="button"
											aria-label="Una pieza más"
											onClick={() => changePieces(line.productId, 1)}
											className="flex size-7 items-center justify-center rounded border"
										>
											<Plus className="size-3.5" aria-hidden="true" />
										</button>
										<button
											type="button"
											aria-label={`Quitar ${product?.name ?? "renglón"}`}
											onClick={() =>
												setLines((current) =>
													current.filter((l) => l.productId !== line.productId),
												)
											}
											className="flex size-7 items-center justify-center rounded text-muted-foreground hover:text-red-600"
										>
											<Trash2 className="size-3.5" aria-hidden="true" />
										</button>
									</li>
								);
							})
						)}
					</ul>
					<div className="border-t p-4">
						<p className="mb-2 text-muted-foreground text-sm">
							{lines.length} renglones · {totalPieces} piezas · el peso se toma
							en la báscula
						</p>
						<button
							type="button"
							disabled={!canCreate}
							onClick={submit}
							className="w-full rounded-md bg-gradient-to-b from-[#4cc35d] to-[#2f9a3f] px-4 py-3 font-bold text-[#06210b] text-lg shadow disabled:opacity-40"
						>
							{busy ? "Creando…" : "Crear pedido · Ctrl+Enter"}
						</button>
						{customerId === null ? (
							<p className="mt-1 text-red-600 text-xs">Falta el cliente.</p>
						) : null}
					</div>
				</aside>
			</div>
		</OverlayFrame>
	);
}
