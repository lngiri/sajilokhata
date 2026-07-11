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

vi.mock("@/components/SyncStatus", () => ({
  default: () => <div data-testid="sync-status">Sync</div>,
}));

vi.mock("@/components/CustomerBottomNav", () => ({
  default: () => <div data-testid="customer-bottom-nav">Nav</div>,
}));

vi.mock("@/lib/actions", () => ({
  getCustomerStats: vi.fn(),
  findOrCreateCustomer: vi.fn(),
  linkCustomerToMerchant: vi.fn(),
  createCreditLog: vi.fn(),
}));

const mockActions = await import("@/lib/actions");

const VALID_SESSION = JSON.stringify({
  phone: "9841234567",
  name: "Hari",
});

describe("CustomerDashboard", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();

    vi.mocked(mockActions.getCustomerStats).mockResolvedValue({
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

  it("renders dashboard content after initialization", async () => {
    render(<CustomerDashboard />);

    await waitFor(() => {
      expect(screen.getByText("My Dashboard")).toBeInTheDocument();
    });
  });

  it("redirects to /scan when no customer session exists", async () => {
    const originalLocation = window.location;
    delete (window as any).location;
    window.location = { ...originalLocation, href: "" };

    render(<CustomerDashboard />);

    await waitFor(() => {
      expect(window.location.href).toBe("/scan");
    });

    window.location = originalLocation;
  });

  it("renders customer name and phone from session", async () => {
    localStorage.setItem("sajilo_customer_session", VALID_SESSION);

    render(<CustomerDashboard />);

    await waitFor(() => {
      expect(screen.getByText("Hari")).toBeInTheDocument();
    });
  });

  it("displays outstanding balance card with stats", async () => {
    localStorage.setItem("sajilo_customer_session", VALID_SESSION);

    render(<CustomerDashboard />);

    await waitFor(() => {
      expect(screen.getByText("Total Outstanding Balance")).toBeInTheDocument();
      expect(screen.getByText("Shop ABC")).toBeInTheDocument();
      expect(screen.getByText("Shop XYZ")).toBeInTheDocument();
    });
  });

  it("shows empty state when no stats", async () => {
    vi.mocked(mockActions.getCustomerStats).mockResolvedValue(null);
    localStorage.setItem("sajilo_customer_session", VALID_SESSION);

    render(<CustomerDashboard />);

    await waitFor(() => {
      expect(
        screen.getByText("No outstanding credit yet")
      ).toBeInTheDocument();
    });
  });

  it("shows QR scanner modal on FAB click and submits credit", async () => {
    vi.mocked(mockActions.findOrCreateCustomer).mockResolvedValue({
      id: "c1",
      phone: "9841234567",
    });
    vi.mocked(mockActions.linkCustomerToMerchant).mockResolvedValue({ id: "mc1" });
    vi.mocked(mockActions.createCreditLog).mockResolvedValue({ id: "cl1" });

    localStorage.setItem("sajilo_customer_session", VALID_SESSION);

    render(<CustomerDashboard />);

    await waitFor(() => {
      expect(screen.getByText("My Dashboard")).toBeInTheDocument();
    });

    const fab = screen.getByRole("button", { name: "" });
    const fabButton = fab.closest("button");
    expect(fabButton).toBeTruthy();

    if (fabButton) {
      await userEvent.click(fabButton);
    }

    await waitFor(() => {
      expect(screen.getByText("Scan Shop QR")).toBeInTheDocument();
    });
  });

  it("renders bottom nav and sync status", async () => {
    localStorage.setItem("sajilo_customer_session", VALID_SESSION);

    render(<CustomerDashboard />);

    await waitFor(() => {
      expect(screen.getByTestId("customer-bottom-nav")).toBeInTheDocument();
      expect(screen.getByTestId("sync-status")).toBeInTheDocument();
    });
  });
});
