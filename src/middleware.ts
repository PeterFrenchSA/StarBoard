import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/constants";
import { verifySessionToken } from "@/lib/auth/jwt";

const PUBLIC_ROUTES = new Set(["/login", "/register"]);

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(SESSION_COOKIE)?.value;

  const isProtectedAppRoute = pathname.startsWith("/parent") || pathname.startsWith("/child");

  if (!token && isProtectedAppRoute) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (!token && PUBLIC_ROUTES.has(pathname)) {
    return NextResponse.next();
  }

  if (!token) {
    return NextResponse.next();
  }

  const session = await verifySessionToken(token);

  if (!session) {
    const response = NextResponse.redirect(new URL("/login", request.url));
    response.cookies.delete(SESSION_COOKIE);
    return response;
  }

  if (PUBLIC_ROUTES.has(pathname)) {
    return NextResponse.redirect(new URL(session.role === "PARENT" ? "/parent" : "/child", request.url));
  }

  if (pathname.startsWith("/parent") && session.role !== "PARENT") {
    return NextResponse.redirect(new URL("/child", request.url));
  }

  if (pathname.startsWith("/child") && session.role !== "CHILD") {
    return NextResponse.redirect(new URL("/parent", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/login", "/register", "/parent/:path*", "/child/:path*"]
};
