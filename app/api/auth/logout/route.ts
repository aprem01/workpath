import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * POST /api/auth/logout
 *
 * Clears the payranker_session cookie. Idempotent — safe to call
 * whether or not a session exists.
 */
export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set("payranker_session", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(0),
  });
  return res;
}
