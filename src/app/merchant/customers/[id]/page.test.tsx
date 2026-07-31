import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CustomerDetailPage from "./page";

vi.mock("@/components/Toast", () => ({
  useToast: () => ({ addToast: vi.fn() }),
}));

vi.mock("@/components/TransactionIcon", () => ({
  default: ({ type }: any) => <div data-testid="transaction-icon">{type}</div>,
}));

vi.mock("@/components/SmsReminderModal", () => ({
  default: () => <div data-testid="sms-reminder-modal" />,
}));

vi.mock("@/lib/auth", () => ({
  getCurrentMerchantId: vi.fn(),
}));

vi.mock("@/app/actions/merchant", () => ({
  getMerchantCustomerDetail: vi.fn(),
  getCustomerTransactions: vi.fn(),
  updateCustomerCreditLimit: vi.fn(),
  updateCustomerTrustStatus: vi.fn(),
  getAuditLogsForCreditLog: vi.fn(),
  getMerchantProfile: vi.fn(),
  resetCustomerPin: vi.fn(),
}));

vi.mock("@/app/actions/sms-billing", () => ({
  getMerchantSmsBalance: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useParams: vi.fn(() => ({ id: "c1" })),
  useRouter: vi.fn(() => ({ back: vi.fn() })),
}));

const mockMerchantActions = await import("@/app/actions/merchant");
const mockAuth = await import("@/lib/auth");

const mockLogs = [
  {
    id: "cl1",
    amount: 2000,
    type: "debit",
    status: "approved",
    description: "Rice 10kg",
    created_at: "2025-01-15T10:00:00Z",
    attachment_url: null,
    initiated_by: null,
    ip_address: null,
    device_info: null,
  },
  {
    id: "cl2",
    amount: 500,
    type: "credit",
    status: "approved",
    description: "Payment received",
    created_at: "2025-01-14T10:00:00Z",
    attachment_url: null,
    initiated_by: null,
    ip_address: null,
    device_info: null,
  },
  {
    id: "cl3",
    amount: 1000,
    type: "debit",
    status: "awaiting_confirmation",
    description: "Milk 5L",
    created_at: "2025-01-13T10:00:00Z",
    attachment_url: null,
    initiated_by: null,
    ip_address: null,
    device_info: null,
  },
];

const mockCustomerDetail = {
  id: "c1",
  name: "Hari",
  phone: "9841234567",
  credit_limit: 5000,
  current_balance: 2500,
  total_debit_amount: 3000,
  total_credit_amount: 500,
  transactions: mockLogs,
  trust_status: "good",
  trust_notes: null,
  trust_flagged_by_me: false,
};

