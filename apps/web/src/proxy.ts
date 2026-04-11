import { NextRequest, NextResponse } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

export async function proxy(request: NextRequest) {
  const sessionCookie = getSessionCookie(request);
  const { pathname } = request.nextUrl;

  const applyNoStore = (res: NextResponse) => {
    if (
      pathname.includes("/admin") ||
      pathname.startsWith("/login") ||
      pathname.startsWith("/signup")
    ) {
      res.headers.set("Cache-Control", "no-store, max-age=0");
    }
    return res;
  };

  if (pathname === "/en" || pathname === "/en/") {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return applyNoStore(NextResponse.redirect(url));
  }

  if (pathname.startsWith("/en/")) {
    const url = request.nextUrl.clone();
    url.pathname = pathname.replace("/en", "");
    return applyNoStore(NextResponse.redirect(url));
  }

  // Redirect root to login page
  if (pathname === "/") {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return applyNoStore(NextResponse.redirect(url));
  }

  if (
    !sessionCookie &&
    !pathname.startsWith("/login") &&
    !pathname.startsWith("/signup") &&
    !pathname.startsWith("/auth") &&
    !pathname.startsWith("/api/auth") &&
    !pathname.startsWith("/api/admin/seed") &&
    !pathname.startsWith("/api/health") &&
    !pathname.startsWith("/api/docs") &&
    !pathname.startsWith("/api/openapi.json")
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return applyNoStore(NextResponse.redirect(url));
  }

  return applyNoStore(NextResponse.next());
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
