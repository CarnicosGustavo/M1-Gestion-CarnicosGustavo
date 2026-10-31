"use client";

import { Button } from "@finopenpos/ui/components/button";
import { useQuery } from "@tanstack/react-query";
import { ScaleIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { useTRPC } from "@/lib/trpc/client";

export type ScaleReading = {
	id: number;
	weight_g: number;
	net: boolean;
};

const DEVICE_STORAGE_KEY = "cg.scaleDeviceId";
const POLL_MS = 1000;

// Tarjeta "Lectura de báscula": muestra la última lectura estable y sin usar
// de la báscula física (POST /api/scale/ingest) y permite usarla como peso.
// No se muestra si la ingesta está apagada (SCALE_INGEST_ENABLED).
export function ScaleReadingCard({
	onUse,
	usedReadingId,
}: {
	onUse: (reading: ScaleReading) => void;
	usedReadingId?: number | null;
}) {
	const trpc = useTRPC();
	const { data: status } = useQuery({
		...trpc.scale.status.queryOptions(),
		staleTime: 60_000,
	});
	const devices = status?.devices ?? [];

	// La tablet recuerda su báscula (una por estación).
	const [deviceId, setDeviceId] = useState<string | null>(null);
	useEffect(() => {
		if (devices.length === 0) return;
		const saved = window.localStorage.getItem(DEVICE_STORAGE_KEY);
		setDeviceId((cur) => {
			if (cur && devices.includes(cur)) return cur;
			return saved && devices.includes(saved) ? saved : devices[0];
		});
	}, [devices]);

	const enabled = Boolean(status?.enabled && deviceId);
	const { data: reading } = useQuery({
		...trpc.scale.latest.queryOptions({ deviceId: deviceId ?? "" }),
		enabled,
		// Solo mientras la pantalla está visible (react-query pausa en segundo plano).
		refetchInterval: POLL_MS,
	});

	// Reloj para "hace N s".
	const [now, setNow] = useState(() => Date.now());
	useEffect(() => {
		if (!enabled) return;
		const t = setInterval(() => setNow(Date.now()), 1000);
		return () => clearInterval(t);
	}, [enabled]);

	if (!status?.enabled || devices.length === 0) return null;

	const ageS = reading
		? Math.max(
				0,
				Math.round((now - new Date(reading.received_at).getTime()) / 1000),
			)
		: null;
	const isUsed = reading != null && reading.id === usedReadingId;

	return (
		<div className="rounded-xl border-2 border-emerald-300 bg-emerald-50 p-3">
			<div className="flex items-center justify-between gap-2">
				<div className="flex items-center gap-2 font-semibold text-emerald-900 text-sm">
					<ScaleIcon className="h-4 w-4" />
					Lectura de báscula
				</div>
				{devices.length > 1 ? (
					<select
						aria-label="Báscula"
						className="rounded border border-emerald-300 bg-white px-2 py-0.5 text-xs"
						value={deviceId ?? ""}
						onChange={(e) => {
							setDeviceId(e.target.value);
							window.localStorage.setItem(DEVICE_STORAGE_KEY, e.target.value);
						}}
					>
						{devices.map((d) => (
							<option key={d} value={d}>
								{d}
							</option>
						))}
					</select>
				) : (
					<span className="font-mono text-emerald-800/70 text-xs">
						{deviceId}
					</span>
				)}
			</div>

			{reading ? (
				<div className="mt-2 flex items-center justify-between gap-3">
					<div>
						<div className="font-bold font-mono text-3xl text-emerald-950">
							{(reading.weight_g / 1000).toFixed(3)}
							<span className="ml-1 text-base">kg</span>
						</div>
						<div className="text-emerald-800/80 text-xs">
							estable{reading.net ? " · neto (tara en báscula)" : " · bruto"} ·
							hace {ageS}s
						</div>
					</div>
					<Button
						type="button"
						size="lg"
						className="bg-emerald-600 hover:bg-emerald-700"
						disabled={isUsed}
						onClick={() =>
							onUse({
								id: reading.id,
								weight_g: reading.weight_g,
								net: reading.net,
							})
						}
					>
						{isUsed ? "En uso" : "Usar"}
					</Button>
				</div>
			) : (
				<div className="mt-2 text-emerald-800/70 text-xs">
					Esperando una lectura estable…
				</div>
			)}
		</div>
	);
}
