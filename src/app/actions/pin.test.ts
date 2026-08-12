import { describe, it, expect, beforeEach, vi } from "vitest";
import { registerNewUser } from "./pin";

process.env.SESSION_HMAC_SECRET = "test-secret";

const { mockCookies, mockHeaders, mockCreateSessionToken, mockGetAdminClient } = vi.hoisted(() => ({
  mockCookies: vi.fn(),
  mockHeaders: vi.fn(),
  mockCreateSessionToken: vi.fn(),
  mockGetAdminClient: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: mockCookies,
  headers: mockHeaders,
}));

vi.mock("@/lib/session", () => ({
  createSessionToken: mockCreateSessionToken,
  SESSION_COOKIE: "session",
  SESSION_COOKIE_OPTIONS: { httpOnly: true },
  getSessionCookieOptions: vi.fn(async () => ({ httpOnly: true, path: "/", maxAge: 3600 })),
}));

vi.mock("@/lib/supabase/admin", () => ({
  getAdminClient: mockGetAdminClient,
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
      upsert: vi.fn(() => builder),
      delete: vi.fn(() => builder),
      eq: vi.fn(() => builder),
      neq: vi.fn(() => builder),
      is: vi.fn(() => builder),
      in: vi.fn(() => builder),
      order: vi.fn(() => builder),
      limit: vi.fn(() => builder),
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

function countQuery(admin: any, table: string, method: string): number {
  let count = 0;
  for (let i = 0; i < admin.from.mock.calls.length; i++) {
    if (admin.from.mock.calls[i][0] === table) {
      const builder = admin.from.mock.results[i].value;
      if (builder[method]?.mock.calls.length > 0) count++;
    }
  }
  return count;
}

function findFirstUpsert(admin: any, table: string): any {
  for (let i = 0; i < admin.from.mock.calls.length; i++) {
    if (admin.from.mock.calls[i][0] === table) {
      const builder = admin.from.mock.results[i].value;
      if (builder.upsert?.mock.calls.length) return builder.upsert.mock.calls[0][0];
    }
  }
  return null;
}

beforeEach(() => {
  vi.clearAllMocks();
  const cookieStore = {
    set: vi.fn(),
    get: vi.fn(() => ({ value: "session-token" })),
    delete: vi.fn(),
  };
  mockCookies.mockResolvedValue(cookieStore as any);
  mockHeaders.mockReturnValue({ get: () => null } as any);
  mockCreateSessionToken.mockResolvedValue({ token: "tok", maxAge: 3600 });
});

describe("registerNewUser · overlap merge", () => {
  it("folds an orphan merchant into the customer identity when a customer adds the merchant role", async () => {
    // Customer "C" is the self identity; orphan merchant "M" shares the phone.
    const admin = makeAdmin({
      merchants: [
        { data: { id: "M", pin_hash: null, name: "Shop" } },
        { data: { name: "Shop", business_type: "kirana", sms_balance: 10 } },
      ],
      customers: [{ data: { id: "C", pin_hash: "hash", name: "Hari" } }],
    });
    mockGetAdminClient.mockReturnValue(admin as any);

    const result = await registerNewUser("9841234567", "merchant", "Hari");

    expect(result.success).toBe(true);
    expect(result.userId).toBe("C");
    expect(result.userType).toBe("merchant");

    // Orphan merchant was absorbed into canonical customer id "C"
    const upsert = findFirstUpsert(admin, "merchants");
    expect(upsert).toMatchObject({ id: "C", phone: "+9779841234567" });
    expect(countQuery(admin, "merchants", "delete")).toBe(1);
    expect(countQuery(admin, "customers", "upsert")).toBe(0);
  });

  it("folds an orphan invited-customer into the merchant identity when a merchant adds the customer role", async () => {
    const admin = makeAdmin({
      merchants: [{ data: { id: "M", pin_hash: "hash", name: "Ruby" } }],
      customers: [{ data: { id: "C", pin_hash: null, name: "Invited" } }],
    });
    mockGetAdminClient.mockReturnValue(admin as any);

    const result = await registerNewUser("9841234567", "customer", "Ruby");

    expect(result.success).toBe(true);
    expect(result.userId).toBe("M");
    expect(result.userType).toBe("customer");

    const upsert = findFirstUpsert(admin, "customers");
    expect(upsert).toMatchObject({ id: "M", phone: "+9779841234567", registration_status: "registered" });
    expect(countQuery(admin, "customers", "delete")).toBe(1);
    expect(countQuery(admin, "merchants", "upsert")).toBe(0);
  });

  it("blocks registration when both roles already share the same identity id", async () => {
    const admin = makeAdmin({
      merchants: [{ data: { id: "X", pin_hash: "hash", name: "Same" } }],
      customers: [{ data: { id: "X", pin_hash: "hash", name: "Same" } }],
    });
    mockGetAdminClient.mockReturnValue(admin as any);

    const result = await registerNewUser("9841234567", "customer");

    expect(result.success).toBe(false);
    expect(countQuery(admin, "customers", "delete")).toBe(0);
    expect(countQuery(admin, "merchants", "delete")).toBe(0);
  });
});