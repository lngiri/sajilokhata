import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  findOrCreateCustomer,
  linkCustomerToMerchant,
  createCreditLog,
  getMerchantCreditLogs,
  updateCreditLogStatus,
  getMerchantCustomers,
  updateCustomerCreditLimit,
  getMerchantByPhone,
  getCustomerStats,
  getCustomerCreditLogs,
  getMerchantStats,
  getMerchantProfile,
  updateMerchantProfile,
} from "./actions";

const { mockFrom, mockCreateClient } = vi.hoisted(() => {
  const mockFrom = vi.fn<() => unknown>();
  const mockCreateClient = vi.fn(() => ({
    from: mockFrom,
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

function __resetMocks() {
  mockFrom.mockReset();
}

function makeBuilder(result?: unknown) {
  const then = vi.fn((resolve: any) =>
    resolve(result || { data: [], error: null })
  );
  const builder = {
    select: vi.fn(() => builder),
    insert: vi.fn(() => builder),
    update: vi.fn(() => builder),
    upsert: vi.fn(() => builder),
    delete: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    in: vi.fn(() => builder),
    order: vi.fn(() => builder),
    range: vi.fn(() => builder),
    single: vi.fn().mockResolvedValue(result),
    maybeSingle: vi.fn().mockResolvedValue(result),
    gte: vi.fn(() => builder),
    then,
  };
  return builder;
}

function mockQueryResult(result: unknown) {
  mockFrom.mockReturnValue(makeBuilder(result));
}

beforeEach(() => {
  __resetMocks();
});

describe("findOrCreateCustomer", () => {
  it("returns existing customer when found by phone", async () => {
    const existing = { id: "c1", phone: "9841234567", name: "Hari" };
    mockQueryResult({ data: existing, error: null });

    const result = await findOrCreateCustomer("9841234567");
    expect(result).toEqual(existing);
  });

  it("creates a new customer when phone not found", async () => {
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    });

    const created = { id: "c2", phone: "9841234567", name: "Hari" };
    mockFrom.mockReturnValueOnce({
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: created, error: null }),
    });

    const result = await findOrCreateCustomer("9841234567", "Hari");
    expect(result).toEqual(created);
  });

  it("throws on DB error", async () => {
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockRejectedValue(new Error("DB down")),
    });

    await expect(findOrCreateCustomer("9841234567")).rejects.toThrow("DB down");
  });
});

describe("linkCustomerToMerchant", () => {
  it("returns existing link when already linked", async () => {
    const existing = {
      id: "mc1",
      merchant_id: "m1",
      customer_id: "c1",
      credit_limit: 5000,
      current_balance: 0,
    };
    mockQueryResult({ data: existing, error: null });

    const result = await linkCustomerToMerchant("m1", "c1");
    expect(result).toEqual(existing);
  });

  it("creates new link when not existing", async () => {
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    });

    const created = {
      id: "mc2",
      merchant_id: "m1",
      customer_id: "c1",
      credit_limit: 5000,
      current_balance: 0,
    };
    mockFrom.mockReturnValueOnce({
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: created, error: null }),
    });

    const result = await linkCustomerToMerchant("m1", "c1", 10000);
    expect(result).toEqual(created);
  });
});

describe("createCreditLog", () => {
  it("inserts a credit log and returns it", async () => {
    const log = {
      merchant_id: "m1",
      customer_id: "c1",
      amount: 500,
      type: "debit",
      status: "pending",
    };
    const created = { id: "cl1", ...log };
    mockQueryResult({ data: created, error: null });

    const result = await createCreditLog(log);
    expect(result).toEqual(created);
  });
});

describe("getMerchantCreditLogs", () => {
  it("returns credit logs with filters", async () => {
    const logs = [
      {
        id: "cl1",
        amount: 500,
        status: "pending",
        customers: { name: "Hari", phone: "9841234567" },
      },
    ];
    mockQueryResult({ data: logs, error: null });

    const result = await getMerchantCreditLogs("m1", { status: "pending" });
    expect(result).toEqual(logs);
  });

  it("returns empty array when no logs", async () => {
    mockQueryResult({ data: null, error: null });

    const result = await getMerchantCreditLogs("m1");
    expect(result).toEqual([]);
  });
});

describe("updateCreditLogStatus", () => {
  it("updates status to approved and creates audit log", async () => {
    const updated = { id: "cl1", status: "approved", approved_at: expect.any(String) };
    mockQueryResult({ data: updated, error: null });

    mockFrom.mockReturnValueOnce({
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: updated, error: null }),
    });

    mockFrom.mockReturnValueOnce({
      insert: vi.fn().mockResolvedValue({ error: null }),
    });

    const result = await updateCreditLogStatus("cl1", "approved");
    expect(result.status).toBe("approved");
  });
});

