import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const rawOrigin = (request.headers.get("origin") || "").trim();
  const origin = rawOrigin.replace(/\/+$/, "");

  const allowedOriginsEnv =
    process.env.ALLOWED_ORIGINS ||
    process.env.FRONTEND_URL ||
    "https://border-to-border-export-frontend.vercel.app";

  const allowedList = allowedOriginsEnv
    .split(",")
    .map((o) => o.trim().replace(/\/+$/, ""))
    .filter(Boolean);

  // In development or if vercel domain, allow dynamically
  const isDev = process.env.NODE_ENV !== "production";
  const isAllowed =
    !origin ||
    allowedList.includes(origin) ||
    allowedList.includes("*") ||
    origin.endsWith(".vercel.app") ||
    (isDev && (origin.includes("localhost") || origin.includes("127.0.0.1")));

  const effectiveOrigin = isAllowed && origin ? origin : (allowedList[0] || "*");

  // Preflight response
  if (request.method === "OPTIONS") {
    const preflightHeaders = new Headers();
    preflightHeaders.set("Access-Control-Allow-Origin", effectiveOrigin);
    preflightHeaders.set("Access-Control-Allow-Credentials", "true");
    preflightHeaders.set(
      "Access-Control-Allow-Methods",
      "GET, POST, PUT, PATCH, DELETE, OPTIONS"
    );
    preflightHeaders.set(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization, x-compliance-grant-token, x-compliance-audit-reason, Accept, Origin, Cookie"
    );
    preflightHeaders.set("Access-Control-Max-Age", "86400");

    return new NextResponse(null, {
      status: 204,
      headers: preflightHeaders,
    });
  }

  // Normal request pass-through with CORS headers
  const response = NextResponse.next();
  if (effectiveOrigin) {
    response.headers.set("Access-Control-Allow-Origin", effectiveOrigin);
    response.headers.set("Access-Control-Allow-Credentials", "true");
  }
  return response;
}

export const config = {
  matcher: "/api/:path*",
};
