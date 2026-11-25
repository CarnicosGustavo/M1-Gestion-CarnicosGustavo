import { getAuthUser } from "@/lib/auth-guard";
import { WeighingStationV2Client } from "./v2-client";

export default async function WeighingStationV2Page() {
	const user = await getAuthUser();
	return <WeighingStationV2Client role={user?.role ?? null} />;
}
