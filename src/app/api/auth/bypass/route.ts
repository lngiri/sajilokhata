import { NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";

interface UserMatch {
  id: string;
  phone_confirmed_at: string | null;
}

/**
 * Development-only bypass auth endpoint.
 * Returns a cryptographically-generated password that the client uses
 * to sign in via supabase.auth.signInWithPassword().
 *
 * In production, replace this with OTP/SMS-based auth using
 * supabase.auth.signInWithOtp().
 */
export async function POST(request: Request) {
  try {
    const { phone } = await request.json();

    if (!phone || typeof phone !== "string" || phone.length < 10) {
      return NextResponse.json(
        { error: "Valid phone number is required" },
        { status: 400 }
      );
    }

    const adminClient = getAdminClient();

    if (!adminClient) {
      return NextResponse.json({
        bypass_id: crypto.randomUUID(),
        phone,
        admin_unavailable: true,
      });
    }

    // Cryptographically secure random password
    const bypassPassword = `sajilo-bypass-${crypto.randomUUID().slice(0, 12)}`;

    async function ensureMerchantRow(userId: string, userPhone: string) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: upsertError } = await (adminClient!.from("merchants") as any)
        .upsert(
          {
            id: userId,
            phone: userPhone,
            name: "Shop",
            business_type: "kirana",
          },
          { onConflict: "id" }
        );
      if (upsertError) {
        console.error("Failed to create merchants row:", upsertError);
      }
    }

    // 1. Try creating a new user
    const { data: newUser, error: createError } =
      await adminClient.auth.admin.createUser({
        phone,
        phone_confirm: true,
        password: bypassPassword,
      });

    if (!createError && newUser?.user) {
      await ensureMerchantRow(newUser.user.id, phone);
      return NextResponse.json({
        user_id: newUser.user.id,
        password: bypassPassword,
        phone,
        created: true,
      });
    }

    // 2. If user already exists, find them
    const isDuplicate =
      createError?.message?.toLowerCase().includes("already exists") ||
      createError?.message?.toLowerCase().includes("already registered");

    if (!isDuplicate) {
      console.error("Unexpected error creating bypass user:", createError);
      return NextResponse.json(
        { error: "Failed to create authentication user" },
        { status: 500 }
      );
    }

    // Find existing user by phone
    let foundUser: UserMatch | null = null;
    let page = 1;
    const perPage = 100;

    while (!foundUser && page <= 5) {
      const { data: pageData } = await adminClient.auth.admin.listUsers({
        page,
        perPage,
      });

      if (!pageData?.users) break;

      const match = pageData.users.find((u) => u.phone === phone);
      if (match) {
        foundUser = {
          id: match.id,
          phone_confirmed_at: match.phone_confirmed_at ?? null,
        };
      }
      page++;
    }

    if (!foundUser) {
      console.error("Could not find existing user with phone:", phone);
      return NextResponse.json(
        { error: "User already exists but could not be found" },
        { status: 500 }
      );
    }

    await adminClient.auth.admin.updateUserById(foundUser.id, {
      password: bypassPassword,
    });

    if (!foundUser.phone_confirmed_at) {
      await adminClient.auth.admin.updateUserById(foundUser.id, {
        phone_confirm: true,
      });
    }

    await ensureMerchantRow(foundUser.id, phone);

    return NextResponse.json({
      user_id: foundUser.id,
      password: bypassPassword,
      phone,
      created: false,
    });
  } catch (err) {
    console.error("Bypass auth error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
