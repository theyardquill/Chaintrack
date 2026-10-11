import { NextResponse } from "next/server";
import type { NextFetchEvent, NextRequest } from "next/server";

const isDev = process.env.NODE_ENV === "development";

// Auth provider is fixed at build time. "clerk" turns on Clerk middleware +
// provider; anything else (default "demo") keeps the localStorage demo auth
// and the E2E suite working unchanged.
const authProvider = process.env.NEXT_PUBLIC_AUTH_PROVIDER ?? "demo";
const clerkEnabled = authProvider === "clerk" && Boolean(process.env.CLERK_SECRET_KEY);

// Routes that require a signed-in user when Clerk is enabled. Per the Next
// proxy docs this is only the first gate — role/ownership still has to be
// checked inside each server action, since matchers don't cover Server
// Function calls that run on an excluded path.
const PROTECTED_PREFIXES = ["/dashboard", "/ship", "/checkpoint", "/agent", "/admin", "/account"];

function buildCsp(nonce: string): string {
  // Per-request nonce so Next can attach it to its own inline scripts/styles
  // and the theme bootstrap in layout.tsx (dynamic rendering, no unsafe-inline).
  const scriptSrc = ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'"];
  if (isDev) scriptSrc.push("'unsafe-eval'");

  const connectSrc = [
    "'self'",
    // Local hardhat RPC proxy is used while developing/E2E; harmless in prod.
    "http://localhost:*",
    "http://127.0.0.1:*",
    "ws://localhost:*",
    "ws://127.0.0.1:*",
  ];

  const imgSrc = ["'self'", "data:", "blob:", "https://*.tile.openstreetmap.org"];

  // A nonce and 'unsafe-inline' do not combine (CSP3 ignores 'unsafe-inline'
  // whenever a nonce is present), so Clerk mode relaxes style-src to allow its
  // inline styles. Demo mode keeps the hardened nonce-only style-src.
  const styleSrc = clerkEnabled
    ? ["'self'", "'unsafe-inline'"]
    : ["'self'", `'nonce-${nonce}'`];

  const extra: string[] = [];
  if (clerkEnabled) {
    connectSrc.push(
      "https://*.clerk.accounts.dev",
      "https://clerk.com",
      "https://*.clerk.com",
      "https://clerk-telemetry.com",
      "https://*.clerk-telemetry.com",
    );
    imgSrc.push("https://img.clerk.com");
    // Fallback for browsers without strict-dynamic; Clerk's own scripts are
    // nonced via the x-nonce / CSP request headers below.
    scriptSrc.push("https://*.clerk.accounts.dev");
    extra.push(
      "frame-src 'self' https://challenges.cloudflare.com https://js.stripe.com https://*.js.stripe.com https://hooks.stripe.com",
      "worker-src 'self' blob:",
    );
  }

  return [
    "default-src 'self'",
    `script-src ${scriptSrc.join(" ")}`,
    `style-src ${styleSrc.join(" ")}`,
    `img-src ${imgSrc.join(" ")}`,
    "font-src 'self' data:",
    `connect-src ${connectSrc.join(" ")}`,
    ...extra,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(isDev ? [] : ["upgrade-insecure-requests"]),
  ]
    .join("; ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export async function proxy(request: NextRequest, event: NextFetchEvent) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = buildCsp(nonce);

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  // Clerk's <DynamicClerkScripts> reads the nonce from x-nonce (falling back to
  // parsing this header), so its injected scripts stay allowed under strict-dynamic.
  requestHeaders.set("Content-Security-Policy", csp);

  let response: Response;

  if (clerkEnabled) {
    // Dynamic import so demo builds never pull Clerk/secret-key code into the bundle.
    const { clerkMiddleware } = await import("@clerk/nextjs/server");
    const handler = clerkMiddleware(async (auth, req) => {
      const { pathname } = req.nextUrl;
      if (PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
        await auth.protect();
      }
      return NextResponse.next({ request: { headers: requestHeaders } });
    });
    response =
      (await handler(request, event)) ??
      NextResponse.next({ request: { headers: requestHeaders } });
  } else {
    response = NextResponse.next({ request: { headers: requestHeaders } });
  }

  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    {
      source: "/((?!_next/static|_next/image|favicon.ico).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
