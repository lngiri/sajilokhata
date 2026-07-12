"use client";

/** Play a short ascending two-tone chime (C5→E5) via Web Audio API.
 *  Silently handles autoplay restrictions — no-op if audio context is blocked.
 */
export function playSuccessSound() {
  try {
    const ctx = new AudioContext();
    const now = ctx.currentTime;

    const osc1 = ctx.createOscillator();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(523.25, now);        // C5
    osc1.frequency.setValueAtTime(659.25, now + 0.12);  // E5
    const gain1 = ctx.createGain();
    gain1.gain.setValueAtTime(0.25, now);
    gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
    osc1.connect(gain1).connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.25);

    const osc2 = ctx.createOscillator();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(659.25, now + 0.14); // E5 again for emphasis
    const gain2 = ctx.createGain();
    gain2.gain.setValueAtTime(0.2, now + 0.14);
    gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
    osc2.connect(gain2).connect(ctx.destination);
    osc2.start(now + 0.14);
    osc2.stop(now + 0.35);
  } catch {
    // Audio not available — silent
  }
}
