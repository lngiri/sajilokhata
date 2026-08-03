import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CustomerDashboard from "./page";

vi.mock("@/lib/supabase/client", () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      then: vi.fn((resolve: any) =>
        resolve({ data: [{ id: "c1" }], error: null })
      ),
    })),
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn(),
    })),
    removeChannel: vi.fn(),
  })),
}));

vi.mock("@/lib/phone", () => ({
  normalizePhone: vi.fn((p: string) => p),
}));

vi.mock("@/lib/offline/db", () => ({
  isOnline: vi.fn(() => true),
  savePendingLog: vi.fn(),
}));

vi.mock("@/components/QRCode", () => ({
  QRScanner: ({ onScan }: { onScan: (data: string) => void }) => (
    <div data-testid="qr-scanner">
      <button
        data-testid="mock-scan"
        onClick={() =>
          onScan(
            JSON.stringify({
              type: "merchant_scan",
              merchantId: "m1",
              merchantName: "Shop ABC",
            })
          )
        }
      >
        Simulate Scan
      </button>
    </div>
  ),
  CustomerQR: ({ customerId }: { customerId: string }) => (
    <div data-testid="customer-qr">{customerId}</div>
  ),
}));

vi.mock("@/components/Toast", () => ({
  useToast: () => ({
    addToast: vi.fn(),
  }),
}));

