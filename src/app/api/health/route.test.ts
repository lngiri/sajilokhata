import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "./route";

const { mockGetAdminClient, mockCheckSchemaHealth } = vi.hoisted(() => ({
  mockGetAdminClient: vi.fn(),
  mockCheckSchemaHealth: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  getAdminClient: mockGetAdminClient,
}));

vi.mock("@/lib/schema-health", () => ({
  checkSchemaHealth: mockCheckSchemaHealth,
}));

describe("GET /api/health", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.HEALTH_TOKEN;
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
    mockGetAdminClient.mockReturnValue({});
    mockCheckSchemaHealth.mockResolvedValue({
      ok: true,
      missing: [],
      errors: [],
    });
  });

  it("returns 200 with ok:true when schema is healthy", async () => {
    const res = await GET(new Request("http://localhost/api/health"));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.missing).toEqual([]);
  });

  it("returns 500 listing missing objects when schema drifts", async () => {
    mockCheckSchemaHealth.mockResolvedValue({
      ok: false,
      missing: ["credit_logs.idempotency_key"],
      errors: [],
    });

    const res = await GET(new Request("http://localhost/api/health"));
    const json = await res.json();
    expect(res.status).toBe(500);
    expect(json.ok).toBe(false);
    expect(json.missing).toContain("credit_logs.idempotency_key");
  });

  it("returns 500 when supabase env vars are missing", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;

    const res = await GET(new Request("http://localhost/api/health"));
    const json = await res.json();
    expect(res.status).toBe(500);
    expect(json.error).toBe("Supabase env vars missing");
  });

  it("returns 401 when the health token does not match", async () => {
    process.env.HEALTH_TOKEN = "secret-token";

    const res = await GET(new Request("http://localhost/api/health"));
    expect(res.status).toBe(401);
  });

  it("accepts a matching health token via query param", async () => {
    process.env.HEALTH_TOKEN = "secret-token";

    const res = await GET(new Request("http://localhost/api/health?token=secret-token"));
    expect(res.status).toBe(200);
  });

  it("accepts a matching health token via header", async () => {
    process.env.HEALTH_TOKEN = "secret-token";

    const res = await GET(
      new Request("http://localhost/api/health", {
        headers: { "x-health-token": "secret-token" },
      })
    );
    expect(res.status).toBe(200);
  });
});
