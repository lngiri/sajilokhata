"use client";

import { useState } from "react";
import AppLogo from "./AppLogo";
import AboutSheet from "./AboutSheet";

interface LogoWithAboutProps {
  size?: number;
  className?: string;
  showAnimation?: boolean;
  onClick?: () => void;
}

export default function LogoWithAbout({ onClick, ...props }: LogoWithAboutProps) {
  const [open, setOpen] = useState(false);

  const handleClick = () => {
    if (onClick) {
      onClick();
    } else {
      setOpen(true);
    }
  };

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        aria-label="QR Hisab information"
        className={`relative inline-block cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2 rounded-xl ${props.className ?? ""}`}
        onClick={(e) => {
          e.stopPropagation();
          handleClick();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            e.stopPropagation();
            handleClick();
          }
        }}
      >
        <AppLogo {...props} clickable={false} />
      </div>
      {!onClick && <AboutSheet open={open} onClose={() => setOpen(false)} />}
    </>
  );
}
