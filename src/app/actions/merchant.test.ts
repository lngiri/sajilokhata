import { describe, it, expect, beforeEach, vi } from "vitest";
import { updateCreditLogStatus, resendInvitation } from "./merchant";
import { sendTransactionSMS } from "./sms";
import { verifyOtpCode } from "@/lib/otp";

process.env.SESSION_HMAC_SECRET = "test-secret";

const { mockGetAdminClient, mockCookies, mockVerifySession } = vi.hoisted(() => ({
  mockGetAdminClient: vi.fn(),
  mockCookies: vi.fn(),
  mockVerifySession: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  getAdminClient: mockGetAdminClient,
}));

vi.mock("next/headers", () => ({
  cookies: mockCookies,
}));

vi.mock("@/lib/session", () => ({
  verifySessionToken: mockVerifySession,
  SESSION_COOKIE: "merchant_session",
}));

vi.mock("@/app/actions/notifications", () => ({
  createNotification: vi.fn(),
}));

vi.mock("./sms", () => ({
  sendTransactionSMS: vi.fn(),
}));

function makeAdmin(handlers: Record<string, any[]>) {
  const queues: Record<string, any[]> = {};
  for (const [table, items] of Object.entries(handlers)) {
    queues[table] = [...items];
  }
  const from = vi.fn((table: string) => {
    const builder: any = {
      select: vi.fn(() => builder),
      insert: vi.fn(() => builder),
      update: vi.fn(() => builder),
      eq: vi.fn(() => builder),
      single: vi.fn(() => Promise.resolve(queues[table]?.shift() || { data: null, error: null })),
      maybeSingle: vi.fn(() => Promise.resolve(queues[table]?.shift() || { data: null, error: null })),
    };
    return builder;
  });
  return { from };
}

