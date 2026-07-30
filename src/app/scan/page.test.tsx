import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ScanPage from "./page";

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

vi.mock("@/lib/offline/db", () => ({
  isOnline: vi.fn(() => true),
  saveOfflineCustomer: vi.fn(),
  savePendingLog: vi.fn(),
}));

vi.mock("@/lib/customer-session", () => ({
  setCustomerSession: vi.fn().mockResolvedValue({ success: true }),
  clearCustomerSession: vi.fn().mockResolvedValue(undefined),
  loadCustomerSession: vi.fn(() => null),
}));

vi.mock("@/lib/actions", () => ({
  findOrCreateCustomer: vi.fn(),
  linkCustomerToMerchant: vi.fn(),
  createCreditLog: vi.fn(),
}));

const mockCustomerActions = await import("@/lib/actions");
const mockSession = await import("@/lib/customer-session");

describe("ScanPage", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    vi.mocked(mockSession.loadCustomerSession).mockReturnValue(null);
  });

  it("renders phone entry screen when no session", async () => {
    // When no session, page redirects to /login. Mock that.
    delete (window as any).location;
    const mockReplace = vi.fn();
    Object.defineProperty(window, "location", {
      value: { replace: mockReplace, href: "" },
      writable: true,
      configurable: true,
    });

    render(<ScanPage />);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith("/login");
    });
  });

  it("skips to scan step when session exists", async () => {
    vi.mocked(mockSession.loadCustomerSession).mockReturnValue({
      phone: "9841234567",
      name: "Hari",
    });

    render(<ScanPage />);

    await waitFor(() => {
      expect(screen.getByText("Scan QR")).toBeInTheDocument();
    });
  });

  it("shows enter amount step after QR scan", async () => {
    vi.mocked(mockSession.loadCustomerSession).mockReturnValue({
      phone: "9841234567",
      name: "Hari",
    });

    render(<ScanPage />);

    await waitFor(() => {
      expect(screen.getByTestId("qr-scanner")).toBeInTheDocument();
    });

    await userEvent.click(screen.getByTestId("mock-scan"));

    await waitFor(() => {
      expect(screen.getByText("Log Entry")).toBeInTheDocument();
      expect(screen.getByText("Shop ABC")).toBeInTheDocument();
    });
  });
});
