import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SettingsPage from "./page";

vi.mock("@/components/QRCode", () => ({
  QRDisplay: ({ merchantId, merchantName, businessType }: any) => (
    <div data-testid="qr-display">
      <span>{merchantName}</span>
    </div>
  ),
}));

vi.mock("@/components/Toast", () => ({
  useToast: () => ({ addToast: vi.fn() }),
}));

vi.mock("@/components/BottomNav", () => ({
  default: () => <div data-testid="bottom-nav">Nav</div>,
}));

vi.mock("@/lib/auth", () => ({
  getCurrentMerchantId: vi.fn(),
  getCurrentUserPhone: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock("@/lib/actions", () => ({
  updateMerchantProfile: vi.fn(),
}));

vi.mock("@/lib/ui/fabVisibility", () => ({
  isFabHidden: vi.fn(),
  setFabHidden: vi.fn(),
}));

vi.mock("@/app/actions/merchant", () => ({
  getMerchantProfile: vi.fn(),
  getMerchantCreditLogs: vi.fn(),
  getMerchantPaymentMethods: vi.fn(),
  upsertMerchantPaymentMethod: vi.fn(),
  getMerchantReminderSettings: vi.fn(),
  updateMerchantReminderSettings: vi.fn(),
  togglePaymentOption: vi.fn(),
  getMerchantInvitations: vi.fn(),
  resendInvitation: vi.fn(),
  cancelInvitation: vi.fn(),
}));

vi.mock("@/app/actions/pin", () => ({
  changePin: vi.fn(),
}));

vi.mock("@/app/actions/sms-billing", () => ({
  getMerchantSmsBalance: vi.fn(),
}));

const mockMerchantActions = await import("@/app/actions/merchant");
const mockAuth = await import("@/lib/auth");
const mockSmsBilling = await import("@/app/actions/sms-billing");
const mockPin = await import("@/app/actions/pin");
const mockUi = await import("@/lib/ui/fabVisibility");

const baseProfile = {
  id: "m1",
  name: "Shop ABC",
  business_type: "kirana",
  business_name: null,
  address: "Kathmandu",
  phone: "+9779841234567",
  photo_url: null,
  payment_enabled: true,
};

const basePaymentMethods = [
  {
    method_type: "fonepay",
    label: null,
    qr_url: "https://example.com/fp.png",
    account_holder: null,
    account_number: null,
    bank_name: null,
    is_active: true,
    sort_order: 0,
  },
];

const renderPage = async () => {
  render(<SettingsPage />);
  await waitFor(() => {
    expect(screen.getByText("Shop Profile")).toBeInTheDocument();
  });
};

describe("SettingsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(mockAuth.getCurrentMerchantId).mockResolvedValue("m1");
    vi.mocked(mockAuth.getCurrentUserPhone).mockResolvedValue("+9779841234567");
    vi.mocked(mockMerchantActions.getMerchantProfile).mockResolvedValue(baseProfile);
    vi.mocked(mockMerchantActions.getMerchantPaymentMethods).mockResolvedValue(basePaymentMethods);
    vi.mocked(mockMerchantActions.getMerchantReminderSettings).mockResolvedValue({
      auto_reminder_enabled: false,
      reminder_message_template: "Dear {customer}, pay Rs. {balance} to {shop}.",
      reminder_day_of_month: 1,
    });
    vi.mocked(mockMerchantActions.getMerchantInvitations).mockResolvedValue({
      invites: [],
      counts: { registered: 0, pending: 0, smsFailed: 0, expired: 0 },
    });
    vi.mocked(mockMerchantActions.getMerchantCreditLogs).mockResolvedValue([]);
    vi.mocked(mockSmsBilling.getMerchantSmsBalance).mockResolvedValue(50);
    vi.mocked(mockPin.changePin).mockResolvedValue({ success: true });
    vi.mocked(mockUi.isFabHidden).mockReturnValue(false);
    vi.mocked(mockAuth.signOut).mockResolvedValue(undefined as any);
    URL.createObjectURL = vi.fn(() => "blob:test");
    URL.revokeObjectURL = vi.fn();
  });

  it("renders the Shop tab by default with the QR hero at the top", async () => {
    await renderPage();
    expect(screen.getByText("Your Shop QR")).toBeInTheDocument();
    expect(screen.getByText("Download")).toBeInTheDocument();
    expect(screen.getByText("Share")).toBeInTheDocument();
    expect(screen.getByText("Print")).toBeInTheDocument();
    expect(screen.getByText("Shop Profile")).toBeInTheDocument();
  });

  it("switches between tabs and only shows the active tab content", async () => {
    const user = userEvent.setup();
    await renderPage();

    // Payments tab
    await user.click(screen.getByRole("button", { name: "Payments" }));
    await waitFor(() => {
      expect(screen.getByText("Receive Payments")).toBeInTheDocument();
    });
    expect(screen.getByText("Fonepay QR")).toBeInTheDocument();
    expect(screen.queryByText("Shop Profile")).not.toBeInTheDocument();
    expect(screen.queryByText("Your Shop QR")).not.toBeInTheDocument();

    // Reminders tab
    await user.click(screen.getByRole("button", { name: "Reminders" }));
    expect(screen.getByText("Auto Reminder")).toBeInTheDocument();
    expect(screen.queryByText("Receive Payments")).not.toBeInTheDocument();

    // Account tab
    await user.click(screen.getByRole("button", { name: "Account" }));
    expect(screen.getByText("PIN Security")).toBeInTheDocument();
    expect(screen.getByText("Export Data")).toBeInTheDocument();
    expect(screen.getByText("Sign Out")).toBeInTheDocument();
    expect(screen.queryByText("Auto Reminder")).not.toBeInTheDocument();
  });

  it("lazily loads SMS balance only when the Reminders tab opens", async () => {
    const user = userEvent.setup();
    await renderPage();

    expect(mockSmsBilling.getMerchantSmsBalance).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Reminders" }));
    await waitFor(() => {
      expect(mockSmsBilling.getMerchantSmsBalance).toHaveBeenCalledWith("m1");
    });
    expect(screen.getByText("SMS Balance")).toBeInTheDocument();
    expect(screen.getByText("50 credits remaining")).toBeInTheDocument();
  });

  it("lazily loads invitation history only when the Account tab opens", async () => {
    const user = userEvent.setup();
    await renderPage();

    expect(mockMerchantActions.getMerchantInvitations).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Account" }));
    await waitFor(() => {
      expect(mockMerchantActions.getMerchantInvitations).toHaveBeenCalledWith("m1");
    });
    expect(screen.getByText("No invitations sent yet.")).toBeInTheDocument();
  });

  it("shows a Set up button for unconfigured methods and a switch for configured ones", async () => {
    const user = userEvent.setup();
    await renderPage();
    await user.click(screen.getByRole("button", { name: "Payments" }));
    await waitFor(() => {
      expect(screen.getByText("Fonepay QR")).toBeInTheDocument();
    });

    const fonepayRow = screen.getByText("Fonepay QR").closest(".p-4") as HTMLElement;
    expect(within(fonepayRow).getByRole("switch")).toBeInTheDocument();

    const esewaRow = screen.getByText("E-Sewa").closest(".p-4") as HTMLElement;
    expect(within(esewaRow).getByText("Set up")).toBeInTheDocument();
  });

  it("disables payment switches and warns when the master payment option is paused", async () => {
    const user = userEvent.setup();
    vi.mocked(mockMerchantActions.getMerchantProfile).mockResolvedValue({
      ...baseProfile,
      payment_enabled: false,
    });
    await renderPage();
    await user.click(screen.getByRole("button", { name: "Payments" }));
    await waitFor(() => {
      expect(screen.getByText("Fonepay QR")).toBeInTheDocument();
    });

    expect(screen.getByText(/Payments paused/)).toBeInTheDocument();
    expect(screen.getByText(/disabled while payments are paused/)).toBeInTheDocument();

    const fonepayRow = screen.getByText("Fonepay QR").closest(".p-4") as HTMLElement;
    expect(within(fonepayRow).getByRole("switch")).toBeDisabled();
  });

  it("auto-saves edited bank details after the debounce", async () => {
    const user = userEvent.setup();
    await renderPage();
    await user.click(screen.getByRole("button", { name: "Payments" }));
    await waitFor(() => {
      expect(screen.getByText("Bank Deposit")).toBeInTheDocument();
    });

    const bankRow = screen.getByText("Bank Deposit").closest(".p-4") as HTMLElement;
    await user.click(within(bankRow).getByText("Set up"));

    const holderInput = screen.getByPlaceholderText("e.g. Ram Shrestha");
    await user.type(holderInput, "Ram Shrestha");

    await waitFor(
      () => {
        expect(mockMerchantActions.upsertMerchantPaymentMethod).toHaveBeenCalledWith(
          "m1",
          "bank_deposit",
          expect.objectContaining({ account_holder: "Ram Shrestha" })
        );
      },
      { timeout: 3000 }
    );
  });

  it("persists removing a QR code", async () => {
    const user = userEvent.setup();
    await renderPage();
    await user.click(screen.getByRole("button", { name: "Payments" }));
    await waitFor(() => {
      expect(screen.getByText("Fonepay QR")).toBeInTheDocument();
    });

    const fonepayRow = screen.getByText("Fonepay QR").closest(".p-4") as HTMLElement;
    await user.click(within(fonepayRow).getByRole("button"));

    await user.click(screen.getByText("Remove QR"));

    await waitFor(
      () => {
        expect(mockMerchantActions.upsertMerchantPaymentMethod).toHaveBeenCalledWith(
          "m1",
          "fonepay",
          expect.objectContaining({ qr_url: null })
        );
      },
      { timeout: 3000 }
    );
  });

  it("requires confirmation before signing out", async () => {
    const user = userEvent.setup();
    await renderPage();
    await user.click(screen.getByRole("button", { name: "Account" }));
    await user.click(screen.getByText("Sign Out"));

    expect(screen.getByText("Sign out?")).toBeInTheDocument();

    await user.click(screen.getByText("Cancel"));
    expect(mockAuth.signOut).not.toHaveBeenCalled();

    await user.click(screen.getByText("Sign Out"));
    await user.click(screen.getByRole("button", { name: "Sign Out" }));
    expect(mockAuth.signOut).toHaveBeenCalledTimes(1);
  });

  it("auto-advances focus between PIN inputs", async () => {
    const user = userEvent.setup();
    await renderPage();
    await user.click(screen.getByRole("button", { name: "Account" }));
    await user.click(screen.getByText("Change PIN"));

    const firstInput = document.getElementById("pin-current-pin-0") as HTMLInputElement;
    await user.type(firstInput, "1");

    expect(document.activeElement?.id).toBe("pin-current-pin-1");
  });

  it("passes the date range to the export", async () => {
    const user = userEvent.setup();
    await renderPage();
    await user.click(screen.getByRole("button", { name: "Account" }));

    await user.type(screen.getByLabelText("From"), "2026-01-01");
    await user.type(screen.getByLabelText("To"), "2026-01-31");

    await user.click(screen.getByText("Export as CSV"));

    await waitFor(() => {
      expect(mockMerchantActions.getMerchantCreditLogs).toHaveBeenCalledWith(
        "m1",
        { limit: 1000, dateFrom: "2026-01-01", dateTo: "2026-01-31" }
      );
    });
  });

  it("auto-saves the reminder toggle without a manual save button", async () => {
    const user = userEvent.setup();
    vi.mocked(mockMerchantActions.updateMerchantReminderSettings).mockResolvedValue(undefined as any);
    await renderPage();
    await user.click(screen.getByRole("button", { name: "Reminders" }));
    await waitFor(() => {
      expect(screen.getByLabelText("Toggle auto reminder")).toBeInTheDocument();
    });

    await user.click(screen.getByLabelText("Toggle auto reminder"));

    await waitFor(
      () => {
        expect(mockMerchantActions.updateMerchantReminderSettings).toHaveBeenCalledWith(
          "m1",
          expect.objectContaining({ auto_reminder_enabled: true })
        );
      },
      { timeout: 3000 }
    );
  });
});
