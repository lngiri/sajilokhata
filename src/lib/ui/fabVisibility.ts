const FAB_HIDDEN_KEY = "qr_hisab_fab_hidden";
const FAB_VISIBILITY_EVENT = "qr_hisab:fab-visibility-change" as const;

export function isFabHidden(): boolean {
  try {
    return localStorage.getItem(FAB_HIDDEN_KEY) === "1";
  } catch {
    return false;
  }
}

export function setFabHidden(hidden: boolean): void {
  try {
    localStorage.setItem(FAB_HIDDEN_KEY, hidden ? "1" : "0");
  } catch {
    // localStorage unavailable
  }
  window.dispatchEvent(new CustomEvent(FAB_VISIBILITY_EVENT));
}

export function toggleFabHidden(): void {
  setFabHidden(!isFabHidden());
}

export { FAB_HIDDEN_KEY, FAB_VISIBILITY_EVENT };
