import { NextResponse } from "next/server";

function forbidden(message: string): NextResponse {
  return NextResponse.json({ message }, { status: 403 });
}

// Next.js's own Origin-vs-Host check (bff/node_modules/next/dist/docs) only
// guards Server Actions — a plain route.ts Route Handler gets none of it for
// free (D118). This replicates that check by hand for the state-changing
// cart/checkout routes: a same-origin fetch() always carries an Origin header
// on POST/PATCH, so its absence or mismatch is treated as cross-site rather
// than assumed benign.
export function assertSameOrigin(request: Request): NextResponse | null {
  const origin = request.headers.get("origin");
  if (!origin) {
    return forbidden("Origin header is required.");
  }

  const host =
    request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!host) {
    return forbidden("Host header is missing.");
  }

  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    return forbidden("Origin header is invalid.");
  }

  if (originHost !== host) {
    return forbidden("Cross-site request rejected.");
  }

  return null;
}
