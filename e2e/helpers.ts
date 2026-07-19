import { Page, expect } from "@playwright/test";

// Use a single timestamp for the whole test run
const TS = Date.now().toString().slice(-6);
export const MERCHANT_PHONE = `98410${TS}`;
export const CUSTOMER_PHONE = `98410${parseInt(TS)+1}`;

// Bypass creds — filled once by createMerchant, reused by setupAuth
let _bypassUserId: string | null = null;

/**
 * Create a merchant via bypass API, set auth_bypass cookie.
 */
export async function createMerchant(page: Page, phone = MERCHANT_PHONE): Promise<string> {
  const res = await page.request.post("/api/auth/bypass", { data: { phone } });
  console.log(`[Helper] Bypass API status: ${res.status()}`);
  if (!res.ok()) {
    const body = await res.text();
    console.log(`[Helper] Bypass API error: ${body}`);
    throw new Error(`Bypass API returned ${res.status()}: ${body}`);
  }
  const body = await res.json();
  expect(body.user_id).toBeTruthy();

  // Set auth_bypass cookie — use the playwright baseURL domain for consistency
  await page.context().addCookies([
    { name: "auth_bypass", value: "true", domain: "app.qrhisab.com", path: "/", httpOnly: false, secure: true, sameSite: "Lax" },
  ]);

  // Set only merchant_phone in localStorage (NOT merchant_id — SessionGuard skips if merchant_id absent)
  await page.goto("/login");
  await page.waitForTimeout(500);
  await page.evaluate(({ ph }) => {
    localStorage.setItem("merchant_phone", ph);
  }, { ph: phone });

  _bypassUserId = body.user_id;
  console.log(`[Helper] Created merchant: ${body.user_id} (created: ${body.created})`);
  return body.user_id;
}

/**
 * Set up auth for a test page.
 * Creates the merchant on first call, re-sets cookie on subsequent calls.
 */
export async function setupAuth(page: Page): Promise<string> {
  if (!_bypassUserId) {
    return await createMerchant(page, MERCHANT_PHONE);
  }
  // Set auth_bypass cookie — use the playwright baseURL domain for consistency
  await page.context().addCookies([
    { name: "auth_bypass", value: "true", domain: "app.qrhisab.com", path: "/", httpOnly: false, secure: true, sameSite: "Lax" },
  ]);
  await page.goto("/login");
  await page.waitForTimeout(500);
  await page.evaluate(({ ph }) => {
    localStorage.setItem("merchant_phone", ph);
  }, { ph: MERCHANT_PHONE });
  return _bypassUserId;
}

/** Navigate to a URL, wait for load */
export async function goto(page: Page, url: string) {
  await page.goto(url, { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(2000);
}

/** Check page for no error text */
export async function assertNoErrors(page: Page) {
  await expect(page.locator("text=Something went wrong")).toHaveCount(0, { timeout: 3000 });
  await expect(page.locator("text=Internal Server Error")).toHaveCount(0, { timeout: 3000 });
}

/** Wait for loading spinners */
export async function waitLoaded(page: Page) {
  await page.waitForTimeout(1500);
  try {
    await page.locator(".animate-spin").waitFor({ state: "detached", timeout: 8000 });
  } catch { /* ok */ }
}

/** Click button by text (case-insensitive) */
export async function clickButton(page: Page, text: string) {
  const btn = page.getByRole("button").filter({ hasText: new RegExp(text, "i") }).first();
  try {
    await btn.waitFor({ state: "visible", timeout: 5000 });
    await btn.click();
  } catch {
    console.log(`[Helper] Button "${text}" not found`);
  }
}
