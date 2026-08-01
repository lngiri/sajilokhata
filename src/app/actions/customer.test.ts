import { describe, it, expect, beforeEach, vi } from "vitest";
import { addCustomerForMerchant, submitCustomerEntry } from "./customer";
import { sendTransactionSMS } from "./sms";

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

function findCreditLogsInsert(admin: any) {
  for (let i = 0; i < admin.from.mock.calls.length; i++) {
    if (admin.from.mock.calls[i][0] === "credit_logs") {
      const builder = admin.from.mock.results[i].value;
      if (builder.insert.mock.calls.length > 0) {
        return builder.insert.mock.calls[0][0];
      }
    }
  }
  return null;
}

function findInviteInsert(admin: any) {
  for (let i = 0; i < admin.from.mock.calls.length; i++) {
    if (admin.from.mock.calls[i][0] === "customer_invites") {
      const builder = admin.from.mock.results[i].value;
      if (builder.insert.mock.calls.length > 0) {
        return builder.insert.mock.calls[0][0];
      }
    }
  }
  return null;
}

function findInviteInsertBuilder(admin: any) {
  for (let i = 0; i < admin.from.mock.calls.length; i++) {
    if (admin.from.mock.calls[i][0] === "customer_invites") {
      const builder = admin.from.mock.results[i].value;
      if (builder.insert.mock.calls.length > 0) {
        return builder;
      }
    }
  }
  return null;
}

function findInviteUpdates(admin: any) {
  const updates: any[] = [];
  for (let i = 0; i < admin.from.mock.calls.length; i++) {
    if (admin.from.mock.calls[i][0] === "customer_invites") {
      const builder = admin.from.mock.results[i].value;
      for (const call of builder.update.mock.calls) {
        updates.push(call[0]);
      }
    }
  }
  return updates;
}

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
      is: vi.fn(() => builder),
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
    expect(findCreditLogsInsert(admin)).toMatchObject({
      merchant_id: "m1",
      customer_id: "c1",
      amount: 500,
      type: "debit",
      status: "awaiting_confirmation",
      initiated_by: "customer",
      idempotency_key: "key-1",
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

  it("omits idempotency_key from the insert when none is provided", async () => {
    const admin = makeAdmin({
      merchants: [{ data: { id: "m1", name: "Shop" } }],
      customers: [{ data: { id: "c1", name: "Hari", phone: "+9779841234567" } }],
      merchant_customers: [{ data: { id: "mc1" } }],
      credit_logs: [{ data: { id: "cl1", status: "awaiting_confirmation" } }],
    });
    mockGetAdminClient.mockReturnValue(admin as any);

    const { idempotency_key, ...params } = VALID_PARAMS;
    const result = await submitCustomerEntry(params);
    expect(result.success).toBe(true);

    const payload = findCreditLogsInsert(admin);
    expect(payload).not.toHaveProperty("idempotency_key");
    expect(payload).toMatchObject({
      merchant_id: "m1",
      customer_id: "c1",
      amount: 500,
      type: "debit",
      status: "awaiting_confirmation",
      initiated_by: "customer",
    });
  });

  it("surfaces the postgres error code when the insert fails", async () => {
    const admin = makeAdmin({
      merchants: [{ data: { id: "m1", name: "Shop" } }],
      customers: [{ data: { id: "c1", name: "Hari", phone: "+9779841234567" } }],
      merchant_customers: [{ data: { id: "mc1" } }],
      credit_logs: [
        { data: null },
        {
          data: null,
          error: {
            code: "42703",
            message: "column idempotency_key of relation credit_logs does not exist",
          },
        },
      ],
    });
    mockGetAdminClient.mockReturnValue(admin as any);

    const result = await submitCustomerEntry(VALID_PARAMS);
    expect(result).toEqual({
      success: false,
      error:
        "Database error (42703): column idempotency_key of relation credit_logs does not exist",
    });
  });
});

