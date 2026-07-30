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
    todayCreditSales: 800,
  },
  awaitingLogs: [
    {
      id: "cl1",
      amount: 500,
      type: "debit",
      status: "awaiting_confirmation",
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
      expect(screen.getByText("Credit on Market")).toBeInTheDocument();
    });

    expect(screen.getByText("Today's Due Collection")).toBeInTheDocument();
    expect(screen.getByText("Today's Cash Sales")).toBeInTheDocument();
    expect(screen.getByText("Today Cr. Sales")).toBeInTheDocument();
    expect(screen.getByText("All Sales")).toBeInTheDocument();
    expect(screen.getByText("Cash in Hand")).toBeInTheDocument();
  });

  it("shows recent activity entries", async () => {
    render(<MerchantsDashboard />);

    await waitFor(() => {
      expect(screen.getByText("Recent Activity")).toBeInTheDocument();
    });

    expect(screen.getAllByText("Shyam").length).toBeGreaterThanOrEqual(1);
  });

  it("shows empty state when no activity", async () => {
    vi.mocked(mockMerchantActions.getMerchantDashboardData).mockResolvedValue({
      ...mockDashboardData,
      recentActivity: [],
      awaitingLogs: [],
      stats: { ...mockDashboardData.stats, pendingCount: 0 },
    });

    render(<MerchantsDashboard />);

    await waitFor(() => {
      expect(screen.getByText(/No activity yet/)).toBeInTheDocument();
    });
  });

  it("renders quick actions", async () => {
    render(<MerchantsDashboard />);

    await waitFor(() => {
      expect(screen.getByText("Manual Entry")).toBeInTheDocument();
    });

    expect(screen.getByText("Reports")).toBeInTheDocument();
    expect(screen.getByText("Add Cash Out")).toBeInTheDocument();
  });

  it("renders bottom navigation", async () => {
    render(<MerchantsDashboard />);

    await waitFor(() => {
      expect(screen.getByTestId("bottom-nav")).toBeInTheDocument();
    });
  });

  it("shows receivables section with call and sms buttons", async () => {
    render(<MerchantsDashboard />);

    await waitFor(() => {
      expect(screen.getByText("Receivables")).toBeInTheDocument();
    });

    // Check customer name appears
    expect(screen.getAllByText("Hari").length).toBeGreaterThanOrEqual(1);

    // Check call button link
    const callLink = screen.getByLabelText("Call Hari");
    expect(callLink).toHaveAttribute("href", "tel:9841234567");
  });
});
