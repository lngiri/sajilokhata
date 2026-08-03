import { describe, it, expect, beforeEach, vi } from "vitest";
import { updateEntryAttachment } from "./entry";

const { mockGetAdminClient, mockRequireMerchant } = vi.hoisted(() => ({
  mockGetAdminClient: vi.fn(),
  mockRequireMerchant: vi.fn(),
}));

vi.mock("@/app/actions/merchant", () => ({
  requireMerchant: mockRequireMerchant,
}));

vi.mock("@/lib/supabase/admin", () => ({
  getAdminClient: mockGetAdminClient,
}));

vi.mock("@/app/actions/notifications", () => ({
  createNotification: vi.fn(),
}));

vi.mock("@/lib/session", () => ({
  verifySessionToken: vi.fn(),
  verifyCustomerSessionToken: vi.fn(),
  SESSION_COOKIE: "session",
}));

function makeAdmin(entry?: any) {
  const builder: any = {
    select: vi.fn(() => builder),
    update: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    maybeSingle: vi.fn(() => Promise.resolve({ data: entry ?? null, error: null })),
  };
  return { from: vi.fn(() => builder) } as any;
}

describe("updateEntryAttachment security", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects when there is no merchant session", async () => {
    mockRequireMerchant.mockRejectedValue(new Error("Not logged in"));
    mockGetAdminClient.mockReturnValue(makeAdmin({ merchant_id: "m1" }));
    const result = await updateEntryAttachment("e1", "https://x/y.jpg");
    expect(result.success).toBe(false);
    expect(result.error).toBe("Not logged in");
  });

  it("rejects a non-existent entry", async () => {
    mockRequireMerchant.mockResolvedValue("m1");
    mockGetAdminClient.mockReturnValue(makeAdmin(null));
    const result = await updateEntryAttachment("e1", "https://x/y.jpg");
    expect(result.success).toBe(false);
    expect(result.error).toBe("Entry not found");
  });

  it("rejects when the entry belongs to another merchant", async () => {
    mockRequireMerchant.mockResolvedValue("m1");
    mockGetAdminClient.mockReturnValue(makeAdmin({ merchant_id: "m2" }));
    const result = await updateEntryAttachment("e1", "https://x/y.jpg");
    expect(result.success).toBe(false);
    expect(result.error).toBe("Not authorized to update this entry");
  });

  it("updates the attachment for an owned entry", async () => {
    mockRequireMerchant.mockResolvedValue("m1");
    const admin = makeAdmin({ merchant_id: "m1" });
    mockGetAdminClient.mockReturnValue(admin);
    const result = await updateEntryAttachment("e1", "https://x/y.jpg");
    expect(result.success).toBe(true);

    const builder = admin.from.mock.results[0].value;
    expect(builder.update).toHaveBeenCalledWith({ attachment_url: "https://x/y.jpg" });
    expect(builder.eq).toHaveBeenCalledWith("id", "e1");
  });
});
