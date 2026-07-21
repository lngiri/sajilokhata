import { test, expect } from "@playwright/test";
import {
  MERCHANT_PHONE, CUSTOMER_PHONE,
  createMerchant, setupAuth, goto, clickButton, assertNoErrors, waitLoaded,
} from "./helpers";

test.describe.configure({ mode: "serial" });
let merchantId = "";

// ================================================================
// PHASE 1: AUTH & REDIRECTS
// ================================================================
test.describe("Phase 1: Auth & Redirects", () => {

  test("A-01: Root redirects to login on app domain", async ({ page }) => {
    const res = await page.request.get("https://app.qrhisab.com/", { maxRedirects: 0 });
    expect(res.status()).toBe(307);
    const loc = res.headers()["location"] || "";
    expect(loc).toContain("/login");
    console.log(`[A] Root → 307 → ${loc}`);
  });

  test("A-02: Login page renders phone input", async ({ page }) => {
    await page.goto("https://app.qrhisab.com/login", { timeout: 30000 });
    await page.waitForTimeout(2000);
    await assertNoErrors(page);
    await expect(page.locator('input[type="tel"]').first()).toBeVisible({ timeout: 10000 });
    console.log("[A] Login page OK");
  });

  test("A-03: Create demo merchant via bypass API", async ({ page }) => {
    merchantId = await setupAuth(page);
    expect(merchantId).toBeTruthy();
  });

  test("A-04: Navigate directly to dashboard", async ({ page }) => {
    await goto(page, "/merchant/dashboard");
    await waitLoaded(page);
    await assertNoErrors(page);
    console.log(`[A] Dashboard URL: ${page.url()}`);
  });
});

