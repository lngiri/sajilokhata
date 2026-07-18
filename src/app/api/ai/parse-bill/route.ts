import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { getAdminClient } from "@/lib/supabase/admin";

const MODEL = "gemini-2.5-flash";
const MAX_DAILY_PARSES = 50;

export async function POST(request: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "AI service not configured" }, { status: 503 });
  }

  let body: { image: string; merchantId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.image) {
    return NextResponse.json({ error: "Image is required (base64)" }, { status: 400 });
  }

  const admin = getAdminClient();

  // Track usage if merchantId is provided
  if (body.merchantId && admin) {
    const today = new Date().toISOString().slice(0, 10);
    const { data: usageData } = await admin
      .from("merchant_ai_usage")
      .select("parse_count")
      .eq("merchant_id", body.merchantId)
      .eq("model_name", MODEL)
      .gte("created_at", today)
      .lt("created_at", new Date(new Date().getTime() + 86400000).toISOString().slice(0, 10))
      .maybeSingle();

    const usage = usageData as { parse_count: number } | null;
    if (usage && usage.parse_count >= MAX_DAILY_PARSES) {
      return NextResponse.json(
        { error: `Daily AI parse limit reached (${MAX_DAILY_PARSES})` },
        { status: 429 }
      );
    }
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: MODEL });

    const mimeMatch = body.image.match(/^data:(image\/\w+);base64,/);
    const mimeType = mimeMatch ? mimeMatch[1] : "image/jpeg";
    const base64Data = mimeMatch ? body.image.replace(/^data:image\/\w+;base64,/, "") : body.image;

    const result = await model.generateContent({
      contents: [
        {
          role: "user",
          parts: [
            {
              inlineData: {
                mimeType,
                data: base64Data,
              },
            },
            {
              text: `You are a bill/invoice parser. Extract the following from the image:
- total amount payable (as a number)
- a brief summary of items (max 200 chars, plain text)

Respond ONLY with valid JSON in this exact format:
{ "amount": 1234.56, "items_summary": "3 items: rice, dal, oil" }

If you cannot read the image, return { "amount": 0, "items_summary": "Could not read bill" }`,
            },
          ],
        },
      ],
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.1,
        maxOutputTokens: 200,
      },
    });

    const text = result.response.text();
    let parsed: { amount: number; items_summary: string };

    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = { amount: 0, items_summary: "Parse error" };
    }

    // Record usage
    if (body.merchantId && admin) {
      const usageData = result.response.usageMetadata;
      const inputTokens = usageData?.promptTokenCount || 0;
      const outputTokens = usageData?.candidatesTokenCount || 0;

      await admin.from("merchant_ai_usage").insert({
        merchant_id: body.merchantId,
        model_name: MODEL,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        parse_count: 1,
      });
    }

    return NextResponse.json(parsed);
  } catch (err) {
    console.error("[AI-Parse] Gemini error:", err);
    return NextResponse.json(
      { amount: 0, items_summary: "AI service error" },
      { status: 500 }
    );
  }
}
