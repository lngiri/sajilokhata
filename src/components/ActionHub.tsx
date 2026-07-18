"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ReferModal from "./ReferModal";
import FeedbackModal from "./FeedbackModal";

const menuVariants = {
  hidden: { opacity: 0, scale: 0.8, y: 20, transition: { duration: 0.15 } },
  visible: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.2, staggerChildren: 0.04 } },
};

const itemVariants = {
  hidden: { opacity: 0, x: 16 },
  visible: { opacity: 1, x: 0 },
};

const ITEMS = [
  {
    label: "Home",
    icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6",
    action: "home" as const,
  },
  {
    label: "Help & Support",
    icon: "M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z",
    action: "support" as const,
  },
  {
    label: "Refer & Earn",
    icon: "M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7",
    action: "refer" as const,
  },
  {
    label: "Feedback",
    icon: "M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z",
    action: "feedback" as const,
  },
];

const HELP_URL = "https://wa.me/9779763658505";
const FAB_SIZE = 56;
const DISMISS_THRESHOLD = 80;

export default function ActionHub() {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [referOpen, setReferOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const posRef = useRef({ x: 0, y: 0 });
  const dragRef = useRef({ startX: 0, startY: 0, elX: 0, elY: 0, moved: false, dismissed: false });
  const ignoreClickRef = useRef(false);
  const fabRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const p = {
        x: window.innerWidth - FAB_SIZE - 24,
        y: window.innerHeight - FAB_SIZE - 24,
      };
      posRef.current = p;
      setPos(p);
      setMounted(true);
    }
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    const el = fabRef.current;
    if (!el) return;
    el.setPointerCapture(e.pointerId);
    const p = posRef.current;
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      elX: p.x,
      elY: p.y,
      moved: false,
      dismissed: false,
    };
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
      dragRef.current.moved = true;
    }
    if (dragRef.current.moved) {
      const newY = Math.max(0, Math.min(window.innerHeight - FAB_SIZE, dragRef.current.elY + dy));
      dragRef.current.dismissed = (window.innerHeight - newY) <= DISMISS_THRESHOLD;
      const newPos = {
        x: Math.max(0, Math.min(window.innerWidth - FAB_SIZE, dragRef.current.elX + dx)),
        y: newY,
      };
      posRef.current = newPos;
      setPos(newPos);
    }
  }, []);

  const handlePointerUp = useCallback(() => {
    if (dragRef.current.dismissed) {
      setOpen(false);
      ignoreClickRef.current = true;
    }
  }, []);

  const handleFabClick = useCallback(() => {
    if (ignoreClickRef.current) {
      ignoreClickRef.current = false;
      return;
    }
    if (dragRef.current.moved) {
      dragRef.current.moved = false;
      return;
    }
    setOpen((v) => !v);
  }, []);

  const handleAction = (action: string) => {
    setOpen(false);
    if (action === "home") {
      if (window.confirm("Are you sure you want to leave this app?")) {
        window.location.href = "/";
      }
    } else if (action === "support") {
      window.open(HELP_URL, "_blank", "noopener");
    } else if (action === "refer") {
      setReferOpen(true);
    } else if (action === "feedback") {
      setFeedbackOpen(true);
    }
  };

  const menuAbove = useMemo(() => pos.y > (typeof window !== "undefined" ? window.innerHeight / 2 : 0), [pos.y]);

  const overlayStyle = useMemo(() => ({ opacity: 0 } as const), []);
  const menuStyle = useMemo(() => ({
    left: pos.x,
    ...(menuAbove
      ? { bottom: (typeof window !== "undefined" ? window.innerHeight : 0) - pos.y + 8 }
      : { top: pos.y + FAB_SIZE + 8 }),
  }), [pos.x, pos.y, menuAbove]);

  const fabStyle = useMemo(() => ({
    left: pos.x,
    top: pos.y,
    touchAction: "none" as const,
    position: "fixed" as const,
    zIndex: 50,
    width: FAB_SIZE,
    height: FAB_SIZE,
  }), [pos.x, pos.y]);

  if (!mounted) return null;

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={overlayStyle}
            animate={overlayStyle}
            exit={overlayStyle}
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {open && (
          <motion.div
            variants={menuVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
            className="fixed z-50 flex flex-col gap-2"
            style={menuStyle}
          >
            {ITEMS.map((item) => (
              <motion.button
                key={item.action}
                variants={itemVariants}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => handleAction(item.action)}
                className="flex items-center gap-3 px-5 py-3 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600 transition-all text-left will-change-transform"
              >
                <svg className="w-5 h-5 shrink-0 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                </svg>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-200 whitespace-nowrap">
                  {item.label}
                </span>
              </motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <button
        ref={fabRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onClick={handleFabClick}
        style={fabStyle}
        className={`rounded-full shadow-xl flex items-center justify-center backdrop-blur-sm will-change-transform transition-colors ${
          open
            ? "bg-red-500/90 hover:bg-red-500 text-white"
            : "bg-blue-600/90 hover:bg-blue-600 text-white"
        }`}
      >
        {open ? (
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14m7-7H5" />
          </svg>
        )}
      </button>

      <ReferModal open={referOpen} onClose={() => setReferOpen(false)} />
      <FeedbackModal open={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
    </>
  );
}