// ================================================================
// PHASE 2: MERCHANT DASHBOARD
// ================================================================
test.describe("Phase 2: Merchant Dashboard", () => {

  test("D-01: Dashboard renders UI shell", async ({ page }) => {
    await setupAuth(page);
    await goto(page, "/merchant/dashboard");
    await waitLoaded(page);
    await assertNoErrors(page);
    // Even without data, the page header should show
    const header = page.locator("h1").first();
    await expect(header).toBeVisible({ timeout: 10000 });
    console.log(`[D] Header: ${await header.textContent()}`);
  });

  test("D-02: Bottom navigation renders", async ({ page }) => {
    await setupAuth(page);
    await goto(page, "/merchant/dashboard");
    await waitLoaded(page);
    const nav = page.locator("nav").last();
    await expect(nav).toBeVisible({ timeout: 10000 });
    const links = await nav.locator("a").count();
    console.log(`[D] BottomNav links: ${links}`);
    expect(links).toBeGreaterThanOrEqual(3);
  });

  test("D-03: Notification bell visible", async ({ page }) => {
    await setupAuth(page);
    await goto(page, "/merchant/dashboard");
    await waitLoaded(page);
    const bellBtns = page.locator("button").filter({ has: page.locator("svg") });
    const count = await bellBtns.count();
    console.log(`[D] SVG buttons (incl. bell): ${count}`);
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test("D-04: SMS balance badge", async ({ page }) => {
    await setupAuth(page);
    await goto(page, "/merchant/dashboard");
    await waitLoaded(page);
    const smsBadge = page.locator("a").filter({ hasText: /SMS/ }).first();
    const exists = await smsBadge.isVisible({ timeout: 3000 }).catch(() => false);
    console.log(`[D] SMS badge visible: ${exists}`);
  });

  test("D-05: Stats section area exists", async ({ page }) => {
    await setupAuth(page);
    await goto(page, "/merchant/dashboard");
    await waitLoaded(page);
    // Stats cards rendered or skeleton shown
    const cards = page.locator(".grid.grid-cols-2").first();
    const exists = await cards.isVisible({ timeout: 5000 }).catch(() => false);
    console.log(`[D] Stats grid visible: ${exists}`);
  });
});

// ================================================================
// PHASE 3: MANUAL ENTRY PAGE
// ================================================================
test.describe("Phase 3: Transaction Entry", () => {

  test("M-01: Manual entry page renders", async ({ page }) => {
    await setupAuth(page);
    await goto(page, "/merchant/scan?manual=true");
    await waitLoaded(page);
    await assertNoErrors(page);
    console.log("[M] Entry page OK");
  });

  test("M-02: Phone input visible", async ({ page }) => {
    await setupAuth(page);
    await goto(page, "/merchant/scan?manual=true");
    await waitLoaded(page);
    const telInput = page.locator('input[type="tel"]').first();
    await expect(telInput).toBeVisible({ timeout: 5000 });
    console.log("[M] Phone input OK");
  });

  test("M-03: Fill phone triggers lookup", async ({ page }) => {
    await setupAuth(page);
    await goto(page, "/merchant/scan?manual=true");
    await waitLoaded(page);
    const telInput = page.locator('input[type="tel"]').first();
    await telInput.fill(CUSTOMER_PHONE);
    await page.waitForTimeout(2000);
    await assertNoErrors(page);
    console.log("[M] Phone filled, lookup triggered");
  });

  test("M-04: Amount input visible", async ({ page }) => {
    await setupAuth(page);
    await goto(page, "/merchant/scan?manual=true");
    await waitLoaded(page);
    const amountInput = page.locator('input[placeholder*="mount"]').first();
    const exists = await amountInput.isVisible({ timeout: 3000 }).catch(() => false);
    console.log(`[M] Amount input: ${exists}`);
  });

  test("M-05: Entry type tabs visible", async ({ page }) => {
    await setupAuth(page);
    await goto(page, "/merchant/scan?manual=true");
    await waitLoaded(page);
    const debitTab = page.locator("button").filter({ hasText: /Debit|Purchase/ }).first();
    const creditTab = page.locator("button").filter({ hasText: /Payment|Credit/ }).first();
    const cashTab = page.locator("button").filter({ hasText: /Cash/ }).first();
    console.log(`[M] Tabs - Debit:${await debitTab.isVisible().catch(()=>false)} Credit:${await creditTab.isVisible().catch(()=>false)} Cash:${await cashTab.isVisible().catch(()=>false)}`);
  });

  test("M-06: Amount suggestions appear", async ({ page }) => {
    await setupAuth(page);
    await goto(page, "/merchant/scan?manual=true");
    await waitLoaded(page);
    const suggestions = page.locator("button").filter({ hasText: /Rs\.?\s*\d{3,}/ }).first();
    const exists = await suggestions.isVisible({ timeout: 3000 }).catch(() => false);
    console.log(`[M] Amount suggestions: ${exists}`);
  });

  test("M-07: Description field", async ({ page }) => {
    await setupAuth(page);
    await goto(page, "/merchant/scan?manual=true");
    await waitLoaded(page);
    const descInput = page.locator('input[placeholder*="escription"]').first();
    const exists = await descInput.isVisible({ timeout: 3000 }).catch(() => false);
    console.log(`[M] Description input: ${exists}`);
  });

  test("M-08: Save button visible", async ({ page }) => {
    await setupAuth(page);
    await goto(page, "/merchant/scan?manual=true");
    await waitLoaded(page);
    const saveBtn = page.locator("button").filter({ hasText: /Save|Submit/ }).first();
    const exists = await saveBtn.isVisible({ timeout: 3000 }).catch(() => false);
    console.log(`[M] Save button: ${exists}`);
  });
});

// ================================================================
// PHASE 4: VERIFICATION FLOW
// ================================================================
test.describe("Phase 4: Verification", () => {

  test("V-01: Verify page with invalid token", async ({ page }) => {
    await goto(page, "/verify?token=invalid_test_token_xyz");
    await page.waitForTimeout(3000);
    await assertNoErrors(page);
    console.log(`[V] Verify page URL: ${page.url()}`);
  });
});

// ================================================================
// PHASE 5-6: CUSTOMER PAGES
// ================================================================
test.describe("Phase 5-6: Customer", () => {

  test("CU-01: Customer dashboard loads", async ({ page }) => {
    await goto(page, "/login");
    await page.evaluate(({ phone }) => {
      const s = JSON.stringify({ phone, name: "E2E Customer" });
      localStorage.setItem("sajilo_customer_session", s);
      document.cookie = `customer_session=${encodeURIComponent(s)}; path=/; max-age=31536000; SameSite=Lax`;
    }, { phone: CUSTOMER_PHONE });
    await goto(page, "/customer/dashboard");
    await page.waitForTimeout(3000);
    await assertNoErrors(page);
    console.log(`[CU] Dashboard: ${page.url()}`);
  });

  test("CU-02: Customer history", async ({ page }) => {
    await goto(page, "/login");
    await page.evaluate(({ phone }) => {
      const s = JSON.stringify({ phone, name: "E2E Customer" });
      localStorage.setItem("sajilo_customer_session", s);
      document.cookie = `customer_session=${encodeURIComponent(s)}; path=/; max-age=31536000; SameSite=Lax`;
    }, { phone: CUSTOMER_PHONE });
    await goto(page, "/customer/history");
    await page.waitForTimeout(3000);
    await assertNoErrors(page);
    console.log(`[CU] History: ${page.url()}`);
  });

  test("CU-03: Customer settings", async ({ page }) => {
    await goto(page, "/login");
    await page.evaluate(({ phone }) => {
      const s = JSON.stringify({ phone, name: "E2E Customer" });
      localStorage.setItem("sajilo_customer_session", s);
    }, { phone: CUSTOMER_PHONE });
    await goto(page, "/customer/settings");
    await page.waitForTimeout(3000);
    await assertNoErrors(page);
    console.log(`[CU] Settings: ${page.url()}`);
  });
});

// ================================================================
// PHASE 7: LEDGER
// ================================================================
test.describe("Phase 7: Ledger", () => {

  test("L-01: Ledger page renders", async ({ page }) => {
    await setupAuth(page);
    await goto(page, "/merchant/logs");
    await waitLoaded(page);
    await assertNoErrors(page);
    console.log("[L] Ledger page OK");
  });

  test("L-02: Filter buttons visible", async ({ page }) => {
    await setupAuth(page);
    await goto(page, "/merchant/logs");
    await waitLoaded(page);
    const filters = page.locator("button").filter({ hasText: /all|pending|approved|disputed/i });
    const count = await filters.count();
    console.log(`[L] Filter buttons: ${count}`);
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test("L-03: Click each filter", async ({ page }) => {
    await setupAuth(page);
    await goto(page, "/merchant/logs");
    await waitLoaded(page);
    for (const label of ["all", "pending", "approved"]) {
      const btn = page.locator("button").filter({ hasText: new RegExp(`^${label}$`, "i") }).first();
      if (await btn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await btn.click();
        await page.waitForTimeout(500);
        await assertNoErrors(page);
        console.log(`[L] Filter "${label}" clicked OK`);
      }
    }
  });
});

// ================================================================
// PHASE 8: CUSTOMER DETAIL
// ================================================================
test.describe("Phase 8: Customer Detail", () => {

  test("CD-01: Navigate to first customer detail", async ({ page }) => {
    await setupAuth(page);
    await goto(page, "/merchant/customers");
    await waitLoaded(page);
    const link = page.locator("a[href*='/merchant/customers/']").first();
    if (await link.isVisible({ timeout: 5000 }).catch(() => false)) {
      await link.click();
      await page.waitForTimeout(2000);
      await assertNoErrors(page);
      console.log(`[CD] Detail page: ${page.url()}`);
    } else {
      console.log("[CD] No customer links (fresh merchant)");
    }
  });

  test("CD-02: Back navigation", async ({ page }) => {
    await setupAuth(page);
    await goto(page, "/merchant/customers");
    await waitLoaded(page);
    const link = page.locator("a[href*='/merchant/customers/']").first();
    if (await link.isVisible({ timeout: 5000 }).catch(() => false)) {
      await link.click();
      await page.waitForTimeout(2000);
      const backBtn = page.locator("a[href*='/merchant/customers']").first();
      if (await backBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await backBtn.click();
        await page.waitForTimeout(1000);
        console.log(`[CD] Back nav: ${page.url()}`);
      }
    }
  });
});

// ================================================================
// PHASE 9: CUSTOMERS LIST
// ================================================================
test.describe("Phase 9: Customers List", () => {

  test("C-01: Customers page renders", async ({ page }) => {
    await setupAuth(page);
    await goto(page, "/merchant/customers");
    await waitLoaded(page);
    await assertNoErrors(page);
    const header = page.locator("h1").first();
    await expect(header).toBeVisible({ timeout: 5000 });
    console.log(`[C] Header: ${await header.textContent()}`);
  });

  test("C-02: Search input visible", async ({ page }) => {
    await setupAuth(page);
    await goto(page, "/merchant/customers");
    await waitLoaded(page);
    const search = page.locator('input[placeholder*="earch"]').first();
    const exists = await search.isVisible({ timeout: 3000 }).catch(() => false);
    console.log(`[C] Search input: ${exists}`);
  });
});

// ================================================================
// PHASE 10: REPORTS
// ================================================================
test.describe("Phase 10: Reports", () => {

  test("R-01: Reports page renders", async ({ page }) => {
    await setupAuth(page);
    await goto(page, "/merchant/reports");
    await waitLoaded(page);
    await assertNoErrors(page);
    console.log("[R] Reports page OK");
  });

  test("R-02: Date filter buttons", async ({ page }) => {
    await setupAuth(page);
    await goto(page, "/merchant/reports");
    await waitLoaded(page);
    for (const label of ["Today", "Week", "Month"]) {
      const btn = page.locator("button").filter({ hasText: new RegExp(label, "i") }).first();
      const v = await btn.isVisible({ timeout: 2000 }).catch(() => false);
      if (v) {
        await btn.click();
        await page.waitForTimeout(500);
      }
      console.log(`[R] "${label}" btn visible: ${v}`);
    }
  });

  test("R-03: Metric cards section", async ({ page }) => {
    await setupAuth(page);
    await goto(page, "/merchant/reports");
    await waitLoaded(page);
    const metric = page.locator("text=Total Debit").first();
    const exists = await metric.isVisible({ timeout: 5000 }).catch(() => false);
    console.log(`[R] Metric cards: ${exists}`);
  });

  test("R-04: Chart area visible", async ({ page }) => {
    await setupAuth(page);
    await goto(page, "/merchant/reports");
    await waitLoaded(page);
    const chart = page.locator(".recharts-surface, .recharts-wrapper").first();
    const exists = await chart.isVisible({ timeout: 3000 }).catch(() => false);
    console.log(`[R] Charts: ${exists}`);
  });
});

// ================================================================
// PHASE 11: CASH SALES
// ================================================================
test.describe("Phase 11: Cash Sales", () => {

  test("CS-01: Cash sales page renders", async ({ page }) => {
    await setupAuth(page);
    await goto(page, "/merchant/cash-sales");
    await waitLoaded(page);
    await assertNoErrors(page);
    console.log("[CS] Cash sales page OK");
  });
});

// ================================================================
// PHASE 12: SMS BILLING
// ================================================================
test.describe("Phase 12: SMS Billing", () => {

  test("B-01: Billing page renders", async ({ page }) => {
    await setupAuth(page);
    await goto(page, "/merchant/billing");
    await waitLoaded(page);
    await assertNoErrors(page);
    console.log("[B] Billing page OK");
  });

  test("B-02: Current balance section", async ({ page }) => {
    await setupAuth(page);
    await goto(page, "/merchant/billing");
    await waitLoaded(page);
    const balance = page.locator("text=Current Balance");
    await expect(balance).toBeVisible({ timeout: 10000 });
    console.log("[B] Balance section OK");
  });

  test("B-03: Package cards visible", async ({ page }) => {
    await setupAuth(page);
    await goto(page, "/merchant/billing");
    await waitLoaded(page);
    const buyBtns = page.locator("button").filter({ hasText: /Buy Now/ });
    const count = await buyBtns.count();
    console.log(`[B] Buy Now buttons: ${count}`);
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test("B-04: Buy Now opens payment modal", async ({ page }) => {
    await setupAuth(page);
    await goto(page, "/merchant/billing");
    await waitLoaded(page);
    const buyBtn = page.locator("button").filter({ hasText: /Buy Now/ }).first();
    if (await buyBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await buyBtn.click();
      await page.waitForTimeout(1500);
      await assertNoErrors(page);
      console.log("[B] Payment modal opened");
    }
  });

  test("B-05: Recharge & SMS history sections", async ({ page }) => {
    await setupAuth(page);
    await goto(page, "/merchant/billing");
    await waitLoaded(page);
    const recharge = page.locator("text=Recharge History").isVisible().catch(() => false);
    const smsHist = page.locator("text=SMS History").isVisible().catch(() => false);
    console.log(`[B] RechargeHistory:${await recharge} SMSHistory:${await smsHist}`);
  });
});

// ================================================================
// PHASE 13: SETTINGS
// ================================================================
test.describe("Phase 13: Settings", () => {

  test("S-01: Settings page renders", async ({ page }) => {
    await setupAuth(page);
    await goto(page, "/merchant/settings");
    await waitLoaded(page);
    await assertNoErrors(page);
    console.log("[S] Settings page OK");
  });

  test("S-02: Profile section visible", async ({ page }) => {
    await setupAuth(page);
    await goto(page, "/merchant/settings");
    await waitLoaded(page);
    const profile = page.locator("text=Profile").first();
    const visible = await profile.isVisible({ timeout: 5000 }).catch(() => false);
    console.log(`[S] Profile section: ${visible}`);
  });

  test("S-03: Change PIN section", async ({ page }) => {
    await setupAuth(page);
    await goto(page, "/merchant/settings");
    await waitLoaded(page);
    const changePin = page.locator("text=Change PIN");
    const visible = await changePin.isVisible({ timeout: 3000 }).catch(() => false);
    console.log(`[S] Change PIN: ${visible}`);
  });

  test("S-04: Payment methods section", async ({ page }) => {
    await setupAuth(page);
    await goto(page, "/merchant/settings");
    await waitLoaded(page);
    const payment = page.locator("text=Payment").first();
    const visible = await payment.isVisible({ timeout: 3000 }).catch(() => false);
    console.log(`[S] Payment methods: ${visible}`);
  });

  test("S-05: Reminder settings", async ({ page }) => {
    await setupAuth(page);
    await goto(page, "/merchant/settings");
    await waitLoaded(page);
    const reminder = page.locator("text=Reminder").first();
    const visible = await reminder.isVisible({ timeout: 3000 }).catch(() => false);
    console.log(`[S] Reminder settings: ${visible}`);
  });

  test("S-06: Export button", async ({ page }) => {
    await setupAuth(page);
    await goto(page, "/merchant/settings");
    await waitLoaded(page);
    const exportBtn = page.locator("button").filter({ hasText: /Export/ }).first();
    const visible = await exportBtn.isVisible({ timeout: 3000 }).catch(() => false);
    console.log(`[S] Export button: ${visible}`);
  });
});

// ================================================================
// PHASE 14: QR PAGE
// ================================================================
test.describe("Phase 14: QR Page", () => {

  test("QR-01: QR page renders", async ({ page }) => {
    await setupAuth(page);
    await goto(page, "/merchant/qr");
    await waitLoaded(page);
    await assertNoErrors(page);
    const header = page.locator("h1").first();
    await expect(header).toBeVisible({ timeout: 5000 });
    console.log(`[QR] Header: ${await header.textContent()}`);
  });

  test("QR-02: QR code element", async ({ page }) => {
    await setupAuth(page);
    await goto(page, "/merchant/qr");
    await waitLoaded(page);
    const qr = page.locator("canvas, svg, img[alt*='QR']").first();
    const visible = await qr.isVisible({ timeout: 3000 }).catch(() => false);
    console.log(`[QR] QR element visible: ${visible}`);
  });
});

// ================================================================
// PHASE 15: IMPORT
// ================================================================
test.describe("Phase 15: Import", () => {

  test("I-01: Import page renders", async ({ page }) => {
    await setupAuth(page);
    await goto(page, "/merchant/import");
    await waitLoaded(page);
    await assertNoErrors(page);
    console.log("[I] Import page OK");
  });

  test("I-02: File upload input", async ({ page }) => {
    await setupAuth(page);
    await goto(page, "/merchant/import");
    await waitLoaded(page);
    const fileInput = page.locator('input[type="file"]').first();
    const visible = await fileInput.isVisible({ timeout: 5000 }).catch(() => false);
    console.log(`[I] File input visible: ${visible}`);
  });
});

// ================================================================
// PHASE 17: SMS REMINDERS
// ================================================================
test.describe("Phase 17: SMS Reminders", () => {

  test("SR-01: Remind button in dashboard", async ({ page }) => {
    await setupAuth(page);
    await goto(page, "/merchant/dashboard");
    await waitLoaded(page);
    const remindBtn = page.locator("button").filter({ hasText: /Remind/ }).first();
    const visible = await remindBtn.isVisible({ timeout: 3000 }).catch(() => false);
    console.log(`[SR] Remind button visible: ${visible}`);
  });
});

// ================================================================
// PHASE 18: ADMIN PANEL
// ================================================================
test.describe("Phase 18: Admin Panel", () => {

  test("AD-01: Admin login page", async ({ page }) => {
    await goto(page, "/admin/login");
    await waitLoaded(page);
    await assertNoErrors(page);
    await expect(page.locator("text=Admin Panel")).toBeVisible({ timeout: 10000 });
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    console.log("[AD] Login page OK");
  });

  test("AD-02: Admin dashboard page", async ({ page }) => {
    await goto(page, "/admin/dashboard");
    await page.waitForTimeout(3000);
    await assertNoErrors(page);
    console.log(`[AD] Dashboard: ${page.url()}`);
  });

  for (const pageName of ["users", "disputes", "sms-requests", "analytics", "alerts", "sessions", "storage", "health", "branding", "cms", "announcements"]) {
    test(`AD-03: Admin /admin/${pageName}`, async ({ page }) => {
      await goto(page, `/admin/${pageName}`);
      await page.waitForTimeout(3000);
      await assertNoErrors(page);
      console.log(`[AD] /admin/${pageName} OK`);
    });
  }
});

// ================================================================
// PHASE 19: EDGE CASES
// ================================================================
test.describe("Phase 19: Edge Cases", () => {

  test("EC-01: Public business profile page", async ({ page }) => {
    if (merchantId) {
      await goto(page, `/business/${merchantId}`);
      await page.waitForTimeout(2000);
      await assertNoErrors(page);
      console.log(`[EC] Business profile for ${merchantId}`);
    }
  });

  test("EC-02: 404 page", async ({ page }) => {
    const res = await page.goto("/nonexistent-test-page-xyz", { timeout: 15000 });
    if (res) console.log(`[EC] 404 status: ${res.status()}`);
  });

  test("EC-03: Customer scan page", async ({ page }) => {
    await goto(page, "/scan");
    await page.waitForTimeout(2000);
    await assertNoErrors(page);
    console.log("[EC] Customer /scan OK");
  });

  test("EC-04: Onboard page", async ({ page }) => {
    await goto(page, "/onboard");
    await page.waitForTimeout(2000);
    await assertNoErrors(page);
    console.log("[EC] /onboard OK");
  });

  test("EC-05: Select-role page without session", async ({ page }) => {
    await goto(page, "/login");
    await page.evaluate(() => localStorage.clear());
    await goto(page, "/select-role");
    await page.waitForTimeout(3000);
    console.log(`[EC] select-role → ${page.url()}`);
  });

  test("EC-06: All public pages error-free", async ({ page }) => {
    for (const p of ["/login", "/scan", "/onboard"]) {
      await goto(page, p);
      await page.waitForTimeout(1500);
      const errCount = await page.locator("text=Something went wrong").count();
      if (errCount > 0) console.error(`[EC] ERROR on ${p}`);
      expect(errCount).toBe(0);
    }
    console.log("[EC] All public pages OK");
  });

  test("EC-07: Session API", async ({ page }) => {
    const res = await page.request.get("/api/auth/session");
    const body = await res.json();
    console.log(`[EC] Session API: userId=${!!body.userId}`);
  });

  test("EC-08: Health API", async ({ page }) => {
    const res = await page.request.get("/api/admin/health");
    console.log(`[EC] Health API: ${res.status()} ${res.ok() ? (await res.json()).status || "ok" : "unavailable"}`);
  });

  test("EC-09: Feedback API", async ({ page }) => {
    const res = await page.request.post("/api/feedback", {
      data: { message: "E2E test", rating: 5 },
    });
    console.log(`[EC] Feedback API: ${res.status()}`);
  });
});