describe("getMerchantCustomers", () => {
  it("returns merchant customers with balance computed from credit_logs", async () => {
    const customers = [
      {
        id: "mc1",
        customer_id: "c1",
        credit_limit: 5000,
        current_balance: 1000,
        customers: { id: "c1", name: "Hari", phone: "9841234567" },
      },
    ];
    const approvedLogs = [
      { customer_id: "c1", amount: 800, type: "debit" },
      { customer_id: "c1", amount: 300, type: "credit" },
    ];

    mockFrom
      .mockReturnValueOnce(makeBuilder({ data: customers, error: null }))
      .mockReturnValueOnce(makeBuilder({ data: approvedLogs, error: null }));

    const result = await getMerchantCustomers("m1");
    expect(result).toHaveLength(1);
    expect(result[0].current_balance).toBe(500); // 800 debit - 300 credit
  });
});

describe("updateCustomerCreditLimit", () => {
  it("updates credit limit and returns updated record", async () => {
    const updated = {
      merchant_id: "m1",
      customer_id: "c1",
      credit_limit: 10000,
    };

    const builder = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: updated, error: null }),
    };
    mockFrom.mockReturnValue(builder);

    const result = await updateCustomerCreditLimit("m1", "c1", 10000);
    expect(result.credit_limit).toBe(10000);
  });
});

describe("getMerchantProfile", () => {
  it("returns merchant profile by id", async () => {
    const profile = {
      id: "m1",
      name: "Shop",
      phone: "+9779841234567",
      business_type: "kirana",
      business_name: "Shop ABC",
      address: "Kathmandu",
    };
    mockQueryResult({ data: profile, error: null });

    const result = await getMerchantProfile("m1");
    expect(result).toEqual(profile);
  });

  it("throws when merchant not found", async () => {
    mockQueryResult({ data: null, error: new Error("Not found") });

    await expect(getMerchantProfile("m1")).rejects.toThrow();
  });
});

describe("updateMerchantProfile", () => {
  it("upserts merchant profile with phone", async () => {
    const updated = {
      id: "m1",
      name: "Shop",
      phone: "+9779841234567",
      business_type: "kirana",
    };
    mockQueryResult({ data: updated, error: null });

    const result = await updateMerchantProfile("m1", {
      name: "Shop",
      phone: "+9779841234567",
    });
    expect(result.phone).toBe("+9779841234567");
  });

  it("upserts merchant profile without phone uses existing value", async () => {
    const updated = {
      id: "m1",
      name: "Shop",
      phone: "+9779841234567",
      business_type: "kirana",
    };
    mockQueryResult({ data: updated, error: null });

    const result = await updateMerchantProfile("m1", {
      name: "Shop",
    });
    expect(result.phone).toBe("+9779841234567");
  });
});

describe("getMerchantByPhone", () => {
  it("returns merchant found by phone", async () => {
    const merchant = {
      id: "m1",
      name: "Shop",
      business_name: "Shop ABC",
      business_type: "kirana",
      phone: "9812345678",
    };
    mockQueryResult({ data: merchant, error: null });

    const result = await getMerchantByPhone("9812345678");
    expect(result).toEqual(merchant);
  });

  it("returns null when no merchant found", async () => {
    mockQueryResult({ data: null, error: null });

    const result = await getMerchantByPhone("9812345678");
    expect(result).toBeNull();
  });
});

describe("getCustomerStats", () => {
  it("returns aggregated stats for a customer from credit_logs", async () => {
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      then: vi.fn((resolve: any) =>
        resolve({ data: [{ id: "c1" }, { id: "c2" }], error: null })
      ),
    });

    const relationships = [
      {
        credit_limit: 5000,
        merchants: { id: "m1", name: "Shop", business_name: "Shop ABC" },
      },
    ];
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      then: vi.fn((resolve: any) =>
        resolve({ data: relationships, error: null })
      ),
    });

    const approvedLogs = [
      { merchant_id: "m1", amount: 800, type: "debit" },
      { merchant_id: "m1", amount: 300, type: "credit" },
    ];
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      then: vi.fn((resolve: any) =>
        resolve({ data: approvedLogs, error: null })
      ),
    });

    const result = await getCustomerStats("9841234567");
    expect(result).toEqual({
      totalOutstanding: 500,  // 800 (debit) - 300 (credit)
      shopsCount: 1,
      totalCreditLimit: 5000,
      relationships: [
        { credit_limit: 5000, merchants: { id: "m1", name: "Shop", business_name: "Shop ABC" }, current_balance: 500 },
      ],
    });
  });

  it("returns null when customer not found", async () => {
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      then: vi.fn((resolve: any) =>
        resolve({ data: null, error: null })
      ),
    });

    const result = await getCustomerStats("9841234567");
    expect(result).toBeNull();
  });
});