vi.mock("@/components/CustomerBottomNav", () => ({
  default: () => <div data-testid="customer-bottom-nav">Nav</div>,
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

vi.mock("@/components/CustomerOnboardingModal", () => ({
  default: ({ onComplete }: any) => (
    <div data-testid="onboarding-modal">
      <button onClick={onComplete}>Complete</button>
    </div>
  ),
}));

vi.mock("@/components/OnboardingTour", () => ({
  default: ({ open, onComplete, onSkip }: any) => {
    if (!open) return null;
    return (
      <div data-testid="onboarding-tour">
        <button onClick={onComplete}>Done</button>
        <button onClick={onSkip}>Skip</button>
      </div>
    );
  },
}));

vi.mock("@/components/CustomerPinGate", () => ({
  default: ({ children }: any) => <>{children}</>,
}));

vi.mock("@/components/AmountSuggestions", () => ({
  default: ({ onSelect }: any) => (
    <div data-testid="amount-suggestions">
      <button onClick={() => onSelect(500)}>500</button>
    </div>
  ),
}));

vi.mock("@/components/PendingApprovalModal", () => ({
  default: () => <div data-testid="pending-approval-modal" />,
}));

vi.mock("@/components/PullToRefresh", () => ({
  default: ({ children }: any) => <>{children}</>,
}));

vi.mock("@/lib/sound", () => ({
  playSuccessSound: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  getCurrentMerchantId: vi.fn(),
  getCurrentUserPhone: vi.fn(),
}));

vi.mock("@/app/actions/customer", () => ({
  getCustomerStats: vi.fn(),
  findOrCreateCustomer: vi.fn(),
  linkCustomerToMerchant: vi.fn(),
  submitCustomerEntry: vi.fn(),
  getCustomerProfile: vi.fn().mockResolvedValue({ name: "Hari" }),
  getCustomerIdsForPhone: vi.fn().mockResolvedValue(["c1"]),
}));

vi.mock("@/app/actions/merchant", () => ({
  getMerchantPaymentMethodsPublic: vi.fn().mockResolvedValue([]),
  submitPaymentVoucher: vi.fn(),
}));

vi.mock("@/app/actions/notifications", () => ({
  getNotifications: vi.fn().mockResolvedValue([]),
  getUnreadCount: vi.fn().mockResolvedValue(0),
  markAsRead: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/offline/cache", () => ({
  fetchWithCache: vi.fn(async (_key: string, fn: any) => ({
    data: await fn(),
    stale: false,
    cachedAt: null,
  })),
}));

const mockCustomerActions = await import("@/app/actions/customer");

const VALID_SESSION = {
  phone: "9841234567",
  name: "Hari",
};

describe("CustomerDashboard", () => {
  const originalLocation = window.location;

  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();

    // Use Object.defineProperty to properly mock window.location
    Object.defineProperty(window, "location", {
      value: {
        ...originalLocation,
        replace: vi.fn(),
        href: originalLocation.href,
        origin: originalLocation.origin,
        protocol: originalLocation.protocol,
        host: originalLocation.host,
        hostname: originalLocation.hostname,
        port: originalLocation.port,
        pathname: originalLocation.pathname,
        search: originalLocation.search,
        hash: originalLocation.hash,
      },
      writable: true,
      configurable: true,
    });

    vi.mocked(mockCustomerActions.getCustomerStats).mockResolvedValue({
      totalOutstanding: 1500,
      shopsCount: 2,
      totalCreditLimit: 10000,
      relationships: [
        {
          current_balance: 1000,
          credit_limit: 5000,
          merchants: { id: "m1", name: "Shop ABC", business_name: "ABC" },
        },
        {
          current_balance: 500,
          credit_limit: 5000,
          merchants: { id: "m2", name: "Shop XYZ", business_name: "XYZ" },
        },
      ],
    });
  });

  afterEach(() => {
    Object.defineProperty(window, "location", {
      value: originalLocation,
      writable: true,
      configurable: true,
    });
  });

  it("renders dashboard content after initialization", async () => {
    localStorage.setItem("sajilo_customer_session", JSON.stringify(VALID_SESSION));

    render(<CustomerDashboard />);

    await waitFor(() => {
      expect(screen.getByText("Total Outstanding Balance")).toBeInTheDocument();
    });
  });

  it("redirects to /login when no customer session exists", async () => {
    render(<CustomerDashboard />);

    await waitFor(() => {
      expect(window.location.replace).toHaveBeenCalledWith("/login");
    });
  });

  it("renders customer name from session", async () => {
    localStorage.setItem("sajilo_customer_session", JSON.stringify(VALID_SESSION));

    render(<CustomerDashboard />);

    await waitFor(() => {
      const hariElements = screen.getAllByText("Hari");
      expect(hariElements.length).toBeGreaterThanOrEqual(1);
    });
  });

  it("displays outstanding balance card with stats", async () => {
    localStorage.setItem("sajilo_customer_session", JSON.stringify(VALID_SESSION));

    render(<CustomerDashboard />);

    await waitFor(() => {
      expect(screen.getByText("Total Outstanding Balance")).toBeInTheDocument();
      expect(screen.getByText("Shop ABC")).toBeInTheDocument();
      expect(screen.getByText("Shop XYZ")).toBeInTheDocument();
    });
  });

  it("shows empty state when no stats", async () => {
    vi.mocked(mockCustomerActions.getCustomerStats).mockResolvedValue(null);
    localStorage.setItem("sajilo_customer_session", JSON.stringify(VALID_SESSION));

    render(<CustomerDashboard />);

    await waitFor(() => {
      expect(
        screen.getByText("No outstanding credit yet")
      ).toBeInTheDocument();
    });
  });

  it("renders bottom nav", async () => {
    localStorage.setItem("sajilo_customer_session", JSON.stringify(VALID_SESSION));

    render(<CustomerDashboard />);

    await waitFor(() => {
      expect(screen.getByTestId("customer-bottom-nav")).toBeInTheDocument();
    });
  });

  it("shows the guided tour for a new customer and hides it after completion", async () => {
    const user = userEvent.setup();
    localStorage.setItem("sajilo_customer_session", JSON.stringify(VALID_SESSION));

    render(<CustomerDashboard />);

    await waitFor(() => {
      expect(screen.getByTestId("onboarding-tour")).toBeInTheDocument();
    });

    await user.click(screen.getByText("Done"));

    await waitFor(() => {
      expect(screen.queryByTestId("onboarding-tour")).not.toBeInTheDocument();
    });
    expect(localStorage.getItem("tour_seen_customer_9841234567")).toBe("1");
  });

  it("replays the tour when the tour:replay event fires", async () => {
    const user = userEvent.setup();
    localStorage.setItem("sajilo_customer_session", JSON.stringify(VALID_SESSION));

    render(<CustomerDashboard />);

    await waitFor(() => {
      expect(screen.getByTestId("onboarding-tour")).toBeInTheDocument();
    });
    await user.click(screen.getByText("Done"));

    await waitFor(() => {
      expect(screen.queryByTestId("onboarding-tour")).not.toBeInTheDocument();
    });

    window.dispatchEvent(new CustomEvent("tour:replay"));
    await waitFor(() => {
      expect(screen.getByTestId("onboarding-tour")).toBeInTheDocument();
    });
  });
});
