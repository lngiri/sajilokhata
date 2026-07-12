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

vi.mock("@/lib/actions", () => ({
  findOrCreateCustomer: vi.fn(),
  linkCustomerToMerchant: vi.fn(),
  createCreditLog: vi.fn(),
}));

vi.mock("@/lib/offline/db", () => ({
  isOnline: vi.fn(() => true),
  saveOfflineCustomer: vi.fn(),
  savePendingLog: vi.fn(),
}));

const mockActions = await import("@/lib/actions");
const mockOffline = await import("@/lib/offline/db");

describe("ScanPage", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    vi.mocked(mockOffline.isOnline).mockReturnValue(true);
  });

  it("renders scan page after initialization", async () => {
    render(<ScanPage />);

    await waitFor(() => {
      expect(screen.getByText("Enter Phone")).toBeInTheDocument();
    });
  });

  it("shows phone entry screen when no session", async () => {
    render(<ScanPage />);

    await waitFor(() => {
      expect(screen.getByText("Enter Phone")).toBeInTheDocument();
      expect(screen.getByPlaceholderText("e.g. 9841234567")).toBeInTheDocument();
    });
  });

  it("skips to scan step when session exists", async () => {
    localStorage.setItem(
      "sajilo_customer_session",
      JSON.stringify({ phone: "9841234567", name: "Hari" })
    );

    render(<ScanPage />);

    await waitFor(() => {
      expect(screen.getByText("Scan QR")).toBeInTheDocument();
    });
  });

  it("goes to scan step after phone submit", async () => {
    render(<ScanPage />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText("e.g. 9841234567")).toBeInTheDocument();
    });

    const phoneInput = screen.getByPlaceholderText("e.g. 9841234567");
    await userEvent.type(phoneInput, "9841234567");

    const continueBtn = screen.getByText("Continue");
    await userEvent.click(continueBtn);

    await waitFor(() => {
      expect(screen.getByText("Scan QR")).toBeInTheDocument();
    });
  });

  it("shows enter amount step after QR scan", async () => {
    localStorage.setItem(
      "sajilo_customer_session",
      JSON.stringify({ phone: "9841234567", name: "Hari" })
    );

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

  it("submits credit entry and shows done screen", async () => {
    vi.mocked(mockActions.findOrCreateCustomer).mockResolvedValue({
      id: "c1",
      phone: "9841234567",
    });
    vi.mocked(mockActions.linkCustomerToMerchant).mockResolvedValue({
      id: "mc1",
    });
    vi.mocked(mockActions.createCreditLog).mockResolvedValue({
      id: "cl1",
      status: "pending",
    });

    localStorage.setItem(
      "sajilo_customer_session",
      JSON.stringify({ phone: "9841234567", name: "Hari" })
    );

    render(<ScanPage />);

    await waitFor(() => {
      expect(screen.getByTestId("qr-scanner")).toBeInTheDocument();
    });

    await userEvent.click(screen.getByTestId("mock-scan"));

    await waitFor(() => {
      expect(screen.getByText("Log Entry")).toBeInTheDocument();
    });

    const amountInput = screen.getByPlaceholderText("0");
    await userEvent.type(amountInput, "500");

    const submitBtn = screen.getByText("Submit Entry");
    await userEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText("Entry Submitted!")).toBeInTheDocument();
    });

    expect(mockActions.findOrCreateCustomer).toHaveBeenCalledWith(
      "9841234567",
      "Hari"
    );
    expect(mockActions.linkCustomerToMerchant).toHaveBeenCalledWith(
      "m1",
      "c1"
    );
    expect(mockActions.createCreditLog).toHaveBeenCalledWith({
      merchant_id: "m1",
      customer_id: "c1",
      amount: 500,
      description: null,
      type: "debit",
      status: "pending",
      sync_status: "online",
    });
  });

  it("submits credit entry with description and correct data", async () => {
    vi.mocked(mockActions.findOrCreateCustomer).mockResolvedValue({
      id: "c1",
      phone: "9841234567",
    });
    vi.mocked(mockActions.linkCustomerToMerchant).mockResolvedValue({
      id: "mc1",
    });
    vi.mocked(mockActions.createCreditLog).mockResolvedValue({
      id: "cl1",
      status: "pending",
    });

    localStorage.setItem(
      "sajilo_customer_session",
      JSON.stringify({ phone: "9841234567", name: "Hari" })
    );

    render(<ScanPage />);

    await waitFor(() => {
      expect(screen.getByTestId("qr-scanner")).toBeInTheDocument();
    });

    await userEvent.click(screen.getByTestId("mock-scan"));

    await waitFor(() => {
      expect(screen.getByText("Log Entry")).toBeInTheDocument();
    });

    const amountInput = screen.getByPlaceholderText("0");
    await userEvent.type(amountInput, "750");

    const descInput = screen.getByPlaceholderText("e.g. Rice 10kg, Milk 2L");
    await userEvent.type(descInput, "Rice 5kg, Oil 1L");

    const submitBtn = screen.getByText("Submit Entry");
    await userEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText("Entry Submitted!")).toBeInTheDocument();
    });

    expect(mockActions.createCreditLog).toHaveBeenCalledWith({
      merchant_id: "m1",
      customer_id: "c1",
      amount: 750,
      description: "Rice 5kg, Oil 1L",
      type: "debit",
      status: "pending",
      sync_status: "online",
    });
  });

  it("stays on enter step when submission fails", async () => {
    vi.mocked(mockActions.findOrCreateCustomer).mockRejectedValue(
      new Error("Network error")
    );

    localStorage.setItem(
      "sajilo_customer_session",
      JSON.stringify({ phone: "9841234567", name: "Hari" })
    );

    render(<ScanPage />);

    await waitFor(() => {
      expect(screen.getByTestId("qr-scanner")).toBeInTheDocument();
    });

    await userEvent.click(screen.getByTestId("mock-scan"));

    await waitFor(() => {
      expect(screen.getByText("Log Entry")).toBeInTheDocument();
    });

    const amountInput = screen.getByPlaceholderText("0");
    await userEvent.type(amountInput, "500");

    const submitBtn = screen.getByText("Submit Entry");
    await userEvent.click(submitBtn);

    // Should remain on enter step (not advance to done)
    expect(screen.getByText("Log Entry")).toBeInTheDocument();
    expect(screen.queryByText("Entry Submitted!")).not.toBeInTheDocument();
  });

  it("resets to scan step on New Entry button from done screen", async () => {
    vi.mocked(mockActions.findOrCreateCustomer).mockResolvedValue({
      id: "c1",
      phone: "9841234567",
    });
    vi.mocked(mockActions.linkCustomerToMerchant).mockResolvedValue({
      id: "mc1",
    });
    vi.mocked(mockActions.createCreditLog).mockResolvedValue({
      id: "cl1",
      status: "pending",
    });

    localStorage.setItem(
      "sajilo_customer_session",
      JSON.stringify({ phone: "9841234567", name: "Hari" })
    );

    render(<ScanPage />);

    await waitFor(() => {
      expect(screen.getByTestId("qr-scanner")).toBeInTheDocument();
    });

    await userEvent.click(screen.getByTestId("mock-scan"));

    await waitFor(() => {
      expect(screen.getByText("Log Entry")).toBeInTheDocument();
    });

    const amountInput = screen.getByPlaceholderText("0");
    await userEvent.type(amountInput, "500");

    await userEvent.click(screen.getByText("Submit Entry"));

    await waitFor(() => {
      expect(screen.getByText("Entry Submitted!")).toBeInTheDocument();
    });

    await userEvent.click(screen.getByText("New Entry"));

    await waitFor(() => {
      expect(screen.getByText("Scan QR")).toBeInTheDocument();
    });
  });

  it("shows reverse QR when offline", async () => {
    vi.mocked(mockOffline.isOnline).mockReturnValue(false);

    localStorage.setItem(
      "sajilo_customer_session",
      JSON.stringify({ phone: "9841234567", name: "Hari" })
    );

    render(<ScanPage />);

    await waitFor(() => {
      expect(screen.getByTestId("qr-scanner")).toBeInTheDocument();
    });

    await userEvent.click(screen.getByTestId("mock-scan"));

    await waitFor(() => {
      expect(screen.getByText("Log Entry")).toBeInTheDocument();
    });

    const amountInput = screen.getByPlaceholderText("0");
    await userEvent.type(amountInput, "500");

    const generateBtn = screen.getByText("Generate QR");
    await userEvent.click(generateBtn);

    await waitFor(() => {
      expect(screen.getByText("Show QR")).toBeInTheDocument();
      expect(screen.getByText("You are offline")).toBeInTheDocument();
    });
  });
});