describe("getCustomerCreditLogs", () => {
  it("returns credit logs for a customer", async () => {
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      then: vi.fn((resolve: any) =>
        resolve({ data: [{ id: "c1" }], error: null })
      ),
    });

    const logs = [
      {
        id: "cl1",
        amount: 500,
        status: "approved",
        customers: { name: "Hari", phone: "9841234567" },
        merchants: { id: "m1", name: "Shop", business_name: "Shop ABC" },
      },
    ];
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      then: vi.fn((resolve: any) =>
        resolve({ data: logs, error: null })
      ),
    });

    const result = await getCustomerCreditLogs("9841234567");
    expect(result).toEqual(logs);
  });
});

describe("complete customer submission data flow", () => {
  it("chains findOrCreateCustomer → linkCustomerToMerchant → createCreditLog with correct FK references", async () => {
    const customerPhone = "9841234567";
    const customerName = "Hari";
    const merchantId = "m1";
    const createdCustomer = { id: "c1", phone: customerPhone, name: customerName };

    // Step 1: findOrCreateCustomer — new customer
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    });
    mockFrom.mockReturnValueOnce({
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: createdCustomer, error: null }),
    });

    const customer = await findOrCreateCustomer(customerPhone, customerName);
    expect(customer).toEqual(createdCustomer);

    // Step 2: linkCustomerToMerchant — new link
    const createdLink = {
      id: "mc1",
      merchant_id: merchantId,
      customer_id: customer.id,
      credit_limit: 5000,
      current_balance: 0,
    };
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    });
    mockFrom.mockReturnValueOnce({
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: createdLink, error: null }),
    });

    const link = await linkCustomerToMerchant(merchantId, customer.id);
    expect(link.merchant_id).toBe(merchantId);
    expect(link.customer_id).toBe(customer.id);

    // Step 3: createCreditLog
    const logEntry = {
      merchant_id: merchantId,
      customer_id: customer.id,
      amount: 500,
      description: "Rice 10kg",
      type: "debit" as const,
      status: "pending" as const,
      sync_status: "online" as const,
    };
    const createdLog = { id: "cl1", ...logEntry };
    mockFrom.mockReturnValueOnce({
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: createdLog, error: null }),
    });

    const log = await createCreditLog(logEntry);
    expect(log.merchant_id).toBe(merchantId);
    expect(log.customer_id).toBe(customer.id);
    expect(log.amount).toBe(500);
    expect(log.type).toBe("debit");
    expect(log.status).toBe("pending");

    // Verify all three operations reference the same merchant and customer
    expect(log.merchant_id).toBe(link.merchant_id);
    expect(log.customer_id).toBe(link.customer_id);
  });

  it("reuses existing customer and link when they already exist", async () => {
    const phone = "9841234567";
    const merchantId = "m1";
    const existingCustomer = { id: "c1", phone, name: "Hari" };

    // Step 1: findOrCreateCustomer — already exists
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: existingCustomer, error: null }),
    });

    const customer = await findOrCreateCustomer(phone);
    expect(customer).toEqual(existingCustomer);

    // Step 2: linkCustomerToMerchant — already linked
    const existingLink = {
      id: "mc1",
      merchant_id: merchantId,
      customer_id: customer.id,
      credit_limit: 5000,
      current_balance: 0,
    };
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: existingLink, error: null }),
    });

    const link = await linkCustomerToMerchant(merchantId, customer.id);
    expect(link).toEqual(existingLink);

    // Step 3: createCreditLog
    const logEntry = {
      merchant_id: merchantId,
      customer_id: customer.id,
      amount: 200,
      description: null,
      type: "debit" as const,
      status: "pending" as const,
      sync_status: "online" as const,
    };
    const createdLog = { id: "cl2", ...logEntry };
    mockFrom.mockReturnValueOnce({
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: createdLog, error: null }),
    });

    const log = await createCreditLog(logEntry);
    expect(log.merchant_id).toBe(merchantId);
    expect(log.customer_id).toBe(customer.id);
  });
});

describe("getMerchantStats", () => {
  it("returns aggregated merchant statistics from credit_logs", async () => {
    const customers = [
      { credit_limit: 5000 },
      { credit_limit: 3000 },
    ];
    const pendingLogs = [{ id: "cl1", amount: 200 }];
    const approvedLogs = [
      { amount: 1500, type: "debit" },
      { amount: 500, type: "credit" },
    ];
    const todayLogs = [
      { id: "cl2", amount: 500, type: "debit" },
      { id: "cl3", amount: 100, type: "credit" },
    ];

    const builder = (data: unknown) => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      then: vi.fn((resolve: any) => resolve({ data, error: null })),
    });

    mockFrom
      .mockReturnValueOnce(builder(customers))
      .mockReturnValueOnce(builder(pendingLogs))
      .mockReturnValueOnce(builder(approvedLogs))
      .mockReturnValueOnce(builder(todayLogs));

    const result = await getMerchantStats("m1");
    expect(result).toEqual({
      totalOutstanding: 1000,   // 1500 (debit) - 500 (credit)
      totalCreditLimit: 8000,   // 5000 + 3000
      customerCount: 2,
      pendingCount: 1,
      todayTotal: 400,          // 500 (debit) - 100 (credit)
    });
  });
});
