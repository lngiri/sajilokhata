import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MerchantReportsPage from "./page";

const { addToast } = vi.hoisted(() => ({ addToast: vi.fn() }));
const { playSuccessSound } = vi.hoisted(() => ({ playSuccessSound: vi.fn() }));

vi.mock("@/components/Toast", () => ({
  useToast: () => ({ addToast }),
}));

vi.mock("@/components/BottomNav", () => ({
  default: () => <div data-testid="bottom-nav">Nav</div>,
}));

vi.mock("@/components/PullToRefresh", () => ({
  default: ({ children }: any) => <>{children}</>,
}));

vi.mock("@/lib/sound", () => ({
  playSuccessSound,
}));

vi.mock("@/lib/auth", () => ({
  getCurrentMerchantId: vi.fn(),
}));

vi.mock("@/app/actions/merchant", () => ({
  getMerchantAnalytics: vi.fn(),
  getMerchantCreditLogs: vi.fn(),
}));

vi.mock("recharts", () => {
  const Container = ({ children }: any) => <div data-testid="chart">{children}</div>;
  const Passthrough = ({ children }: any) => <>{children}</>;
  const Null = () => null;
  return {
    ResponsiveContainer: Container,
    BarChart: Passthrough,
    Bar: Null,
    XAxis: Null,
    YAxis: Null,
    CartesianGrid: Null,
    Tooltip: Null,
  };
});

const mockMerchantActions = await import("@/app/actions/merchant");
const mockAuth = await import("@/lib/auth");

const toDateStr = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const analyticsFixture = {
  totalOutstanding: 1200,
  totalReceived: 300,
  totalCashSales: 500,
  totalCashIn: 200,
  totalExpenses: 150,
  totalSales: 1700,
  cashInHand: 850,
  netCashFlow: -350,
  outstandingBalance: 800,
  topCustomers: [{ name: "Hari", phone: "9841234567", balance: 800 }],
  dailyBreakdown: [
    { date: "2025-01-15", debit: 1200, credit: 300, cash: 500, cash_in: 200, expense: 150 },
  ],
};

const displayLogs = [
  {
    id: "cl1",
    amount: 1000,
    type: "debit",
    status: "approved",
    description: "Rice 10kg",
    created_at: "2025-01-15T06:00:00Z",
    customers: { name: "Hari", phone: "9841234567" },
  },
];

const exportLogs = [
  {
    id: "e1",
    amount: 1000,
    type: "debit",
    status: "approved",
    description: 'Rice, 10kg "premium"',
    created_at: "2025-01-15T06:00:00Z",
    customers: { name: "=SUM(A1)", phone: "9841234567" },
  },
  {
    id: "e2",
    amount: 250,
    type: "credit",
    status: "approved",
    description: "Payment received",
    created_at: "2025-01-16T06:00:00Z",
    customers: { name: "Shyam", phone: "9847654321" },
  },
  {
    id: "e3",
    amount: 300,
    type: "cash",
    status: "approved",
    description: "Walk-in sale",
    created_at: "2025-01-17T06:00:00Z",
    customers: null,
  },
];

