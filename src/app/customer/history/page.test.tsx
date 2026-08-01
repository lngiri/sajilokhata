import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import CustomerHistoryPage from "./page";
import {
  getCustomerCreditLogs,
  getCustomerLogCounts,
  updateCreditLog,
  cancelCreditLog,
  confirmCustomerEntry,
  disputeEntry,
  getCustomerIdsForPhone,
} from "@/app/actions/customer";

const { mockSearchParams, mockRouter } = vi.hoisted(() => ({
  mockSearchParams: vi.fn(() => new URLSearchParams("")),
  mockRouter: { replace: vi.fn(), push: vi.fn() },
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => mockSearchParams(),
  useRouter: () => mockRouter,
}));

vi.mock("@/components/Toast", () => ({
  useToast: () => ({ addToast: vi.fn() }),
}));

vi.mock("@/components/CustomerBottomNav", () => ({
  default: () => <div data-testid="customer-bottom-nav" />,
}));

vi.mock("@/components/PullToRefresh", () => ({
  default: ({ children }: any) => <>{children}</>,
}));

vi.mock("@/components/CustomerPinGate", () => ({
  default: ({ children }: any) => <>{children}</>,
}));

vi.mock("@/components/TransactionIcon", () => ({
  default: ({ type }: any) => <div data-testid="transaction-icon">{type}</div>,
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

vi.mock("@/app/actions/customer", () => ({
  getCustomerCreditLogs: vi.fn(),
  getCustomerLogCounts: vi.fn(),
  updateCreditLog: vi.fn(),
  cancelCreditLog: vi.fn(),
  confirmCustomerEntry: vi.fn(),
  disputeEntry: vi.fn(),
  getCustomerIdsForPhone: vi.fn(),
}));

const baseLog = (over: Record<string, unknown> = {}) => ({
  id: "cl1",
  amount: 2000,
  type: "debit",
  status: "approved",
  description: "Rice 10kg",
  created_at: "2025-01-15T10:00:00Z",
  approved_at: null,
  merchants: { id: "m1", name: "Shop ABC", business_name: null },
  customers: { name: "Hari", phone: "9841234567" },
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  mockSearchParams.mockReturnValue(new URLSearchParams(""));
  localStorage.setItem("sajilo_customer_session", JSON.stringify({ phone: "9841234567" }));
  localStorage.setItem("customer_history_last_seen", String(Date.now() - 86400000));
  window.confirm = vi.fn(() => true);
  vi.mocked(getCustomerIdsForPhone).mockResolvedValue(["c1"]);
  vi.mocked(getCustomerCreditLogs).mockResolvedValue([baseLog()]);
  vi.mocked(getCustomerLogCounts).mockResolvedValue({
    total: 3,
    awaiting_confirmation: 1,
    approved: 1,
    rejected: 1,
    disputed: 0,
  });
});

describe("CustomerHistoryPage", () => {
  it("renders transactions, shop names, and unique filter tabs", async () => {
    render(<CustomerHistoryPage />);

    expect(await screen.findByText("Shop ABC")).toBeInTheDocument();
    expect(screen.getByText("Rs. 2,000")).toBeInTheDocument();

    // Only ONE "Pending" tab
    expect(screen.getAllByText("Pending")).toHaveLength(1);
    // New Disputed tab present
    expect(screen.getByText("Disputed")).toBeInTheDocument();

    // Server-side counts render on tabs
    expect(screen.getByRole("button", { name: "All3" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Pending1" })
    ).toBeInTheDocument();
  });

  it("marks only entries newer than the previous visit with an N badge", async () => {
    vi.mocked(getCustomerCreditLogs).mockResolvedValue([
      baseLog({ id: "new1", created_at: new Date(Date.now() - 3600000).toISOString() }),
      baseLog({ id: "old1", created_at: new Date(Date.now() - 3 * 86400000).toISOString() }),
    ]);

    render(<CustomerHistoryPage />);

    expect(await screen.findByText("N")).toBeInTheDocument();
    expect(screen.getAllByText("N")).toHaveLength(1);
  });

  it("loads more transactions and hides the button when done", async () => {
    const fifty = Array.from({ length: 50 }, (_, i) =>
      baseLog({ id: `cl${i}`, created_at: new Date(Date.now() - i * 3600000).toISOString() })
    );
    vi.mocked(getCustomerCreditLogs)
      .mockResolvedValueOnce(fifty)
      .mockResolvedValueOnce([baseLog({ id: "cl99", created_at: "2024-01-01T00:00:00Z" })]);

    render(<CustomerHistoryPage />);

    fireEvent.click(await screen.findByRole("button", { name: /Load More/i }));

    await waitFor(() => {
      expect(getCustomerCreditLogs).toHaveBeenCalledTimes(2);
      expect(getCustomerCreditLogs).toHaveBeenLastCalledWith(
        "9841234567",
        expect.objectContaining({ offset: 50, limit: 50 })
      );
    });
    await waitFor(() => {
      expect(screen.queryByRole("button", { name: /Load More/i })).not.toBeInTheDocument();
    });
  });

  it("confirms before cancelling an entry", async () => {
    vi.mocked(getCustomerCreditLogs).mockResolvedValue([
      baseLog({ id: "pending1", status: "awaiting_confirmation" }),
    ]);
    window.confirm = vi.fn(() => true);

    render(<CustomerHistoryPage />);

    fireEvent.click(await screen.findByRole("button", { name: "Cancel" }));
    expect(window.confirm).toHaveBeenCalled();
    await waitFor(() => expect(cancelCreditLog).toHaveBeenCalledWith("pending1"));
  });

  it("does not cancel when the confirm dialog is declined", async () => {
    vi.mocked(getCustomerCreditLogs).mockResolvedValue([
      baseLog({ id: "pending1", status: "awaiting_confirmation" }),
    ]);
    window.confirm = vi.fn(() => false);

    render(<CustomerHistoryPage />);

    fireEvent.click(await screen.findByRole("button", { name: "Cancel" }));
    expect(cancelCreditLog).not.toHaveBeenCalled();
  });

  it("edits an entry with a paisa-friendly step and saves", async () => {
    vi.mocked(getCustomerCreditLogs).mockResolvedValue([
      baseLog({ id: "pending1", status: "awaiting_confirmation" }),
    ]);

    render(<CustomerHistoryPage />);

    fireEvent.click(await screen.findByRole("button", { name: "Edit" }));
    expect(screen.getByText("Edit Entry")).toBeInTheDocument();
    expect(screen.getByRole("spinbutton")).toHaveAttribute("step", "any");

    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(updateCreditLog).toHaveBeenCalledWith("pending1", expect.anything())
    );
  });

  it("closes the edit modal on Escape", async () => {
    vi.mocked(getCustomerCreditLogs).mockResolvedValue([
      baseLog({ id: "pending1", status: "awaiting_confirmation" }),
    ]);

    render(<CustomerHistoryPage />);

    fireEvent.click(await screen.findByRole("button", { name: "Edit" }));
    expect(screen.getByText("Edit Entry")).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "Escape" });
    await waitFor(() => expect(screen.queryByText("Edit Entry")).not.toBeInTheDocument());
  });

  it("shows a single pending banner and jumps to the awaiting filter", async () => {
    vi.mocked(getCustomerCreditLogs).mockResolvedValue([
      baseLog({ id: "p1", status: "awaiting_confirmation" }),
    ]);
    vi.mocked(getCustomerLogCounts).mockResolvedValue({
      total: 1,
      awaiting_confirmation: 1,
      approved: 0,
      rejected: 0,
      disputed: 0,
    });

    render(<CustomerHistoryPage />);

    const banner = await screen.findByText(/pending — review needed/i);
    expect(screen.getAllByText(/pending — review needed/i)).toHaveLength(1);

    fireEvent.click(banner);
    await waitFor(() =>
      expect(getCustomerCreditLogs).toHaveBeenLastCalledWith(
        "9841234567",
        expect.objectContaining({ status: "awaiting_confirmation" })
      )
    );
  });

  it("shows Confirm Balance only for merchant-initiated pending entries, not the customer's own", async () => {
    vi.mocked(getCustomerCreditLogs).mockResolvedValue([
      baseLog({ id: "merchant-init", status: "awaiting_confirmation", initiated_by: "merchant" }),
      baseLog({ id: "own-init", status: "awaiting_confirmation", initiated_by: "customer" }),
    ]);

    render(<CustomerHistoryPage />);

    expect(await screen.findByText("Waiting for shopkeeper approval")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Confirm Balance" })).toHaveLength(1);
    expect(screen.getAllByText("Waiting for shopkeeper approval")).toHaveLength(1);
  });

  it("shows a clear-shop chip when scoped to a merchant and clears it", async () => {
    mockSearchParams.mockReturnValue(new URLSearchParams("merchantId=m1&shopName=Shop+ABC"));

    render(<CustomerHistoryPage />);

    expect(await screen.findByText(/View all shops/i)).toBeInTheDocument();
    await waitFor(() =>
      expect(getCustomerCreditLogs).toHaveBeenCalledWith(
        "9841234567",
        expect.objectContaining({ merchant_id: "m1" })
      )
    );

    fireEvent.click(screen.getByText(/View all shops/i));
    expect(mockRouter.replace).toHaveBeenCalledWith("/customer/history");
  });

  it("renders the empty state with friendly filter labels", async () => {
    vi.mocked(getCustomerCreditLogs).mockResolvedValue([]);

    render(<CustomerHistoryPage />);

    expect(await screen.findByText(/No transactions yet/)).toBeInTheDocument();
  });
});
