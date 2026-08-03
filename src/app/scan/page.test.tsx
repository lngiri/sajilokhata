import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ScanPage from "./page";

const { mockAddToast, mockSubmitCustomerEntry } = vi.hoisted(() => ({
  mockAddToast: vi.fn(),
  mockSubmitCustomerEntry: vi.fn(),
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
  useToast: () => ({ addToast: mockAddToast }),
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

vi.mock("@/lib/offline/sync", () => ({
  notifyPendingSave: vi.fn(),
}));

vi.mock("@/lib/customer-session", () => ({
  setCustomerSession: vi.fn().mockResolvedValue({ success: true }),
  clearCustomerSession: vi.fn().mockResolvedValue(undefined),
  loadCustomerSession: vi.fn(() => null),
}));

vi.mock("@/app/actions/customer", () => ({
  submitCustomerEntry: mockSubmitCustomerEntry,
}));

const mockSession = await import("@/lib/customer-session");

describe("ScanPage", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    vi.mocked(mockSession.loadCustomerSession).mockReturnValue(null);
    mockSubmitCustomerEntry.mockResolvedValue({
      success: true,
      entry: { id: "cl1", status: "awaiting_confirmation" },
    });
  });

  it("redirects to login when no session exists", async () => {
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

  it("saves an entry through the full scan flow like a human", async () => {
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
    });

    await userEvent.type(screen.getByPlaceholderText("0"), "500");
    await userEvent.click(screen.getByRole("button", { name: "Submit Entry" }));

    await waitFor(() => {
      expect(screen.getByText("Entry Saved!")).toBeInTheDocument();
    });

    expect(mockSubmitCustomerEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        merchant_id: "m1",
        phone: "9841234567",
        name: "Hari",
        amount: 500,
        type: "debit",
        idempotency_key: expect.any(String),
      })
    );
  });

  it("shows an error toast and stays on the form when the save fails", async () => {
    vi.mocked(mockSession.loadCustomerSession).mockReturnValue({
      phone: "9841234567",
      name: "Hari",
    });
    mockSubmitCustomerEntry.mockResolvedValue({
      success: false,
      error: "Database error (42703): column idempotency_key of relation credit_logs does not exist",
    });

    render(<ScanPage />);

    await waitFor(() => {
      expect(screen.getByTestId("qr-scanner")).toBeInTheDocument();
    });

    await userEvent.click(screen.getByTestId("mock-scan"));

    await waitFor(() => {
      expect(screen.getByText("Log Entry")).toBeInTheDocument();
    });

    await userEvent.type(screen.getByPlaceholderText("0"), "500");
    await userEvent.click(screen.getByRole("button", { name: "Submit Entry" }));

    await waitFor(() => {
      expect(mockAddToast).toHaveBeenCalledWith(
        "Database error (42703): column idempotency_key of relation credit_logs does not exist",
        "error"
      );
    });
    expect(screen.getByText("Log Entry")).toBeInTheDocument();
  });
});
