# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: comprehensive.spec.ts >> Phase 5-6: Customer >> CU-01: Customer dashboard loads
- Location: e2e\comprehensive.spec.ts:199:7

# Error details

```
Error: expect(locator).toHaveCount(expected) failed

Locator:  locator('text=Something went wrong')
Expected: 0
Received: 1
Timeout:  3000ms

Call log:
  - Expect "toHaveCount" with timeout 3000ms
  - waiting for locator('text=Something went wrong')
    10 × locator resolved to 1 element
       - unexpected value "1"

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - main [ref=e2]:
    - generic [ref=e3]:
      - img [ref=e5]
      - heading "Something went wrong" [level=2] [ref=e7]
      - paragraph [ref=e8]: "Minified React error #310; visit https://react.dev/errors/310 for the full message or use the non-minified dev environment for full errors and additional helpful warnings."
      - button "Try Again" [ref=e9]
  - button [ref=e10]:
    - img [ref=e11]
  - alert [ref=e13]
```

# Test source

```ts
  1  | import { Page, expect } from "@playwright/test";
  2  | 
  3  | // Use a single timestamp for the whole test run
  4  | const TS = Date.now().toString().slice(-6);
  5  | export const MERCHANT_PHONE = `98410${TS}`;
  6  | export const CUSTOMER_PHONE = `98410${parseInt(TS)+1}`;
  7  | 
  8  | // Bypass creds — filled once by createMerchant, reused by setupAuth
  9  | let _bypassUserId: string | null = null;
  10 | 
  11 | /**
  12 |  * Create a merchant via bypass API, set auth_bypass cookie.
  13 |  */
  14 | export async function createMerchant(page: Page, phone = MERCHANT_PHONE): Promise<string> {
  15 |   const res = await page.request.post("/api/auth/bypass", { data: { phone } });
  16 |   console.log(`[Helper] Bypass API status: ${res.status()}`);
  17 |   if (!res.ok()) {
  18 |     const body = await res.text();
  19 |     console.log(`[Helper] Bypass API error: ${body}`);
  20 |     throw new Error(`Bypass API returned ${res.status()}: ${body}`);
  21 |   }
  22 |   const body = await res.json();
  23 |   expect(body.user_id).toBeTruthy();
  24 | 
  25 |   // Set auth_bypass cookie (middleware checks this on deployed env)
  26 |   await page.context().addCookies([
  27 |     { name: "auth_bypass", value: "true", domain: "app.qrhisab.com", path: "/", httpOnly: false, secure: true, sameSite: "Lax" },
  28 |   ]);
  29 | 
  30 |   // Set only merchant_phone in localStorage (NOT merchant_id — SessionGuard skips if merchant_id absent)
  31 |   await page.goto("/login");
  32 |   await page.waitForTimeout(500);
  33 |   await page.evaluate(({ ph }) => {
  34 |     localStorage.setItem("merchant_phone", ph);
  35 |   }, { ph: phone });
  36 | 
  37 |   _bypassUserId = body.user_id;
  38 |   console.log(`[Helper] Created merchant: ${body.user_id} (created: ${body.created})`);
  39 |   return body.user_id;
  40 | }
  41 | 
  42 | /**
  43 |  * Set up auth for a test page.
  44 |  * Creates the merchant on first call, re-sets cookie on subsequent calls.
  45 |  */
  46 | export async function setupAuth(page: Page): Promise<string> {
  47 |   if (!_bypassUserId) {
  48 |     return await createMerchant(page, MERCHANT_PHONE);
  49 |   }
  50 |   await page.context().addCookies([
  51 |     { name: "auth_bypass", value: "true", domain: "app.qrhisab.com", path: "/", httpOnly: false, secure: true, sameSite: "Lax" },
  52 |   ]);
  53 |   await page.goto("/login");
  54 |   await page.waitForTimeout(500);
  55 |   await page.evaluate(({ ph }) => {
  56 |     localStorage.setItem("merchant_phone", ph);
  57 |   }, { ph: MERCHANT_PHONE });
  58 |   return _bypassUserId;
  59 | }
  60 | 
  61 | /** Navigate to a URL, wait for load */
  62 | export async function goto(page: Page, url: string) {
  63 |   await page.goto(url, { timeout: 30000 }).catch(() => {});
  64 |   await page.waitForTimeout(2000);
  65 | }
  66 | 
  67 | /** Check page for no error text */
  68 | export async function assertNoErrors(page: Page) {
> 69 |   await expect(page.locator("text=Something went wrong")).toHaveCount(0, { timeout: 3000 });
     |                                                           ^ Error: expect(locator).toHaveCount(expected) failed
  70 |   await expect(page.locator("text=Internal Server Error")).toHaveCount(0, { timeout: 3000 });
  71 | }
  72 | 
  73 | /** Wait for loading spinners */
  74 | export async function waitLoaded(page: Page) {
  75 |   await page.waitForTimeout(1500);
  76 |   try {
  77 |     await page.locator(".animate-spin").waitFor({ state: "detached", timeout: 8000 });
  78 |   } catch { /* ok */ }
  79 | }
  80 | 
  81 | /** Click button by text (case-insensitive) */
  82 | export async function clickButton(page: Page, text: string) {
  83 |   const btn = page.getByRole("button").filter({ hasText: new RegExp(text, "i") }).first();
  84 |   try {
  85 |     await btn.waitFor({ state: "visible", timeout: 5000 });
  86 |     await btn.click();
  87 |   } catch {
  88 |     console.log(`[Helper] Button "${text}" not found`);
  89 |   }
  90 | }
  91 | 
```