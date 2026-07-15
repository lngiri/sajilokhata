import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET() {
  const response = NextResponse.redirect(
    new URL("/", process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000")
  );

  const pastDate = new Date(0);

  // Clear EVERY cookie — wipes Supabase SSR tokens, custom session, bypass, etc.
  const cookieStore = await cookies();
  const allCookies = cookieStore.getAll();
  for (const c of allCookies) {
    response.cookies.set(c.name, "", {
      path: "/",
      expires: pastDate,
      maxAge: 0,
    });
  }

  return response;
}
