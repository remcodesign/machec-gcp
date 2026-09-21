import { describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

vi.mock("@/lib/authProxy", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/authProxy")>("@/lib/authProxy");
  return { ...actual, proxyCurrentUser: vi.fn() };
});

const { proxyCurrentUser } = await import("@/lib/authProxy");
const { GET } = await import("./route");

describe("GET /api/v1/auth/me", () => {
  it("delegates to proxyCurrentUser", async () => {
    vi.mocked(proxyCurrentUser).mockResolvedValueOnce(
      new NextResponse(null, { status: 401 }),
    );

    const response = await GET();

    expect(proxyCurrentUser).toHaveBeenCalledOnce();
    expect(response.status).toBe(401);
  });
});
