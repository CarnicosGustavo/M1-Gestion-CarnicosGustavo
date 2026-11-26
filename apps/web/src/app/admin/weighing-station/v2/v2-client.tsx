"use client";

import { PesajeStation } from "@/components/weighing-station-v2/pesaje-station";

export function WeighingStationV2Client({ role }: { role: string | null }) {
	return <PesajeStation role={role} />;
}
