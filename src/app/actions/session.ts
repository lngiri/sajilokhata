"use server";

import { cookies } from "next/headers";
import {
  verifySessionToken,
  createSessionTokenWithTTL,
  SESSION_COOKIE,
  SESSION_DURATION,
} from "@/lib/session";

/**
 * Refresh the session cookie TTL.
 * Called client-side on a heartbeat to extend the session
 * so the user isn't logged out after closing the browser.
 *
 * Only extends if at least 7 days remain on a 30-day session
 * (avoids unnecessary writes on every heartbeat).
 */
export async function heartbeatSession(): Promise<{ ok: boolean }> {
  try {
    const cookieStore = await cookies();
    const raw = cookieStore.get(SESSION_COOKIE)?.value;
    if (!raw) return { ok: false };

    const session = await verifySessionToken(raw);
    const userId = session?.userId ?? null;
    if (!userId) return { ok: false };

    // Re-issue with fresh 30-day TTL
    const { token, maxAge } = await createSessionTokenWithTTL(
      userId,
      SESSION_DURATION
    );
    cookieStore.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge,
      path: "/",
    });

    return { ok: true };
  } catch {
    return { ok: false };
  }
}
