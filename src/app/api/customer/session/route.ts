import { NextResponse } from "next/server";
import { createCustomerSessionToken, CUSTOMER_SESSION_COOKIE_OPTIONS } from "@/lib/session";

export async function POST(request: Request) {
  try {
    const { phone, name } = await request.json();

    if (!phone || typeof phone !== "string") {
      return NextResponse.json({ error: "Phone number required" }, { status: 400 });
    }

    const cleanPhone = phone.replace(/\D/g, "").slice(-10);
    if (cleanPhone.length !== 10) {
      return NextResponse.json({ error: "Invalid phone number" }, { status: 400 });
    }

    const { token } = await createCustomerSessionToken(cleanPhone, name);

    const response = NextResponse.json({ success: true });
    response.cookies.set("customer_session", token, CUSTOMER_SESSION_COOKIE_OPTIONS);

    return response;
  } catch (err) {
    console.error("[Customer Session] Error creating session:", err);
    return NextResponse.json({ error: "Failed to create session" }, { status: 500 });
  }
}