import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
	client: {
		NEXT_PUBLIC_BASE_URL: z.string().url().default("http://localhost"),
		// Supabase: URL del proyecto y clave anónima (públicas, seguras en el cliente).
		// Usadas por el cliente Supabase JS para Realtime / Storage.
		NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
		NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1).optional(),
	},
	runtimeEnv: {
		NEXT_PUBLIC_BASE_URL: process.env.NEXT_PUBLIC_BASE_URL,
		NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
		NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
	},
	emptyStringAsUndefined: true,
});

const base = env.NEXT_PUBLIC_BASE_URL.replace(/\/$/, "");
const isDev = base === "http://localhost";

export const urls = {
	base,
	app: isDev ? "http://localhost:3001" : `${base}/app`,
	docs: isDev ? "http://localhost:3002" : `${base}/docs`,
	apiDocs: isDev ? "http://localhost:3001/api/docs" : `${base}/app/api/docs`,
	landing: base,
} as const;
