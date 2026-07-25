import { NextResponse } from "next/server";
import { CUSTOMER_SESSION_COOKIE_OPTIONS } from "@/lib/session";

export async function POST() {
  const response = NextResponse.json({ success: true });
  response.cookies.set("customer_session", "", {
    ...CUSTOMER_SESSION_COOKIE_OPTIONS,
    expires: new Date(0),
    maxAge: 0,
  });
  return response;
}