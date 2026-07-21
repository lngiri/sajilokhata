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

vi.mock("@/app/actions/merchant", () => ({
  getMerchantCustomers: vi.fn(),
  lookupPhoneAccountStatus: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  getCurrentMerchantId: vi.fn(),
}));

const mockActions = await import("@/app/actions/merchant");
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

function mockImplementation(
  id: string,
  search?: string
): Promise<typeof mockCustomers> {
  if (!search) return Promise.resolve(mockCustomers);
  const q = search.toLowerCase();
  const filtered = mockCustomers.filter((c) => {
    if (!c.customers) return false;
    return (
      c.customers.name?.toLowerCase().includes(q) ||
      c.customers.phone.includes(q)
    );
  });
  return Promise.resolve(filtered);
}

describe("CustomersPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders customer list with names, phones, and balances", async () => {
    vi.mocked(mockAuth.getCurrentMerchantId).mockResolvedValue("m1");
    vi.mocked(mockActions.getMerchantCustomers).mockImplementation(
      mockImplementation
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
    vi.mocked(mockActions.getMerchantCustomers).mockImplementation(
      mockImplementation
    );

    render(<CustomersPage />);

    await waitFor(() => {
      expect(screen.getByText("Unknown")).toBeInTheDocument();
    });
  });

  it("filters customers by name search", async () => {
    vi.mocked(mockAuth.getCurrentMerchantId).mockResolvedValue("m1");
    vi.mocked(mockActions.getMerchantCustomers).mockImplementation(
      mockImplementation
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
      expect(mockActions.getMerchantCustomers).toHaveBeenCalledWith(
        "m1",
        "Shyam"
      );
    });

    await waitFor(() => {
      expect(screen.getByText("Shyam")).toBeInTheDocument();
      expect(screen.queryByText("Hari")).not.toBeInTheDocument();
    });
  });

  it("filters customers by phone search", async () => {
    vi.mocked(mockAuth.getCurrentMerchantId).mockResolvedValue("m1");
    vi.mocked(mockActions.getMerchantCustomers).mockImplementation(
      mockImplementation
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
      expect(mockActions.getMerchantCustomers).toHaveBeenCalledWith(
        "m1",
        "9847654321"
      );
    });

    await waitFor(() => {
      expect(screen.getByText("Shyam")).toBeInTheDocument();
      expect(screen.queryByText("Hari")).not.toBeInTheDocument();
    });
  });

  it("shows empty state when search matches no customers", async () => {
    vi.mocked(mockAuth.getCurrentMerchantId).mockResolvedValue("m1");
    vi.mocked(mockActions.getMerchantCustomers).mockImplementation(
      mockImplementation
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
      expect(mockActions.getMerchantCustomers).toHaveBeenCalledWith(
        "m1",
        "zzzzz"
      );
    });

    await waitFor(() => {
      expect(
        screen.getByText(/No customers match/)
      ).toBeInTheDocument();
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
    vi.mocked(mockActions.getMerchantCustomers).mockImplementation(
      mockImplementation
    );

    render(<CustomersPage />);

    await waitFor(() => {
      expect(screen.getByTestId("bottom-nav")).toBeInTheDocument();
    });
  });

  it("calls server search for multi-word phrase", async () => {
    vi.mocked(mockAuth.getCurrentMerchantId).mockResolvedValue("m1");
    vi.mocked(mockActions.getMerchantCustomers).mockImplementation(
      mockImplementation
    );

    render(<CustomersPage />);

    await waitFor(() => {
      expect(screen.getByText("Hari")).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(
      "Search by name or phone..."
    );
    await userEvent.type(searchInput, "Hari Ku");

    await waitFor(() => {
      expect(mockActions.getMerchantCustomers).toHaveBeenCalledWith(
        "m1",
        "Hari Ku"
      );
    });
  });

  it("clearing search restores full customer list", async () => {
    vi.mocked(mockAuth.getCurrentMerchantId).mockResolvedValue("m1");
    vi.mocked(mockActions.getMerchantCustomers).mockImplementation(
      mockImplementation
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
      expect(mockActions.getMerchantCustomers).toHaveBeenCalledWith(
        "m1",
        "Shyam"
      );
    });

    // Clear search
    await userEvent.clear(searchInput);

    // After clearing, the component should load the full list again
    await waitFor(() => {
      expect(mockActions.getMerchantCustomers).toHaveBeenCalledWith("m1");
    });
  });

  it("shows phone account status for unlinked customer", async () => {
    vi.mocked(mockAuth.getCurrentMerchantId).mockResolvedValue("m1");
    vi.mocked(mockActions.getMerchantCustomers).mockResolvedValue([]);
    vi.mocked(mockActions.lookupPhoneAccountStatus).mockResolvedValue({
      type: "customer",
    });

    render(<CustomersPage />);

    await waitFor(() => {
      expect(screen.getByText("No customers found")).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(
      "Search by name or phone..."
    );
    await userEvent.type(searchInput, "9841234567");

    await waitFor(() => {
      expect(
        screen.getByText("This phone has a QR Hisab account (Customer).")
      ).toBeInTheDocument();
    });
  });

  it("shows indicator for merchant account", async () => {
    vi.mocked(mockAuth.getCurrentMerchantId).mockResolvedValue("m1");
    vi.mocked(mockActions.getMerchantCustomers).mockResolvedValue([]);
    vi.mocked(mockActions.lookupPhoneAccountStatus).mockResolvedValue({
      type: "merchant",
    });

    render(<CustomersPage />);

    await waitFor(() => {
      expect(screen.getByText("No customers found")).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(
      "Search by name or phone..."
    );
    await userEvent.type(searchInput, "9841234567");

    await waitFor(() => {
      expect(
        screen.getByText("This phone has a QR Hisab account (Merchant).")
      ).toBeInTheDocument();
    });
  });

  it("shows indicator for both merchant and customer", async () => {
    vi.mocked(mockAuth.getCurrentMerchantId).mockResolvedValue("m1");
    vi.mocked(mockActions.getMerchantCustomers).mockResolvedValue([]);
    vi.mocked(mockActions.lookupPhoneAccountStatus).mockResolvedValue({
      type: "both",
    });

    render(<CustomersPage />);

    await waitFor(() => {
      expect(screen.getByText("No customers found")).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(
      "Search by name or phone..."
    );
    await userEvent.type(searchInput, "9841234567");

    await waitFor(() => {
      expect(
        screen.getByText(
          "This phone has a QR Hisab account (Merchant & Customer)."
        )
      ).toBeInTheDocument();
    });
  });

  it("caches repeated phone search and does not call lookup twice", async () => {
    vi.mocked(mockAuth.getCurrentMerchantId).mockResolvedValue("m1");
    vi.mocked(mockActions.getMerchantCustomers).mockResolvedValue([]);
    vi.mocked(mockActions.lookupPhoneAccountStatus).mockResolvedValue({
      type: "customer",
    });

    render(<CustomersPage />);

    await waitFor(() => {
      expect(screen.getByText("No customers found")).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(
      "Search by name or phone..."
    );

    // First search
    await userEvent.type(searchInput, "9841234567");

    await waitFor(() => {
      expect(mockActions.lookupPhoneAccountStatus).toHaveBeenCalledTimes(1);
    });

    // Clear search
    vi.mocked(mockActions.getMerchantCustomers).mockClear();
    await userEvent.clear(searchInput);

    await waitFor(() => {
      expect(mockActions.getMerchantCustomers).toHaveBeenCalledWith("m1");
    });

    // Second search with same phone - should NOT call lookup again
    vi.mocked(mockActions.lookupPhoneAccountStatus).mockClear();
    await userEvent.type(searchInput, "9841234567");

    // Wait a moment to ensure lookup was not called
    await new Promise((r) => setTimeout(r, 500));

    expect(mockActions.lookupPhoneAccountStatus).not.toHaveBeenCalled();
  });

  it("does not call lookup for non-numeric search", async () => {
    vi.mocked(mockAuth.getCurrentMerchantId).mockResolvedValue("m1");
    vi.mocked(mockActions.getMerchantCustomers).mockImplementation(
      mockImplementation
    );

    render(<CustomersPage />);

    const searchInput = screen.getByPlaceholderText(
      "Search by name or phone..."
    );
    await userEvent.type(searchInput, "Ram");

    await new Promise((r) => setTimeout(r, 500));

    expect(
      mockActions.lookupPhoneAccountStatus
    ).not.toHaveBeenCalled();
  });

  it("does not call lookup for short numeric search", async () => {
    vi.mocked(mockAuth.getCurrentMerchantId).mockResolvedValue("m1");
    vi.mocked(mockActions.getMerchantCustomers).mockResolvedValue([]);

    render(<CustomersPage />);

    const searchInput = screen.getByPlaceholderText(
      "Search by name or phone..."
    );
    await userEvent.type(searchInput, "984");

    await new Promise((r) => setTimeout(r, 500));

    expect(
      mockActions.lookupPhoneAccountStatus
    ).not.toHaveBeenCalled();
  });
});
