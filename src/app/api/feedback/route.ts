import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { message, url, userAgent } = body;

    if (!message || typeof message !== "string" || !message.trim()) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    // Log feedback to console (in production, send to your preferred channel)
    console.log("[Feedback] New feedback received:");
    console.log("  Message:", message.trim());
    console.log("  URL:", url || "N/A");
    console.log("  User Agent:", userAgent || "N/A");
    console.log("  Timestamp:", new Date().toISOString());

    // Forward to Telegram or email if configured
    // For now, the console log is sufficient for MVP

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[Feedback] Error:", err);
    return NextResponse.json({ error: "Failed to send feedback" }, { status: 500 });
  }
}
