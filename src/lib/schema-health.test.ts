import { describe, it, expect, vi } from "vitest";
import {
  checkSchemaHealth,
  diffCheckConstraints,
  fetchCheckConstraints,
} from "./schema-health";

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

describe("diffCheckConstraints", () => {
  it("reports ok when every app value is allowed by the live constraint", () => {
    const actual = {
      credit_logs_status_check: ["awaiting_confirmation", "approved", "disputed", "rejected", "edit_requested"],
      credit_logs_type_check: ["debit", "credit", "cash", "expense", "cash_in"],
      customers_registration_status_check: ["invited", "registered"],
      customer_invites_status_check: ["pending", "sms_sent", "sms_failed", "invitation_opened", "otp_verified", "registration_completed", "expired", "cancelled"],
    };
    expect(diffCheckConstraints(actual)).toEqual([]);
  });

  it("flags when a value the app writes is no longer allowed (the credit_logs regression)", () => {
    const actual = {
      credit_logs_status_check: ["pending", "unverified", "approved", "disputed", "rejected", "edit_requested"],
      credit_logs_type_check: ["debit", "credit", "cash", "expense", "cash_in"],
      customers_registration_status_check: ["invited", "registered"],
      customer_invites_status_check: ["pending", "sms_sent", "sms_failed", "invitation_opened", "otp_verified", "registration_completed", "expired", "cancelled"],
    };
    const problems = diffCheckConstraints(actual);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("credit_logs_status_check");
    expect(problems[0]).toContain("awaiting_confirmation");
  });

  it("flags a missing constraint", () => {
    const problems = diffCheckConstraints({
      credit_logs_status_check: ["awaiting_confirmation"],
    });
    expect(problems.some((p) => p.includes("customer_invites_status_check"))).toBe(true);
  });

  it("ignores extra values the database allows that the app does not know", () => {
    const problems = diffCheckConstraints({
      credit_logs_status_check: ["awaiting_confirmation", "approved", "disputed", "rejected", "edit_requested", "legacy_extra"],
      credit_logs_type_check: ["debit", "credit", "cash", "expense", "cash_in"],
      customers_registration_status_check: ["invited", "registered"],
      customer_invites_status_check: ["pending", "sms_sent", "sms_failed", "invitation_opened", "otp_verified", "registration_completed", "expired", "cancelled"],
    });
    expect(problems).toEqual([]);
  });
});

describe("fetchCheckConstraints", () => {
  it("parses allowed values out of pg_get_constraintdef output", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        { name: "credit_logs_status_check", def: "CHECK ((status = ANY (ARRAY['awaiting_confirmation'::text, 'approved'::text, 'disputed'::text])))" },
        { name: "customers_registration_status_check", def: "CHECK ((registration_status = ANY (ARRAY['invited'::text, 'registered'::text])))" },
      ],
    });
    vi.stubGlobal("fetch", fetchMock);

    try {
      const map = await fetchCheckConstraints("https://smbzejjkymovdetqjski.supabase.co", "sbp_test");
      expect(map["credit_logs_status_check"]).toEqual(["awaiting_confirmation", "approved", "disputed"]);
      expect(map["customers_registration_status_check"]).toEqual(["invited", "registered"]);
      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.query).toContain("credit_logs");
      expect(body.query).toContain("customers");
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("throws when the Management API rejects the request", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 401, text: async () => "unauthorized" })
    );
    try {
      await expect(
        fetchCheckConstraints("https://smbzejjkymovdetqjski.supabase.co", "bad")
      ).rejects.toThrow(/401/);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
