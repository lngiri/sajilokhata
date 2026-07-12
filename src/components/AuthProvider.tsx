"use client";

import { createClient } from "@/lib/supabase/client";
import { useEffect, useRef } from "react";

const STORAGE_KEYS = ["merchant_id", "sajilo_customer_session"];

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const supabase = useRef(createClient()).current;

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        // Clear stale localStorage keys so pages re-fetch fresh data
        STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));
        // Store the authoritative user ID from the session
        if (session?.user?.id) {
          localStorage.setItem("merchant_id", session.user.id);
        }
      }

      if (event === "SIGNED_OUT") {
        STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase]);

  return <>{children}</>;
}
