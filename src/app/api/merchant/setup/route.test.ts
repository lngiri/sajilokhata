import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "./route";

vi.mock("@/lib/supabase/admin", () => ({
  getAdminClient: vi.fn(() => null),
}));

describe("POST /api/merchant/setup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects missing merchant_id", async () => {
    const req = new Request("http://localhost/api/merchant/setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: "+9779841234567" }),
    });
    const res = await POST(req);
    const json = await res.json();
    expect(res.status).toBe(400);
    expect(json.error).toBe("merchant_id and phone are required");
  });

  it("rejects missing phone", async () => {
    const req = new Request("http://localhost/api/merchant/setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ merchant_id: crypto.randomUUID() }),
    });
    const res = await POST(req);
    const json = await res.json();
    expect(res.status).toBe(400);
    expect(json.error).toBe("merchant_id and phone are required");
  });

  it("returns admin_unavailable signal when admin client unavailable", async () => {
    const req = new Request("http://localhost/api/merchant/setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        merchant_id: crypto.randomUUID(),
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
