import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { sendTransactionSMS } from "./sms";

vi.mock("@/lib/supabase/admin", () => ({
  getAdminClient: vi.fn(() => null),
}));

function stubFetch(body: unknown) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    text: async () => JSON.stringify(body),
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("sendTransactionSMS", () => {
  beforeEach(() => {
    vi.stubEnv("AAKASH_SMS_TOKEN", "test-token");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("treats a content-review response as accepted instead of a hard failure", async () => {
    const fetchMock = stubFetch({
      error: false,
      message: "1 message(s) submitted for admin content review. They will be delivered after approval.",
      data: { url_review_batch_id: "batch-1", pending_count: 1 },
    });

    const result = await sendTransactionSMS("9847585081", "Open QRhisab and use code 123456 to register.");
    expect(result).toEqual({ success: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("reports rejected recipients instead of silently passing", async () => {
    stubFetch({
      error: false,
      message: "1 messages has been queued for delivery.",
      data: { valid: [], invalid: [{ mobile: "9771111111111", status: "aborted" }] },
    });

    const result = await sendTransactionSMS("1111111111", "test");
    expect(result.success).toBe(false);
    expect(result.error).toContain("Could not send SMS to this number");
  });

  it("returns success for a normal queued delivery", async () => {
    stubFetch({
      error: false,
      message: "1 messages has been queued for delivery.",
      data: { valid: [{ mobile: "9779847585081", status: "queued" }], invalid: [] },
    });

    const result = await sendTransactionSMS("9847585081", "test");
    expect(result).toEqual({ success: true });
  });

  it("fails fast when the token is missing", async () => {
    vi.stubEnv("AAKASH_SMS_TOKEN", "");
    const result = await sendTransactionSMS("9847585081", "test");
    expect(result).toEqual({ success: false, error: "AAKASH_SMS_TOKEN not configured" });
  });
});
