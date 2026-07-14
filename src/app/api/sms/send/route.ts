import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendTransactionSMS } from "@/lib/sms";

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

    // Fetch merchant profile for shop name
    const supabase = await createClient();
    const { data: merchant } = await supabase
      .from("merchants")
      .select("name, business_name")
      .eq("id", merchantId)
      .single();

    const shopName = merchant?.business_name || merchant?.name || "Shop";

    // Build message template
    const formattedAmount = `Rs. ${Number(amount).toLocaleString()}`;

    let message: string;
    if (type === "cash") {
      message = `Thank you for shopping at ${shopName}! Cash payment received: ${formattedAmount}.`;
    } else if (type === "debit") {
      const greeting = customerName ? `Dear ${customerName}, ` : "";
      message = `${greeting}${formattedAmount} has been added to your ledger at ${shopName}.`;
    } else {
      const greeting = customerName ? `Dear ${customerName}, ` : "";
      message = `${greeting}${formattedAmount} has been credited to your account at ${shopName}.`;
    }

    const result = await sendTransactionSMS(to, message);

    if (!result.success) {
      console.warn("[SMS] Send failed:", result.error);
    }

    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[SMS] Route error:", msg);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
