import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Define public routes that don't require authentication
const publicRoutes = [
  "/login",
  "/register",
  "/api/auth/login",
  "/api/auth/register",
  "/api/auth/me",
  "/api/auth/refresh",
];
// Define protected route prefixes
const protectedRoutePrefixes = [
  "/super-admin",
  "/company-admin",
  "/branch-manager",
  "/finance-manager",
  "/logistics-manager",
  "/driver",
  "/drivermodule", // Temporary renamed protected driver route
  "/dashboard", // Legacy route
  "/deliveries",
  "/orders",
  "/trips",
  "/history",
  "/masters",
  "/audit-logs",
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Check if the path is public
  const isPublicRoute = publicRoutes.some((route) =>
    pathname.startsWith(route)
  );

  // Check if the path is protected (any role-based route or legacy route)
  const isProtectedRoute =
    protectedRoutePrefixes.some((route) => pathname.startsWith(route)) ||
    (pathname !== "/" &&
      pathname !== "/login" &&
      pathname !== "/register" &&
      !pathname.startsWith("/api/"));

  // Get token from cookies or authorization header
  const cookieToken = request.cookies.get('access_token')?.value;
  const token = cookieToken ||
    request.headers.get('authorization')?.replace('Bearer ', '');

  // If accessing protected routes without token, redirect to login
  if (!isPublicRoute && isProtectedRoute && !token) {
    // For API routes (except auth endpoints), return 401 response
    if (pathname.startsWith("/api/") && !pathname.startsWith("/api/auth/")) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // For page routes, redirect to login
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // If accessing login page with token, redirect to root
  // The root route will handle role-based redirection through the protected layout
  if (pathname === "/login" && token) {
    // We can't determine the user's role from the token in middleware,
    // so redirect to root and let the application handle role-based routing
    return NextResponse.redirect(new URL("/", request.url));
  }

  // Continue with the request
  // Clone the request headers so we can modify them
  const requestHeaders = new Headers(request.headers);

  // Forward the authorization token to the next handler if it exists
  // This ensures API routes receive the token for forwarding to backend services
  if (token && !requestHeaders.get("authorization")) {
    requestHeaders.set("authorization", `Bearer ${token}`);
  }

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  return response;
}

// Configure which routes the middleware should run on
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
