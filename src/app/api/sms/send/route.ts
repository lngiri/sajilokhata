import { NextResponse } from "next/server";
import { sendTransactionNotification } from "@/app/actions/sms";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { to, merchantId, amount, type, customerName } = body as {
      to: string;
      merchantId: string;
      amount: number;
      type: "debit" | "credit" | "cash";
      customerName?: string;
    };

    if (!to || !merchantId || !amount || !type) {
      return NextResponse.json(
        { error: "Missing required fields: to, merchantId, amount, type" },
        { status: 400 }
      );
    }

    const result = await sendTransactionNotification({
      to,
      merchantId,
      amount,
      type,
      customerName,
    });

    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[SMS] Route error:", msg);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
