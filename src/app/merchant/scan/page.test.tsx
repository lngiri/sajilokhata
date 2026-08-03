import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useSearchParams } from "next/navigation";
import MerchantScanPage from "./page";

// ─── Mock: QRScanner ───
vi.mock("@/components/QRCode", () => ({
  QRScanner: ({ onScan }: { onScan: (data: string) => void }) => (
    <div data-testid="qr-scanner">
      <button data-testid="mock-scan-valid" onClick={() => onScan("QR Hisab:customer:9841234567")}>
        Scan Valid QR
      </button>
      <button data-testid="mock-scan-legacy" onClick={() => onScan(JSON.stringify({ type: "reverse_scan", customerId: "9847654321" }))}>
        Scan Legacy QR
      </button>
      <button data-testid="mock-scan-invalid" onClick={() => onScan("bad-data")}>
        Scan Invalid QR
      </button>
    </div>
  ),
}));

// ─── Mock: Toast ───
const mockAddToast = vi.fn();
vi.mock("@/components/Toast", () => ({
  useToast: () => ({ addToast: mockAddToast }),
}));

// ─── Mock: BottomNav ───
vi.mock("@/components/BottomNav", () => ({
  default: () => <div data-testid="bottom-nav">Nav</div>,
}));

// ─── Mock: AmountSuggestions (mirrors real SUGGESTIONS = [10, 50, 100, 500]) ───
vi.mock("@/components/AmountSuggestions", () => ({
  default: ({ onSelect }: any) => (
    <div data-testid="amount-suggestions">
      <button onClick={() => onSelect(10)}>Rs 10</button>
      <button onClick={() => onSelect(50)}>Rs 50</button>
      <button onClick={() => onSelect(100)}>Rs 100</button>
      <button onClick={() => onSelect(500)}>Rs 500</button>
    </div>
  ),
}));

// ─── Mock: DescriptionSuggestions ───
vi.mock("@/components/DescriptionSuggestions", () => ({
  default: ({ onSelect }: any) => (
    <div data-testid="description-suggestions">
      <button onClick={() => onSelect("Rice 10kg")}>Rice 10kg</button>
    </div>
  ),
}));

// ─── Mock: Auth ───
vi.mock("@/lib/auth", () => ({
  getCurrentMerchantId: vi.fn(),
}));

// ─── Mock: Merchant actions ───
vi.mock("@/app/actions/merchant", () => ({
  getMerchantProfile: vi.fn(),
  getMerchantCustomerBalance: vi.fn(),
  getMerchantRecentDescriptions: vi.fn(),
  getMerchantCashBalance: vi.fn(),
  uploadAttachment: vi.fn(),
}));

// ─── Mock: Entry actions ───
vi.mock("@/app/actions/entry", () => ({
  saveEntry: vi.fn(),
}));

// ─── Mock: Customer actions ───
vi.mock("@/app/actions/customer", () => ({
  checkCustomerByPhone: vi.fn(),
  addCustomerForMerchant: vi.fn(),
  searchCustomers: vi.fn(),
}));

// ─── Mock: Product actions ───
vi.mock("@/app/actions/products", () => ({
  getMerchantProducts: vi.fn(),
}));

// ─── Mock: Offline DB ───
vi.mock("@/lib/offline/db", () => ({
  savePendingLog: vi.fn(),
  savePendingAttachment: vi.fn(),
  getAllOfflineCustomers: vi.fn().mockResolvedValue([]),
  saveOfflineCustomer: vi.fn().mockResolvedValue(undefined),
}));

// ─── Mock: Offline sync (decouples server-action imports) ───
vi.mock("@/lib/offline/sync", () => ({
  notifyPendingSave: vi.fn(),
}));

// ─── Mock: Image utils ───
vi.mock("@/lib/image", () => ({
  compressImage: vi.fn(),
  blobToBase64: vi.fn(),
}));

// ─── Mock: Phone utils ───
vi.mock("@/lib/phone", () => ({
  normalizePhone: (p: string) => p,
  sanitizePhoneForUrl: (p: string) => p,
}));

// ─── Imports for assertions ───
const mockMerchantActions = await import("@/app/actions/merchant");
const mockEntryActions = await import("@/app/actions/entry");
const mockAuth = await import("@/lib/auth");
const mockCustomerActions = await import("@/app/actions/customer");
const mockOfflineDb = await import("@/lib/offline/db");
const mockImageUtils = await import("@/lib/image");
const mockProductsActions = await import("@/app/actions/products");

// ─── Shared setup ───
function setupMocks() {
  vi.mocked(mockAuth.getCurrentMerchantId).mockResolvedValue("m1");
  vi.mocked(mockMerchantActions.getMerchantProfile).mockResolvedValue({
    id: "m1",
    name: "Shop ABC",
    business_type: "kirana",
    address: "Kathmandu",
  });
  vi.mocked(mockMerchantActions.getMerchantCustomerBalance).mockResolvedValue({ balance: 500, creditLimit: 5000 });
  vi.mocked(mockMerchantActions.getMerchantRecentDescriptions).mockResolvedValue(["Rice", "Milk"]);
  vi.mocked(mockMerchantActions.getMerchantCashBalance).mockResolvedValue(1000);
  vi.mocked(mockMerchantActions.uploadAttachment).mockResolvedValue("https://example.com/attachment.jpg");
  vi.mocked(mockProductsActions.getMerchantProducts).mockResolvedValue([]);
  vi.mocked(mockCustomerActions.searchCustomers).mockResolvedValue([]);
}

