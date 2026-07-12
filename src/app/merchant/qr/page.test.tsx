import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MerchantQRPage from "./page";

vi.mock("@/components/QRCode", () => ({
  QRDisplay: ({ merchantId, merchantName, businessType }: any) => (
    <div data-testid="qr-display">
      <span data-testid="qr-mid">{merchantId}</span>
      <span data-testid="qr-mname">{merchantName}</span>
      <span data-testid="qr-btype">{businessType}</span>
    </div>
  ),
}));

vi.mock("@/components/Toast", () => ({
  useToast: () => ({ addToast: vi.fn() }),
}));

vi.mock("@/components/BottomNav", () => ({
  default: () => <div data-testid="bottom-nav">Nav</div>,
}));

vi.mock("@/lib/actions", () => ({
  getMerchantProfile: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  getCurrentMerchantId: vi.fn(),
}));

const mockActions = await import("@/lib/actions");
const mockAuth = await import("@/lib/auth");

describe("MerchantQRPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders merchant info and QR code after loading", async () => {
    vi.mocked(mockAuth.getCurrentMerchantId).mockResolvedValue("m1");
    vi.mocked(mockActions.getMerchantProfile).mockResolvedValue({
      id: "m1",
      name: "Shop ABC",
      business_type: "kirana",
    });

    render(<MerchantQRPage />);

    await waitFor(() => {
      expect(screen.getByText("Shop QR Code")).toBeInTheDocument();
    });

    expect(screen.getByTestId("qr-mid")).toHaveTextContent("m1");
    expect(screen.getByTestId("qr-mname")).toHaveTextContent("Shop ABC");
    expect(screen.getByTestId("qr-btype")).toHaveTextContent("kirana");
  });

  it("falls back to default data when profile fetch fails", async () => {
    vi.mocked(mockAuth.getCurrentMerchantId).mockResolvedValue("m1");
    vi.mocked(mockActions.getMerchantProfile).mockRejectedValue(
      new Error("fail")
    );

    render(<MerchantQRPage />);

    await waitFor(() => {
      expect(screen.getByTestId("qr-mname")).toHaveTextContent("My Shop");
    });
  });

  it("renders instructions and print button", async () => {
    vi.mocked(mockAuth.getCurrentMerchantId).mockResolvedValue("m1");
    vi.mocked(mockActions.getMerchantProfile).mockResolvedValue({
      id: "m1",
      name: "Shop ABC",
      business_type: "kirana",
    });

    render(<MerchantQRPage />);

    await waitFor(() => {
      expect(screen.getByText("How it works")).toBeInTheDocument();
      expect(
        screen.getByText("Print QR for Shop Counter")
      ).toBeInTheDocument();
    });
  });

  it("renders bottom navigation", async () => {
    vi.mocked(mockAuth.getCurrentMerchantId).mockResolvedValue("m1");
    vi.mocked(mockActions.getMerchantProfile).mockResolvedValue({
      id: "m1",
      name: "Shop ABC",
      business_type: "kirana",
    });

    render(<MerchantQRPage />);

    await waitFor(() => {
      expect(screen.getByTestId("bottom-nav")).toBeInTheDocument();
    });
  });
});
