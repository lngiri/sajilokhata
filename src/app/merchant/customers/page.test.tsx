import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CustomersPage from "./page";

vi.mock("@/components/Toast", () => ({
  useToast: () => ({ addToast: vi.fn() }),
}));

vi.mock("@/components/BottomNav", () => ({
  default: () => <div data-testid="bottom-nav">Nav</div>,
}));

vi.mock("@/lib/actions", () => ({
  getMerchantCustomers: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  getCurrentMerchantId: vi.fn(),
}));

const mockActions = await import("@/lib/actions");
const mockAuth = await import("@/lib/auth");

const mockCustomers = [
  {
    id: "mc1",
    credit_limit: 5000,
    current_balance: 2500,
    customers: { id: "c1", name: "Hari", phone: "9841234567" },
  },
  {
    id: "mc2",
    credit_limit: 10000,
    current_balance: 500,
    customers: { id: "c2", name: "Shyam", phone: "9847654321" },
  },
  {
    id: "mc3",
    credit_limit: 3000,
    current_balance: 0,
    customers: null,
  },
];

describe("CustomersPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders customer list with names, phones, and balances", async () => {
    vi.mocked(mockAuth.getCurrentMerchantId).mockResolvedValue("m1");
    vi.mocked(mockActions.getMerchantCustomers).mockResolvedValue(
      mockCustomers
    );

    render(<CustomersPage />);

    await waitFor(() => {
      expect(screen.getByText("Customers")).toBeInTheDocument();
    });

    expect(screen.getByText("Hari")).toBeInTheDocument();
    expect(screen.getByText("9841234567")).toBeInTheDocument();
    expect(screen.getByText("Shyam")).toBeInTheDocument();
    expect(screen.getByText("9847654321")).toBeInTheDocument();
  });

  it("shows 'Unknown' for customers with null name", async () => {
    vi.mocked(mockAuth.getCurrentMerchantId).mockResolvedValue("m1");
    vi.mocked(mockActions.getMerchantCustomers).mockResolvedValue(
      mockCustomers
    );

    render(<CustomersPage />);

    await waitFor(() => {
      expect(screen.getByText("Unknown")).toBeInTheDocument();
    });
  });

  it("filters customers by name search", async () => {
    vi.mocked(mockAuth.getCurrentMerchantId).mockResolvedValue("m1");
    vi.mocked(mockActions.getMerchantCustomers).mockResolvedValue(
      mockCustomers
    );

    render(<CustomersPage />);

    await waitFor(() => {
      expect(screen.getByText("Hari")).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(
      "Search by name or phone..."
    );
    await userEvent.type(searchInput, "Shyam");

    await waitFor(() => {
      expect(screen.getByText("Shyam")).toBeInTheDocument();
      expect(screen.queryByText("Hari")).not.toBeInTheDocument();
    });
  });

  it("filters customers by phone search", async () => {
    vi.mocked(mockAuth.getCurrentMerchantId).mockResolvedValue("m1");
    vi.mocked(mockActions.getMerchantCustomers).mockResolvedValue(
      mockCustomers
    );

    render(<CustomersPage />);

    await waitFor(() => {
      expect(screen.getByText("Hari")).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(
      "Search by name or phone..."
    );
    await userEvent.type(searchInput, "9847654321");

    await waitFor(() => {
      expect(screen.getByText("Shyam")).toBeInTheDocument();
      expect(screen.queryByText("Hari")).not.toBeInTheDocument();
    });
  });

  it("shows empty state when search matches no customers", async () => {
    vi.mocked(mockAuth.getCurrentMerchantId).mockResolvedValue("m1");
    vi.mocked(mockActions.getMerchantCustomers).mockResolvedValue(
      mockCustomers
    );

    render(<CustomersPage />);

    await waitFor(() => {
      expect(screen.getByText("Hari")).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(
      "Search by name or phone..."
    );
    await userEvent.type(searchInput, "zzzzz");

    await waitFor(() => {
      expect(screen.getByText("No customers found")).toBeInTheDocument();
      expect(screen.queryByText("Hari")).not.toBeInTheDocument();
    });
  });

  it("shows empty state when no customers exist", async () => {
    vi.mocked(mockAuth.getCurrentMerchantId).mockResolvedValue("m1");
    vi.mocked(mockActions.getMerchantCustomers).mockResolvedValue([]);

    render(<CustomersPage />);

    await waitFor(() => {
      expect(screen.getByText("No customers found")).toBeInTheDocument();
    });
  });

  it("renders bottom navigation", async () => {
    vi.mocked(mockAuth.getCurrentMerchantId).mockResolvedValue("m1");
    vi.mocked(mockActions.getMerchantCustomers).mockResolvedValue(
      mockCustomers
    );

    render(<CustomersPage />);

    await waitFor(() => {
      expect(screen.getByTestId("bottom-nav")).toBeInTheDocument();
    });
  });
});
