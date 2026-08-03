import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  getMerchantProducts,
  getAllMerchantProducts,
  createMerchantProduct,
  updateMerchantProduct,
  deleteMerchantProduct,
} from "./products";

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

interface AdminOpts {
  existing?: any;
  existingQueue?: any[];
  singleData?: any;
}

function makeAdmin(opts: AdminOpts = {}) {
  const queue = [...(opts.existingQueue ?? [])];
  if (opts.existing !== undefined) queue.unshift(opts.existing);
  const builder: any = {
    select: vi.fn(() => builder),
    insert: vi.fn(() => builder),
    update: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    ilike: vi.fn(() => builder),
    neq: vi.fn(() => builder),
    order: vi.fn(() => builder),
    maybeSingle: vi.fn(() =>
      Promise.resolve(queue.length > 0 ? { data: queue.shift(), error: null } : { data: null, error: null })
    ),
    single: vi.fn(() =>
      Promise.resolve({ data: opts.singleData ?? null, error: null })
    ),
    then: (resolve: (v: any) => any) => resolve({ data: null, error: null }),
  };
  return { admin: { from: vi.fn(() => builder) } as any, builder };
}

function findUpdate(admin: any, table: string) {
  const calls = admin.from.mock.calls as any[];
  for (let i = 0; i < calls.length; i++) {
    if (calls[i][0] === table && admin.from.mock.results[i].value.update.mock.calls.length > 0) {
      return admin.from.mock.results[i].value.update;
    }
  }
  return null;
}

describe("products actions security hardening", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAdminClient.mockReturnValue(makeAdmin().admin);
  });

  it("rejects create when there is no session", async () => {
    mockRequireMerchant.mockImplementation(() => {
      throw new Error("Not logged in");
    });
    await expect(
      createMerchantProduct({ merchant_id: "m1", name: "Milk", default_rate: 100 })
    ).rejects.toThrow("Not logged in");
    expect(mockGetAdminClient).not.toHaveBeenCalled();
  });

  it("rejects create when session merchant differs from payload merchant_id", async () => {
    mockRequireMerchant.mockResolvedValue("m2");
    await expect(
      createMerchantProduct({ merchant_id: "m1", name: "Milk", default_rate: 100 })
    ).rejects.toThrow("Not logged in");
  });

  it("rejects a blank product name server-side", async () => {
    mockRequireMerchant.mockResolvedValue("m1");
    await expect(
      createMerchantProduct({ merchant_id: "m1", name: "   ", default_rate: 100 })
    ).rejects.toThrow("Product name is required");
  });

  it("rejects a negative rate server-side", async () => {
    mockRequireMerchant.mockResolvedValue("m1");
    await expect(
      createMerchantProduct({ merchant_id: "m1", name: "Milk", default_rate: -5 })
    ).rejects.toThrow("Rate must be a non-negative number");
  });

  it("allows a zero rate", async () => {
    mockRequireMerchant.mockResolvedValue("m1");
    const { admin } = makeAdmin({ singleData: { id: "p1" } });
    mockGetAdminClient.mockReturnValue(admin);
    const result = await createMerchantProduct({ merchant_id: "m1", name: "Milk", default_rate: 0 });
    expect(result).toMatchObject({ id: "p1" });
  });

  it("rejects a duplicate product name (case-insensitive)", async () => {
    mockRequireMerchant.mockResolvedValue("m1");
    const { admin } = makeAdmin({ existing: { id: "existing" } });
    mockGetAdminClient.mockReturnValue(admin);
    await expect(
      createMerchantProduct({ merchant_id: "m1", name: "milk", default_rate: 100 })
    ).rejects.toThrow("A product with this name already exists");
  });

  it("trims name and normalizes empty category to null on create", async () => {
    mockRequireMerchant.mockResolvedValue("m1");
    const { admin } = makeAdmin({ singleData: { id: "p1" } });
    mockGetAdminClient.mockReturnValue(admin);
    await createMerchantProduct({
      merchant_id: "m1",
      name: "  Milk  ",
      default_rate: 100,
      category: "   ",
    });
    const insertCalls = admin.from.mock.calls as any[];
    let payload: any = null;
    for (let i = 0; i < insertCalls.length; i++) {
      if (insertCalls[i][0] === "merchant_products" && admin.from.mock.results[i].value.insert.mock.calls.length > 0) {
        payload = admin.from.mock.results[i].value.insert.mock.calls[0][0];
      }
    }
    expect(payload).toMatchObject({ name: "Milk", merchant_id: "m1", category: null });
  });

  it("rejects update when the product belongs to another merchant", async () => {
    mockRequireMerchant.mockResolvedValue("m1");
    const { admin } = makeAdmin({ existing: { id: "p1", merchant_id: "m2" } });
    mockGetAdminClient.mockReturnValue(admin);
    await expect(
      updateMerchantProduct("p1", { default_rate: 50 })
    ).rejects.toThrow("You are not authorized to modify this product");
  });

  it("rejects update when the product does not exist", async () => {
    mockRequireMerchant.mockResolvedValue("m1");
    await expect(
      updateMerchantProduct("p1", { default_rate: 50 })
    ).rejects.toThrow("Product not found");
  });

  it("uses neq(id) when checking duplicate names on update", async () => {
    mockRequireMerchant.mockResolvedValue("m1");
    const { admin } = makeAdmin({ existingQueue: [{ id: "p1", merchant_id: "m1" }, { id: "other" }] });
    mockGetAdminClient.mockReturnValue(admin);
    await expect(
      updateMerchantProduct("p1", { name: "Milk" })
    ).rejects.toThrow("A product with this name already exists");

    const calls = admin.from.mock.calls as any[];
    let hasNeq = false;
    for (let i = 0; i < calls.length; i++) {
      if (calls[i][0] === "merchant_products") {
        const b = admin.from.mock.results[i].value;
        if (b.neq.mock.calls.some((c: any) => c[0] === "id" && c[1] === "p1")) hasNeq = true;
      }
    }
    expect(hasNeq).toBe(true);
  });

  it("updates category to null to allow clearing", async () => {
    mockRequireMerchant.mockResolvedValue("m1");
    const { admin } = makeAdmin({ existingQueue: [{ id: "p1", merchant_id: "m1" }, null], singleData: { id: "p1" } });
    mockGetAdminClient.mockReturnValue(admin);
    await updateMerchantProduct("p1", { category: null, name: "Milk", default_rate: 100 });
    const updater = findUpdate(admin, "merchant_products");
    expect(updater).not.toBeNull();
    expect(updater.mock.calls[0][0]).toMatchObject({ category: null, name: "Milk" });
  });

  it("deletes by soft-deactivating the product", async () => {
    mockRequireMerchant.mockResolvedValue("m1");
    const { admin } = makeAdmin({ existing: { id: "p1", merchant_id: "m1" } });
    mockGetAdminClient.mockReturnValue(admin);
    await deleteMerchantProduct("p1");
    const updater = findUpdate(admin, "merchant_products");
    expect(updater).not.toBeNull();
    expect(updater.mock.calls[0][0]).toEqual({ is_active: false });
  });

  it("rejects listing when session merchant differs", async () => {
    mockRequireMerchant.mockResolvedValue("m1");
    await expect(getMerchantProducts("m2")).rejects.toThrow("Not logged in");
    await expect(getAllMerchantProducts("m2")).rejects.toThrow("Not logged in");
  });

  it("rejects listing when not logged in", async () => {
    mockRequireMerchant.mockImplementation(() => {
      throw new Error("Not logged in");
    });
    await expect(getMerchantProducts("m1")).rejects.toThrow("Not logged in");
  });
});
