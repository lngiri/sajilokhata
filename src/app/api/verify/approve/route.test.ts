import { describe, it, expect, beforeEach, vi } from "vitest";
import { POST } from "./route";

const { mockGetAdminClient } = vi.hoisted(() => ({
  mockGetAdminClient: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  getAdminClient: mockGetAdminClient,
}));

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn(() => Promise.resolve({ allowed: true, retryAfter: 0 })),
}));

function makeAdmin(log: any) {
  const builder: any = {
    select: vi.fn(() => builder),
    update: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    maybeSingle: vi.fn(() => Promise.resolve({ data: log, error: null })),
    single: vi.fn(() => Promise.resolve({ data: null, error: null })),
  };
  return { from: vi.fn(() => builder) };
}

function makeRequest() {
  return {
    json: vi.fn(() => Promise.resolve({ token: "tok-123" })),
    headers: new Headers(),
  };
}

const baseLog = {
  id: "log1",
  amount: 100,
  type: "credit",
  status: "awaiting_confirmation",
  merchant_id: "m1",
  customer_id: "c1",
  created_at: new Date().toISOString(),
};

describe("POST /api/verify/approve", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects a customer-initiated self-approval", async () => {
    mockGetAdminClient.mockReturnValue(
      makeAdmin({ ...baseLog, initiated_by: "customer" }) as any
    );

    const res = await POST(makeRequest() as any);
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.error).toContain("shopkeeper");
  });

  it("approves a merchant-initiated entry via the verification link", async () => {
    const admin = makeAdmin({ ...baseLog, initiated_by: "merchant" });
    mockGetAdminClient.mockReturnValue(admin as any);

    const res = await POST(makeRequest() as any);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toEqual({ success: true });

    let updatePayload: any = null;
    const calls = admin.from.mock.calls as any[];
    for (let i = 0; i < calls.length; i++) {
      if (calls[i][0] === "credit_logs" && admin.from.mock.results[i].value.update.mock.calls.length > 0) {
        updatePayload = admin.from.mock.results[i].value.update.mock.calls[0][0];
        break;
      }
    }
    expect(updatePayload).toMatchObject({ status: "approved", verification_token: null });
  });
});
