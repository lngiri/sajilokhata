import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock supabase client
vi.mock("@/lib/supabase/client", () => ({
  createClient: vi.fn(() => ({
    auth: {
      signOut: vi.fn().mockResolvedValue({ error: null }),
      getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
    },
  })),
}));

// Mock clearCachedClient
vi.mock("@/lib/actions", () => ({
  clearCachedClient: vi.fn(),
}));

// Mock clearIndexedDB
vi.mock("@/lib/offline/db", () => ({
  clearIndexedDB: vi.fn().mockResolvedValue(undefined),
}));

describe("signOut", () => {
  const originalLocation = window.location;
  let replaceSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.resetModules();

    // Replace window.location with a mock (proven pattern from customer/dashboard tests)
    replaceSpy = vi.fn();
    delete (window as any).location;
    window.location = {
      ...originalLocation,
      replace: replaceSpy,
      assign: vi.fn(),
      reload: vi.fn(),
    } as any;

    // Set up localStorage with test data
    localStorage.setItem("merchant_id", "test-user-id");
    localStorage.setItem("merchant_phone", "9841000001");
    localStorage.setItem("sw_version", "1.0.0");
    localStorage.setItem("pwa-install-dismissed", "true");

    // Set up sessionStorage
    sessionStorage.setItem("test-key", "test-value");

    // Set up cookies
    document.cookie = "test_cookie=value1; path=/";
    document.cookie = "auth_bypass=true; path=/";
  });

  afterEach(() => {
    window.location = originalLocation;
    vi.restoreAllMocks();
    localStorage.clear();
    sessionStorage.clear();
    document.cookie.split(";").forEach((c) => {
      const name = c.trim().split("=")[0];
      document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC; max-age=0`;
    });
  });

  it("calls window.location.replace('/api/auth/signout')", async () => {
    const { signOut } = await import("./auth");
    await signOut();
    expect(replaceSpy).toHaveBeenCalledWith("/api/auth/signout");
  });

  it("redirect is the LAST operation after all cleanup", async () => {
    const callOrder: string[] = [];
    const { createClient } = await import("@/lib/supabase/client");
    const { clearCachedClient } = await import("@/lib/actions");
    const { clearIndexedDB } = await import("@/lib/offline/db");

    const mockSignOut = vi.fn().mockImplementation(() => {
      callOrder.push("supabase.auth.signOut");
      return Promise.resolve({ error: null });
    });

    (createClient as ReturnType<typeof vi.fn>).mockReturnValue({
      auth: { signOut: mockSignOut },
    });

    (clearCachedClient as ReturnType<typeof vi.fn>).mockImplementation(() => {
      callOrder.push("clearCachedClient");
    });

    (clearIndexedDB as ReturnType<typeof vi.fn>).mockImplementation(() => {
      callOrder.push("clearIndexedDB");
      return Promise.resolve();
    });

    replaceSpy.mockImplementation(() => {
      callOrder.push("window.location.replace");
    });

    const { signOut } = await import("./auth");
    await signOut();

    // redirect should be the last call
    expect(callOrder[callOrder.length - 1]).toBe("window.location.replace");
    // cleanup operations should come before redirect
    expect(callOrder).toContain("supabase.auth.signOut");
    expect(callOrder).toContain("clearCachedClient");
    expect(callOrder).toContain("clearIndexedDB");
  });

  it("supabase.auth.signOut() is fire-and-forget (does not block redirect)", async () => {
    const { createClient } = await import("@/lib/supabase/client");
    // Return a promise that never resolves
    const mockSignOut = vi.fn().mockReturnValue(new Promise(() => {}));

    (createClient as ReturnType<typeof vi.fn>).mockReturnValue({
      auth: { signOut: mockSignOut },
    });

    const { signOut } = await import("./auth");
    await signOut();

    expect(mockSignOut).toHaveBeenCalled();
    // Redirect should still fire even though supabase.auth.signOut() never resolves
    expect(replaceSpy).toHaveBeenCalledWith("/api/auth/signout");
  });

  it("clearIndexedDB() is fire-and-forget (does not block redirect)", async () => {
    const { clearIndexedDB } = await import("@/lib/offline/db");
    // Return a promise that never resolves
    const mockClearIDB = vi.fn().mockReturnValue(new Promise(() => {}));

    (clearIndexedDB as ReturnType<typeof vi.fn>).mockImplementation(mockClearIDB);

    const { signOut } = await import("./auth");
    await signOut();

    expect(mockClearIDB).toHaveBeenCalled();
    expect(replaceSpy).toHaveBeenCalledWith("/api/auth/signout");
  });

  it("clears localStorage but preserves sw_version and pwa-install-dismissed", async () => {
    const { signOut } = await import("./auth");
    await signOut();

    // These should be preserved
    expect(localStorage.getItem("sw_version")).toBe("1.0.0");
    expect(localStorage.getItem("pwa-install-dismissed")).toBe("true");

    // These should be cleared
    expect(localStorage.getItem("merchant_id")).toBeNull();
    expect(localStorage.getItem("merchant_phone")).toBeNull();
  });

  it("does not set sw_version/pwa-dismissed keys if they were not set before", async () => {
    localStorage.clear();
    const { signOut } = await import("./auth");
    await signOut();

    expect(localStorage.getItem("sw_version")).toBeNull();
    expect(localStorage.getItem("pwa-install-dismissed")).toBeNull();
  });

  it("clears sessionStorage", async () => {
    sessionStorage.setItem("important", "data");
    const { signOut } = await import("./auth");
    await signOut();

    expect(sessionStorage.getItem("important")).toBeNull();
  });

  it("clears client-accessible cookies", async () => {
    document.cookie = "my_cookie=hello; path=/";
    const { signOut } = await import("./auth");
    await signOut();

    expect(document.cookie).not.toContain("my_cookie=hello");
  });

  it("redirect fires even if Supabase signOut throws", async () => {
    const { createClient } = await import("@/lib/supabase/client");
    (createClient as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw new Error("Supabase unavailable");
    });

    const { signOut } = await import("./auth");
    await signOut();

    expect(replaceSpy).toHaveBeenCalledWith("/api/auth/signout");
  });

  it("redirect fires even if clearIndexedDB throws", async () => {
    const { clearIndexedDB } = await import("@/lib/offline/db");
    (clearIndexedDB as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("IDB error"));

    const { signOut } = await import("./auth");
    await signOut();

    expect(replaceSpy).toHaveBeenCalledWith("/api/auth/signout");
  });

  it("redirect fires even if localStorage throws", async () => {
    const origClear = localStorage.clear.bind(localStorage);
    localStorage.clear = vi.fn(() => { throw new Error("storage error"); });

    const { signOut } = await import("./auth");
    await signOut();

    expect(replaceSpy).toHaveBeenCalledWith("/api/auth/signout");
    localStorage.clear = origClear;
  });
});