describe("CustomerDetailPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(mockAuth.getCurrentMerchantId).mockResolvedValue("m1");
    vi.mocked(mockMerchantActions.getMerchantCustomerDetail).mockResolvedValue(mockCustomerDetail);
    vi.mocked(mockMerchantActions.updateCustomerCreditLimit).mockResolvedValue({});
    vi.mocked(mockMerchantActions.getMerchantProfile).mockResolvedValue({ name: "Shop" });
  });

  it("renders customer name and phone", async () => {
    render(<CustomerDetailPage />);

    await waitFor(() => {
      expect(screen.getByText("Customer Detail")).toBeInTheDocument();
    });

    expect(screen.getByText("Hari")).toBeInTheDocument();
    expect(screen.getByText("9841234567")).toBeInTheDocument();
  });

  it("shows current balance and credit limit", async () => {
    render(<CustomerDetailPage />);

    await waitFor(() => {
      expect(screen.getByText("Current Balance")).toBeInTheDocument();
    });

    expect(screen.getByText("Edit Limit")).toBeInTheDocument();
  });

  it("shows Total Credit Taken and Total Paid stats", async () => {
    render(<CustomerDetailPage />);

    await waitFor(() => {
      expect(screen.getByText("Total Credit Taken")).toBeInTheDocument();
    });

    expect(screen.getByText("Total Paid")).toBeInTheDocument();
  });

  it("shows transaction history list", async () => {
    render(<CustomerDetailPage />);

    await waitFor(() => {
      expect(screen.getByText("Recent Transactions")).toBeInTheDocument();
    });

    expect(screen.getByText("Rice 10kg")).toBeInTheDocument();
    expect(screen.getByText("Payment received")).toBeInTheDocument();
    expect(screen.getByText("Milk 5L")).toBeInTheDocument();
  });

  it("shows 'No transactions yet' when no logs", async () => {
    vi.mocked(mockMerchantActions.getMerchantCustomerDetail).mockResolvedValue({
      ...mockCustomerDetail,
      transactions: [],
    });

    render(<CustomerDetailPage />);

    await waitFor(() => {
      expect(screen.getByText("No transactions yet")).toBeInTheDocument();
    });
  });

  it("opens credit limit modal on Edit Limit click", async () => {
    render(<CustomerDetailPage />);

    await waitFor(() => {
      expect(screen.getByText("Edit Limit")).toBeInTheDocument();
    });

    await userEvent.click(screen.getByText("Edit Limit"));

    expect(screen.getByText("Update Credit Limit")).toBeInTheDocument();
    expect(screen.getByText("Save Limit")).toBeInTheDocument();
  });

  it("saves credit limit and closes modal", async () => {
    render(<CustomerDetailPage />);

    await waitFor(() => {
      expect(screen.getByText("Edit Limit")).toBeInTheDocument();
    });

    await userEvent.click(screen.getByText("Edit Limit"));

    await waitFor(() => {
      expect(screen.getByText("Update Credit Limit")).toBeInTheDocument();
    });

    const limitInput = screen.getByDisplayValue("5000");
    await userEvent.clear(limitInput);
    await userEvent.type(limitInput, "8000");

    await userEvent.click(screen.getByText("Save Limit"));

    expect(mockMerchantActions.updateCustomerCreditLimit).toHaveBeenCalledWith(
      "m1",
      "c1",
      8000
    );

    await waitFor(() => {
      expect(
        screen.queryByText("Update Credit Limit")
      ).not.toBeInTheDocument();
    });
  });

  it("renders back button", async () => {
    render(<CustomerDetailPage />);

    await waitFor(() => {
      expect(screen.getByText("Customer Detail")).toBeInTheDocument();
    });

    const backButton = document.querySelector("button");
    expect(backButton).toBeInTheDocument();
  });

  it("shows a not-found state when the customer does not exist", async () => {
    vi.mocked(mockMerchantActions.getMerchantCustomerDetail).mockResolvedValue(
      null as any
    );

    render(<CustomerDetailPage />);

    await waitFor(() => {
      expect(screen.getByText("Customer not found")).toBeInTheDocument();
    });

    expect(screen.getByText("Back to Customers")).toBeInTheDocument();
  });

  it("loads more transactions and hides the button when exhausted", async () => {
    const fifty = Array.from({ length: 50 }, (_, i) => ({
      id: `tx${i}`,
      amount: 100,
      type: "debit",
      status: "approved",
      description: `Tx ${i}`,
      created_at: `2025-01-0${(i % 9) + 1}T10:00:00Z`,
      attachment_url: null,
      initiated_by: null,
      ip_address: null,
      device_info: null,
    }));
    vi.mocked(mockMerchantActions.getMerchantCustomerDetail).mockResolvedValue({
      ...mockCustomerDetail,
      transactions: fifty,
    });
    vi.mocked(mockMerchantActions.getCustomerTransactions).mockResolvedValue({
      transactions: [
        {
          id: "tx50",
          amount: 250,
          type: "credit",
          status: "approved",
          description: "Extra old payment",
          created_at: "2024-12-01T10:00:00Z",
          attachment_url: null,
          initiated_by: null,
          ip_address: null,
          device_info: null,
        },
      ],
      hasMore: false,
    });

    render(<CustomerDetailPage />);

    await waitFor(() => {
      expect(screen.getByText("Load More")).toBeInTheDocument();
    });

    await userEvent.click(screen.getByText("Load More"));

    await waitFor(() => {
      expect(screen.getByText("Extra old payment")).toBeInTheDocument();
    });

    expect(mockMerchantActions.getCustomerTransactions).toHaveBeenCalledWith(
      "m1",
      "c1",
      50
    );

    await waitFor(() => {
      expect(screen.queryByText("Load More")).not.toBeInTheDocument();
    });
  });

  it("shows transaction details (incl. device) in the audit modal and closes on Escape", async () => {
    vi.mocked(mockMerchantActions.getAuditLogsForCreditLog).mockResolvedValue(
      []
    );
    vi.mocked(mockMerchantActions.getMerchantCustomerDetail).mockResolvedValue({
      ...mockCustomerDetail,
      transactions: [
        {
          ...mockLogs[0],
          ip_address: "192.168.1.1",
          device_info: "Android 14",
        },
      ],
    });

    render(<CustomerDetailPage />);

    await waitFor(() => {
      expect(screen.getByText("Rice 10kg")).toBeInTheDocument();
    });

    await userEvent.click(screen.getByText("Rice 10kg"));

    await waitFor(() => {
      expect(screen.getByText("Transaction Details")).toBeInTheDocument();
    });

    expect(screen.getByText(/Android 14 · 192.168.1.1/)).toBeInTheDocument();

    await userEvent.keyboard("{Escape}");

    await waitFor(() => {
      expect(
        screen.queryByText("Transaction Details")
      ).not.toBeInTheDocument();
    });
  });

  it("closes the flag modal on Escape", async () => {
    render(<CustomerDetailPage />);

    await waitFor(() => {
      expect(screen.getByText("Flag")).toBeInTheDocument();
    });

    await userEvent.click(screen.getByText("Flag"));

    await waitFor(() => {
      expect(screen.getByText("Flag Customer")).toBeInTheDocument();
    });

    await userEvent.keyboard("{Escape}");

    await waitFor(() => {
      expect(screen.queryByText("Flag Customer")).not.toBeInTheDocument();
    });
  });

  it("disables Clear Flag when another merchant owns the flag", async () => {
    vi.mocked(mockMerchantActions.getMerchantCustomerDetail).mockResolvedValue({
      ...mockCustomerDetail,
      trust_status: "defaulter",
      trust_notes: "Repeated late payments",
      trust_flagged_by_me: false,
    });

    render(<CustomerDetailPage />);

    await waitFor(() => {
      expect(screen.getByText("Clear Flag")).toBeInTheDocument();
    });

    expect(screen.getByText("Clear Flag")).toBeDisabled();
  });

  it("clears the flag only after confirmation when the merchant owns it", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    vi.mocked(mockMerchantActions.getMerchantCustomerDetail).mockResolvedValue({
      ...mockCustomerDetail,
      trust_status: "warning",
      trust_notes: "Slow payer",
      trust_flagged_by_me: true,
    });
    vi.mocked(mockMerchantActions.updateCustomerTrustStatus).mockResolvedValue({
      success: true,
    });

    render(<CustomerDetailPage />);

    await waitFor(() => {
      expect(screen.getByText("Clear Flag")).toBeInTheDocument();
    });

    // Declined confirmation -> no server call
    await userEvent.click(screen.getByText("Clear Flag"));
    expect(
      mockMerchantActions.updateCustomerTrustStatus
    ).not.toHaveBeenCalled();

    // Accepted confirmation -> clear call
    confirmSpy.mockReturnValue(true);
    await userEvent.click(screen.getByText("Clear Flag"));

    await waitFor(() => {
      expect(
        mockMerchantActions.updateCustomerTrustStatus
      ).toHaveBeenCalledWith("m1", "c1", "clear");
    });

    confirmSpy.mockRestore();
  });

  it("allows paisa-precision credit limits (step any)", async () => {
    render(<CustomerDetailPage />);

    await waitFor(() => {
      expect(screen.getByText("Edit Limit")).toBeInTheDocument();
    });

    await userEvent.click(screen.getByText("Edit Limit"));

    const input = screen.getByDisplayValue("5000") as HTMLInputElement;
    expect(input.step).toBe("any");
  });

  it("resets the customer PIN after confirmation", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    vi.mocked(mockMerchantActions.resetCustomerPin).mockResolvedValue({
      success: true,
    });

    render(<CustomerDetailPage />);

    await waitFor(() => {
      expect(screen.getByText("Reset PIN")).toBeInTheDocument();
    });

    await userEvent.click(screen.getByText("Reset PIN"));

    await waitFor(() => {
      expect(mockMerchantActions.resetCustomerPin).toHaveBeenCalledWith(
        "m1",
        "c1"
      );
    });

    confirmSpy.mockRestore();
  });

  it("shows absolute balance and clamped credit-used percent for overpaid customers", async () => {
    vi.mocked(mockMerchantActions.getMerchantCustomerDetail).mockResolvedValue({
      ...mockCustomerDetail,
      current_balance: -1234,
      total_debit_amount: 200,
      total_credit_amount: 2000,
    });

    render(<CustomerDetailPage />);

    await waitFor(() => {
      expect(screen.getByText("Current Balance")).toBeInTheDocument();
    });

    expect(
      screen.getByText("Customer is in credit (no outstanding)")
    ).toBeInTheDocument();
    expect(screen.getByText("0%")).toBeInTheDocument();
    expect(screen.queryByText(/Rs\.\s*-/)).toBeNull();
  });
});
