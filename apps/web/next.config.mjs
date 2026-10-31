import { fileURLToPath } from "node:url";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

/** @type {import('next').NextConfig} */
const nextConfig = {
	basePath: process.env.BASE_PATH || "",
	env: {
		NEXT_PUBLIC_BASE_PATH: process.env.BASE_PATH || "",
	},
	productionBrowserSourceMaps: true,
	serverExternalPackages: ["@electric-sql/pglite"],
	async headers() {
		return [
			{
				source: "/admin/:path*",
				headers: [{ key: "Cache-Control", value: "no-store, max-age=0" }],
			},
		];
	},
};

// En Docker standalone se incluye la raíz del monorepo para el trazado de archivos.
if (process.env.NEXT_OUTPUT === "standalone") {
	nextConfig.output = "standalone";
	nextConfig.outputFileTracingRoot = fileURLToPath(
		new URL("../..", import.meta.url),
	);
}

export default withNextIntl(nextConfig);
