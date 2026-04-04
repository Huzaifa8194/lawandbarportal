import { NextRequest, NextResponse } from "next/server";

const protectedPaths = ["/", "/subjects", "/mocks", "/progress", "/search", "/admin"];
const adminPath = "/admin";

function isProtectedPath(pathname: string) {
  return protectedPaths.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (pathname === "/login") {
    const loginUrl = new URL("/auth/login", request.url);
    loginUrl.search = request.nextUrl.search;
    return NextResponse.redirect(loginUrl);
  }

  const sessionCookie = request.cookies.get("lb_session")?.value;
  const adminCookie = request.cookies.get("lb_admin")?.value;
  const accessCookie = request.cookies.get("lb_access")?.value;
  const isLoggedIn = sessionCookie === "1";
  const isAdmin = adminCookie === "1";
  const hasAccess = accessCookie !== "0";

  if (pathname.startsWith("/auth/login")) {
    // Let logged-in users without portal access stay on login (e.g. sign out, try another account).
    if (isLoggedIn && hasAccess) {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return NextResponse.next();
  }

  if (isProtectedPath(pathname) && !isLoggedIn) {
    const loginUrl = new URL("/auth/login", request.url);
    loginUrl.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(loginUrl);
  }

  if (isProtectedPath(pathname) && !hasAccess && !pathname.startsWith("/auth")) {
    return NextResponse.redirect(new URL("/unauthorized", request.url));
  }

  if ((pathname === adminPath || pathname.startsWith("/admin/")) && !isAdmin) {
    return NextResponse.redirect(new URL("/unauthorized", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
