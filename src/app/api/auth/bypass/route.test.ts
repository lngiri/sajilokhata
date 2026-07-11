import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "./route";

vi.mock("@/lib/supabase/admin", () => ({
  getAdminClient: vi.fn(() => null),
}));

describe("POST /api/auth/bypass", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects missing phone", async () => {
    const req = new Request("http://localhost/api/auth/bypass", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const res = await POST(req);
    const json = await res.json();
    expect(res.status).toBe(400);
    expect(json.error).toBe("Valid phone number is required");
  });

  it("rejects short phone", async () => {
    const req = new Request("http://localhost/api/auth/bypass", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: "12345" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns bypass fallback when admin client unavailable", async () => {
    const req = new Request("http://localhost/api/auth/bypass", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: "+9779841234567" }),
    });
    const res = await POST(req);
    const json = await res.json();
    expect(json.admin_unavailable).toBe(true);
    expect(json.bypass_id).toBeDefined();
    expect(json.phone).toBe("+9779841234567");
  });
});
