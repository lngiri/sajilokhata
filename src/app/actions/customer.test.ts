import { describe, it, expect, beforeEach, vi } from "vitest";
import { submitCustomerEntry } from "./customer";

const { mockCookies, mockVerifySession, mockGetAdminClient } = vi.hoisted(() => ({
  mockCookies: vi.fn(),
  mockVerifySession: vi.fn(),
  mockGetAdminClient: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: mockCookies,
}));

vi.mock("@/lib/session", () => ({
  verifyCustomerSessionToken: mockVerifySession,
}));

vi.mock("@/lib/supabase/admin", () => ({
  getAdminClient: mockGetAdminClient,
}));

vi.mock("@/app/actions/notifications", () => ({
  createNotification: vi.fn(),
}));

vi.mock("./sms", () => ({
  sendTransactionSMS: vi.fn(),
}));

type QueryResult = { data?: unknown; error?: unknown };

function makeAdmin(handlers: Record<string, QueryResult[]>) {
  const queues: Record<string, QueryResult[]> = {};
  for (const [table, items] of Object.entries(handlers)) {
    queues[table] = [...items];
  }
  const from = vi.fn((table: string) => {
    const builder: any = {
      select: vi.fn(() => builder),
      insert: vi.fn(() => builder),
      update: vi.fn(() => builder),
      eq: vi.fn(() => builder),
      neq: vi.fn(() => builder),
      in: vi.fn(() => builder),
      not: vi.fn(() => builder),
      order: vi.fn(() => builder),
      range: vi.fn(() => builder),
      limit: vi.fn(() => builder),
      gte: vi.fn(() => builder),
      lte: vi.fn(() => builder),
      single: vi.fn(() =>
        Promise.resolve(queues[table]?.shift() || { data: null, error: null })
      ),
      maybeSingle: vi.fn(() =>
        Promise.resolve(queues[table]?.shift() || { data: null, error: null })
      ),
    };
    return builder;
  });
  return { from };
}

const VALID_PARAMS = {
  merchant_id: "m1",
  phone: "9841234567",
  name: "Hari",
  amount: 500,
  description: "Rice",
  type: "debit" as const,
  idempotency_key: "key-1",
};

describe("submitCustomerEntry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCookies.mockResolvedValue({
      get: () => ({ value: "valid-token" }),
    });
    mockVerifySession.mockResolvedValue({
      phone: "9841234567",
      name: "Hari",
      iat: 0,
    });
  });

  it("rejects an invalid amount", async () => {
    const result = await submitCustomerEntry({
      ...VALID_PARAMS,
      amount: 0,
    });
    expect(result).toEqual({
      success: false,
      error: "Please enter a valid amount.",
    });
  });

  it("returns Not logged in when the cookie is missing", async () => {
    mockCookies.mockResolvedValue({ get: () => undefined });
    mockGetAdminClient.mockReturnValue(
      makeAdmin({ merchants: [{ data: { id: "m1", name: "Shop" } }] })
    );

    const result = await submitCustomerEntry(VALID_PARAMS);
    expect(result).toEqual({ success: false, error: "Not logged in" });
  });

  it("returns Shop not found when the merchant id is bogus", async () => {
    mockGetAdminClient.mockReturnValue(
      makeAdmin({ merchants: [{ data: null, error: null }] })
    );

    const result = await submitCustomerEntry(VALID_PARAMS);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Shop not found/);
  });

  it("saves the entry for an existing customer", async () => {
    const admin = makeAdmin({
      merchants: [{ data: { id: "m1", name: "Shop" } }],
      customers: [{ data: { id: "c1", name: "Hari", phone: "+9779841234567" } }],
      merchant_customers: [{ data: { id: "mc1" } }],
      credit_logs: [
        { data: null },
        { data: { id: "cl1", status: "awaiting_confirmation" } },
      ],
    });
    mockGetAdminClient.mockReturnValue(admin as any);

    const result = await submitCustomerEntry(VALID_PARAMS);
    expect(result).toEqual({
      success: true,
      entry: { id: "cl1", status: "awaiting_confirmation" },
    });
  });

  it("creates the customer row for a scan/walk-up customer and saves the entry", async () => {
    const admin = makeAdmin({
      merchants: [{ data: { id: "m1", name: "Shop" } }],
      customers: [
        { data: null },
        { data: { id: "c-new", name: "Hari", phone: "+9779841234567" } },
      ],
      merchant_customers: [{ data: null }],
      credit_logs: [
        { data: null },
        { data: { id: "cl1", status: "awaiting_confirmation" } },
      ],
    });
    mockGetAdminClient.mockReturnValue(admin as any);

    const result = await submitCustomerEntry(VALID_PARAMS);
    expect(result.success).toBe(true);
    expect(result.entry?.id).toBe("cl1");
  });

  it("recovers when a parallel request created the customer first (unique violation)", async () => {
    const admin = makeAdmin({
      merchants: [{ data: { id: "m1", name: "Shop" } }],
      customers: [
        { data: null },
        { data: null, error: { code: "23505", message: "duplicate" } },
        { data: { id: "c1", name: "Hari", phone: "+9779841234567" } },
      ],
      merchant_customers: [{ data: { id: "mc1" } }],
      credit_logs: [
        { data: null },
        { data: { id: "cl1", status: "awaiting_confirmation" } },
      ],
    });
    mockGetAdminClient.mockReturnValue(admin as any);

    const result = await submitCustomerEntry(VALID_PARAMS);
    expect(result.success).toBe(true);
    expect(result.entry?.id).toBe("cl1");
  });

  it("returns Database connection unavailable when admin client is missing", async () => {
    mockGetAdminClient.mockReturnValue(null);

    const result = await submitCustomerEntry(VALID_PARAMS);
    expect(result).toEqual({
      success: false,
      error: "Database connection unavailable",
    });
  });
});
