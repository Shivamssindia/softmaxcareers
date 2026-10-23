import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const role = request.cookies.get("softmax_auth_role")?.value;

  // Protect Admin Portal: Only users with 'admin' role cookie can access
  if (pathname.startsWith("/admin")) {
    if (role !== "admin") {
      const homeUrl = new URL("/", request.url);
      return NextResponse.redirect(homeUrl);
    }
  }

  // Protect Candidate Console: Only authenticated users with candidate (or admin) role can access
  if (pathname.startsWith("/candidate")) {
    if (role !== "candidate" && role !== "admin") {
      const homeUrl = new URL("/", request.url);
      return NextResponse.redirect(homeUrl);
    }
  }

  // Protect User Profile: Only authenticated users can access
  if (pathname.startsWith("/profile")) {
    if (!role) {
      const authUrl = new URL("/auth", request.url);
      return NextResponse.redirect(authUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/candidate/:path*", "/profile/:path*"],
};
