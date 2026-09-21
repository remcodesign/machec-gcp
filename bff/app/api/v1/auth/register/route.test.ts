import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

vi.mock("@/lib/authProxy", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/authProxy")>("@/lib/authProxy");
  return { ...actual, proxyAuthRequest: vi.fn() };
});

const { proxyAuthRequest } = await import("@/lib/authProxy");
const { POST } = await import("./route");

describe("POST /api/v1/auth/register", () => {
  beforeEach(() => {
    vi.mocked(proxyAuthRequest).mockClear();
  });

  afterEach(() => {
    vi.mocked(proxyAuthRequest).mockReset();
  });

  it("all registration fields are required before proxying to Identity", async () => {
    const request = new Request("http://localhost/api/v1/auth/register", {
      method: "POST",
      body: JSON.stringify({
        name: "Test",
        email: "test@example.com",
        password: "secret123",
        password_confirmation: "",
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(422);
    expect(proxyAuthRequest).not.toHaveBeenCalled();
  });

  it("forwards a mismatched password_confirmation to Identity rather than rejecting it locally (Identity owns that check)", async () => {
    vi.mocked(proxyAuthRequest).mockResolvedValueOnce(
      new NextResponse(null, { status: 422 }),
    );

    const request = new Request("http://localhost/api/v1/auth/register", {
      method: "POST",
      body: JSON.stringify({
        name: "Test",
        email: "test@example.com",
        password: "secret123",
        password_confirmation: "different",
      }),
    });

    const response = await POST(request);

    expect(proxyAuthRequest).toHaveBeenCalledWith("/api/v1/auth/register", {
      body: {
        name: "Test",
        email: "test@example.com",
        password: "secret123",
        password_confirmation: "different",
      },
    });
    expect(response.status).toBe(422);
  });
});