describe("MerchantReportsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(mockAuth.getCurrentMerchantId).mockResolvedValue("m1");
    vi.mocked(mockMerchantActions.getMerchantAnalytics).mockResolvedValue(analyticsFixture);
    vi.mocked(mockMerchantActions.getMerchantCreditLogs).mockResolvedValue(displayLogs);

    URL.createObjectURL = vi.fn(() => "blob:mock");
    URL.revokeObjectURL = vi.fn();
    HTMLAnchorElement.prototype.click = vi.fn();
  });

  it("renders honest metric labels with range scope", async () => {
    render(<MerchantReportsPage />);

    await waitFor(() => {
      expect(screen.getByText("Total Sales (range)")).toBeInTheDocument();
    });

    expect(screen.getByText("Outstanding Balance")).toBeInTheDocument();
    expect(screen.getByText("All-time, not limited to range")).toBeInTheDocument();
    expect(screen.getByText("Credit Given (range)")).toBeInTheDocument();
    expect(screen.getByText("Received (range)")).toBeInTheDocument();
    expect(screen.getByText("Cash Sales (range)")).toBeInTheDocument();
    expect(screen.getByText("Cash In (range)")).toBeInTheDocument();
    expect(screen.getByText("Expenses (range)")).toBeInTheDocument();
    expect(screen.getByText("Net Cash Flow (range)")).toBeInTheDocument();
    expect(screen.queryByText("Cash In Hand")).not.toBeInTheDocument();
  });

  it("fetches This Month as the 1st through today", async () => {
    render(<MerchantReportsPage />);

    const now = new Date();
    const expectedStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    const expectedEnd = toDateStr(now);

    await waitFor(() => {
      expect(mockMerchantActions.getMerchantAnalytics).toHaveBeenCalledWith(
        "m1",
        expectedStart,
        expectedEnd
      );
    });
    expect(mockMerchantActions.getMerchantCreditLogs).toHaveBeenCalledWith("m1", {
      limit: 50,
      dateFrom: expectedStart,
      dateTo: expectedEnd,
    });
  });

  it("switches to This Week as local Monday through Sunday", async () => {
    const user = userEvent.setup();
    render(<MerchantReportsPage />);

    const now = new Date();
    const day = now.getDay();
    const monday = new Date(now);
    monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    await waitFor(() => {
      expect(mockMerchantActions.getMerchantAnalytics).toHaveBeenCalled();
    });

    await user.click(screen.getByText("This Week"));

    await waitFor(() => {
      expect(mockMerchantActions.getMerchantAnalytics).toHaveBeenCalledWith(
        "m1",
        toDateStr(monday),
        toDateStr(sunday)
      );
    });
  });

  it("prompts for dates on an incomplete custom range and fetches once both are set", async () => {
    const user = userEvent.setup();
    render(<MerchantReportsPage />);

    await waitFor(() => {
      expect(mockMerchantActions.getMerchantAnalytics).toHaveBeenCalled();
    });

    await user.click(screen.getByText("Custom Range"));

    expect(screen.getByText("Pick a start and end date")).toBeInTheDocument();

    const inputs = document.querySelectorAll<HTMLInputElement>('input[type="date"]');
    expect(inputs.length).toBe(2);

    fireEvent.change(inputs[0], { target: { value: "2025-01-01" } });
    fireEvent.change(inputs[1], { target: { value: "2025-02-01" } });

    await waitFor(() => {
      expect(mockMerchantActions.getMerchantAnalytics).toHaveBeenCalledWith(
        "m1",
        "2025-01-01",
        "2025-02-01"
      );
    });
  });

  it("exports the full range with proper CSV quoting and formula guard", async () => {
    const user = userEvent.setup();
    vi.mocked(mockMerchantActions.getMerchantCreditLogs).mockResolvedValue(exportLogs as any);

    render(<MerchantReportsPage />);

    await waitFor(() => {
      expect(screen.getByText("Total Sales (range)")).toBeInTheDocument();
    });

    await user.click(screen.getByText("Export CSV"));

    await waitFor(() => {
      expect(mockMerchantActions.getMerchantCreditLogs).toHaveBeenCalledWith("m1", {
        limit: 1000,
        dateFrom: expect.any(String),
        dateTo: expect.any(String),
      });
    });

    expect(playSuccessSound).toHaveBeenCalled();
    expect(addToast).toHaveBeenCalledWith("Exported 3 transactions", "success");

    const blob = (URL.createObjectURL as ReturnType<typeof vi.fn>).mock.calls[0][0];
    const csv = await (blob as Blob).text();

    expect(csv).toContain("Date,Type,Description,Customer Name,Customer Phone,Amount,Status");
    expect(csv).toContain('"Rice, 10kg ""premium"""');
    expect(csv).toContain("'=SUM(A1)");
    expect(csv).toContain("2025-01-15,Credit Given");
    expect(csv).toContain(",300,Approved");
    expect(csv).toContain("Payment received,Shyam,9847654321,250,Approved");
  });

  it("shows an error state and recovers on retry", async () => {
    const user = userEvent.setup();
    vi.mocked(mockMerchantActions.getMerchantAnalytics)
      .mockRejectedValueOnce(new Error("network down"))
      .mockResolvedValue(analyticsFixture);

    render(<MerchantReportsPage />);

    await waitFor(() => {
      expect(
        screen.getByText("Couldn't load your report. Check your connection and try again.")
      ).toBeInTheDocument();
    });

    await user.click(screen.getByText("Retry"));

    await waitFor(() => {
      expect(screen.getByText("Total Sales (range)")).toBeInTheDocument();
    });
    expect(screen.queryByText("Retry")).not.toBeInTheDocument();
  });

  it("renders the bottom navigation", async () => {
    render(<MerchantReportsPage />);

    await waitFor(() => {
      expect(screen.getByTestId("bottom-nav")).toBeInTheDocument();
    });
  });
});
