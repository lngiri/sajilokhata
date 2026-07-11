import { NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";

interface UserMatch {
  id: string;
  phone_confirmed_at: string | null;
}

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

    // If service_role key is not configured, fall back to a lightweight bypass
    if (!adminClient) {
      // The client will use localStorage + cookie approach as fallback
      return NextResponse.json({
        bypass_id: crypto.randomUUID(),
        phone,
        admin_unavailable: true,
      });
    }

    // Generate a random password for this session
    const bypassPassword = `sajilo-bypass-${Math.random().toString(36).slice(2, 10)}`;

    // 1. Try creating a new user first (simplest path when phone is available)
    const { data: newUser, error: createError } =
      await adminClient.auth.admin.createUser({
        phone,
        phone_confirm: true,
        password: bypassPassword,
      });

    if (!createError && newUser?.user) {
      return NextResponse.json({
        user_id: newUser.user.id,
        password: bypassPassword,
        phone,
        created: true,
      });
    }

    // 2. If user already exists, find them by paginating through auth.users
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

    // Find existing user by phone (admin API lacks getUserByPhone)
    let foundUser: UserMatch | null = null;
    let page = 1;
    const perPage = 100;

    while (!foundUser && page <= 5) {
      // Safety limit: 5 pages × 100 = 500 users
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

    // Update password so client can sign in
    await adminClient.auth.admin.updateUserById(foundUser.id, {
      password: bypassPassword,
    });

    // Ensure phone is confirmed
    if (!foundUser.phone_confirmed_at) {
      await adminClient.auth.admin.updateUserById(foundUser.id, {
        phone_confirm: true,
      });
    }

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
