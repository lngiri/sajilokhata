import { describe, it, expect, beforeEach, vi } from "vitest";

const dbMock = vi.hoisted(() => ({
  cachePut: vi.fn(),
  cacheGet: vi.fn(),
}));

vi.mock("@/lib/offline/db", () => dbMock);

import { fetchWithCache } from "@/lib/offline/cache";

describe("fetchWithCache", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns fresh data and writes it to the cache", async () => {
    dbMock.cachePut.mockResolvedValue(undefined);
    const fn = vi.fn().mockResolvedValue({ balance: 100 });

    const result = await fetchWithCache("key", fn);

    expect(result).toEqual({ data: { balance: 100 }, stale: false, cachedAt: null });
    expect(dbMock.cachePut).toHaveBeenCalledWith("key", { balance: 100 });
  });

  it("survives cache write failures without affecting the result", async () => {
    dbMock.cachePut.mockRejectedValue(new Error("quota"));
    const fn = vi.fn().mockResolvedValue([1, 2]);

    await expect(fetchWithCache("key", fn)).resolves.toEqual({
      data: [1, 2],
      stale: false,
      cachedAt: null,
    });
  });

  it("falls back to the cached value when the fetch fails", async () => {
    dbMock.cacheGet.mockResolvedValue({ data: { balance: 50 }, savedAt: "2025-01-01T00:00:00Z" });
    const fn = vi.fn().mockRejectedValue(new Error("offline"));

    const result = await fetchWithCache("key", fn);

    expect(result).toEqual({ data: { balance: 50 }, stale: true, cachedAt: "2025-01-01T00:00:00Z" });
  });

  it("rethrows when offline and no cache exists", async () => {
    dbMock.cacheGet.mockResolvedValue(null);
    const fn = vi.fn().mockRejectedValue(new Error("offline"));

    await expect(fetchWithCache("key", fn)).rejects.toThrow("offline");
  });
});
