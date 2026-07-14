import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MerchantScanPage from "./page";

vi.mock("@/components/QRCode", () => ({
  QRScanner: ({ onScan }: { onScan: (data: string) => void }) => (
    <div data-testid="qr-scanner">
      <button
        data-testid="mock-scan-valid"
        onClick={() => onScan("sajilokhata:customer:9841234567")}
      >
        Valid
      </button>
      <button
        data-testid="mock-scan-legacy"
        onClick={() =>
          onScan(
            JSON.stringify({
              type: "reverse_scan",
              customerId: "9847654321",
            })
          )
        }
      >
        Legacy
      </button>
      <button
        data-testid="mock-scan-invalid"
        onClick={() => onScan("bad-data")}
      >
        Invalid
      </button>
    </div>
  ),
}));

vi.mock("@/components/Toast", () => ({
  useToast: () => ({ addToast: vi.fn() }),
}));

vi.mock("@/lib/actions", () => ({
  findOrCreateCustomer: vi.fn(),
  linkCustomerToMerchant: vi.fn(),
  createCreditLog: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  getCurrentMerchantId: vi.fn(),
}));

vi.mock("@/components/BottomNav", () => ({
  default: () => <div data-testid="bottom-nav">Nav</div>,
}));

const mockActions = await import("@/lib/actions");
const mockAuth = await import("@/lib/auth");

