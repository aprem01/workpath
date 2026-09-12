import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

export const dynamic = "force-dynamic";

/**
 * POST /api/auth/reset   { token, password }
 *
 * Consumes a single-use reset token and writes a new scrypt hash.
 * Same password rules as /api/auth/register.
 */
export async function POST(req: Request) {
  try {
    const { token, password } = await req.json();
    if (!token || typeof token !== "string") {
      return NextResponse.json({ error: "token required" }, { status: 400 });
    }
    if (!password || typeof password !== "string" || password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters." },
        { status: 400 }
      );
    }
    if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
      return NextResponse.json(
        { error: "Password must include letters and numbers." },
        { status: 400 }
      );
    }

    const row = await prisma.verificationToken.findUnique({ where: { token } });
    if (!row || !row.identifier.startsWith("reset:") || row.expires < new Date()) {
      return NextResponse.json(
        { error: "This reset link is invalid or has expired." },
        { status: 400 }
      );
    }
    const addr = row.identifier.slice("reset:".length);
    const user = await prisma.user.findUnique({ where: { email: addr } });
    if (!user) {
      return NextResponse.json(
        { error: "This reset link is invalid or has expired." },
        { status: 400 }
      );
    }

    const salt = crypto.randomBytes(16);
    const derived = crypto.scryptSync(password, salt, 64);
    const passwordHash = `scrypt:${salt.toString("hex")}:${derived.toString("hex")}`;

    await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
    await prisma.verificationToken.delete({ where: { token } }).catch(() => {});

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("reset error:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
