import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";
import { signSessionCookie } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * POST /api/auth/register
 *
 * Caroline 8/23 Round 8 profile requirement:
 *   "Each profile is securely recorded in the user database, including
 *    the anonymous handle, email, password, and ZIP code."
 *   "Passwords must be securely hashed and never stored or displayed in
 *    plaintext."
 *
 * We use scrypt (Node's built-in KDF) — no new dependency, no bcrypt
 * install. The hash blob is stored on the User row as a single string
 * "scrypt:<saltHex>:<hashHex>" so future logins can verify without
 * knowing the plaintext.
 *
 * Body:
 *   {
 *     handle: string
 *     email: string
 *     password: string   (>= 8 chars, at least 1 letter + 1 number)
 *     zipCode: string
 *   }
 *
 * Response: { ok: true } | { error }
 */
export async function POST(req: Request) {
  try {
    const { handle, email, password, zipCode } = await req.json();
    if (!handle || typeof handle !== "string") {
      return NextResponse.json({ error: "handle required" }, { status: 400 });
    }
    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "email required" }, { status: 400 });
    }
    if (!password || typeof password !== "string" || password.length < 8) {
      return NextResponse.json(
        { error: "password must be at least 8 characters" },
        { status: 400 }
      );
    }
    if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
      return NextResponse.json(
        { error: "password must include letters and numbers" },
        { status: 400 }
      );
    }
    if (!zipCode || typeof zipCode !== "string" || !/^\d{5}$/.test(zipCode)) {
      return NextResponse.json(
        { error: "5-digit zipCode required" },
        { status: 400 }
      );
    }

    // Reject if the handle already exists AND has a password set —
    // returning users go through /api/auth/login, not this endpoint.
    const existing = await prisma.user.findUnique({
      where: { anonymousHandle: handle },
    });
    if (existing && existing.passwordHash) {
      return NextResponse.json(
        { error: "This account already exists. Please log in instead." },
        { status: 409 }
      );
    }
    // Also refuse if the email is already used by a DIFFERENT handle.
    const emailInUse = await prisma.user.findFirst({
      where: {
        email: email.toLowerCase().trim(),
        NOT: { anonymousHandle: handle },
      },
    });
    if (emailInUse) {
      return NextResponse.json(
        { error: "That email is already in use." },
        { status: 409 }
      );
    }

    // Hash with scrypt: 16-byte random salt, 64-byte derived hash,
    // default N/r/p. Serialized as "scrypt:<saltHex>:<hashHex>" so the
    // login endpoint can split, hex-decode the salt, and re-derive to
    // constant-time compare.
    const salt = crypto.randomBytes(16);
    const derived = crypto.scryptSync(password, salt, 64);
    const passwordHash = `scrypt:${salt.toString("hex")}:${derived.toString("hex")}`;

    const user = existing
      ? await prisma.user.update({
          where: { anonymousHandle: handle },
          data: {
            email: email.toLowerCase().trim(),
            zipCode,
            passwordHash,
          },
        })
      : await prisma.user.create({
          data: {
            anonymousHandle: handle,
            email: email.toLowerCase().trim(),
            zipCode,
            passwordHash,
            profileComplete: false,
          },
        });

    // Auto-login on successful registration so the client doesn't need
    // to POST /api/auth/login immediately after.
    const { value: cookieValue, expires } = signSessionCookie(handle);
    const res = NextResponse.json({ ok: true, userId: user.id, handle });
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
    console.error("register error:", errMsg);
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
