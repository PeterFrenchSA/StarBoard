import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/constants";
import { verifySessionToken } from "@/lib/auth/jwt";

const PUBLIC_ROUTES = new Set(["/login", "/register"]);

function getRoleHomePath(role: "PARENT" | "CHILD" | "SUPER_ADMIN"): string {
  if (role === "SUPER_ADMIN") {
    return "/provider";
  }

  return role === "PARENT" ? "/parent" : "/child";
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(SESSION_COOKIE)?.value;

  const isProtectedAppRoute =
    pathname.startsWith("/parent") || pathname.startsWith("/child") || pathname.startsWith("/provider");

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
    return NextResponse.redirect(new URL(getRoleHomePath(session.role), request.url));
  }

  if (pathname.startsWith("/parent") && session.role !== "PARENT") {
    return NextResponse.redirect(new URL(getRoleHomePath(session.role), request.url));
  }

  if (pathname.startsWith("/child") && session.role !== "CHILD") {
    return NextResponse.redirect(new URL(getRoleHomePath(session.role), request.url));
  }

  if (pathname.startsWith("/provider") && session.role !== "SUPER_ADMIN") {
    return NextResponse.redirect(new URL(getRoleHomePath(session.role), request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/login", "/register", "/parent/:path*", "/child/:path*", "/provider/:path*"]
};
