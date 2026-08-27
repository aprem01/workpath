import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";
import { signSessionCookie } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * POST /api/auth/login
 *
 * Verifies a returning user's password against the stored scrypt hash
 * and, on success, sets a signed session cookie so downstream endpoints
 * (/api/jobs/apply and the interview-accept flow) can authenticate the
 * request.
 *
 * The cookie payload is `<handle>.<expiryEpochMs>.<hmacHex>` — HMAC-SHA256
 * over the first two segments, keyed by process.env.SESSION_SECRET (or a
 * generated fallback on cold start). Cookie is HttpOnly, Secure in prod,
 * SameSite=Lax. 30-day expiry.
 *
 * Body:
 *   { email: string, password: string }
 */
export async function POST(req: Request) {
  try {
    const { email, password } = await req.json();
    if (!email || typeof email !== "string" || !password || typeof password !== "string") {
      return NextResponse.json(
        { error: "email and password required" },
        { status: 400 }
      );
    }
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });
    // Same error on missing user OR bad password so attackers can't
    // enumerate valid emails.
    const genericBad = () =>
      NextResponse.json(
        { error: "Incorrect email or password" },
        { status: 401 }
      );
    if (!user || !user.passwordHash || !user.anonymousHandle) return genericBad();

    const parts = user.passwordHash.split(":");
    if (parts.length !== 3 || parts[0] !== "scrypt") return genericBad();
    const [, saltHex, hashHex] = parts;
    const salt = Buffer.from(saltHex, "hex");
    const expected = Buffer.from(hashHex, "hex");
    const derived = crypto.scryptSync(password, salt, expected.length);
    if (
      expected.length !== derived.length ||
      !crypto.timingSafeEqual(expected, derived)
    ) {
      return genericBad();
    }

    const { value: cookieValue, expires } = signSessionCookie(user.anonymousHandle);
    const res = NextResponse.json({
      ok: true,
      handle: user.anonymousHandle,
      zipCode: user.zipCode || null,
      profileComplete: user.profileComplete,
    });
    res.cookies.set("payranker_session", cookieValue, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      expires,
    });
    return res;
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : "unknown";
    console.error("login error:", errMsg);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