describe("MerchantScanPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders scan step with QR scanner on mount", async () => {
    render(<MerchantScanPage />);

    await waitFor(() => {
      expect(screen.getByText("Scan Customer QR")).toBeInTheDocument();
      expect(screen.getByTestId("qr-scanner")).toBeInTheDocument();
    });
  });

  it("extracts phone from new format QR and advances to enter step", async () => {
    render(<MerchantScanPage />);

    await waitFor(() => {
      expect(screen.getByTestId("qr-scanner")).toBeInTheDocument();
    });

    await userEvent.click(screen.getByTestId("mock-scan-valid"));

    await waitFor(() => {
      expect(screen.getByText("Enter Details")).toBeInTheDocument();
      expect(screen.getByText("9841234567")).toBeInTheDocument();
    });
  });

  it("extracts phone from legacy JSON QR format", async () => {
    render(<MerchantScanPage />);

    await waitFor(() => {
      expect(screen.getByTestId("qr-scanner")).toBeInTheDocument();
    });

    await userEvent.click(screen.getByTestId("mock-scan-legacy"));

    await waitFor(() => {
      expect(screen.getByText("Enter Details")).toBeInTheDocument();
      expect(screen.getByText("9847654321")).toBeInTheDocument();
    });
  });

  it("stays on scan step when QR data is invalid", async () => {
    render(<MerchantScanPage />);

    await waitFor(() => {
      expect(screen.getByTestId("qr-scanner")).toBeInTheDocument();
    });

    await userEvent.click(screen.getByTestId("mock-scan-invalid"));

    expect(screen.getByText("Scan Customer QR")).toBeInTheDocument();
    expect(screen.queryByText("Enter Details")).not.toBeInTheDocument();
  });

  it("advances to confirm step after entering amount and clicking Continue", async () => {
    render(<MerchantScanPage />);

    await waitFor(() => {
      expect(screen.getByTestId("qr-scanner")).toBeInTheDocument();
    });

    await userEvent.click(screen.getByTestId("mock-scan-valid"));

    await waitFor(() => {
      expect(screen.getByText("Enter Details")).toBeInTheDocument();
    });

    await userEvent.type(screen.getByPlaceholderText("0"), "1500");
    await userEvent.type(
      screen.getByPlaceholderText("e.g. Rice 10kg, Milk 2L"),
      "Groceries"
    );

    await userEvent.click(screen.getByText("Continue"));

    await waitFor(() => {
      expect(screen.getByText("Confirm Entry")).toBeInTheDocument();
    });

    expect(screen.getByText("Debit (Credit Taken)")).toBeInTheDocument();
    expect(screen.getByText("Groceries")).toBeInTheDocument();
    expect(screen.getByText("Review Entry Details")).toBeInTheDocument();
  });

  it("disables Continue button when amount is empty or zero", async () => {
    render(<MerchantScanPage />);

    await waitFor(() => {
      expect(screen.getByTestId("qr-scanner")).toBeInTheDocument();
    });

    await userEvent.click(screen.getByTestId("mock-scan-valid"));

    await waitFor(() => {
      expect(screen.getByText("Enter Details")).toBeInTheDocument();
    });

    expect(screen.getByText("Continue")).toBeDisabled();

    await userEvent.type(screen.getByPlaceholderText("0"), "0");
    expect(screen.getByText("Continue")).toBeDisabled();
  });

  it("completes full scan flow: scan → enter → confirm → success", async () => {
    vi.mocked(mockAuth.getCurrentMerchantId).mockResolvedValue("m1");
    vi.mocked(mockActions.findOrCreateCustomer).mockResolvedValue({
      id: "c1",
      phone: "9841234567",
      name: "Hari",
    });
    vi.mocked(mockActions.linkCustomerToMerchant).mockResolvedValue({
      id: "mc1",
    });
    vi.mocked(mockActions.createCreditLog).mockResolvedValue({
      id: "cl1",
      status: "pending",
    });

    render(<MerchantScanPage />);

    await waitFor(() => {
      expect(screen.getByTestId("qr-scanner")).toBeInTheDocument();
    });

    // Step 1: Scan
    await userEvent.click(screen.getByTestId("mock-scan-valid"));

    await waitFor(() => {
      expect(screen.getByText("Enter Details")).toBeInTheDocument();
    });

    // Step 2: Enter details
    await userEvent.type(screen.getByPlaceholderText("0"), "2000");
    await userEvent.type(
      screen.getByPlaceholderText("e.g. Rice 10kg, Milk 2L"),
      "Groceries"
    );
    await userEvent.click(screen.getByText("Continue"));

    await waitFor(() => {
      expect(screen.getByText("Confirm Entry")).toBeInTheDocument();
    });

    // Step 3: Confirm and save
    await userEvent.click(screen.getByText("Save Entry"));

    // Verify success by checking for unique success indicators
    await waitFor(() => {
      expect(screen.getByText("Scan Another")).toBeInTheDocument();
    });

    // Verify all action functions called with correct data
    expect(mockActions.findOrCreateCustomer).toHaveBeenCalledWith(
      "9841234567"
    );
    expect(mockActions.linkCustomerToMerchant).toHaveBeenCalledWith(
      "m1",
      "c1"
    );
    expect(mockActions.createCreditLog).toHaveBeenCalledWith({
      merchant_id: "m1",
      customer_id: "c1",
      amount: 2000,
      description: "Groceries",
      type: "debit",
      status: "pending",
      sync_status: "online",
    });
  });

  it("shows summary with customer name on success", async () => {
    vi.mocked(mockAuth.getCurrentMerchantId).mockResolvedValue("m1");
    vi.mocked(mockActions.findOrCreateCustomer).mockResolvedValue({
      id: "c1",
      phone: "9841234567",
      name: "Hari",
    });
    vi.mocked(mockActions.linkCustomerToMerchant).mockResolvedValue({
      id: "mc1",
    });
    vi.mocked(mockActions.createCreditLog).mockResolvedValue({
      id: "cl1",
      status: "pending",
    });

    render(<MerchantScanPage />);

    await waitFor(() => {
      expect(screen.getByTestId("qr-scanner")).toBeInTheDocument();
    });

    await userEvent.click(screen.getByTestId("mock-scan-valid"));
    await waitFor(() => {
      expect(screen.getByText("Enter Details")).toBeInTheDocument();
    });
    await userEvent.type(screen.getByPlaceholderText("0"), "1000");
    await userEvent.click(screen.getByText("Continue"));
    await waitFor(() => {
      expect(screen.getByText("Confirm Entry")).toBeInTheDocument();
    });
    await userEvent.click(screen.getByText("Save Entry"));

    await waitFor(() => {
      expect(
        screen.getByText((c) => c.includes("Credit of Rs.") && c.includes("added for Hari"))
      ).toBeInTheDocument();
    });
  });

  it("'Scan Another' button resets flow from success to scan", async () => {
    vi.mocked(mockAuth.getCurrentMerchantId).mockResolvedValue("m1");
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

    render(<MerchantScanPage />);

    await waitFor(() => {
      expect(screen.getByTestId("qr-scanner")).toBeInTheDocument();
    });

    await userEvent.click(screen.getByTestId("mock-scan-valid"));
    await waitFor(() => {
      expect(screen.getByText("Enter Details")).toBeInTheDocument();
    });
    await userEvent.type(screen.getByPlaceholderText("0"), "500");
    await userEvent.click(screen.getByText("Continue"));
    await waitFor(() => {
      expect(screen.getByText("Confirm Entry")).toBeInTheDocument();
    });
    await userEvent.click(screen.getByText("Save Entry"));

    await waitFor(() => {
      expect(screen.getByText("Scan Another")).toBeInTheDocument();
    });

    await userEvent.click(screen.getByText("Scan Another"));

    await waitFor(() => {
      expect(screen.getByText("Scan Customer QR")).toBeInTheDocument();
    });
  });

  it("'View Ledger' on success links to /merchant/logs", async () => {
    vi.mocked(mockAuth.getCurrentMerchantId).mockResolvedValue("m1");
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

    render(<MerchantScanPage />);

    await waitFor(() => {
      expect(screen.getByTestId("qr-scanner")).toBeInTheDocument();
    });

    await userEvent.click(screen.getByTestId("mock-scan-valid"));
    await waitFor(() => {
      expect(screen.getByText("Enter Details")).toBeInTheDocument();
    });
    await userEvent.type(screen.getByPlaceholderText("0"), "500");
    await userEvent.click(screen.getByText("Continue"));
    await waitFor(() => {
      expect(screen.getByText("Confirm Entry")).toBeInTheDocument();
    });
    await userEvent.click(screen.getByText("Save Entry"));

    await waitFor(() => {
      expect(screen.getByText("Scan Another")).toBeInTheDocument();
    });

    const viewLedger = screen.getByText("View Ledger").closest("a");
    expect(viewLedger).toHaveAttribute("href", "/merchant/logs");
  });

  it("'Edit' button returns from confirm to enter step", async () => {
    render(<MerchantScanPage />);

    await waitFor(() => {
      expect(screen.getByTestId("qr-scanner")).toBeInTheDocument();
    });

    await userEvent.click(screen.getByTestId("mock-scan-valid"));
    await waitFor(() => {
      expect(screen.getByText("Enter Details")).toBeInTheDocument();
    });
    await userEvent.type(screen.getByPlaceholderText("0"), "1000");
    await userEvent.click(screen.getByText("Continue"));
    await waitFor(() => {
      expect(screen.getByText("Confirm Entry")).toBeInTheDocument();
    });

    await userEvent.click(screen.getByText("Edit"));

    await waitFor(() => {
      expect(screen.getByText("Enter Details")).toBeInTheDocument();
    });
    expect(screen.queryByText("Confirm Entry")).not.toBeInTheDocument();
  });

  it("stays on confirm step when save fails", async () => {
    vi.mocked(mockAuth.getCurrentMerchantId).mockResolvedValue("m1");
    vi.mocked(mockActions.findOrCreateCustomer).mockRejectedValue(
      new Error("Network error")
    );

    render(<MerchantScanPage />);

    await waitFor(() => {
      expect(screen.getByTestId("qr-scanner")).toBeInTheDocument();
    });

    await userEvent.click(screen.getByTestId("mock-scan-valid"));
    await waitFor(() => {
      expect(screen.getByText("Enter Details")).toBeInTheDocument();
    });
    await userEvent.type(screen.getByPlaceholderText("0"), "1000");
    await userEvent.click(screen.getByText("Continue"));
    await waitFor(() => {
      expect(screen.getByText("Confirm Entry")).toBeInTheDocument();
    });

    await userEvent.click(screen.getByText("Save Entry"));

    await waitFor(() => {
      expect(screen.getByText("Confirm Entry")).toBeInTheDocument();
    });
    expect(screen.queryByText("Scan Another")).not.toBeInTheDocument();
  });

  it("renders bottom navigation", async () => {
    render(<MerchantScanPage />);

    await waitFor(() => {
      expect(screen.getByTestId("bottom-nav")).toBeInTheDocument();
    });
  });
});
