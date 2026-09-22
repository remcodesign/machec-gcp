import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const pushMock = vi.fn();
const refreshMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, refresh: refreshMock }),
}));

const { useCart } = await import("./useCart");

describe("useCart", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    pushMock.mockClear();
    refreshMock.mockClear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("addItem POSTs sku and quantity, defaulting quantity to 1, then navigates to /cart and refreshes the layout", async () => {
    fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({}), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useCart());

    let succeeded = false;
    await act(async () => {
      succeeded = await result.current.addItem("SKU-1");
    });

    expect(succeeded).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/cart/items",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ sku: "SKU-1", quantity: 1 }),
      }),
    );
    expect(pushMock).toHaveBeenCalledWith("/cart");
    // refresh() is what actually re-runs the root layout, so the header's
    // item count reflects this addition instead of showing the stale one
    // that push() alone would leave behind (Next's cached layout render).
    expect(refreshMock).toHaveBeenCalledTimes(1);
  });

  it("setQuantity PATCHes the sku's own route with the exact quantity and refreshes in place", async () => {
    fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({}), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useCart());

    await act(async () => {
      await result.current.setQuantity("SKU-1", 0);
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/cart/items/SKU-1",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ quantity: 0 }),
      }),
    );
    expect(refreshMock).toHaveBeenCalledTimes(1);
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("a failed mutation surfaces the server's error message and does not navigate", async () => {
    fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ message: "Cross-site request rejected." }),
        {
          status: 403,
        },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useCart());

    let succeeded = true;
    await act(async () => {
      succeeded = await result.current.addItem("SKU-1");
    });

    expect(succeeded).toBe(false);
    expect(result.current.error).toBe("Cross-site request rejected.");
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("a network failure sets a generic unavailable error", async () => {
    fetchMock = vi.fn().mockRejectedValue(new Error("network down"));
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useCart());

    await act(async () => {
      await result.current.addItem("SKU-1");
    });

    expect(result.current.error).toBe(
      "De winkelmand is tijdelijk niet bereikbaar.",
    );
  });

  it("a rapid second call while the first is still in flight is dropped, sending only one request", async () => {
    let resolveFetch!: (response: Response) => void;
    fetchMock = vi.fn().mockReturnValue(
      new Promise<Response>((resolve) => {
        resolveFetch = resolve;
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useCart());

    let first!: Promise<boolean>;
    let second!: Promise<boolean>;
    act(() => {
      first = result.current.addItem("SKU-1");
      second = result.current.addItem("SKU-1");
    });

    resolveFetch(new Response(JSON.stringify({}), { status: 200 }));
    let firstResult = false;
    let secondResult = true;
    await act(async () => {
      [firstResult, secondResult] = await Promise.all([first, second]);
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(firstResult).toBe(true);
    expect(secondResult).toBe(false);
  });

  it("stays locked for a cooldown period after a fast response, dropping an immediate repeat click", async () => {
    fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({}), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useCart());

    await act(async () => {
      await result.current.addItem("SKU-1");
    });

    let repeatSucceeded = true;
    await act(async () => {
      repeatSucceeded = await result.current.addItem("SKU-1");
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(repeatSucceeded).toBe(false);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });

    const afterCooldown = await result.current.addItem("SKU-1");
    expect(afterCooldown).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
