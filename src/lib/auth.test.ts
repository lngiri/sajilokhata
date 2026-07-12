import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/client", () => ({
  createClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: null },
        error: null,
      }),
    },
  })),
}));

describe("getCurrentUserPhone", () => {
  beforeEach(() => {
    document.cookie = "";
  });

  it("returns null when no auth session and no cookie", async () => {
    const { getCurrentUserPhone } = await import("./auth");
    const result = await getCurrentUserPhone();
    expect(result).toBeNull();
  });

  it("returns phone from auth_bypass_phone cookie as fallback", async () => {
    document.cookie = "auth_bypass_phone=%2B9779841234567; path=/";
    const { getCurrentUserPhone } = await import("./auth");
    const result = await getCurrentUserPhone();
    expect(result).toBe("+9779841234567");
  });
});

describe("getCurrentMerchantId", () => {
  beforeEach(() => {
    localStorage.clear();
    // Reset the module-level cache by clearing the module
    vi.resetModules();
    document.cookie = "";
  });

  it("returns merchant_id from localStorage when Supabase not available", async () => {
    localStorage.setItem("merchant_id", "test-merchant-id");
    const { getCurrentMerchantId } = await import("./auth");
    const result = await getCurrentMerchantId();
    expect(result).toBe("test-merchant-id");
  });

  it("returns null when no session and no localStorage", async () => {
    const { getCurrentMerchantId } = await import("./auth");
    const result = await getCurrentMerchantId();
    expect(result).toBeNull();
  });
});
