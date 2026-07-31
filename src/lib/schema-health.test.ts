import { describe, it, expect, vi } from "vitest";
import { checkSchemaHealth } from "./schema-health";

function makeAdmin(handler: (table: string, column?: string) => any) {
  return {
    from: vi.fn((table: string) => {
      const builder: any = {
        select: vi.fn((column: string) => {
          builder.__result = handler(table, column === "*" ? undefined : column);
          return builder;
        }),
        limit: vi.fn(() => Promise.resolve(builder.__result)),
      };
      return builder;
    }),
  };
}

describe("checkSchemaHealth", () => {
  it("reports ok when every table and column exists", async () => {
    const admin = makeAdmin(() => ({ data: [], error: null }));
    const result = await checkSchemaHealth(admin as any);
    expect(result.ok).toBe(true);
    expect(result.missing).toEqual([]);
    expect(result.errors).toEqual([]);
  });

  it("reports a missing column with the 42703 error code", async () => {
    const admin = makeAdmin((table, column) => {
      if (table === "credit_logs" && column === "idempotency_key") {
        return { data: null, error: { code: "42703", message: 'column "idempotency_key" of relation "credit_logs" does not exist' } };
      }
      return { data: [], error: null };
    });
    const result = await checkSchemaHealth(admin as any);
    expect(result.ok).toBe(false);
    expect(result.missing).toEqual(["credit_logs.idempotency_key"]);
  });

  it("reports a missing table with the 42P01 error code", async () => {
    const admin = makeAdmin((table) => {
      if (table === "rate_limits") {
        return { data: null, error: { code: "42P01", message: 'relation "rate_limits" does not exist' } };
      }
      return { data: [], error: null };
    });
    const result = await checkSchemaHealth(admin as any);
    expect(result.ok).toBe(false);
    expect(result.missing).toContain("rate_limits");
  });

  it("reports connectivity errors separately", async () => {
    const admin = makeAdmin(() => ({
      data: null,
      error: { code: "PGRST301", message: "Database connection refused" },
    }));
    const result = await checkSchemaHealth(admin as any);
    expect(result.ok).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.missing).toEqual([]);
  });
});
