import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

export const dynamic = "force-dynamic";

/**
 * POST /api/auth/request-reset   { email }
 *
 * Caroline 9/11: the Log In page had no "Forgot your password?" path.
 * Creates a single-use reset token (1h) and emails the link when Resend
 * is configured.
 *
 * Always returns { ok: true } regardless of whether the address exists —
 * otherwise this endpoint becomes an account-enumeration oracle.
 */
export async function POST(req: Request) {
  try {
    const { email } = await req.json();
    if (!email || typeof email !== "string" || !email.includes("@")) {
      return NextResponse.json({ error: "valid email required" }, { status: 400 });
    }
    const addr = email.toLowerCase().trim();
    const user = await prisma.user.findUnique({ where: { email: addr } });

    if (user) {
      const token = crypto.randomBytes(32).toString("hex");
      const expires = new Date(Date.now() + 60 * 60 * 1000); // 1h
      await prisma.verificationToken.create({
        data: { identifier: `reset:${addr}`, token, expires },
      });

      const baseUrl =
        process.env.NEXT_PUBLIC_APP_URL || `https://${req.headers.get("host")}`;
      const resetUrl = `${baseUrl}/reset-password?token=${encodeURIComponent(token)}`;

      if (process.env.RESEND_API_KEY && process.env.RESEND_FROM) {
        try {
          const { Resend } = await import("resend");
          const resend = new Resend(process.env.RESEND_API_KEY);
          await resend.emails.send({
            from: process.env.RESEND_FROM,
            to: addr,
            subject: "Reset your PayRanker password",
            text:
              `Use the link below to choose a new PayRanker password:\n\n${resetUrl}\n\n` +
              `This link is valid for one hour. If you didn't ask for it, ignore this email.`,
            html:
              `<p>Use the button below to choose a new PayRanker password:</p>` +
              `<p><a href="${resetUrl}" style="display:inline-block;background:#E725E2;color:#fff;` +
              `text-decoration:none;font-weight:bold;padding:12px 24px;border-radius:24px">` +
              `Reset my password</a></p>` +
              `<p style="font-size:13px;color:#666">Or paste this into your browser:<br/><code>${resetUrl}</code></p>` +
              `<p style="font-size:12px;color:#999">Valid for one hour. If you didn't ask for it, ignore this email.</p>`,
          });
        } catch (e) {
          // Never fail the request because delivery failed — the user
          // still sees "check your email"; we log for ops.
          console.error("reset email send failed:", e instanceof Error ? e.message : e);
        }
      } else {
        console.warn("request-reset: Resend not configured; token created but not emailed");
      }
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("request-reset error:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
