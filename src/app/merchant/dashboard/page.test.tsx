import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
const mockLibActions = await import("@/lib/actions");

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
    awaitingCount: 2,
    todayTotal: 800,
    totalCashSales: 500,
    totalSales: 1300,
    cashInHand: 700,
    todayCreditSales: 800,
    totalExpenses: 150,
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
    {
      id: "cl3",
      amount: 5000,
      type: "cash_in",
      status: "approved",
      description: "Money from home",
      created_at: "2025-01-13T10:00:00Z",
      customers: null,
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
    vi.mocked(mockMerchantActions.updateCreditLogStatus).mockResolvedValue({});
    vi.mocked(mockLibActions.acceptEditRequest).mockResolvedValue({});
    vi.mocked(mockLibActions.rejectEditRequest).mockResolvedValue({});
    vi.mocked(mockAuth.signOut).mockResolvedValue(undefined as any);
  });

  it("renders stats cards after loading", async () => {
    const user = userEvent.setup();
    render(<MerchantsDashboard />);

    await waitFor(() => {
      expect(screen.getByText("Credit on Market")).toBeInTheDocument();
    });

    expect(screen.getByText("Today's Net Credit")).toBeInTheDocument();
    expect(screen.getByText("Today's Cash Sales")).toBeInTheDocument();
    expect(screen.getByText("Today's Credit Sales")).toBeInTheDocument();

    await user.click(screen.getByText("More Stats"));
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

  it("renders cash_in activity with Cash In label and + sign", async () => {
    render(<MerchantsDashboard />);

    await waitFor(() => {
      expect(screen.getByText("Recent Activity")).toBeInTheDocument();
    });

    expect(screen.getByText("Cash In")).toBeInTheDocument();
    expect(screen.getByText("Money from home")).toBeInTheDocument();
    const cashInRow = screen.getByText("Money from home").closest("a") as HTMLElement;
    expect(
      within(cashInRow).getByText((content, el) => !!el?.textContent && /^\+Rs\. \S+$/.test(el.textContent))
    ).toBeInTheDocument();
  });

  it("shows empty state when no activity", async () => {
    vi.mocked(mockMerchantActions.getMerchantDashboardData).mockResolvedValue({
      ...mockDashboardData,
      recentActivity: [],
      awaitingLogs: [],
      stats: { ...mockDashboardData.stats, awaitingCount: 0 },
    });

    render(<MerchantsDashboard />);

    await waitFor(() => {
      expect(screen.getByText(/No activity yet/)).toBeInTheDocument();
    });
  });

  it("shows New Entry hero and collapsible More Stats", async () => {
    const user = userEvent.setup();
    render(<MerchantsDashboard />);

    await waitFor(() => {
      expect(screen.getByText("New Entry")).toBeInTheDocument();
    });

    expect(screen.getByText("Products")).toBeInTheDocument();
    expect(screen.getByText("Reports")).toBeInTheDocument();
    expect(screen.queryByText("All Sales")).not.toBeInTheDocument();

    await user.click(screen.getByText("More Stats"));

    expect(screen.getByText("All Sales")).toBeInTheDocument();
    expect(screen.getByText("Cash in Hand")).toBeInTheDocument();
    expect(screen.getByText("Total Purchase and Expenses")).toBeInTheDocument();
    expect(screen.getByText("Add your Purchase or expenses")).toBeInTheDocument();
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

  it("renders pending requests with inline approve/reject", async () => {
    render(<MerchantsDashboard />);

    await waitFor(() => {
      expect(screen.getByText("Pending Requests")).toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: "Approve" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reject" })).toBeInTheDocument();
  });

  it("approves an awaiting_confirmation entry inline", async () => {
    const user = userEvent.setup();
    render(<MerchantsDashboard />);

    await waitFor(() => {
      expect(screen.getByText("Pending Requests")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Approve" }));

    await waitFor(() => {
      expect(mockMerchantActions.updateCreditLogStatus).toHaveBeenCalledWith("cl1", "approved");
    });
  });

  it("rejects an awaiting_confirmation entry inline", async () => {
    const user = userEvent.setup();
    render(<MerchantsDashboard />);

    await waitFor(() => {
      expect(screen.getByText("Pending Requests")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Reject" }));

    await waitFor(() => {
      expect(mockMerchantActions.updateCreditLogStatus).toHaveBeenCalledWith("cl1", "rejected");
    });
  });

  it("accepts an edit request inline", async () => {
    const user = userEvent.setup();
    vi.mocked(mockMerchantActions.getMerchantDashboardData).mockResolvedValue({
      ...mockDashboardData,
      awaitingLogs: [
        {
          id: "cl-edit",
          amount: 500,
          type: "debit" as const,
          status: "edit_requested",
          description: "Rice 10kg",
          proposed_amount: 450,
          created_at: "2025-01-15T10:00:00Z",
          attachment_url: null,
          customer_id: "c1",
          customers: { name: "Hari", phone: "9841234567" },
        },
      ],
    });

    render(<MerchantsDashboard />);

    await waitFor(() => {
      expect(screen.getByText("Pending Requests")).toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: "Accept" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Decline" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Accept" }));

    await waitFor(() => {
      expect(mockLibActions.acceptEditRequest).toHaveBeenCalledWith("cl-edit");
    });
  });

  it("declines an edit request inline", async () => {
    const user = userEvent.setup();
    vi.mocked(mockMerchantActions.getMerchantDashboardData).mockResolvedValue({
      ...mockDashboardData,
      awaitingLogs: [
        {
          id: "cl-edit",
          amount: 500,
          type: "debit" as const,
          status: "edit_requested",
          description: "Rice 10kg",
          proposed_amount: 450,
          created_at: "2025-01-15T10:00:00Z",
          attachment_url: null,
          customer_id: "c1",
          customers: { name: "Hari", phone: "9841234567" },
        },
      ],
    });

    render(<MerchantsDashboard />);

    await waitFor(() => {
      expect(screen.getByText("Pending Requests")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Decline" }));

    await waitFor(() => {
      expect(mockLibActions.rejectEditRequest).toHaveBeenCalledWith("cl-edit");
    });
  });

  it("requires confirmation before signing out", async () => {
    const user = userEvent.setup();
    render(<MerchantsDashboard />);

    await waitFor(() => {
      expect(screen.getByText("New Entry")).toBeInTheDocument();
    });

    await user.click(screen.getByLabelText("Menu"));
    await user.click(screen.getByText("Sign Out"));

    expect(screen.getByText("Sign out?")).toBeInTheDocument();
    await user.click(screen.getByText("Cancel"));
    expect(mockAuth.signOut).not.toHaveBeenCalled();

    await user.click(screen.getByLabelText("Menu"));
    await user.click(screen.getByText("Sign Out"));
    await user.click(screen.getByRole("button", { name: "Sign Out" }));

    expect(mockAuth.signOut).toHaveBeenCalledTimes(1);
  });
});
