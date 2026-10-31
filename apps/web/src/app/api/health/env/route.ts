import { NextResponse } from "next/server";
import { isHealthAuthorized } from "@/lib/health-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getUrl(value: string | undefined): URL | null {
	if (!value) {
		return null;
	}

	try {
		return new URL(value);
	} catch {
		return null;
	}
}

function matchesRequestHost(
	value: string | undefined,
	request: Request,
): boolean | null {
	const url = getUrl(value);
	if (!url) {
		return null;
	}

	return url.host === new URL(request.url).host;
}

export async function GET(request: Request) {
	const headers = {
		"Cache-Control": "no-store",
	};

	if (!(await isHealthAuthorized(request))) {
		return NextResponse.json(
			{ ok: false, error: "unauthorized" },
			{ status: 401, headers },
		);
	}

	const baseMatchesRequest = matchesRequestHost(process.env.BASE_URL, request);
	const betterAuthMatchesRequest = matchesRequestHost(
		process.env.BETTER_AUTH_URL,
		request,
	);

	return NextResponse.json(
		{
			ok: true,
			env: {
				DATABASE_URL_set: Boolean(process.env.DATABASE_URL),
				BETTER_AUTH_SECRET_set: Boolean(process.env.BETTER_AUTH_SECRET),
				BETTER_AUTH_URL_set: Boolean(process.env.BETTER_AUTH_URL),
				BASE_URL_set: Boolean(process.env.BASE_URL),
				base_matches_request: baseMatchesRequest,
				betterAuth_matches_request: betterAuthMatchesRequest,
			},
		},
		{ status: 200, headers },
	);
}
