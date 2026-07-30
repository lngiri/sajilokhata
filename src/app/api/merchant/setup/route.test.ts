import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "./route";

vi.mock("@/lib/supabase/admin", () => ({
  getAdminClient: vi.fn(() => null),
}));

vi.mock("@/lib/session", () => ({
  verifySessionToken: vi.fn(() => ({ userId: "m1" })),
  SESSION_COOKIE: "sb-session",
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(() =>
    Promise.resolve({
      get: vi.fn((name: string) => {
        if (name === "sb-session") return { value: "valid-token" };
        return undefined;
      }),
      set: vi.fn(),
      getAll: vi.fn(() => []),
      delete: vi.fn(),
    })
  ),
}));

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn(() => Promise.resolve({ allowed: true, retryAfter: 0 })),
}));

describe("POST /api/merchant/setup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects missing phone", async () => {
    const req = new Request("http://localhost/api/merchant/setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const res = await POST(req);
    const json = await res.json();
    expect(res.status).toBe(400);
    expect(json.error).toBe("phone is required");
  });

  it("returns admin_unavailable signal when admin client unavailable", async () => {
    const req = new Request("http://localhost/api/merchant/setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phone: "+9779841234567",
      }),
    });
    const res = await POST(req);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.admin_unavailable).toBe(true);
    expect(json.merchant_id).toBeDefined();
  });
});
