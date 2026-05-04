import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Verify email link target.
 *
 * MVP: just redirects to /jobs?verified=1 (token validation happens client-side
 * via localStorage flag for now). Production should:
 *   - Store tokens in DB with TTL
 *   - Look up by token + mark email verified
 *   - Sign a session cookie
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const email = url.searchParams.get("email");
  const token = url.searchParams.get("token");

  if (!email || !token) {
    return NextResponse.redirect(
      new URL("/jobs?verified=0&error=missing", req.url)
    );
  }

  // MVP: just redirect with verified=1; client reads URL param + sets localStorage
  return NextResponse.redirect(
    new URL(`/jobs?verified=1&email=${encodeURIComponent(email)}`, req.url)
  );
}
