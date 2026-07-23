# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: comprehensive.spec.ts >> Phase 7: Ledger >> L-02: Filter buttons visible
- Location: e2e\comprehensive.spec.ts:251:7

# Error details

```
Error: expect(received).toBeGreaterThanOrEqual(expected)

Expected: >= 1
Received:    0
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - main [ref=e2]:
    - generic [ref=e3]:
      - generic [ref=e4]:
        - img [ref=e6]
        - heading "QR Hisab" [level=1] [ref=e8]
        - paragraph [ref=e9]: Digital Diary
      - generic [ref=e10]:
        - paragraph [ref=e11]: Sign in with your phone number
        - generic [ref=e12]:
          - text: Phone Number
          - generic [ref=e13]:
            - generic [ref=e14]: "+977"
            - textbox "9841234567" [ref=e15]
        - button "Continue" [disabled] [ref=e16]
  - button [ref=e17]:
    - img [ref=e18]
  - alert [ref=e20]
```

# Test source

```ts
  158 |     const exists = await suggestions.isVisible({ timeout: 3000 }).catch(() => false);
  159 |     console.log(`[M] Amount suggestions: ${exists}`);
  160 |   });
  161 | 
  162 |   test("M-07: Description field", async ({ page }) => {
  163 |     await setupAuth(page);
  164 |     await goto(page, "/merchant/scan?manual=true");
  165 |     await waitLoaded(page);
  166 |     const descInput = page.locator('input[placeholder*="escription"]').first();
  167 |     const exists = await descInput.isVisible({ timeout: 3000 }).catch(() => false);
  168 |     console.log(`[M] Description input: ${exists}`);
  169 |   });
  170 | 
  171 |   test("M-08: Save button visible", async ({ page }) => {
  172 |     await setupAuth(page);
  173 |     await goto(page, "/merchant/scan?manual=true");
  174 |     await waitLoaded(page);
  175 |     const saveBtn = page.locator("button").filter({ hasText: /Save|Submit/ }).first();
  176 |     const exists = await saveBtn.isVisible({ timeout: 3000 }).catch(() => false);
  177 |     console.log(`[M] Save button: ${exists}`);
  178 |   });
  179 | });
  180 | 
  181 | // ================================================================
  182 | // PHASE 4: VERIFICATION FLOW
  183 | // ================================================================
  184 | test.describe("Phase 4: Verification", () => {
  185 | 
  186 |   test("V-01: Verify page with invalid token", async ({ page }) => {
  187 |     await goto(page, "/verify?token=invalid_test_token_xyz");
  188 |     await page.waitForTimeout(3000);
  189 |     await assertNoErrors(page);
  190 |     console.log(`[V] Verify page URL: ${page.url()}`);
  191 |   });
  192 | });
  193 | 
  194 | // ================================================================
  195 | // PHASE 5-6: CUSTOMER PAGES
  196 | // ================================================================
  197 | test.describe("Phase 5-6: Customer", () => {
  198 | 
  199 |   test("CU-01: Customer dashboard loads", async ({ page }) => {
  200 |     await goto(page, "/login");
  201 |     await page.evaluate(({ phone }) => {
  202 |       const s = JSON.stringify({ phone, name: "E2E Customer" });
  203 |       localStorage.setItem("sajilo_customer_session", s);
  204 |       document.cookie = `customer_session=${encodeURIComponent(s)}; path=/; max-age=31536000; SameSite=Lax`;
  205 |     }, { phone: CUSTOMER_PHONE });
  206 |     await goto(page, "/customer/dashboard");
  207 |     await page.waitForTimeout(3000);
  208 |     await assertNoErrors(page);
  209 |     console.log(`[CU] Dashboard: ${page.url()}`);
  210 |   });
  211 | 
  212 |   test("CU-02: Customer history", async ({ page }) => {
  213 |     await goto(page, "/login");
  214 |     await page.evaluate(({ phone }) => {
  215 |       const s = JSON.stringify({ phone, name: "E2E Customer" });
  216 |       localStorage.setItem("sajilo_customer_session", s);
  217 |       document.cookie = `customer_session=${encodeURIComponent(s)}; path=/; max-age=31536000; SameSite=Lax`;
  218 |     }, { phone: CUSTOMER_PHONE });
  219 |     await goto(page, "/customer/history");
  220 |     await page.waitForTimeout(3000);
  221 |     await assertNoErrors(page);
  222 |     console.log(`[CU] History: ${page.url()}`);
  223 |   });
  224 | 
  225 |   test("CU-03: Customer settings", async ({ page }) => {
  226 |     await goto(page, "/login");
  227 |     await page.evaluate(({ phone }) => {
  228 |       const s = JSON.stringify({ phone, name: "E2E Customer" });
  229 |       localStorage.setItem("sajilo_customer_session", s);
  230 |     }, { phone: CUSTOMER_PHONE });
  231 |     await goto(page, "/customer/settings");
  232 |     await page.waitForTimeout(3000);
  233 |     await assertNoErrors(page);
  234 |     console.log(`[CU] Settings: ${page.url()}`);
  235 |   });
  236 | });
  237 | 
  238 | // ================================================================
  239 | // PHASE 7: LEDGER
  240 | // ================================================================
  241 | test.describe("Phase 7: Ledger", () => {
  242 | 
  243 |   test("L-01: Ledger page renders", async ({ page }) => {
  244 |     await setupAuth(page);
  245 |     await goto(page, "/merchant/logs");
  246 |     await waitLoaded(page);
  247 |     await assertNoErrors(page);
  248 |     console.log("[L] Ledger page OK");
  249 |   });
  250 | 
  251 |   test("L-02: Filter buttons visible", async ({ page }) => {
  252 |     await setupAuth(page);
  253 |     await goto(page, "/merchant/logs");
  254 |     await waitLoaded(page);
  255 |     const filters = page.locator("button").filter({ hasText: /all|pending|approved|disputed/i });
  256 |     const count = await filters.count();
  257 |     console.log(`[L] Filter buttons: ${count}`);
> 258 |     expect(count).toBeGreaterThanOrEqual(1);
      |                   ^ Error: expect(received).toBeGreaterThanOrEqual(expected)
  259 |   });
  260 | 
  261 |   test("L-03: Click each filter", async ({ page }) => {
  262 |     await setupAuth(page);
  263 |     await goto(page, "/merchant/logs");
  264 |     await waitLoaded(page);
  265 |     for (const label of ["all", "pending", "approved"]) {
  266 |       const btn = page.locator("button").filter({ hasText: new RegExp(`^${label}$`, "i") }).first();
  267 |       if (await btn.isVisible({ timeout: 2000 }).catch(() => false)) {
  268 |         await btn.click();
  269 |         await page.waitForTimeout(500);
  270 |         await assertNoErrors(page);
  271 |         console.log(`[L] Filter "${label}" clicked OK`);
  272 |       }
  273 |     }
  274 |   });
  275 | });
  276 | 
  277 | // ================================================================
  278 | // PHASE 8: CUSTOMER DETAIL
  279 | // ================================================================
  280 | test.describe("Phase 8: Customer Detail", () => {
  281 | 
  282 |   test("CD-01: Navigate to first customer detail", async ({ page }) => {
  283 |     await setupAuth(page);
  284 |     await goto(page, "/merchant/customers");
  285 |     await waitLoaded(page);
  286 |     const link = page.locator("a[href*='/merchant/customers/']").first();
  287 |     if (await link.isVisible({ timeout: 5000 }).catch(() => false)) {
  288 |       await link.click();
  289 |       await page.waitForTimeout(2000);
  290 |       await assertNoErrors(page);
  291 |       console.log(`[CD] Detail page: ${page.url()}`);
  292 |     } else {
  293 |       console.log("[CD] No customer links (fresh merchant)");
  294 |     }
  295 |   });
  296 | 
  297 |   test("CD-02: Back navigation", async ({ page }) => {
  298 |     await setupAuth(page);
  299 |     await goto(page, "/merchant/customers");
  300 |     await waitLoaded(page);
  301 |     const link = page.locator("a[href*='/merchant/customers/']").first();
  302 |     if (await link.isVisible({ timeout: 5000 }).catch(() => false)) {
  303 |       await link.click();
  304 |       await page.waitForTimeout(2000);
  305 |       const backBtn = page.locator("a[href*='/merchant/customers']").first();
  306 |       if (await backBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
  307 |         await backBtn.click();
  308 |         await page.waitForTimeout(1000);
  309 |         console.log(`[CD] Back nav: ${page.url()}`);
  310 |       }
  311 |     }
  312 |   });
  313 | });
  314 | 
  315 | // ================================================================
  316 | // PHASE 9: CUSTOMERS LIST
  317 | // ================================================================
  318 | test.describe("Phase 9: Customers List", () => {
  319 | 
  320 |   test("C-01: Customers page renders", async ({ page }) => {
  321 |     await setupAuth(page);
  322 |     await goto(page, "/merchant/customers");
  323 |     await waitLoaded(page);
  324 |     await assertNoErrors(page);
  325 |     const header = page.locator("h1").first();
  326 |     await expect(header).toBeVisible({ timeout: 5000 });
  327 |     console.log(`[C] Header: ${await header.textContent()}`);
  328 |   });
  329 | 
  330 |   test("C-02: Search input visible", async ({ page }) => {
  331 |     await setupAuth(page);
  332 |     await goto(page, "/merchant/customers");
  333 |     await waitLoaded(page);
  334 |     const search = page.locator('input[placeholder*="earch"]').first();
  335 |     const exists = await search.isVisible({ timeout: 3000 }).catch(() => false);
  336 |     console.log(`[C] Search input: ${exists}`);
  337 |   });
  338 | });
  339 | 
  340 | // ================================================================
  341 | // PHASE 10: REPORTS
  342 | // ================================================================
  343 | test.describe("Phase 10: Reports", () => {
  344 | 
  345 |   test("R-01: Reports page renders", async ({ page }) => {
  346 |     await setupAuth(page);
  347 |     await goto(page, "/merchant/reports");
  348 |     await waitLoaded(page);
  349 |     await assertNoErrors(page);
  350 |     console.log("[R] Reports page OK");
  351 |   });
  352 | 
  353 |   test("R-02: Date filter buttons", async ({ page }) => {
  354 |     await setupAuth(page);
  355 |     await goto(page, "/merchant/reports");
  356 |     await waitLoaded(page);
  357 |     for (const label of ["Today", "Week", "Month"]) {
  358 |       const btn = page.locator("button").filter({ hasText: new RegExp(label, "i") }).first();
```