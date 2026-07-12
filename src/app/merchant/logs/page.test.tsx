import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import LedgerPage from "./page";

vi.mock("@/components/BottomNav", () => ({
  default: () => <div data-testid="bottom-nav">Nav</div>,
}));

vi.mock("@/components/Toast", () => ({
  useToast: () => ({ addToast: vi.fn() }),
}));

vi.mock("@/lib/actions", () => ({
  getMerchantCreditLogs: vi.fn(),
  updateCreditLogStatus: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  getCurrentMerchantId: vi.fn(),
}));

const mockActions = await import("@/lib/actions");
const mockAuth = await import("@/lib/auth");

const pendingLogs = [
  {
    id: "cl1",
    amount: 500,
    type: "debit",
    status: "pending",
    description: "Rice 10kg",
    quantity: null,
    unit: null,
    created_at: "2025-01-15T10:00:00Z",
    customers: { name: "Hari", phone: "9841234567" },
  },
];

const approvedLogs = [
  {
    id: "cl2",
    amount: 200,
    type: "debit",
    status: "approved",
    description: "Milk 2L",
    quantity: null,
    unit: null,
    created_at: "2025-01-14T10:00:00Z",
    customers: { name: "Shyam", phone: "9847654321" },
  },
];

const allLogs = [...pendingLogs, ...approvedLogs];

describe("LedgerPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(mockAuth.getCurrentMerchantId).mockResolvedValue("m1");
    vi.mocked(mockActions.getMerchantCreditLogs).mockImplementation(
      (_id: string, options?: { status?: string }) => {
        if (options?.status === "pending") return Promise.resolve(pendingLogs);
        if (options?.status === "approved") return Promise.resolve(approvedLogs);
        return Promise.resolve(allLogs);
      }
    );
  });

  it("renders ledger with log entries", async () => {
    render(<LedgerPage />);

    await waitFor(() => {
      expect(screen.getByText("Ledger")).toBeInTheDocument();
    });

    expect(screen.getByText("Hari")).toBeInTheDocument();
    expect(screen.getByText("Shyam")).toBeInTheDocument();
    expect(screen.getByText("Rice 10kg")).toBeInTheDocument();
    expect(screen.getByText("Milk 2L")).toBeInTheDocument();
  });

  it("shows status badges for each entry", async () => {
    render(<LedgerPage />);

    await waitFor(() => {
      expect(screen.getByText("pending")).toBeInTheDocument();
      expect(screen.getByText("approved")).toBeInTheDocument();
    });
  });

  it("shows Approve and Reject buttons only for pending entries", async () => {
    render(<LedgerPage />);

    await waitFor(() => {
      expect(screen.getByText("Approve")).toBeInTheDocument();
      expect(screen.getByText("Reject")).toBeInTheDocument();
    });
  });

  it("calls updateCreditLogStatus with 'approved' on Approve click", async () => {
    vi.mocked(mockActions.updateCreditLogStatus).mockResolvedValue({});

    render(<LedgerPage />);

    await waitFor(() => {
      expect(screen.getByText("Approve")).toBeInTheDocument();
    });

    await userEvent.click(screen.getByText("Approve"));

    expect(mockActions.updateCreditLogStatus).toHaveBeenCalledWith(
      "cl1",
      "approved"
    );
  });

  it("calls updateCreditLogStatus with 'rejected' on Reject click", async () => {
    vi.mocked(mockActions.updateCreditLogStatus).mockResolvedValue({});

    render(<LedgerPage />);

    await waitFor(() => {
      expect(screen.getByText("Reject")).toBeInTheDocument();
    });

    await userEvent.click(screen.getByText("Reject"));

    expect(mockActions.updateCreditLogStatus).toHaveBeenCalledWith(
      "cl1",
      "rejected"
    );
  });

  it("switches filter tabs and re-fetches logs with correct status", async () => {
    render(<LedgerPage />);

    await waitFor(() => {
      expect(screen.getByText("Ledger")).toBeInTheDocument();
    });

    await userEvent.click(screen.getAllByText("pending")[0]);

    expect(mockActions.getMerchantCreditLogs).toHaveBeenCalledWith("m1", {
      status: "pending",
      limit: 50,
    });

    await userEvent.click(screen.getAllByText("approved")[0]);

    expect(mockActions.getMerchantCreditLogs).toHaveBeenCalledWith("m1", {
      status: "approved",
      limit: 50,
    });
  });

  it("re-fetches all logs when 'all' tab is clicked", async () => {
    render(<LedgerPage />);

    await waitFor(() => {
      expect(screen.getByText("Ledger")).toBeInTheDocument();
    });

    await userEvent.click(screen.getAllByText("pending")[0]);
    await userEvent.click(screen.getByText("all"));

    expect(mockActions.getMerchantCreditLogs).toHaveBeenCalledWith("m1", {
      limit: 50,
    });
  });

  it("shows empty state when no logs exist", async () => {
    vi.mocked(mockActions.getMerchantCreditLogs).mockResolvedValue([]);

    render(<LedgerPage />);

    await waitFor(() => {
      expect(screen.getByText("No entries found")).toBeInTheDocument();
    });
  });

  it("renders bottom navigation", async () => {
    render(<LedgerPage />);

    await waitFor(() => {
      expect(screen.getByTestId("bottom-nav")).toBeInTheDocument();
    });
  });
});
