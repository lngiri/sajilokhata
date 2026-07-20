#!/usr/bin/env npx tsx
/**
 * DIAGNOSTIC SCRIPT — Captures the FULL Aakash SMS API response.
 * 
 * Usage: npx tsx scripts/diagnostic-sms.ts <phone_number>
 * 
 * This replicates EXACTLY what src/app/actions/sms.ts does:
 * - Strips to 10 digits (same as the app)
 * - Sends POST to https://sms.aakashsms.com/sms/v3/send
 * - Prints the FULL response body, status, headers
 * 
 * Then also tests WITH 977 prefix for comparison.
 */

import { readFileSync } from "fs";

// Read .env manually to avoid dotenv dependency
let AUTH_TOKEN = "";
try {
  const envContent = readFileSync(".env", "utf-8");
  const match = envContent.match(/^AAKASH_SMS_TOKEN=(.+)$/m);
  if (match) AUTH_TOKEN = match[1].trim().replace(/^['"]|['"]$/g, "");
} catch (e) {
  console.error("Failed to read .env:", e);
}
const API_URL = "https://sms.aakashsms.com/sms/v3/send";

async function sendSms(to: string, label: string) {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`TEST: ${label}`);
  console.log(`${"=".repeat(60)}`);
  console.log(`Token present: ${!!AUTH_TOKEN} (length: ${AUTH_TOKEN.length})`);
  console.log(`To (raw): "${to}"`);
  
  const cleanNumber = to.replace(/\D/g, "").slice(-10);
  console.log(`To (cleanNumber — same as app): "${cleanNumber}"`);
  console.log(`To (length): ${cleanNumber.length}`);
  
  const payload = new URLSearchParams();
  payload.append("auth_token", AUTH_TOKEN);
  payload.append("to", cleanNumber);
  payload.append("text", "QR Hisab diagnostic test — ignore this message.");
  
  const payloadStr = payload.toString();
  console.log(`\nPayload (redacted): ${payloadStr.replace(AUTH_TOKEN, "TOKEN_REDACTED")}`);
  console.log(`\nSending POST to ${API_URL} ...`);
  
  const startTime = Date.now();
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: payloadStr,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    
    const elapsed = Date.now() - startTime;
    
    console.log(`\n--- RESPONSE ---`);
    console.log(`HTTP Status: ${res.status}`);
    console.log(`HTTP Status Text: ${res.statusText}`);
    console.log(`Response Time: ${elapsed}ms`);
    console.log(`Content-Type: ${res.headers.get("content-type")}`);
    
    // Print ALL response headers
    console.log(`\nAll Response Headers:`);
    res.headers.forEach((value, key) => {
      console.log(`  ${key}: ${value}`);
    });
    
    const body = await res.text();
    
    console.log(`\n--- FULL RESPONSE BODY (raw text) ---`);
    console.log(body);
    
    // Try to parse as JSON
    let parsed: any;
    try {
      parsed = JSON.parse(body);
      console.log(`\n--- PARSED JSON ---`);
      console.log(JSON.stringify(parsed, null, 2));
      
      // Deep inspection
      console.log(`\n--- DETAILED INSPECTION ---`);
      console.log(`parsed.error: ${JSON.stringify(parsed.error)}`);
      console.log(`parsed.error type: ${typeof parsed.error}`);
      console.log(`parsed.message: ${JSON.stringify(parsed.message)}`);
      console.log(`parsed.data: ${JSON.stringify(parsed.data)}`);
      console.log(`parsed.data?.valid: ${JSON.stringify(parsed.data?.valid)}`);
      console.log(`parsed.data?.valid type: ${typeof parsed.data?.valid}`);
      console.log(`parsed.data?.valid length: ${parsed.data?.valid?.length}`);
      console.log(`parsed.data?.invalid: ${JSON.stringify(parsed.data?.invalid)}`);
      console.log(`parsed.data?.invalid type: ${typeof parsed.data?.invalid}`);
      console.log(`parsed.data?.invalid length: ${parsed.data?.invalid?.length}`);
      
      // Check for any other top-level keys
      console.log(`\nAll top-level keys: ${Object.keys(parsed).join(", ")}`);
      
      // Check for message_id or any ID field
      if (parsed.message_id) console.log(`parsed.message_id: ${parsed.message_id}`);
      if (parsed.id) console.log(`parsed.id: ${parsed.id}`);
      if (parsed.msg_id) console.log(`parsed.msg_id: ${parsed.msg_id}`);
      if (parsed.data?.message_id) console.log(`parsed.data.message_id: ${parsed.data.message_id}`);
      
      // Check valid entries for format
      if (parsed.data?.valid?.length > 0) {
        console.log(`\nValid entries format:`);
        parsed.data.valid.forEach((entry: any, i: number) => {
          console.log(`  [${i}] type: ${typeof entry}, value: ${JSON.stringify(entry)}`);
        });
      }
      
      // Check invalid entries for format
      if (parsed.data?.invalid?.length > 0) {
        console.log(`\nInvalid entries format:`);
        parsed.data.invalid.forEach((entry: any, i: number) => {
          console.log(`  [${i}] type: ${typeof entry}, value: ${JSON.stringify(entry)}`);
          if (typeof entry === "object") {
            console.log(`       keys: ${Object.keys(entry).join(", ")}`);
          }
        });
      }
      
      // What the app would do with this response
      console.log(`\n--- APP BEHAVIOR ANALYSIS ---`);
      if (parsed?.error === true) {
        console.log(`❌ App would return ERROR: ${parsed.message || "SMS gateway error"}`);
      } else if (parsed?.data?.invalid?.length > 0) {
        console.log(`❌ App would return ERROR: "Could not send SMS to this number"`);
      } else if (!res.ok) {
        console.log(`❌ App would return ERROR: "SMS gateway error (HTTP ${res.status})"`);
      } else {
        console.log(`✅ App would return SUCCESS: { success: true }`);
        console.log(`⚠️  Credits would be DEDUCTED even if valid[] is empty!`);
      }
      
    } catch (parseErr) {
      console.log(`\n--- NOT JSON ---`);
      console.log(`Parse error: ${parseErr}`);
    }
    
  } catch (err: any) {
    const elapsed = Date.now() - startTime;
    console.log(`\n--- NETWORK ERROR ---`);
    console.log(`Error type: ${err?.name}`);
    console.log(`Error message: ${err?.message}`);
    console.log(`Elapsed: ${elapsed}ms`);
    if (err?.name === "AbortError") {
      console.log(`Request was ABORTED (15s timeout)`);
    }
  }
}

