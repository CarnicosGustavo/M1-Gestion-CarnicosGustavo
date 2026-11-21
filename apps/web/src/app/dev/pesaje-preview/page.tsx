import { notFound } from "next/navigation";
import { PesajePreviewClient } from "./preview-client";

export const dynamic = "force-dynamic";

export default function PesajePreviewPage() {
	if (process.env.NODE_ENV !== "development") {
		notFound();
	}
	return <PesajePreviewClient />;
}