describe("resendInvitation", () => {
  const smsMock = sendTransactionSMS as unknown as ReturnType<typeof vi.fn>;

  const inviteQueue = [
    {
      data: {
        id: "inv1",
        merchant_id: "m1",
        phone: "+9779841234567",
        status: "sms_failed",
        resend_count: 1,
        last_resent_at: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      },
    },
  ];
  const merchantQueue = [{ data: { id: "m1", business_name: "Kirana Store", name: "Shop" } }];

  beforeEach(() => {
    vi.clearAllMocks();
    smsMock.mockResolvedValue({ success: true });
  });

  it("resends the invitation with the OTP in the SMS and marks it sms_sent", async () => {
    const admin = makeAdmin({
      customer_invites: inviteQueue,
      merchants: merchantQueue,
    });
    mockGetAdminClient.mockReturnValue(admin as any);

    const result = await resendInvitation("m1", "inv1");
    expect(result).toEqual({ success: true });

    expect(smsMock).toHaveBeenCalledWith("9841234567", expect.any(String), "m1");
    const message = smsMock.mock.calls[0][1] as string;
    expect(message).toMatch(/use code \d{6} to register/);
    expect(message).not.toMatch(/https?:\/\//);

    let inviteBuilder: any = null;
    for (let i = 0; i < admin.from.mock.calls.length; i++) {
      if (admin.from.mock.calls[i][0] === "customer_invites" && admin.from.mock.results[i].value.update.mock.calls.length > 0) {
        inviteBuilder = admin.from.mock.results[i].value;
        break;
      }
    }
    const updatePayload = inviteBuilder.update.mock.calls[0][0];
    expect(updatePayload).toMatchObject({
      status: "sms_sent",
      resend_count: 2,
      used_at: null,
    });
    expect(updatePayload.otp).toMatch(/^[a-f0-9]{64}$/);
    expect(verifyOtpCode(message.match(/use code (\d{6})/)![1], updatePayload.otp)).toBe(true);
  });

  it("returns Invitation not found for a bogus invite id", async () => {
    const admin = makeAdmin({
      customer_invites: [{ data: null }],
      merchants: merchantQueue,
    });
    mockGetAdminClient.mockReturnValue(admin as any);

    const result = await resendInvitation("m1", "bogus");
    expect(result).toEqual({ success: false, error: "Invitation not found" });
    expect(smsMock).not.toHaveBeenCalled();
  });

  it("refuses to resend an invitation that is not retryable", async () => {
    const admin = makeAdmin({
      customer_invites: [
        {
          data: {
            id: "inv1",
            merchant_id: "m1",
            phone: "+9779841234567",
            status: "otp_verified",
            resend_count: 0,
            last_resent_at: null,
            expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          },
        },
      ],
      merchants: merchantQueue,
    });
    mockGetAdminClient.mockReturnValue(admin as any);

    const result = await resendInvitation("m1", "inv1");
    expect(result).toEqual({
      success: false,
      error: "Cannot resend invitation in current status",
    });
    expect(smsMock).not.toHaveBeenCalled();
  });
});

describe("updateCreditLogStatus", () => {
  const baseLog = {
    id: "log1",
    merchant_id: "m1",
    initiated_by: "customer",
    status: "awaiting_confirmation",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockCookies.mockResolvedValue({
      get: (name: string) => (name === "merchant_session" ? { value: "tok" } : undefined),
      getAll: vi.fn(() => []),
    });
    mockVerifySession.mockResolvedValue({ userId: "m1" });
  });

  it("throws when there is no merchant session", async () => {
    mockVerifySession.mockResolvedValue(null);
    const admin = makeAdmin({ credit_logs: [{ data: baseLog }] });
    mockGetAdminClient.mockReturnValue(admin as any);

    await expect(updateCreditLogStatus("log1", "approved")).rejects.toThrow("Not logged in");
  });

  it("throws when the log belongs to another merchant", async () => {
    const admin = makeAdmin({
      credit_logs: [{ data: { ...baseLog, merchant_id: "m2" } }],
    });
    mockGetAdminClient.mockReturnValue(admin as any);

    await expect(updateCreditLogStatus("log1", "approved")).rejects.toThrow(
      "You are not authorized to update this entry"
    );
  });

  it("throws when the merchant approves their own merchant-initiated entry", async () => {
    const admin = makeAdmin({
      credit_logs: [{ data: { ...baseLog, initiated_by: "merchant" } }],
    });
    mockGetAdminClient.mockReturnValue(admin as any);

    await expect(updateCreditLogStatus("log1", "approved")).rejects.toThrow(
      "This entry awaits confirmation from the customer"
    );
  });

  it("throws for legacy merchant-initiated entries (null initiated_by)", async () => {
    const admin = makeAdmin({
      credit_logs: [{ data: { ...baseLog, initiated_by: null } }],
    });
    mockGetAdminClient.mockReturnValue(admin as any);

    await expect(updateCreditLogStatus("log1", "rejected")).rejects.toThrow(
      "This entry awaits confirmation from the customer"
    );
  });

  it("throws when the log does not exist", async () => {
    const admin = makeAdmin({ credit_logs: [{ data: null }] });
    mockGetAdminClient.mockReturnValue(admin as any);

    await expect(updateCreditLogStatus("log1", "approved")).rejects.toThrow("Entry not found");
  });

  it("approves a customer-initiated entry owned by the merchant", async () => {
    const updated = { id: "log1", amount: 100, customer_id: "c1", status: "approved" };
    const admin = makeAdmin({
      credit_logs: [
        { data: { ...baseLog, customer_id: "c1" } },
        { data: updated },
      ],
    });
    mockGetAdminClient.mockReturnValue(admin as any);

    const result = await updateCreditLogStatus("log1", "approved");
    expect(result).toMatchObject({ id: "log1", status: "approved" });

    let updateBuilder: any = null;
    for (let i = 0; i < admin.from.mock.calls.length; i++) {
      if (admin.from.mock.calls[i][0] === "credit_logs" && admin.from.mock.results[i].value.update.mock.calls.length > 0) {
        updateBuilder = admin.from.mock.results[i].value;
        break;
      }
    }
    expect(updateBuilder).not.toBeNull();
    const updatePayload = updateBuilder.update.mock.calls[0][0];
    expect(updatePayload).toMatchObject({ status: "approved" });
    expect(updatePayload.approved_at).toBeTruthy();
    expect(updateBuilder.eq.mock.calls[0][0]).toBe("id");
    expect(updateBuilder.eq.mock.calls[0][1]).toBe("log1");
  });

  it("allows the merchant to undo an approval back to awaiting_confirmation", async () => {
    const admin = makeAdmin({
      credit_logs: [
        { data: { ...baseLog, status: "approved" } },
        { data: { id: "log1", status: "awaiting_confirmation" } },
      ],
    });
    mockGetAdminClient.mockReturnValue(admin as any);

    const result = await updateCreditLogStatus("log1", "awaiting_confirmation");
    expect(result).toMatchObject({ id: "log1", status: "awaiting_confirmation" });
  });
});
