import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import MerchantsDashboard from "./page";

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

vi.mock("@/components/RoleSwitcher", () => ({
  default: () => <div data-testid="role-switcher">RoleSwitcher</div>,
}));

vi.mock("@/components/OtherRolePrompt", () => ({
  default: () => <div data-testid="other-role-prompt">OtherRole</div>,
}));

vi.mock("@/components/LogoWithAbout", () => ({
  default: () => <div data-testid="logo">Logo</div>,
}));

vi.mock("@/components/SmsReminderModal", () => ({
  default: () => <div data-testid="sms-reminder-modal">SMSReminder</div>,
}));

vi.mock("@/components/MerchantOnboardingModal", () => ({
  default: ({ onComplete }: any) => (
    <div data-testid="onboarding-modal">
      <button onClick={onComplete}>Complete</button>
    </div>
  ),
}));

vi.mock("@/components/TransactionIcon", () => ({
  default: ({ type }: any) => <div data-testid="transaction-icon">{type}</div>,
}));

vi.mock("@/lib/auth", () => ({
  getCurrentMerchantId: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock("@/lib/sound", () => ({
  playSuccessSound: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: vi.fn(() => ({
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn(),
    })),
    removeChannel: vi.fn(),
  })),
}));

vi.mock("@/lib/actions", () => ({
  acceptEditRequest: vi.fn(),
  rejectEditRequest: vi.fn(),
}));

vi.mock("@/app/actions/merchant", () => ({
  getMerchantDashboardData: vi.fn(),
  getMerchantStats: vi.fn(),
  getMerchantCreditLogs: vi.fn(),
  getMerchantProfile: vi.fn(),
  getMerchantCustomers: vi.fn(),
  getMerchantCustomerBalance: vi.fn(),
  getMerchantRecentDescriptions: vi.fn(),
  getMerchantPaymentMethods: vi.fn(),
  checkAndSendAutoReminders: vi.fn().mockResolvedValue(undefined),
  sendPaymentReminder: vi.fn(),
  updateCreditLogStatus: vi.fn(),
}));

vi.mock("@/app/actions/sms-billing", () => ({
  getMerchantSmsBalance: vi.fn().mockResolvedValue(50),
}));

vi.mock("@/app/actions/notifications", () => ({
  getNotifications: vi.fn().mockResolvedValue([]),
  getUnreadCount: vi.fn().mockResolvedValue(0),
  markAsRead: vi.fn().mockResolvedValue(undefined),
}));

const mockMerchantActions = await import("@/app/actions/merchant");
const mockAuth = await import("@/lib/auth");

const mockDashboardData = {
  profile: {
    id: "m1",
    name: "Shop ABC",
    business_type: "kirana",
    business_name: null,
    address: "Kathmandu",
    phone: "+9779841234567",
  },
  stats: {
    totalOutstanding: 2500,
    totalCreditLimit: 15000,
    customerCount: 3,
    pendingCount: 2,
    todayTotal: 800,
    totalCashSales: 500,
    totalSales: 1300,
    cashInHand: 700,
  },
  pendingLogs: [
    {
      id: "cl1",
      amount: 500,
      type: "debit",
      status: "pending",
      description: "Rice 10kg",
      proposed_amount: null,
      created_at: "2025-01-15T10:00:00Z",
      attachment_url: null,
      customer_id: "c1",
      customers: { name: "Hari", phone: "9841234567" },
    },
  ],
  recentActivity: [
    {
      id: "cl2",
      amount: 200,
      type: "debit",
      status: "approved",
      description: "Milk 2L",
      created_at: "2025-01-14T10:00:00Z",
      customers: { name: "Shyam", phone: "9847654321" },
    },
  ],
  topReceivables: [
    {
      customer_id: "c1",
      customer_name: "Hari",
      customer_phone: "9841234567",
      current_balance: 500,
    },
  ],
};

describe("MerchantDashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(mockAuth.getCurrentMerchantId).mockResolvedValue("m1");
    vi.mocked(mockMerchantActions.getMerchantDashboardData).mockResolvedValue(mockDashboardData);
  });

  it("renders stats cards after loading", async () => {
    render(<MerchantsDashboard />);

    await waitFor(() => {
      expect(screen.getByText("Money to Collect")).toBeInTheDocument();
    });

    expect(screen.getByText("Today's Cash")).toBeInTheDocument();
    expect(screen.getByText("Customers")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("Pending")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("shows recent activity entries", async () => {
    render(<MerchantsDashboard />);

    await waitFor(() => {
      expect(screen.getByText("Recent Activity")).toBeInTheDocument();
    });

    expect(screen.getByText("Shyam")).toBeInTheDocument();
  });

  it("shows pending approvals section", async () => {
    render(<MerchantsDashboard />);

    await waitFor(() => {
      expect(screen.getByText("Pending Approvals")).toBeInTheDocument();
    });
  });

  it("shows empty state when no activity", async () => {
    vi.mocked(mockMerchantActions.getMerchantDashboardData).mockResolvedValue({
      ...mockDashboardData,
      recentActivity: [],
      pendingLogs: [],
      stats: { ...mockDashboardData.stats, pendingCount: 0 },
    });

    render(<MerchantsDashboard />);

    await waitFor(() => {
      expect(screen.getByText(/No activity yet/)).toBeInTheDocument();
    });
  });

  it("shows empty state when no pending entries", async () => {
    vi.mocked(mockMerchantActions.getMerchantDashboardData).mockResolvedValue({
      ...mockDashboardData,
      pendingLogs: [],
      stats: { ...mockDashboardData.stats, pendingCount: 0 },
    });

    render(<MerchantsDashboard />);

    await waitFor(() => {
      expect(screen.queryByText("Pending Approvals")).toBeInTheDocument();
    });

    // When no pending, the pending section should show no pending count badge
    expect(screen.queryByText("1")).not.toBeInTheDocument();
  });

  it("renders quick actions", async () => {
    render(<MerchantsDashboard />);

    await waitFor(() => {
      expect(screen.getByText("Manual Entry")).toBeInTheDocument();
    });

    expect(screen.getByText("Reports")).toBeInTheDocument();
  });

  it("renders bottom navigation", async () => {
    render(<MerchantsDashboard />);

    await waitFor(() => {
      expect(screen.getByTestId("bottom-nav")).toBeInTheDocument();
    });
  });
});
