import { cookies, headers } from "next/headers";
import { NextResponse } from "next/server";

const BFF_SESSION_COOKIE = "machec_session";
// customer-identity's config/session.php default is
// Str::slug(env('APP_NAME', 'laravel')) . '-session' — with APP_NAME=Laravel
// that's "laravel-session" (hyphen), not the Laravel-starter-kit default
// "laravel_session" (underscore).
const IDENTITY_SESSION_COOKIE = "laravel-session";
const XSRF_COOKIE = "XSRF-TOKEN";
const IDENTITY_REQUEST_TIMEOUT_MS = 5000;

interface AuthProxyOptions {
  body?: Record<string, string>;
  method?: "POST";
}

function identityBaseUrl(): string {
  const value = process.env.CUSTOMER_IDENTITY_URL?.trim();
  if (!value) {
    throw new Error("CUSTOMER_IDENTITY_URL is not configured");
  }

  return value.replace(/\/$/, "");
}

function identityCookieName(): string {
  return process.env.IDENTITY_SESSION_COOKIE?.trim() || IDENTITY_SESSION_COOKIE;
}

function getSetCookieHeaders(response: Response): string[] {
  const values = response.headers.getSetCookie();
  if (values && values.length > 0) {
    return values;
  }

  const value = response.headers.get("set-cookie");
  return value ? [value] : [];
}

function parseCookiePair(value: string): [string, string] | null {
  const separator = value.indexOf("=");
  if (separator < 1) {
    return null;
  }

  return [value.slice(0, separator).trim(), value.slice(separator + 1).trim()];
}

function parseSetCookies(values: string[]): Map<string, string> {
  const cookiesByName = new Map<string, string>();
  for (const value of values) {
    const pair = parseCookiePair(value.split(";", 1)[0]);
    if (pair) {
      cookiesByName.set(pair[0], pair[1]);
    }
  }

  return cookiesByName;
}

function serializeCookies(cookiesByName: Map<string, string>): string {
  return [...cookiesByName.entries()]
    .map(([name, value]) => `${name}=${value}`)
    .join("; ");
}

function decodeCookieValue(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function relayCookieOptions() {
  return {
    httpOnly: true,
    path: "/",
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
  };
}

function identityUnavailableResponse(): NextResponse {
  return NextResponse.json(
    { message: "Authentication service is unavailable" },
    { status: 502 },
  );
}

// customer-identity's config('sanctum.stateful') / EnsureFrontendRequestsAreStateful
// (D8/D115) only attach the session middleware — and 'stateful-origin' only
// lets the request through — when the request carries a Referer or Origin
// header matching a configured stateful domain. Every outbound call to
// Identity must present the BFF's own origin, or Identity 403s it before
// LoginController/RegisterController/whoami ever run.
async function bffOrigin(): Promise<string> {
  const incoming = await headers();
  const proto = incoming.get("x-forwarded-proto") ?? "http";
  const host = incoming.get("host");
  if (!host) {
    throw new Error("Incoming request has no Host header");
  }

  return `${proto}://${host}`;
}

async function fetchIdentity(
  path: string,
  init: RequestInit,
): Promise<Response> {
  const origin = await bffOrigin();
  return fetch(`${identityBaseUrl()}${path}`, {
    ...init,
    headers: { ...init.headers, Origin: origin },
    signal: AbortSignal.timeout(IDENTITY_REQUEST_TIMEOUT_MS),
  });
}

async function currentRelaySession(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(BFF_SESSION_COOKIE)?.value ?? null;
}

async function csrfHandshake(
  session: string | null,
): Promise<{ cookies: Map<string, string>; token: string } | NextResponse> {
  const headers: HeadersInit = { Accept: "application/json" };
  if (session) {
    headers.Cookie = `${identityCookieName()}=${session}`;
  }

  let response: Response;
  try {
    response = await fetchIdentity("/sanctum/csrf-cookie", {
      headers,
      cache: "no-store",
    });
  } catch {
    return identityUnavailableResponse();
  }
  if (!response.ok) {
    return identityUnavailableResponse();
  }

  const handshakeCookies = parseSetCookies(getSetCookieHeaders(response));
  const xsrfToken = handshakeCookies.get(XSRF_COOKIE);
  if (!xsrfToken) {
    return NextResponse.json(
      { message: "Authentication service returned no CSRF cookie" },
      { status: 502 },
    );
  }

  if (session) {
    handshakeCookies.set(identityCookieName(), session);
  }

  return { cookies: handshakeCookies, token: decodeCookieValue(xsrfToken) };
}

function copyResponse(response: Response): NextResponse {
  const contentType = response.headers.get("content-type");
  const headers = new Headers({ "cache-control": "no-store" });
  if (contentType) {
    headers.set("content-type", contentType);
  }

  return new NextResponse(response.status === 204 ? null : response.body, {
    status: response.status,
    headers,
  });
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export async function proxyAuthRequest(
  path: string,
  options: AuthProxyOptions = {},
): Promise<NextResponse> {
  const session = await currentRelaySession();
  const handshake = await csrfHandshake(session);
  if (handshake instanceof NextResponse) {
    return handshake;
  }

  const headers: HeadersInit = {
    Accept: "application/json",
    "Content-Type": "application/json",
    Cookie: serializeCookies(handshake.cookies),
    "X-XSRF-TOKEN": handshake.token,
  };
  let response: Response;
  try {
    response = await fetchIdentity(path, {
      method: options.method ?? "POST",
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
      cache: "no-store",
    });
  } catch {
    return identityUnavailableResponse();
  }
  const proxyResponse = copyResponse(response);

  if (path === "/api/v1/auth/logout") {
    if (response.ok || response.status === 401) {
      proxyResponse.cookies.set(BFF_SESSION_COOKIE, "", {
        ...relayCookieOptions(),
        maxAge: 0,
      });
    }
    return proxyResponse;
  }

  if (response.ok) {
    const identityCookies = parseSetCookies(getSetCookieHeaders(response));
    const identitySession = identityCookies.get(identityCookieName());
    if (identitySession) {
      proxyResponse.cookies.set(
        BFF_SESSION_COOKIE,
        identitySession,
        relayCookieOptions(),
      );
    }
  }

  return proxyResponse;
}

export async function proxyCurrentUser(): Promise<NextResponse> {
  const session = await currentRelaySession();
  if (!session) {
    return NextResponse.json({ message: "Unauthenticated" }, { status: 401 });
  }

  let response: Response;
  try {
    response = await fetchIdentity("/api/internal/v1/whoami", {
      headers: {
        Accept: "application/json",
        Cookie: `${identityCookieName()}=${session}`,
      },
      cache: "no-store",
    });
  } catch {
    return identityUnavailableResponse();
  }

  return copyResponse(response);
}
