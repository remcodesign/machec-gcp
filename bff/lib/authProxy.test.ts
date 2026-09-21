import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const cookieStore = new Map<string, string>();

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: (name: string) =>
      cookieStore.has(name) ? { value: cookieStore.get(name) } : undefined,
  })),
  headers: vi.fn(async () => new Headers({ host: "localhost:3000" })),
}));

const { isNonEmptyString, isRecord, proxyAuthRequest, proxyCurrentUser } =
  await import("./authProxy");

function jsonResponse(
  body: unknown,
  init: { status?: number; setCookie?: string[] } = {},
): Response {
  const headers = new Headers({ "content-type": "application/json" });
  for (const cookie of init.setCookie ?? []) {
    headers.append("set-cookie", cookie);
  }

  const status = init.status ?? 200;
  return new Response(status === 204 ? null : JSON.stringify(body), {
    status,
    headers,
  });
}

describe("authProxy type guards", () => {
  it("isRecord accepts plain objects and rejects arrays/null/primitives", () => {
    expect(isRecord({})).toBe(true);
    expect(isRecord([])).toBe(false);
    expect(isRecord(null)).toBe(false);
    expect(isRecord("x")).toBe(false);
  });

  it("isNonEmptyString rejects blank/whitespace-only strings", () => {
    expect(isNonEmptyString("hi")).toBe(true);
    expect(isNonEmptyString("   ")).toBe(false);
    expect(isNonEmptyString("")).toBe(false);
    expect(isNonEmptyString(5)).toBe(false);
  });
});

describe("proxyAuthRequest", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    cookieStore.clear();
    process.env.CUSTOMER_IDENTITY_URL = "https://identity.test";
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("a customer logs in and the BFF sets its own relay cookie carrying Identity's session (D115)", async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse(null, {
          status: 204,
          setCookie: ["XSRF-TOKEN=csrf-token-value; Path=/"],
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse(
          { customer_id: 1, name: "Test", email: "test@example.com" },
          {
            setCookie: [
              "laravel-session=identity-session-value; Path=/; HttpOnly",
            ],
          },
        ),
      );

    const response = await proxyAuthRequest("/api/v1/auth/login", {
      body: { email: "test@example.com", password: "secret123" },
    });

    expect(response.status).toBe(200);
    const relayCookie = response.cookies.get("machec_session");
    expect(relayCookie?.value).toBe("identity-session-value");

    // Every outbound Identity call carries the BFF's own Origin, or
    // Identity's stateful-origin middleware 403s it before any of this runs.
    for (const [, init] of fetchMock.mock.calls) {
      const headers = new Headers(init.headers as HeadersInit);
      expect(headers.get("Origin")).toBe("http://localhost:3000");
    }

    // CSRF handshake token is forwarded on the actual login call (D80).
    const loginCallHeaders = new Headers(fetchMock.mock.calls[1][1].headers);
    expect(loginCallHeaders.get("X-XSRF-TOKEN")).toBe("csrf-token-value");
  });

  it("invalid credentials show an inline error and set no cookie", async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse(null, {
          status: 204,
          setCookie: ["XSRF-TOKEN=csrf-token-value; Path=/"],
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse(
          { message: "These credentials do not match our records." },
          { status: 422 },
        ),
      );

    const response = await proxyAuthRequest("/api/v1/auth/login", {
      body: { email: "test@example.com", password: "wrong" },
    });

    expect(response.status).toBe(422);
    expect(response.cookies.get("machec_session")).toBeUndefined();
  });

  it("clicking Logout calls the logout proxy and clears the relay cookie", async () => {
    cookieStore.set("machec_session", "identity-session-value");
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse(null, {
          status: 204,
          setCookie: ["XSRF-TOKEN=csrf-token-value; Path=/"],
        }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 204 }));

    const response = await proxyAuthRequest("/api/v1/auth/logout");

    expect(response.status).toBe(204);
    const cleared = response.cookies.get("machec_session");
    expect(cleared?.value).toBe("");
  });

  it("a downstream Identity failure (network error) returns a controlled 502, not a crash", async () => {
    fetchMock.mockRejectedValueOnce(new Error("ECONNREFUSED"));

    const response = await proxyAuthRequest("/api/v1/auth/login", {
      body: { email: "test@example.com", password: "secret123" },
    });

    expect(response.status).toBe(502);
  });

  it("a CSRF handshake with no XSRF-TOKEN cookie returns a controlled 502", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(null, { status: 204 }));

    const response = await proxyAuthRequest("/api/v1/auth/login", {
      body: { email: "test@example.com", password: "secret123" },
    });

    expect(response.status).toBe(502);
  });
});

describe("proxyCurrentUser", () => {
  beforeEach(() => {
    cookieStore.clear();
    process.env.CUSTOMER_IDENTITY_URL = "https://identity.test";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns 401 with no relay cookie, never calling Identity", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await proxyCurrentUser();

    expect(response.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("resolves the current user when a relay cookie is present", async () => {
    cookieStore.set("machec_session", "identity-session-value");
    const fetchMock = vi.fn().mockResolvedValueOnce(
      jsonResponse({
        customer_id: 1,
        name: "Test",
        email: "test@example.com",
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await proxyCurrentUser();

    expect(response.status).toBe(200);
    const [path, init] = fetchMock.mock.calls[0];
    expect(path).toBe("https://identity.test/api/internal/v1/whoami");
    expect(new Headers(init.headers).get("Origin")).toBe(
      "http://localhost:3000",
    );
  });
});
