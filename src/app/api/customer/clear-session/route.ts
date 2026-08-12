import { NextResponse } from "next/server";
import { getCustomerSessionCookieOptions } from "@/lib/session";

export async function POST() {
  const response = NextResponse.json({ success: true });
  response.cookies.set("customer_session", "", {
    ...(await getCustomerSessionCookieOptions(0)),
    expires: new Date(0),
    maxAge: 0,
  });
  return response;
}