async function main() {
  const phone = process.argv[2];
  
  if (!phone) {
    console.error("Usage: npx tsx scripts/diagnostic-sms.ts <phone_number>");
    console.error("Example: npx tsx scripts/diagnostic-sms.ts 9847033366");
    process.exit(1);
  }
  
  if (!AUTH_TOKEN) {
    console.error("ERROR: AAKASH_SMS_TOKEN not found in .env");
    process.exit(1);
  }
  
  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║  AKASH SMS API DIAGNOSTIC — Full Response Capture      ║");
  console.log("╚══════════════════════════════════════════════════════════╝");
  
  // TEST 1: Same as app (10 digits only)
  await sendSms(phone, "10-digit number (EXACTLY as app sends it)");
  
  // TEST 2: With 977 prefix
  const withPrefix = phone.replace(/\D/g, "");
  const prefixed = withPrefix.startsWith("977") ? withPrefix : `977${withPrefix}`;
  await sendSms(`+${prefixed}`, "With +977 country code prefix");
  
  // TEST 3: With 977 prefix (no +)
  await sendSms(prefixed, "With 977 prefix (no +)");
  
  console.log(`\n${"=".repeat(60)}`);
  console.log("DIAGNOSTIC COMPLETE — Compare the three responses above.");
  console.log(`${"=".repeat(60)}`);
}

main();
