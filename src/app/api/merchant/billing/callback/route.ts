import { NextRequest, NextResponse } from "next/server";
import { verifyEsewaPayment } from "@/app/actions/sms-billing";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const encodedData = formData.get("data") as string | null;

    if (!encodedData) {
      return NextResponse.redirect(new URL("/merchant/billing?error=no_data", request.url));
    }

    const result = await verifyEsewaPayment(encodedData);

    if (result.success) {
      return NextResponse.redirect(
        new URL(`/merchant/billing/success?status=completed&sms=${result.smsAdded}`, request.url)
      );
    }

    return NextResponse.redirect(
      new URL(`/merchant/billing/success?status=failed&error=${encodeURIComponent(result.error || "Verification failed")}`, request.url)
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[BILLING-CALLBACK] Error:", msg);
    return NextResponse.redirect(
      new URL(`/merchant/billing?error=${encodeURIComponent(msg)}`, request.url)
    );
  }
}
