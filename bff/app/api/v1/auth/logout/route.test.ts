import { describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

vi.mock("@/lib/authProxy", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/authProxy")>("@/lib/authProxy");
  return { ...actual, proxyAuthRequest: vi.fn() };
});

const { proxyAuthRequest } = await import("@/lib/authProxy");
const { POST } = await import("./route");

describe("POST /api/v1/auth/logout", () => {
  it("proxies to Identity's real /api/v1/auth/logout route", async () => {
    vi.mocked(proxyAuthRequest).mockResolvedValueOnce(
      new NextResponse(null, { status: 204 }),
    );

    await POST();

    expect(proxyAuthRequest).toHaveBeenCalledWith("/api/v1/auth/logout");
  });
});
