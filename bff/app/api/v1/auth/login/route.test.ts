import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

vi.mock("@/lib/authProxy", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/authProxy")>("@/lib/authProxy");
  return { ...actual, proxyAuthRequest: vi.fn() };
});

const { proxyAuthRequest } = await import("@/lib/authProxy");
const { POST } = await import("./route");

describe("POST /api/v1/auth/login", () => {
  beforeEach(() => {
    vi.mocked(proxyAuthRequest).mockClear();
  });

  afterEach(() => {
    vi.mocked(proxyAuthRequest).mockReset();
  });

  it("email and password are required before proxying to Identity", async () => {
    const request = new Request("http://localhost/api/v1/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: "", password: "" }),
    });

    const response = await POST(request);

    expect(response.status).toBe(422);
    expect(proxyAuthRequest).not.toHaveBeenCalled();
  });

  it("an invalid JSON body is rejected before proxying to Identity", async () => {
    const request = new Request("http://localhost/api/v1/auth/login", {
      method: "POST",
      body: "not json",
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
    expect(proxyAuthRequest).not.toHaveBeenCalled();
  });

  it("forwards the real Identity route with only email/password", async () => {
    vi.mocked(proxyAuthRequest).mockResolvedValueOnce(
      new NextResponse(null, { status: 200 }),
    );

    const request = new Request("http://localhost/api/v1/auth/login", {
      method: "POST",
      body: JSON.stringify({
        email: "cust@example.com",
        password: "secret123",
        role: "admin", // must never be forwarded as-is
      }),
    });

    await POST(request);

    expect(proxyAuthRequest).toHaveBeenCalledWith("/api/v1/auth/login", {
      body: { email: "cust@example.com", password: "secret123" },
    });
  });
});
