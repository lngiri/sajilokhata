import { describe, it, expect, beforeEach, vi } from "vitest";
import { resendInvitation } from "./merchant";
import { sendTransactionSMS } from "./sms";

const { mockGetAdminClient } = vi.hoisted(() => ({
  mockGetAdminClient: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  getAdminClient: mockGetAdminClient,
}));

vi.mock("@/lib/session", () => ({
  verifySessionToken: vi.fn(),
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
    expect(message).toMatch(/Your verification code is \d{6}\./);

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
    expect(updatePayload.otp).toMatch(/^\d{6}$/);
    expect(message).toContain(`Your verification code is ${updatePayload.otp}.`);
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
