"use client";

import { type KeyboardEvent } from "react";

interface AppLogoProps {
  size?: number;
  className?: string;
  showAnimation?: boolean;
  clickable?: boolean;
}

const DEFAULT_SIZE = 36;
const SVG_SIZE = 36;

function LogoSvg({ size }: { size: number }) {
  return (
    <svg
      viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`}
      className="absolute inset-0"
      style={{ width: size, height: size }}
      fill="none"
      stroke="var(--color-primary)"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="4" y="4" width="10" height="10" rx="2" className="animate-draw" style={{ animationDelay: "0s" }} />
      <rect x="22" y="4" width="10" height="10" rx="2" className="animate-draw" style={{ animationDelay: "0.3s" }} />
      <rect x="4" y="22" width="10" height="10" rx="2" className="animate-draw" style={{ animationDelay: "0.6s" }} />
      <circle cx="27" cy="27" r="2" className="animate-draw" style={{ animationDelay: "0.9s" }} />
      <circle cx="18" cy="18" r="1.5" className="animate-draw" style={{ animationDelay: "1s" }} />
    </svg>
  );
}

export default function AppLogo({
  size = DEFAULT_SIZE,
  className = "",
  showAnimation = true,
  clickable = true,
}: AppLogoProps) {
  const img = (
    <img
      src="/icons/logo.png"
      alt=""
      className={`absolute inset-0 object-contain${showAnimation ? " animate-fade-in" : ""}`}
      style={{
        width: "100%",
        height: "100%",
        animationDelay: showAnimation ? "0.8s" : undefined,
      }}
    />
  );

  const content = (
    <div className="relative" style={{ width: size, height: size }}>
      {showAnimation && <LogoSvg size={size} />}
      {img}
    </div>
  );

  if (!clickable) {
    return <div className={className}>{content}</div>;
  }

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="QR Hisab information"
      className={`relative cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2 rounded-xl ${className}`}
      style={{ width: size, height: size }}
      onClick={(e) => {
        e.stopPropagation();
      }}
      onKeyDown={(e: KeyboardEvent) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          e.stopPropagation();
        }
      }}
    >
      {showAnimation && <LogoSvg size={size} />}
      {img}
    </div>
  );
}
