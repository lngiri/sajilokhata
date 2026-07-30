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
  updateCustomerCreditLimit: vi.fn(),
  updateCustomerTrustStatus: vi.fn(),
  getAuditLogsForCreditLog: vi.fn(),
  getMerchantProfile: vi.fn(),
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
    status: "pending",
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
});
