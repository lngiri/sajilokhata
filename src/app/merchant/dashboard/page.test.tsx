import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import MerchantsDashboard from "./page";

vi.mock("@/lib/supabase/client", () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      then: vi.fn((resolve: any) =>
        resolve({ data: [{ id: "m1" }], error: null })
      ),
    })),
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn(),
    })),
    removeChannel: vi.fn(),
  })),
}));

vi.mock("@/components/QRCode", () => ({
  QRDisplay: ({ merchantId, merchantName, businessType }: any) => (
    <div data-testid="qr-display">
      <span>{merchantName}</span>
    </div>
  ),
}));

vi.mock("@/components/Toast", () => ({
  useToast: () => ({ addToast: vi.fn() }),
}));

vi.mock("@/components/SyncStatus", () => ({
  default: () => <div data-testid="sync-status">Sync</div>,
}));

vi.mock("@/components/PullToRefresh", () => ({
  default: ({ children }: any) => <>{children}</>,
}));

vi.mock("@/components/BottomNav", () => ({
  default: () => <div data-testid="bottom-nav">Nav</div>,
}));

vi.mock("@/lib/actions", () => ({
  getMerchantStats: vi.fn(),
  getMerchantCreditLogs: vi.fn(),
  getMerchantProfile: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  getCurrentMerchantId: vi.fn(),
}));

const mockActions = await import("@/lib/actions");
const mockAuth = await import("@/lib/auth");

const mockStats = {
  totalOutstanding: 2500,
  totalCreditLimit: 15000,
  customerCount: 3,
  pendingCount: 2,
  todayTotal: 800,
  totalCashSales: 500,
  totalSales: 1300,
  cashInHand: 700,
};

const pendingLogs = [
  {
    id: "cl1",
    amount: 500,
    type: "debit",
    status: "pending",
    description: "Rice 10kg",
    created_at: "2025-01-15T10:00:00Z",
    customers: { name: "Hari", phone: "9841234567" },
  },
];

const activityLogs = [
  {
    id: "cl2",
    amount: 200,
    type: "debit",
    status: "approved",
    description: "Milk 2L",
    created_at: "2025-01-14T10:00:00Z",
    customers: { name: "Shyam", phone: "9847654321" },
  },
  {
    id: "cl1",
    amount: 500,
    type: "debit",
    status: "pending",
    description: "Rice 10kg",
    created_at: "2025-01-15T10:00:00Z",
    customers: { name: "Hari", phone: "9841234567" },
  },
];

describe("MerchantDashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(mockAuth.getCurrentMerchantId).mockResolvedValue("m1");
    vi.mocked(mockActions.getMerchantStats).mockResolvedValue(mockStats);
    vi.mocked(mockActions.getMerchantCreditLogs).mockImplementation(
      (_id: string, options?: { status?: string }) => {
        if (options?.status === "pending") return Promise.resolve(pendingLogs);
        return Promise.resolve(activityLogs);
      }
    );
    vi.mocked(mockActions.getMerchantProfile).mockResolvedValue({
      id: "m1",
      name: "Shop ABC",
      business_type: "kirana",
    });
  });

  it("renders stats cards after loading", async () => {
    render(<MerchantsDashboard />);

    await waitFor(() => {
      expect(screen.getByText("QR Hisab")).toBeInTheDocument();
    });

    expect(screen.getByText("Outstanding")).toBeInTheDocument();
    expect(screen.getByText("Today")).toBeInTheDocument();
    expect(screen.getByText("Customers")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("Pending")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("renders quick action buttons", async () => {
    render(<MerchantsDashboard />);

    await waitFor(() => {
      expect(screen.getByText("QR Hisab")).toBeInTheDocument();
    });

    const scanLink = screen.getByText("Scan QR").closest("a");
    expect(scanLink).toHaveAttribute("href", "/merchant/scan");

    expect(screen.getByText("Show QR")).toBeInTheDocument();

    const ledgerLink = screen.getByText("Ledger").closest("a");
    expect(ledgerLink).toHaveAttribute("href", "/merchant/logs");
  });

  it("shows recent activity entries", async () => {
    render(<MerchantsDashboard />);

    await waitFor(() => {
      expect(screen.getByText("Recent Activity")).toBeInTheDocument();
    });

    expect(screen.getByText("Shyam")).toBeInTheDocument();
    expect(screen.getByText("Milk 2L")).toBeInTheDocument();
    expect(screen.getAllByText("Rice 10kg").length).toBeGreaterThan(0);
  });

  it("shows pending approvals section with count badge", async () => {
    render(<MerchantsDashboard />);

    await waitFor(() => {
      expect(screen.getByText("Pending Approvals")).toBeInTheDocument();
    });

    expect(screen.getByText("1")).toBeInTheDocument();
  });

  it("shows empty state when no activity", async () => {
    vi.mocked(mockActions.getMerchantStats).mockResolvedValue({
      ...mockStats,
      pendingCount: 0,
    });
    vi.mocked(mockActions.getMerchantCreditLogs).mockResolvedValue([]);

    render(<MerchantsDashboard />);

    await waitFor(() => {
      expect(screen.getByText("No activity yet")).toBeInTheDocument();
    });
  });

  it("shows empty state when no pending entries", async () => {
    vi.mocked(mockActions.getMerchantStats).mockResolvedValue({
      ...mockStats,
      pendingCount: 0,
    });
    vi.mocked(mockActions.getMerchantCreditLogs).mockImplementation(
      (_id: string, options?: { status?: string }) => {
        if (options?.status === "pending") return Promise.resolve([]);
        return Promise.resolve(activityLogs);
      }
    );

    render(<MerchantsDashboard />);

    await waitFor(() => {
      expect(screen.getByText("No pending entries")).toBeInTheDocument();
    });
  });

  it("renders sync status", async () => {
    render(<MerchantsDashboard />);

    await waitFor(() => {
      expect(screen.getByTestId("sync-status")).toBeInTheDocument();
    });
  });

  it("renders bottom navigation", async () => {
    render(<MerchantsDashboard />);

    await waitFor(() => {
      expect(screen.getByTestId("bottom-nav")).toBeInTheDocument();
    });
  });
});