describe("addCustomerForMerchant", () => {
  const smsMock = sendTransactionSMS as unknown as ReturnType<typeof vi.fn>;

  const merchantQueue = [{ data: { id: "m1", business_name: "Kirana Store", name: "Shop" } }];
  const customerQueue = [{ data: { id: "c1", name: "Hari", phone: "+9779841234567" } }];
  const linkQueue = [{ data: { id: "mc1" } }];

  beforeEach(() => {
    vi.clearAllMocks();
    smsMock.mockResolvedValue({ success: true });
  });

  it("inserts the invite with pending status and the OTP before sending the SMS", async () => {
    const admin = makeAdmin({
      merchants: merchantQueue,
      customers: customerQueue,
      merchant_customers: linkQueue,
      customer_invites: [{ data: null }, { data: { id: "inv1" } }],
    });
    mockGetAdminClient.mockReturnValue(admin as any);

    const result = await addCustomerForMerchant("m1", "9841234567", "Hari");
    expect(result.success).toBe(true);
    expect(result.smsStatus).toBe("sms_sent");
    expect(result.customer).toMatchObject({ id: "c1", registration_status: "invited" });

    const insertPayload = findInviteInsert(admin);
    expect(insertPayload).toMatchObject({
      customer_id: "c1",
      merchant_id: "m1",
      phone: "+9779841234567",
      status: "pending",
    });
    expect(insertPayload.otp).toMatch(/^\d{6}$/);

    const inviteInsertBuilder = findInviteInsertBuilder(admin);
    expect(inviteInsertBuilder.insert.mock.invocationCallOrder[0]).toBeLessThan(
      smsMock.mock.invocationCallOrder[0]
    );
    expect(smsMock.mock.calls[0][0]).toBe("+9779841234567");
    expect(smsMock.mock.calls[0][1]).toContain(
      `Your verification code is ${insertPayload.otp}.`
    );
  });

  it("resets a retryable invite to pending on resend and resends the OTP", async () => {
    const admin = makeAdmin({
      merchants: merchantQueue,
      customers: customerQueue,
      merchant_customers: linkQueue,
      customer_invites: [
        {
          data: {
            id: "inv1",
            status: "sms_failed",
            resend_count: 1,
            last_resent_at: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
            expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          },
        },
      ],
    });
    mockGetAdminClient.mockReturnValue(admin as any);

    const result = await addCustomerForMerchant("m1", "9841234567");
    expect(result.success).toBe(true);

    const updates = findInviteUpdates(admin);
    expect(updates[0]).toMatchObject({
      status: "pending",
      resend_count: 2,
      used_at: null,
    });
    expect(updates[0].otp).toMatch(/^\d{6}$/);
    expect(smsMock.mock.calls[0][1]).toContain(
      `Your verification code is ${updates[0].otp}.`
    );
  });

  it("does not create a duplicate invite when one is already pending", async () => {
    const admin = makeAdmin({
      merchants: merchantQueue,
      customers: customerQueue,
      merchant_customers: linkQueue,
      customer_invites: [
        {
          data: {
            id: "inv1",
            status: "pending",
            resend_count: 0,
            last_resent_at: null,
            expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          },
        },
      ],
    });
    mockGetAdminClient.mockReturnValue(admin as any);

    const result = await addCustomerForMerchant("m1", "9841234567");
    expect(result).toEqual({
      success: false,
      error: "Invitation already sent. Waiting for customer registration.",
    });
    expect(findInviteInsert(admin)).toBeNull();
    expect(smsMock).not.toHaveBeenCalled();
  });

  it("marks the invite sms_failed and reports the error when SMS delivery fails", async () => {
    smsMock.mockResolvedValue({ success: false, error: "SMS provider down" });
    const admin = makeAdmin({
      merchants: merchantQueue,
      customers: customerQueue,
      merchant_customers: linkQueue,
      customer_invites: [{ data: null }, { data: { id: "inv1" } }],
    });
    mockGetAdminClient.mockReturnValue(admin as any);

    const result = await addCustomerForMerchant("m1", "9841234567");
    expect(result.success).toBe(true);
    expect(result.smsStatus).toBe("sms_failed");
    expect(result.smsError).toBe("SMS provider down");

    const updates = findInviteUpdates(admin);
    expect(updates[0]).toMatchObject({ status: "sms_failed", sms_error: "SMS provider down" });
  });
});
