"use client";

import { useEffect, useRef } from "react";
import { heartbeatSession } from "@/app/actions/session";

const HEARTBEAT_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Silently refreshes the session cookie TTL every 24 hours
 * so active users never need to re-login.
 *
 * Only runs on merchant pages and only when a merchant_id
 * exists in localStorage.
 */
export default function SessionHeartbeat() {
  const scheduled = useRef(false);

  useEffect(() => {
    if (scheduled.current) return;
    scheduled.current = true;

    const merchantId = localStorage.getItem("merchant_id");
    if (!merchantId) return;

    const beat = async () => {
      try {
        await heartbeatSession();
      } catch {
        // silent — don't disturb the user if heartbeat fails
      }
    };

    // Heartbeat immediately (extends the session from the first page load)
    beat();

    // Then repeat every 24 hours
    const id = setInterval(beat, HEARTBEAT_INTERVAL);
    return () => clearInterval(id);
  }, []);

  return null;
}
