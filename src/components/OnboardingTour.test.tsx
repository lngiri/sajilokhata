import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import OnboardingTour, { type TourStep } from "./OnboardingTour";

const steps: TourStep[] = [
  { target: '[data-tour="stats"]', title: "Your shop at a glance", body: "See today's numbers here." },
  { target: '[data-tour="scan"]', title: "Scan a shop QR", body: "Point your camera at the QR." },
];

function addTarget(selector: string) {
  const host = document.createElement("div");
  host.setAttribute("data-tour", selector);
  host.style.width = "300px";
  host.style.height = "80px";
  document.body.appendChild(host);
  return host;
}

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
});

describe("OnboardingTour", () => {
  it("renders the first step when open", async () => {
    addTarget("stats");
    render(<OnboardingTour steps={steps} open onComplete={vi.fn()} onSkip={vi.fn()} />);

    expect(await screen.findByText("Your shop at a glance")).toBeInTheDocument();
    expect(screen.getByText("See today's numbers here.")).toBeInTheDocument();
    expect(screen.getByText("1 of 2")).toBeInTheDocument();
    expect(screen.getByText("Next")).toBeInTheDocument();
    expect(screen.getByText("Skip")).toBeInTheDocument();
  });

  it("advances to the next step and completes on the last", async () => {
    const user = userEvent.setup();
    addTarget("stats");
    addTarget("scan");
    const onComplete = vi.fn();
    render(<OnboardingTour steps={steps} open onComplete={onComplete} onSkip={vi.fn()} />);

    await screen.findByText("Your shop at a glance");

    await user.click(screen.getByText("Next"));
    await screen.findByText("Scan a shop QR");
    expect(screen.getByText("2 of 2")).toBeInTheDocument();

    await user.click(screen.getByText("Done"));
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("calls onSkip when Skip is pressed", async () => {
    const user = userEvent.setup();
    addTarget("stats");
    const onSkip = vi.fn();
    render(<OnboardingTour steps={steps} open onComplete={vi.fn()} onSkip={onSkip} />);

    await screen.findByText("Your shop at a glance");
    await user.click(screen.getByText("Skip"));

    expect(onSkip).toHaveBeenCalledTimes(1);
  });

  it("renders a centered fallback when the target element is missing", async () => {
    render(<OnboardingTour steps={steps} open onComplete={vi.fn()} onSkip={vi.fn()} />);

    expect(await screen.findByText("Your shop at a glance")).toBeInTheDocument();
  });

  it("renders nothing when closed", () => {
    render(<OnboardingTour steps={steps} open={false} onComplete={vi.fn()} onSkip={vi.fn()} />);
    expect(screen.queryByText("Your shop at a glance")).not.toBeInTheDocument();
  });
});
