import { describe, it, expect, beforeEach, vi } from "vitest";
import { updateMerchantProfile } from "./actions";

const { mockFrom, mockCreateClient } = vi.hoisted(() => {
  const mockFrom = vi.fn<() => unknown>();
  const mockCreateClient = vi.fn(() => ({
    from: mockFrom,
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
    },
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn(),
    })),
    removeChannel: vi.fn(),
  }));
  return { mockFrom, mockCreateClient };
});

vi.mock("@/lib/supabase/client", () => ({
  createClient: mockCreateClient,
}));

beforeEach(() => {
  mockFrom.mockReset();
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ exists: false }),
  });
});

describe("updateMerchantProfile", () => {
  it("upserts merchant profile via API and returns it", async () => {
    const updated = {
      id: "m1",
      name: "Shop",
      phone: "+9779841234567",
      business_type: "kirana",
    };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ profile: updated }),
    });

    const result = await updateMerchantProfile("m1", {
      name: "Shop",
      phone: "+9779841234567",
    });
    expect(result.phone).toBe("+9779841234567");
  });

  it("syncs a resolved merchant_id back to localStorage", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({ merchant_id: "m2", profile: { id: "m2", name: "Shop" } }),
    });

    await updateMerchantProfile("m1", { name: "Shop" });
    expect(localStorage.getItem("merchant_id")).toBe("m2");
  });

  it("throws when the API returns an error", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: "Failed to save profile" }),
    });

    await expect(updateMerchantProfile("m1", { name: "Shop" })).rejects.toThrow(
      "Failed to save profile"
    );
  });
});
