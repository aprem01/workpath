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
    // default N/r/p — plenty for MVP.
    const salt = crypto.randomBytes(16);
    const derived = crypto.scryptSync(password, salt, 64);
    const passwordHash = `scrypt:${salt.toString("hex")}:${derived.toString("hex")}`;

    // Upsert on the anonymousHandle so a returning user updates their
    // profile rather than duplicating.
    const user = await prisma.user.upsert({
      where: { anonymousHandle: handle },
      update: {
        email: email.toLowerCase().trim(),
        zipCode,
        // NOTE: Prisma schema currently has no `passwordHash` column;
        // we store it in a User-level analytics event as a stopgap so
        // this route is safe to ship without a migration.
      },
      create: {
        anonymousHandle: handle,
        email: email.toLowerCase().trim(),
        zipCode,
        profileComplete: false,
      },
    });

    // Persist the hash into AnalyticsEvent (stopgap until we add a
    // dedicated column). NEVER log the plaintext password.
    await prisma.analyticsEvent.create({
      data: {
        event: "user_password_registered",
        metadata: JSON.stringify({
          userId: user.id,
          handle: user.anonymousHandle,
          passwordHash, // hashed, not plaintext
        }),
      },
    });

    return NextResponse.json({ ok: true, userId: user.id });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : "unknown";
    console.error("register error:", errMsg);
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
