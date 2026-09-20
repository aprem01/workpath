import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmail, isEmailConfigured } from "@/lib/email";
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
  // Whether we can send mail at all is a property of OUR configuration,
  // never of the submitted address, so it is computed before we look
  // anything up and returned identically on every path. An earlier
  // version returned it only when the account existed, which turned this
  // endpoint into an account-enumeration oracle.
  const emailConfigured = isEmailConfigured();
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

      // SECURITY: never build a reset link from the raw Host header.
      // An attacker who sends `Host: evil.example` would otherwise have
      // us email the victim a VALID token pointing at their domain —
      // classic password-reset poisoning. Prefer the configured origin;
      // otherwise accept the Host ONLY if it is on an explicit
      // allowlist; otherwise fail closed (no email, but the caller still
      // gets an opaque ok:true so this stays non-enumerable).
      // Caroline tests on payranker.io, which was missing here, so a reset
      // from her actual domain would have refused to send even once an
      // email key exists. Exact matches only — this guards against Host
      // header injection pointing a valid token at an attacker's domain.
      const ALLOWED_HOSTS = new Set([
        "workpath-iota.vercel.app",
        "payranker.io",
        "www.payranker.io",
        "localhost:3000",
        "localhost:3001",
      ]);
      const configured = process.env.NEXT_PUBLIC_APP_URL;
      const rawHost = (req.headers.get("host") || "").toLowerCase();
      let baseUrl: string | null = null;
      if (configured) {
        baseUrl = configured.replace(/\/+$/, "");
      } else if (ALLOWED_HOSTS.has(rawHost)) {
        baseUrl = `${rawHost.startsWith("localhost") ? "http" : "https"}://${rawHost}`;
      }
      if (!baseUrl) {
        console.error(
          "request-reset: refusing to send — untrusted host and no NEXT_PUBLIC_APP_URL",
          { rawHost }
        );
        return NextResponse.json({ ok: true, emailConfigured });
      }
      const resetUrl = `${baseUrl}/reset-password?token=${encodeURIComponent(token)}`;

      // Send via the Resend REST API with plain fetch — the same
      // approach as /api/auth/send-verification. The `resend` SDK is NOT
      // a dependency of this app; importing it built locally (stale
      // transitive copy in node_modules) but broke the Vercel build.
      if (emailConfigured) {
        const result = await sendEmail({
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
            `<p style="font-size:13px;color:#666">Or paste this into your browser:<br/>` +
            `<code>${resetUrl}</code></p>` +
            `<p style="font-size:12px;color:#999">Valid for one hour. If you didn't ask ` +
            `for it, ignore this email.</p>`,
        });
        if (!result.sent) {
          // Log for ops, but never change the response — the reply must look
          // identical whether or not the address exists.
          console.error("reset email send failed:", result.error);
        }
      } else {
        console.warn("request-reset: no email provider configured; token created but not emailed");
      }
    }
    return NextResponse.json({ ok: true, emailConfigured });
  } catch (error) {
    console.error("request-reset error:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