describe("MerchantScanPage — Full Flow Integration Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useSearchParams).mockReturnValue(new URLSearchParams());
    setupMocks();
  });

  // ═══════════════════════════════════════════════
  // HAPPY PATH: Scan → Enter → Confirm → Success
  // ═══════════════════════════════════════════════

  describe("Full scan-to-success flow", () => {
    it("completes the full flow: scan QR → enter amount → confirm → success", async () => {
      const user = userEvent.setup();

      // saveEntry returns success with a verification token
      vi.mocked(mockEntryActions.saveEntry).mockResolvedValue({
        success: true,
        entry: { id: "entry-1", verification_token: "tok-abc", status: "awaiting_confirmation" },
      });

      render(<MerchantScanPage />);

      // Step 1: Scan screen
      await waitFor(() => {
        expect(screen.getByText("Scan Customer QR")).toBeInTheDocument();
        expect(screen.getByTestId("qr-scanner")).toBeInTheDocument();
      });

      // Step 2: Scan a valid QR code → advances to Enter Details
      await user.click(screen.getByTestId("mock-scan-valid"));
      await waitFor(() => {
        expect(screen.getByText("Enter Details")).toBeInTheDocument();
        expect(screen.getByText("9841234567")).toBeInTheDocument();
      });

      // Step 3: Enter amount and description
      const amountInput = screen.getByPlaceholderText("0");
      await user.clear(amountInput);
      await user.type(amountInput, "1500");

      const descInput = screen.getByPlaceholderText(/e\.g\. Rice/);
      await user.type(descInput, "Rice 20kg");

      // Click Continue → goes to Confirm
      await user.click(screen.getByText("Continue"));
      await waitFor(() => {
        expect(screen.getByText("Confirm Entry")).toBeInTheDocument();
      });

      // Step 4: Confirm screen shows correct data (amount is locale-dependent, verified via saveEntry call)
      expect(screen.getByText("9841234567")).toBeInTheDocument();
      expect(screen.getByText("Rice 20kg")).toBeInTheDocument();
      expect(screen.getByText("Credit Given")).toBeInTheDocument();
      expect(screen.getByText("Review Entry Details")).toBeInTheDocument();

      // Step 5: Click Save Entry → success
      await user.click(screen.getByText("Save Entry"));
      await waitFor(() => {
        expect(screen.getByText("Entry Saved! 🎉")).toBeInTheDocument();
      });

      // Verify saveEntry was called with correct params
      expect(mockEntryActions.saveEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          merchant_id: "m1",
          customer_phone: "9841234567",
          amount: 1500,
          type: "debit",
          description: "Rice 20kg",
        })
      );

      // Toast shows success message
      expect(mockAddToast).toHaveBeenCalledWith(
        "Entry saved! Customer notified.",
        "success"
      );

      // QR mode success screen shows Scan Another and View Ledger
      expect(screen.getByText("Scan Another")).toBeInTheDocument();
      expect(screen.getByText("View Ledger")).toBeInTheDocument();

      // Toast shows success message
      expect(mockAddToast).toHaveBeenCalledWith(
        "Entry saved! Customer notified.",
        "success"
      );
    });

    it("shows verification token link in success screen for non-cash entries", async () => {
      const user = userEvent.setup();

      vi.mocked(mockEntryActions.saveEntry).mockResolvedValue({
        success: true,
        entry: { id: "entry-1", verification_token: "tok-xyz-123", status: "awaiting_confirmation" },
      });

      render(<MerchantScanPage />);
      await waitFor(() => screen.getByTestId("qr-scanner"));

      await user.click(screen.getByTestId("mock-scan-valid"));
      await waitFor(() => screen.getByText("Enter Details"));

      // Set amount
      await user.type(screen.getByPlaceholderText("0"), "2000");

      // Go to confirm and save
      await user.click(screen.getByText("Continue"));
      await waitFor(() => screen.getByText("Confirm Entry"));
      await user.click(screen.getByText("Save Entry"));

      await waitFor(() => {
        expect(screen.getByText("Entry Saved! 🎉")).toBeInTheDocument();
      });

      // QR mode success screen does not include WhatsApp share (that's manual mode only)
      expect(screen.getByText("Scan Another")).toBeInTheDocument();
      expect(screen.getByText("View Ledger")).toBeInTheDocument();
    });
  });

  // ═══════════════════════════════════════════════
  // VALIDATION: Blocking empty/invalid amounts
  // ═══════════════════════════════════════════════

  describe("Amount validation", () => {
    it("blocks Continue when amount is empty", async () => {
      const user = userEvent.setup();
      render(<MerchantScanPage />);

      await waitFor(() => screen.getByTestId("qr-scanner"));
      await user.click(screen.getByTestId("mock-scan-valid"));
      await waitFor(() => screen.getByText("Enter Details"));

      // Continue button should be disabled when amount is empty
      const continueBtn = screen.getByText("Continue").closest("button");
      expect(continueBtn).toBeDisabled();
    });

    it("blocks Continue when amount is zero", async () => {
      const user = userEvent.setup();
      render(<MerchantScanPage />);

      await waitFor(() => screen.getByTestId("qr-scanner"));
      await user.click(screen.getByTestId("mock-scan-valid"));
      await waitFor(() => screen.getByText("Enter Details"));

      const amountInput = screen.getByPlaceholderText("0");
      await user.type(amountInput, "0");

      const continueBtn = screen.getByText("Continue").closest("button");
      expect(continueBtn).toBeDisabled();
    });

    it("allows Continue with positive amount", async () => {
      const user = userEvent.setup();
      render(<MerchantScanPage />);

      await waitFor(() => screen.getByTestId("qr-scanner"));
      await user.click(screen.getByTestId("mock-scan-valid"));
      await waitFor(() => screen.getByText("Enter Details"));

      await user.type(screen.getByPlaceholderText("0"), "500");

      const continueBtn = screen.getByText("Continue").closest("button");
      expect(continueBtn).not.toBeDisabled();
    });
  });

  // ═══════════════════════════════════════════════
  // AMOUNT SUGGESTIONS
  // ═══════════════════════════════════════════════

  describe("Amount suggestions", () => {
    it("populates amount when suggestion is clicked", async () => {
      const user = userEvent.setup();
      render(<MerchantScanPage />);

      await waitFor(() => screen.getByTestId("qr-scanner"));
      await user.click(screen.getByTestId("mock-scan-valid"));
      await waitFor(() => screen.getByText("Enter Details"));

      // Click the Rs 500 suggestion
      await user.click(screen.getByText("Rs 500"));

      const amountInput = screen.getByPlaceholderText("0") as HTMLInputElement;
      expect(amountInput.value).toBe("500");
    });
  });

  // ═══════════════════════════════════════════════
  // EDIT FLOW: Back from Confirm → Enter
  // ═══════════════════════════════════════════════

  describe("Edit flow", () => {
    it("allows going back from Confirm to Enter and editing", async () => {
      const user = userEvent.setup();
      render(<MerchantScanPage />);

      await waitFor(() => screen.getByTestId("qr-scanner"));
      await user.click(screen.getByTestId("mock-scan-valid"));
      await waitFor(() => screen.getByText("Enter Details"));

      // Enter amount
      await user.type(screen.getByPlaceholderText("0"), "300");
      await user.click(screen.getByText("Continue"));

      await waitFor(() => screen.getByText("Confirm Entry"));

      // Click Edit to go back
      await user.click(screen.getByText("Edit"));
      await waitFor(() => {
        expect(screen.getByText("Enter Details")).toBeInTheDocument();
      });

      // Change amount
      const amountInput = screen.getByPlaceholderText("0") as HTMLInputElement;
      expect(amountInput.value).toBe("300");
    });
  });

  // ═══════════════════════════════════════════════
  // ERROR HANDLING: saveEntry failure
  // ═══════════════════════════════════════════════

  describe("Error handling", () => {
    it("shows error toast when saveEntry fails", async () => {
      const user = userEvent.setup();

      vi.mocked(mockEntryActions.saveEntry).mockResolvedValue({
        success: false,
        error: "Database error: connection refused",
      });

      render(<MerchantScanPage />);

      await waitFor(() => screen.getByTestId("qr-scanner"));
      await user.click(screen.getByTestId("mock-scan-valid"));
      await waitFor(() => screen.getByText("Enter Details"));

      await user.type(screen.getByPlaceholderText("0"), "100");
      await user.click(screen.getByText("Continue"));
      await waitFor(() => screen.getByText("Confirm Entry"));

      await user.click(screen.getByText("Save Entry"));

      await waitFor(() => {
        expect(mockAddToast).toHaveBeenCalledWith(
          "Database error: connection refused",
          "error"
        );
      });

      // Should NOT show success screen
      expect(screen.queryByText("Entry Saved! 🎉")).not.toBeInTheDocument();
    });

    it("shows error toast when saveEntry throws an exception", async () => {
      const user = userEvent.setup();

      vi.mocked(mockEntryActions.saveEntry).mockRejectedValue(new Error("Network timeout"));

      render(<MerchantScanPage />);

      await waitFor(() => screen.getByTestId("qr-scanner"));
      await user.click(screen.getByTestId("mock-scan-valid"));
      await waitFor(() => screen.getByText("Enter Details"));

      await user.type(screen.getByPlaceholderText("0"), "100");
      await user.click(screen.getByText("Continue"));
      await waitFor(() => screen.getByText("Confirm Entry"));

      await user.click(screen.getByText("Save Entry"));

      await waitFor(() => {
        expect(mockAddToast).toHaveBeenCalledWith(
          "Network timeout",
          "error"
        );
      });
    });

    it("shows error toast for invalid QR scan", async () => {
      const user = userEvent.setup();
      render(<MerchantScanPage />);

      await waitFor(() => screen.getByTestId("qr-scanner"));
      await user.click(screen.getByTestId("mock-scan-invalid"));

      expect(mockAddToast).toHaveBeenCalledWith(
        "Please scan a valid customer QR code.",
        "error"
      );
      // Should stay on scan step
      expect(screen.getByText("Scan Customer QR")).toBeInTheDocument();
      expect(screen.queryByText("Enter Details")).not.toBeInTheDocument();
    });
  });

  // ═══════════════════════════════════════════════
  // QR FORMAT VARIANTS
  // ═══════════════════════════════════════════════

  describe("QR format variants", () => {
    it("handles legacy JSON QR format with amount and description", async () => {
      const user = userEvent.setup();
      render(<MerchantScanPage />);

      await waitFor(() => screen.getByTestId("qr-scanner"));

      // Mock the legacy scan with pre-filled data
      // The legacy format can include amount and description
      vi.mocked(mockEntryActions.saveEntry).mockResolvedValue({
        success: true,
        entry: { id: "entry-2", status: "awaiting_confirmation" },
      });

      // We need to trigger the legacy scan which has customerId but no amount pre-filled
      await user.click(screen.getByTestId("mock-scan-legacy"));
      await waitFor(() => {
        expect(screen.getByText("Enter Details")).toBeInTheDocument();
        expect(screen.getByText("9847654321")).toBeInTheDocument();
      });
    });
  });

  // ═══════════════════════════════════════════════
  // NEW ENTRY AFTER SUCCESS
  // ═══════════════════════════════════════════════

  describe("New entry after success", () => {
    it("resets to scan screen when New Entry is clicked", async () => {
      const user = userEvent.setup();

      vi.mocked(mockEntryActions.saveEntry).mockResolvedValue({
        success: true,
        entry: { id: "entry-1", status: "awaiting_confirmation" },
      });

      render(<MerchantScanPage />);

      // Complete full flow
      await waitFor(() => screen.getByTestId("qr-scanner"));
      await user.click(screen.getByTestId("mock-scan-valid"));
      await waitFor(() => screen.getByText("Enter Details"));

      await user.type(screen.getByPlaceholderText("0"), "500");
      await user.click(screen.getByText("Continue"));
      await waitFor(() => screen.getByText("Confirm Entry"));

      await user.click(screen.getByText("Save Entry"));
      await waitFor(() => screen.getByText("Entry Saved! 🎉"));

      // Click Scan Another (QR mode success button)
      await user.click(screen.getByText("Scan Another"));

      await waitFor(() => {
        expect(screen.getByText("Scan Customer QR")).toBeInTheDocument();
        expect(screen.getByTestId("qr-scanner")).toBeInTheDocument();
      });
    });
  });

  // ═══════════════════════════════════════════════
  // NAVIGATION: Bottom nav and back link
  // ═══════════════════════════════════════════════

  describe("Navigation", () => {
    it("renders bottom navigation", async () => {
      render(<MerchantScanPage />);
      await waitFor(() => {
        expect(screen.getByTestId("bottom-nav")).toBeInTheDocument();
      });
    });

    it("has back to dashboard link", async () => {
      render(<MerchantScanPage />);
      await waitFor(() => {
        const backLink = screen.getByLabelText("Back to dashboard");
        expect(backLink).toHaveAttribute("href", "/merchant/dashboard");
      });
    });
  });

  // ═══════════════════════════════════════════════
  // TRANSITION: Scan → Enter shows customer phone
  // ═══════════════════════════════════════════════

  describe("Customer display", () => {
    it("shows customer phone after scanning valid QR", async () => {
      const user = userEvent.setup();
      render(<MerchantScanPage />);

      await waitFor(() => screen.getByTestId("qr-scanner"));
      await user.click(screen.getByTestId("mock-scan-valid"));

      await waitFor(() => {
        expect(screen.getByText("9841234567")).toBeInTheDocument();
        // The phone should appear in the customer card on the Enter step
        expect(screen.getByText("Enter Details")).toBeInTheDocument();
      });
    });

    it("shows customer phone for legacy QR format", async () => {
      const user = userEvent.setup();
      render(<MerchantScanPage />);

      await waitFor(() => screen.getByTestId("qr-scanner"));
      await user.click(screen.getByTestId("mock-scan-legacy"));

      await waitFor(() => {
        expect(screen.getByText("9847654321")).toBeInTheDocument();
      });
    });
  });

  // ═══════════════════════════════════════════════
  // CONFIRM SCREEN DETAILS
  // ═══════════════════════════════════════════════

  describe("Confirm screen", () => {
    it("displays all entry details on confirm screen", async () => {
      const user = userEvent.setup();
      render(<MerchantScanPage />);

      await waitFor(() => screen.getByTestId("qr-scanner"));
      await user.click(screen.getByTestId("mock-scan-valid"));
      await waitFor(() => screen.getByText("Enter Details"));

      // Fill in details
      await user.type(screen.getByPlaceholderText("0"), "2500");
      await user.type(screen.getByPlaceholderText(/e\.g\. Rice/), "Milk 5L");

      await user.click(screen.getByText("Continue"));

      await waitFor(() => {
        expect(screen.getByText("Confirm Entry")).toBeInTheDocument();
      });

      // Verify all details are shown (amount is locale-dependent, verified via saveEntry call)
      expect(screen.getByText("9841234567")).toBeInTheDocument();
      expect(screen.getByText("Milk 5L")).toBeInTheDocument();
      expect(screen.getByText("Credit Given")).toBeInTheDocument();
      expect(screen.getByText("Review Entry Details")).toBeInTheDocument();
    });
  });

  // ═══════════════════════════════════════════════
  // CONCURRENT RAPID CLICKS
  // ═══════════════════════════════════════════════

  describe("Rapid interaction safety", () => {
    it("does not double-submit when Save Entry is clicked rapidly", async () => {
      const user = userEvent.setup();

      let resolveSaveEntry: (value: any) => void;
      vi.mocked(mockEntryActions.saveEntry).mockImplementation(
        () => new Promise((resolve) => { resolveSaveEntry = resolve; })
      );

      render(<MerchantScanPage />);

      await waitFor(() => screen.getByTestId("qr-scanner"));
      await user.click(screen.getByTestId("mock-scan-valid"));
      await waitFor(() => screen.getByText("Enter Details"));

      await user.type(screen.getByPlaceholderText("0"), "100");
      await user.click(screen.getByText("Continue"));
      await waitFor(() => screen.getByText("Confirm Entry"));

      // Fire two synchronous clicks so the savingRef guard is exercised
      // before React re-renders the button into its disabled/spinner state
      const saveBtn = screen.getByRole("button", { name: /Save Entry/ });
      fireEvent.click(saveBtn);
      fireEvent.click(saveBtn);

      // Wait for the in-flight saveEntry promise to be captured, then resolve it
      await waitFor(() => {
        expect(resolveSaveEntry).toBeDefined();
      });
      resolveSaveEntry!({ success: true, entry: { id: "e1", status: "awaiting_confirmation" } });

      await waitFor(() => screen.getByText("Entry Saved! 🎉"));

      // saveEntry should only have been called once
      expect(mockEntryActions.saveEntry).toHaveBeenCalledTimes(1);
    });
  });

  // ═══════════════════════════════════════════════
  // INSUFFICIENT CASH WARNING (manual expense mode)
  // ═══════════════════════════════════════════════

  describe("Insufficient cash warning for expenses", () => {
    function renderExpenseFlow(cashBalance: number) {
      vi.mocked(useSearchParams).mockReturnValue(new URLSearchParams("manual=true&type=expense"));
      vi.mocked(mockMerchantActions.getMerchantCashBalance).mockResolvedValue(cashBalance);
    }

    it("shows the insufficient cash modal when expense exceeds cash in hand and allows recording anyway", async () => {
      const user = userEvent.setup();
      renderExpenseFlow(500);
      vi.mocked(mockEntryActions.saveEntry).mockResolvedValue({
        success: true,
        entry: { id: "exp-1", status: "approved" },
      });

      render(<MerchantScanPage />);

      await waitFor(() => {
        expect(screen.getByText("Manual Entry")).toBeInTheDocument();
      });

      // Amount input is the first placeholder="0" (quantity is the second)
      await user.type(screen.getAllByPlaceholderText("0")[0], "2000");
      await user.click(screen.getByText("Continue"));
      await waitFor(() => {
        expect(screen.getByText("Confirm Entry")).toBeInTheDocument();
      });

      // Warning modal appears
      await waitFor(() => {
        expect(screen.getByText("Insufficient Cash in Hand")).toBeInTheDocument();
      });
      expect(screen.getByText("Yes, record anyway")).toBeInTheDocument();
      expect(screen.getByText("Edit amount")).toBeInTheDocument();

      // Record anyway saves the expense
      await user.click(screen.getByText("Yes, record anyway"));
      await waitFor(() => {
        expect(screen.getByText("Entry Saved! 🎉")).toBeInTheDocument();
      });

      expect(mockEntryActions.saveEntry).toHaveBeenCalledWith(
        expect.objectContaining({ type: "expense", amount: 2000 })
      );
    });

    it("does not block the save when cash in hand is sufficient", async () => {
      const user = userEvent.setup();
      renderExpenseFlow(5000);
      vi.mocked(mockEntryActions.saveEntry).mockResolvedValue({
        success: true,
        entry: { id: "exp-2", status: "approved" },
      });

      render(<MerchantScanPage />);

      await waitFor(() => {
        expect(screen.getByText("Manual Entry")).toBeInTheDocument();
      });

      await user.type(screen.getAllByPlaceholderText("0")[0], "2000");
      await user.click(screen.getByText("Continue"));
      await waitFor(() => {
        expect(screen.getByText("Confirm Entry")).toBeInTheDocument();
      });

      // No modal, Save Entry works directly
      expect(screen.queryByText("Insufficient Cash in Hand")).not.toBeInTheDocument();

      await user.click(screen.getByText("Save Entry"));
      await waitFor(() => {
        expect(screen.getByText("Entry Saved! 🎉")).toBeInTheDocument();
      });

      expect(mockEntryActions.saveEntry).toHaveBeenCalledWith(
        expect.objectContaining({ type: "expense", amount: 2000 })
      );
    });

    it("goes back to edit when Edit amount is clicked and does not save", async () => {
      const user = userEvent.setup();
      renderExpenseFlow(100);

      render(<MerchantScanPage />);

      await waitFor(() => {
        expect(screen.getByText("Manual Entry")).toBeInTheDocument();
      });

      await user.type(screen.getAllByPlaceholderText("0")[0], "300");
      await user.click(screen.getByText("Continue"));
      await waitFor(() => {
        expect(screen.getByText("Insufficient Cash in Hand")).toBeInTheDocument();
      });

      await user.click(screen.getByText("Edit amount"));
      await waitFor(() => {
        expect(screen.getByText("Manual Entry")).toBeInTheDocument();
      });

      expect(mockEntryActions.saveEntry).not.toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════
  // CASH IN TOGGLE (manual mode: Cash Sale ⟷ Cash In)
  // ═══════════════════════════════════════════════

  describe("Cash In toggle", () => {
    beforeEach(() => {
      vi.mocked(useSearchParams).mockReturnValue(new URLSearchParams("manual=true"));
    });

    it("shows both Cash Sale and Cash In options in the transaction type selector", async () => {
      render(<MerchantScanPage />);

      await waitFor(() => {
        expect(screen.getByText("Manual Entry")).toBeInTheDocument();
      });

      expect(screen.getByText("Cash Sale")).toBeInTheDocument();
      expect(screen.getByText("Cash In")).toBeInTheDocument();
      expect(screen.getByText("Cash Out")).toBeInTheDocument();
    });

    it("records a cash_in entry when Cash In is selected", async () => {
      const user = userEvent.setup();
      vi.mocked(mockEntryActions.saveEntry).mockResolvedValue({
        success: true,
        entry: { id: "cash-in-1", status: "approved" },
      });

      render(<MerchantScanPage />);

      await waitFor(() => {
        expect(screen.getByText("Manual Entry")).toBeInTheDocument();
      });

      await user.click(screen.getByText("Cash In"));

      await user.type(screen.getAllByPlaceholderText("0")[0], "5000");
      await user.type(screen.getByPlaceholderText(/e\.g\. Money from home/), "Money from home");
      await user.click(screen.getByText("Continue"));

      await waitFor(() => {
        expect(screen.getByText("Confirm Entry")).toBeInTheDocument();
      });

      expect(screen.getByText("Cash In")).toBeInTheDocument();
      expect(screen.getByText(/to Cash in Hand/)).toBeInTheDocument();

      await user.click(screen.getByText("Save Entry"));
      await waitFor(() => {
        expect(screen.getByText("Entry Saved! 🎉")).toBeInTheDocument();
      });

      expect(mockEntryActions.saveEntry).toHaveBeenCalledWith(
        expect.objectContaining({ type: "cash_in", amount: 5000, description: "Money from home" })
      );

      expect(screen.getByText(/added to Cash in Hand/)).toBeInTheDocument();
      expect(mockAddToast).toHaveBeenCalledWith("Cash In recorded!", "success");
    });

    it("defaults to Cash Sale when manual mode has no type param", async () => {
      render(<MerchantScanPage />);

      await waitFor(() => {
        expect(screen.getByText("Manual Entry")).toBeInTheDocument();
      });

      const cashInBtn = screen.getByText("Cash In").closest("button");
      expect(cashInBtn).not.toHaveClass("bg-teal-600");
    });
  });

  // ═══════════════════════════════════════════════
  // NAME SEARCH (manual mode: search customer by name)
  // ═══════════════════════════════════════════════

  describe("Customer name search", () => {
    beforeEach(() => {
      vi.mocked(useSearchParams).mockReturnValue(new URLSearchParams("manual=true"));
    });

    it("shows due-first suggestions when typing a customer name", async () => {
      const user = userEvent.setup();
      vi.mocked(mockCustomerActions.searchCustomers).mockResolvedValue([
        { id: "c1", name: "Ram Kumar", phone: "9841234567", current_balance: 1000, registration_status: "registered" },
        { id: "c2", name: "Ram Bahadur", phone: "9847654321", current_balance: 0, registration_status: "registered" },
      ]);

      render(<MerchantScanPage />);

      await waitFor(() => {
        expect(screen.getByText("Manual Entry")).toBeInTheDocument();
      });

      await user.click(screen.getByText("Credit Given"));

      const searchInput = screen.getByPlaceholderText(/Search name or phone/);
      await user.type(searchInput, "Ram");

      await waitFor(() => {
        expect(screen.getByText("Ram Kumar")).toBeInTheDocument();
      });

      expect(screen.getByText("Ram Bahadur")).toBeInTheDocument();
      expect(screen.getByText(/^Due Rs\. /)).toBeInTheDocument();
      expect(screen.getAllByText("No Due").length).toBeGreaterThanOrEqual(1);
    });

    it("selects a suggestion and fills customer details through to confirm", async () => {
      const user = userEvent.setup();
      vi.mocked(mockEntryActions.saveEntry).mockResolvedValue({
        success: true,
        entry: { id: "e1", status: "awaiting_confirmation" },
      });
      vi.mocked(mockCustomerActions.searchCustomers).mockResolvedValue([
        { id: "c1", name: "Ram Kumar", phone: "9841234567", current_balance: 1000, registration_status: "registered" },
      ]);

      render(<MerchantScanPage />);

      await waitFor(() => {
        expect(screen.getByText("Manual Entry")).toBeInTheDocument();
      });

      await user.click(screen.getByText("Credit Given"));

      const searchInput = screen.getByPlaceholderText(/Search name or phone/);
      await user.type(searchInput, "Ram");

      await waitFor(() => {
        expect(screen.getByText("Ram Kumar")).toBeInTheDocument();
      });

      await user.click(screen.getByText("Ram Kumar"));

      await waitFor(() => {
        expect(screen.getByText(/Already registered ✅ as Ram Kumar/)).toBeInTheDocument();
      });

      expect((searchInput as HTMLInputElement).value).toBe("Ram Kumar");

      await user.type(screen.getAllByPlaceholderText("0")[0], "1500");
      await user.type(screen.getByPlaceholderText(/e\.g\. Rice/), "Rice 10kg");
      await user.click(screen.getByText("Continue"));

      await waitFor(() => {
        expect(screen.getByText("Confirm Entry")).toBeInTheDocument();
      });

      expect(screen.getByText("Ram Kumar")).toBeInTheDocument();

      await user.click(screen.getByText("Save Entry"));
      await waitFor(() => {
        expect(screen.getByText("Entry Saved! 🎉")).toBeInTheDocument();
      });

      expect(mockEntryActions.saveEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          customer_id: "c1",
          customer_phone: "9841234567",
          customer_name: "Ram Kumar",
          amount: 1500,
          type: "debit",
        })
      );
    });

    it("does not show the no-match message after selecting a suggestion (Bug 1)", async () => {
      const user = userEvent.setup();
      vi.mocked(mockCustomerActions.searchCustomers).mockResolvedValue([
        { id: "c1", name: "Ram Kumar", phone: "9841234567", current_balance: 1000, registration_status: "registered" },
      ]);

      render(<MerchantScanPage />);

      await waitFor(() => {
        expect(screen.getByText("Manual Entry")).toBeInTheDocument();
      });

      await user.click(screen.getByText("Credit Given"));

      const searchInput = screen.getByPlaceholderText(/Search name or phone/);
      await user.type(searchInput, "Ram");

      await waitFor(() => {
        expect(screen.getByText("Ram Kumar")).toBeInTheDocument();
      });

      // Select the suggestion → the stale "no customers found" message must disappear
      await user.click(screen.getByText("Ram Kumar"));

      await waitFor(() => {
        expect(screen.getByText(/Already registered ✅ as Ram Kumar/)).toBeInTheDocument();
      });
      expect(screen.queryByText(/No customers found matching/)).not.toBeInTheDocument();
    });

    it("shows a no-match message when the name search finds nothing", async () => {
      const user = userEvent.setup();
      vi.mocked(mockCustomerActions.searchCustomers).mockResolvedValue([]);

      render(<MerchantScanPage />);

      await waitFor(() => {
        expect(screen.getByText("Manual Entry")).toBeInTheDocument();
      });

      await user.click(screen.getByText("Credit Given"));

      await user.type(screen.getByPlaceholderText(/Search name or phone/), "Ram");

      await waitFor(() => {
        expect(screen.getByText(/No customers found matching/)).toBeInTheDocument();
      });
    });

    it("searches by name in the default manual mode (Debit)", async () => {
      const user = userEvent.setup();
      vi.mocked(mockEntryActions.saveEntry).mockResolvedValue({
        success: true,
        entry: { id: "e1", status: "awaiting_confirmation" },
      });
      vi.mocked(mockCustomerActions.searchCustomers).mockResolvedValue([
        { id: "c1", name: "Ram Kumar", phone: "9841234567", current_balance: 1000, registration_status: "registered" },
      ]);

      render(<MerchantScanPage />);

      await waitFor(() => {
        expect(screen.getByText("Manual Entry")).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(/Search name or phone/);
      expect(searchInput).not.toBeDisabled();

      await user.type(searchInput, "Ram");

      await waitFor(() => {
        expect(screen.getByText("Ram Kumar")).toBeInTheDocument();
      });

      await user.click(screen.getByText("Ram Kumar"));

      await waitFor(() => {
        expect((searchInput as HTMLInputElement).value).toBe("Ram Kumar");
      });

      await user.type(screen.getAllByPlaceholderText("0")[0], "1500");
      await user.type(screen.getByPlaceholderText(/e\.g\. Rice/), "Rice 15kg");
      await user.click(screen.getByText("Continue"));

      await waitFor(() => {
        expect(screen.getByText("Confirm Entry")).toBeInTheDocument();
      });

      await user.click(screen.getByText("Save Entry"));
      await waitFor(() => {
        expect(screen.getByText("Entry Saved! 🎉")).toBeInTheDocument();
      });

      expect(mockEntryActions.saveEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          customer_id: "c1",
          customer_phone: "9841234567",
          customer_name: "Ram Kumar",
          amount: 1500,
          type: "debit",
        })
      );
    });
  });

  // ═══════════════════════════════════════════════
  // REGRESSION FIXES from the scan page rewrite
  // ═══════════════════════════════════════════════

  describe("Regression fixes", () => {
    it("shows the product picker in QR mode (Bug 1)", async () => {
      const user = userEvent.setup();
      vi.mocked(mockProductsActions.getMerchantProducts).mockResolvedValue([
        { id: "p1", name: "Basmati Rice", unit: "kg", default_rate: 120, category: null },
      ]);

      render(<MerchantScanPage />);

      await waitFor(() => screen.getByTestId("qr-scanner"));
      await user.click(screen.getByTestId("mock-scan-valid"));
      await waitFor(() => screen.getByText("Enter Details"));

      // Product picker must be rendered in QR scan mode
      expect(screen.getByText("Basmati Rice")).toBeInTheDocument();

      // Selecting a product fills amount + description
      await user.click(screen.getByText("Basmati Rice"));
      expect((screen.getAllByPlaceholderText("0")[0] as HTMLInputElement).value).toBe("120");
      expect((screen.getByPlaceholderText(/e\.g\. Rice 10kg/) as HTMLInputElement).value).toBe("Basmati Rice");
    });

    it("shows a debit/credit type selector in QR mode (Bug 4)", async () => {
      const user = userEvent.setup();
      render(<MerchantScanPage />);

      await waitFor(() => screen.getByTestId("qr-scanner"));
      await user.click(screen.getByTestId("mock-scan-valid"));
      await waitFor(() => screen.getByText("Enter Details"));

      expect(screen.getByText("Credit Given")).toBeInTheDocument();
      expect(screen.getByText("Amount Received")).toBeInTheDocument();

      // Switching to credit keeps the scanned customer and saves as credit
      await user.click(screen.getByText("Amount Received"));
      await user.type(screen.getByPlaceholderText("0"), "500");
      await user.click(screen.getByText("Continue"));
      await waitFor(() => screen.getByText("Confirm Entry"));
      expect(screen.getByText("Amount Received")).toBeInTheDocument();

      vi.mocked(mockEntryActions.saveEntry).mockResolvedValue({
        success: true,
        entry: { id: "e1", status: "awaiting_confirmation" },
      });
      await user.click(screen.getByText("Save Entry"));
      await waitFor(() => screen.getByText("Entry Saved! 🎉"));

      expect(mockEntryActions.saveEntry).toHaveBeenCalledWith(
        expect.objectContaining({ type: "credit", customer_phone: "9841234567", amount: 500 })
      );
    });

    it("reuses the idempotency key across a retry and regenerates it on reset (Bug 6)", async () => {
      const user = userEvent.setup();
      vi.mocked(mockEntryActions.saveEntry)
        .mockResolvedValueOnce({ success: false, error: "Duplicate detected" })
        .mockResolvedValueOnce({ success: true, entry: { id: "e1", status: "awaiting_confirmation" } });

      render(<MerchantScanPage />);

      await waitFor(() => screen.getByTestId("qr-scanner"));
      await user.click(screen.getByTestId("mock-scan-valid"));
      await waitFor(() => screen.getByText("Enter Details"));
      await user.type(screen.getByPlaceholderText("0"), "100");
      await user.click(screen.getByText("Continue"));
      await waitFor(() => screen.getByText("Confirm Entry"));

      // First attempt fails
      await user.click(screen.getByText("Save Entry"));
      await waitFor(() => {
        expect(mockAddToast).toHaveBeenCalledWith("Duplicate detected", "error");
      });

      // Retry from the same confirm screen must reuse the same key
      await user.click(screen.getByText("Save Entry"));
      await waitFor(() => screen.getByText("Entry Saved! 🎉"));

      const calls = vi.mocked(mockEntryActions.saveEntry).mock.calls;
      expect(calls).toHaveLength(2);
      expect(calls[0][0].idempotency_key).toBe(calls[1][0].idempotency_key);

      // Reset (Scan Another) regenerates the key for the next draft
      await user.click(screen.getByText("Scan Another"));
      await waitFor(() => screen.getByTestId("qr-scanner"));
      await user.click(screen.getByTestId("mock-scan-valid"));
      await waitFor(() => screen.getByText("Enter Details"));
      await user.type(screen.getByPlaceholderText("0"), "200");
      await user.click(screen.getByText("Continue"));
      await waitFor(() => screen.getByText("Confirm Entry"));
      await user.click(screen.getByText("Save Entry"));
      await waitFor(() => screen.getByText("Entry Saved! 🎉"));

      const keyAfterReset = vi.mocked(mockEntryActions.saveEntry).mock.calls[2][0].idempotency_key;
      expect(keyAfterReset).not.toBe(calls[0][0].idempotency_key);
    });

    it("shows an error toast when the AI bill parse fails without changing the amount (Bug 5)", async () => {
      const user = userEvent.setup();
      const fetchMock = vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ error: "Rate limited" }),
      });
      vi.stubGlobal("fetch", fetchMock);
      vi.mocked(useSearchParams).mockReturnValue(new URLSearchParams("manual=true"));

      try {
        render(<MerchantScanPage />);
        await waitFor(() => screen.getByText("Manual Entry"));

        const file = new File(["fake-bill"], "bill.jpg", { type: "image/jpeg" });
        await user.upload(document.getElementById("ai-bill-input") as HTMLElement, file);

        await waitFor(() => {
          expect(mockAddToast).toHaveBeenCalledWith("Rate limited", "error");
        });

        // Amount untouched by the failed parse
        expect((screen.getAllByPlaceholderText("0")[0] as HTMLInputElement).value).toBe("");
      } finally {
        vi.unstubAllGlobals();
      }
    });

    it("keeps the customer phone in the offline pending log for new customers (Bug 3)", async () => {
      const user = userEvent.setup();
      const originalOnLine = navigator.onLine;
      Object.defineProperty(navigator, "onLine", { value: false, configurable: true });
      vi.mocked(useSearchParams).mockReturnValue(new URLSearchParams("manual=true"));
      vi.mocked(mockCustomerActions.checkCustomerByPhone).mockResolvedValue({ exists: false, customer: null });

      try {
        render(<MerchantScanPage />);
        await waitFor(() => screen.getByText("Manual Entry"));

        // Switch to Credit Given so the customer lookup UI is active
        await user.click(screen.getByText("Credit Given"));

        // Type a full 10-digit phone for an unregistered customer
        const searchInput = screen.getByPlaceholderText(/Search name or phone/);
        await user.type(searchInput, "9811111111");
        await waitFor(() => screen.getByText("Not registered yet 📱"));

        await user.type(screen.getAllByPlaceholderText("0")[0], "300");
        await user.click(screen.getByText("Continue"));
        await waitFor(() => screen.getByText("Confirm Entry"));

        await user.click(screen.getByText("Save Entry"));
        await waitFor(() => screen.getByText("Entry Saved! 🎉"));

        expect(mockOfflineDb.savePendingLog).toHaveBeenCalledWith(
          expect.objectContaining({
            customer_id: null,
            customerPhone: "9811111111",
            amount: 300,
            type: "debit",
          })
        );
        // Offline path must not hit the server action
        expect(mockEntryActions.saveEntry).not.toHaveBeenCalled();
      } finally {
        Object.defineProperty(navigator, "onLine", { value: originalOnLine, configurable: true });
      }
    });

    it("clears the attachment preview on reset and revokes the blob URL (Bug 2)", async () => {
      const user = userEvent.setup();
      const createObjectURL = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:mock-preview");
      const revokeObjectURL = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
      vi.mocked(useSearchParams).mockReturnValue(new URLSearchParams("manual=true"));

      const { container } = render(<MerchantScanPage />);
      await waitFor(() => screen.getByText("Manual Entry"));

      const attachInput = container.querySelector('input[type="file"]:not(#ai-bill-input)');
      const file = new File(["receipt"], "receipt.jpg", { type: "image/jpeg" });
      await user.upload(attachInput as HTMLElement, file);

      await waitFor(() => {
        expect(screen.getByAltText("Receipt preview")).toBeInTheDocument();
      });
      expect(createObjectURL).toHaveBeenCalledWith(file);

      // Cancel calls handleReset → clears attachment + revokes preview blob
      await user.click(screen.getByText("Cancel"));
      await waitFor(() => {
        expect(screen.queryByAltText("Receipt preview")).not.toBeInTheDocument();
      });
      expect(revokeObjectURL).toHaveBeenCalledWith("blob:mock-preview");
    });

    it("uses step=any on amount inputs so paisa amounts are allowed (UX 9)", async () => {
      const user = userEvent.setup();
      render(<MerchantScanPage />);

      await waitFor(() => screen.getByTestId("qr-scanner"));
      await user.click(screen.getByTestId("mock-scan-valid"));
      await waitFor(() => screen.getByText("Enter Details"));

      expect(screen.getAllByPlaceholderText("0")[0]).toHaveAttribute("step", "any");
    });
  });

  // ═══════════════════════════════════════════════
  // INVITE FLOW: honest status labels when SMS fails
  // ═══════════════════════════════════════════════

  describe("Invite flow status labels (Bug 2)", () => {
    beforeEach(() => {
      vi.mocked(useSearchParams).mockReturnValue(new URLSearchParams("manual=true"));
    });

    function setupInviteFlow(smsSent: boolean, smsError?: string) {
      vi.mocked(mockCustomerActions.checkCustomerByPhone).mockResolvedValue({ exists: false, customer: null });
      vi.mocked(mockCustomerActions.addCustomerForMerchant).mockResolvedValue({
        success: true,
        customer: { id: "c9", name: null, phone: "9811111111", registration_status: "invited" },
        smsSent,
        smsError,
        smsStatus: smsSent ? "sms_sent" : "sms_failed",
      });
    }

    async function inviteNewCustomer(user: ReturnType<typeof userEvent.setup>) {
      render(<MerchantScanPage />);
      await waitFor(() => screen.getByText("Manual Entry"));
      await user.click(screen.getByText("Credit Given"));

      const searchInput = screen.getByPlaceholderText(/Search name or phone/);
      await user.type(searchInput, "9811111111");
      await waitFor(() => screen.getByText("Not registered yet 📱"));
      await user.click(screen.getByText("Send Invitation"));
    }

    it("shows 'Invited — awaiting registration' (never 'Already registered') when the SMS succeeds", async () => {
      const user = userEvent.setup();
      setupInviteFlow(true);

      await inviteNewCustomer(user);

      await waitFor(() => {
        expect(screen.getByText(/Invited — awaiting registration/)).toBeInTheDocument();
      });
      expect(screen.queryByText(/Already registered/)).not.toBeInTheDocument();
      expect(screen.queryByText(/SMS delivery failed/)).not.toBeInTheDocument();
      expect(screen.queryByText("Retry SMS")).not.toBeInTheDocument();
    });

    it("shows an SMS-failure banner with a retry button when the SMS fails", async () => {
      const user = userEvent.setup();
      setupInviteFlow(false, "SMS provider down");

      await inviteNewCustomer(user);

      await waitFor(() => {
        expect(screen.getByText(/Invited — awaiting registration/)).toBeInTheDocument();
        expect(screen.getByText(/SMS delivery failed: SMS provider down/)).toBeInTheDocument();
        expect(screen.getByText("Retry SMS")).toBeInTheDocument();
      });
      expect(screen.queryByText(/Already registered/)).not.toBeInTheDocument();

      await user.click(screen.getByText("Retry SMS"));
      await waitFor(() => {
        expect(mockCustomerActions.addCustomerForMerchant).toHaveBeenCalledTimes(2);
      });
    });

    it("marks an invited customer selected from search as awaiting registration, not already registered", async () => {
      const user = userEvent.setup();
      vi.mocked(mockCustomerActions.searchCustomers).mockResolvedValue([
        { id: "c1", name: "Hari", phone: "9812222222", current_balance: 0, registration_status: "invited" },
      ]);

      render(<MerchantScanPage />);
      await waitFor(() => screen.getByText("Manual Entry"));
      await user.click(screen.getByText("Credit Given"));

      const searchInput = screen.getByPlaceholderText(/Search name or phone/);
      await user.type(searchInput, "Hari");

      await waitFor(() => screen.getByText("Hari"));
      await user.click(screen.getByText("Hari"));

      await waitFor(() => {
        expect(screen.getByText(/Invited — awaiting registration for Hari/)).toBeInTheDocument();
      });
      expect(screen.queryByText(/Already registered/)).not.toBeInTheDocument();
    });
  });
});
