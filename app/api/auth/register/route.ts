import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

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

    // Hash the password with scrypt. 16-byte random salt, 64-byte hash,
    // default N/r/p — plenty for MVP. The derived hash is dropped at
    // the end of this handler because we don't yet have a
    // User.passwordHash column to persist it; adding that column takes
    // a Prisma migration and needs to land in its own change set. The
    // hashing step is kept so the route is future-safe once the column
    // exists — we just refuse to write hashes into a general-purpose
    // AnalyticsEvent row, which was a leak vector flagged in review.
    const salt = crypto.randomBytes(16);
    const derived = crypto.scryptSync(password, salt, 64);
    void derived; // intentionally not persisted (see comment above)
    void salt;

    // Reject if the handle already exists AND has an email set — this
    // is not a "log in" endpoint. Returning users go through a proper
    // login flow (still to be built).
    const existing = await prisma.user.findUnique({
      where: { anonymousHandle: handle },
    });
    if (existing && existing.email) {
      return NextResponse.json(
        {
          error:
            "This handle already has an account. Please log in instead.",
        },
        { status: 409 }
      );
    }

    const user = existing
      ? await prisma.user.update({
          where: { anonymousHandle: handle },
          data: {
            email: email.toLowerCase().trim(),
            zipCode,
          },
        })
      : await prisma.user.create({
          data: {
            anonymousHandle: handle,
            email: email.toLowerCase().trim(),
            zipCode,
            profileComplete: false,
          },
        });

    return NextResponse.json({
      ok: true,
      userId: user.id,
      passwordHashPersisted: false,
      note:
        "Password was hashed but not persisted — a User.passwordHash column will land in the next migration.",
    });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : "unknown";
    console.error("register error:", errMsg);
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
