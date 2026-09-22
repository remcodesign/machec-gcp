import { describe, expect, it } from "vitest";
import { assertSameOrigin } from "./assertSameOrigin";

function requestWith(headers: Record<string, string>): Request {
  return new Request("http://internal/api/v1/cart/items", {
    method: "POST",
    headers,
  });
}

describe("assertSameOrigin", () => {
  it("allows a request whose Origin matches the Host header", async () => {
    const result = assertSameOrigin(
      requestWith({
        origin: "https://shop.example.com",
        host: "shop.example.com",
      }),
    );

    expect(result).toBeNull();
  });

  it("allows a request whose Origin matches X-Forwarded-Host when present", async () => {
    const result = assertSameOrigin(
      requestWith({
        origin: "https://shop.example.com",
        host: "internal-service:8080",
        "x-forwarded-host": "shop.example.com",
      }),
    );

    expect(result).toBeNull();
  });

  it("rejects a cross-site Origin with 403", async () => {
    const result = assertSameOrigin(
      requestWith({
        origin: "https://evil.example.com",
        host: "shop.example.com",
      }),
    );

    expect(result).not.toBeNull();
    expect(result?.status).toBe(403);
  });

  it("rejects a request with no Origin header at all", async () => {
    const result = assertSameOrigin(requestWith({ host: "shop.example.com" }));

    expect(result).not.toBeNull();
    expect(result?.status).toBe(403);
  });

  it("rejects a request with no Host/X-Forwarded-Host header to compare against", async () => {
    const result = assertSameOrigin(
      requestWith({ origin: "https://shop.example.com" }),
    );

    expect(result).not.toBeNull();
    expect(result?.status).toBe(403);
  });

  it("rejects a malformed Origin header", async () => {
    const result = assertSameOrigin(
      requestWith({ origin: "not-a-url", host: "shop.example.com" }),
    );

    expect(result).not.toBeNull();
    expect(result?.status).toBe(403);
  });
});
