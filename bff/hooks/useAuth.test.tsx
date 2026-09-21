import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

const pushMock = vi.fn();
const refreshMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, refresh: refreshMock }),
}));

const { AuthProvider, useAuth } = await import("./useAuth");

function wrapper({ children }: { children: ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}

describe("useAuth", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    pushMock.mockClear();
    refreshMock.mockClear();
    fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 401 }));
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("starts unauthenticated when GET /api/v1/auth/me returns 401", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.user).toBeNull();
  });

  it("a successful login sets the user and redirects to the homepage", async () => {
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      if (String(input).endsWith("/api/v1/auth/me")) {
        return Promise.resolve(new Response(null, { status: 401 }));
      }
      return Promise.resolve(
        new Response(
          JSON.stringify({
            customer_id: 1,
            name: "Test User",
            email: "test@example.com",
          }),
          { status: 200 },
        ),
      );
    });

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let success = false;
    await act(async () => {
      success = await result.current.login({
        email: "test@example.com",
        password: "secret123",
      });
    });

    expect(success).toBe(true);
    expect(result.current.user?.email).toBe("test@example.com");
    expect(result.current.error).toBeNull();
    expect(pushMock).toHaveBeenCalledWith("/");
    expect(refreshMock).toHaveBeenCalled();
  });

  it("invalid credentials surface the server's error message and set no user", async () => {
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      if (String(input).endsWith("/api/v1/auth/me")) {
        return Promise.resolve(new Response(null, { status: 401 }));
      }
      return Promise.resolve(
        new Response(
          JSON.stringify({
            message: "These credentials do not match our records.",
          }),
          { status: 422 },
        ),
      );
    });

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let success = true;
    await act(async () => {
      success = await result.current.login({
        email: "test@example.com",
        password: "wrong",
      });
    });

    expect(success).toBe(false);
    expect(result.current.user).toBeNull();
    expect(result.current.error).toBe(
      "These credentials do not match our records.",
    );
  });

  it("logout clears the user and redirects to the homepage", async () => {
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/api/v1/auth/me")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              customer_id: 1,
              name: "Test User",
              email: "test@example.com",
            }),
            { status: 200 },
          ),
        );
      }
      if (url.endsWith("/api/v1/auth/logout")) {
        return Promise.resolve(new Response(null, { status: 204 }));
      }
      throw new Error(`unexpected fetch: ${url}`);
    });

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() =>
      expect(result.current.user?.email).toBe("test@example.com"),
    );

    await act(async () => {
      await result.current.logout();
    });

    expect(result.current.user).toBeNull();
    expect(pushMock).toHaveBeenCalledWith("/");
  });
});
