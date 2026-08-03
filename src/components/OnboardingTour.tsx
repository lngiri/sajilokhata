"use client";

import { useState, useEffect, useCallback, useLayoutEffect, useRef } from "react";
import { createPortal } from "react-dom";

export interface TourStep {
  target: string;
  title: string;
  body: string;
}

interface Props {
  steps: TourStep[];
  open: boolean;
  onComplete: () => void;
  onSkip: () => void;
}

interface Rect {
  top: number;
  left: number;
  bottom: number;
  width: number;
  height: number;
}

const CARD_WIDTH = 320;
const MARGIN = 16;
const GAP = 12;

export default function OnboardingTour({ steps, open, onComplete, onSkip }: Props) {
  const [stepIndex, setStepIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [mounted, setMounted] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (open) setStepIndex(0);
  }, [open]);

  const measure = useCallback(() => {
    if (!open) return;
    const el = document.querySelector<HTMLElement>(steps[stepIndex]?.target);
    if (!el) {
      setRect(null);
      return;
    }
    const r = el.getBoundingClientRect();
    setRect({
      top: r.top,
      left: r.left,
      bottom: r.bottom,
      width: r.width,
      height: r.height,
    });
  }, [open, steps, stepIndex]);

  useLayoutEffect(() => {
    if (!open) return;
    measure();
    let raf = requestAnimationFrame(measure);
    const onScroll = () => raf = requestAnimationFrame(measure);
    window.addEventListener("resize", onScroll);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onScroll);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open, measure]);

  // Body scroll lock + Escape to skip
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onSkip();
    };
    window.addEventListener("keydown", handler);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", handler);
    };
  }, [open, onSkip]);

  if (!mounted || !open || steps.length === 0) return null;

  const step = steps[stepIndex];
  const isLast = stepIndex === steps.length - 1;

  const viewportW = typeof window !== "undefined" && window.innerWidth > 0 ? window.innerWidth : 375;
  const viewportH = typeof window !== "undefined" && window.innerHeight > 0 ? window.innerHeight : 812;
  const cardWidth = Math.max(Math.min(CARD_WIDTH, viewportW - MARGIN * 2), 1);

  let cardTop: number;
  let cardLeft: number;
  let placement: "bottom" | "top" = "bottom";

  if (rect) {
    // Prefer placing below the target; flip above if not enough room
    const estCardHeight = 150;
    if (rect.top - MARGIN - estCardHeight - GAP > 0 && rect.bottom + GAP + estCardHeight > viewportH) {
      placement = "top";
      cardTop = Math.max(MARGIN, rect.top - estCardHeight - GAP);
    } else {
      placement = "bottom";
      cardTop = rect.bottom + GAP;
    }
    cardTop = Math.min(cardTop, Math.max(MARGIN, viewportH - estCardHeight - MARGIN));
    cardLeft = Math.max(MARGIN, Math.min(rect.left + rect.width / 2 - cardWidth / 2, viewportW - cardWidth - MARGIN));
  } else {
    // Fallback: centered card (target not found yet)
    cardTop = Math.max(MARGIN, viewportH * 0.3);
    cardLeft = Math.max(MARGIN, (viewportW - cardWidth) / 2);
  }

  const spotlight = rect && (
    <div
      className="fixed z-[190]"
      style={{
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
        borderRadius: 16,
        boxShadow: "0 0 0 9999px rgba(0,0,0,0.55)",
        pointerEvents: "none",
        transition: "all 0.25s ease",
      }}
    />
  );

  const arrow = rect && (
    <div
      className={`fixed z-[200] w-3 h-3 bg-white dark:bg-gray-800 rotate-45`}
      style={{
        top: placement === "bottom" ? cardTop - 6 : cardTop + 150 - 6,
        left: cardLeft + cardWidth / 2 - 6,
        boxShadow: "0 0 0 9999px transparent",
      }}
    />
  );

  const tooltip = (
    <div
      ref={cardRef}
      className="fixed z-[200] bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 animate-scale-up"
      style={{ top: cardTop, left: cardLeft, width: cardWidth }}
    >
      <div className="px-5 pt-4 pb-2">
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-primary)]">
            {stepIndex + 1} of {steps.length}
          </p>
          <div className="flex items-center gap-1">
            {steps.map((_, i) => (
              <span
                key={i}
                className={`w-1.5 h-1.5 rounded-full transition-colors ${i === stepIndex ? "bg-[var(--color-primary)]" : "bg-gray-300 dark:bg-gray-600"}`}
              />
            ))}
          </div>
        </div>
        <h3 className="text-base font-bold text-[var(--color-text)]">{step.title}</h3>
        <p className="text-sm text-[var(--color-text-muted)] mt-1 leading-relaxed">{step.body}</p>
      </div>
      <div className="flex items-center justify-between px-5 pb-4 pt-2">
        <button
          type="button"
          onClick={onSkip}
          className="px-4 py-2.5 rounded-xl text-sm font-medium text-[var(--color-text-muted)] hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors active:scale-[0.97]"
        >
          Skip
        </button>
        <button
          type="button"
          onClick={() => (isLast ? onComplete() : setStepIndex((i) => i + 1))}
          className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] transition-colors active:scale-[0.97]"
        >
          {isLast ? "Done" : "Next"}
        </button>
      </div>
    </div>
  );

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-[190] bg-black/40"
        style={{ pointerEvents: "none" }}
        aria-hidden
      />
      {spotlight}
      {arrow}
      {tooltip}
    </>,
    document.body
  );
}
