import { NextResponse } from "next/server";
import crypto from "crypto";

export const dynamic = "force-dynamic";

/**
 * Send a verification email via Resend.
 *
 * Setup:
 * 1. Sign up at https://resend.com (free: 3,000 emails/month)
 * 2. Add a sending domain (or use onboarding@resend.dev for testing)
 * 3. Set RESEND_API_KEY in Vercel env vars
 * 4. Set RESEND_FROM in Vercel env vars (e.g., "noreply@payranker.app")
 *
 * Without those env vars, the API returns sent:false with a helpful message
 * (so the UI can show "Email service not configured yet" instead of lying).
 */
export async function POST(req: Request) {
  try {
    const { email } = (await req.json()) as { email?: string };

    if (!email || !email.includes("@")) {
      return NextResponse.json(
        { sent: false, error: "Valid email required" },
        { status: 400 }
      );
    }

    const apiKey = process.env.RESEND_API_KEY;
    const fromAddr = process.env.RESEND_FROM || "onboarding@resend.dev";

    if (!apiKey) {
      return NextResponse.json({
        sent: false,
        message:
          "Email service not configured yet. Your profile is saved locally — we'll add email verification soon.",
      });
    }

    // Generate a verification token (in production, store this in DB with TTL)
    const token = crypto.randomBytes(32).toString("hex");
    const baseUrl =
      process.env.NEXT_PUBLIC_BASE_URL || "https://workpath-iota.vercel.app";
    const verifyUrl = `${baseUrl}/api/auth/verify?token=${token}&email=${encodeURIComponent(email)}`;

    const emailHtml = `
      <!doctype html>
      <html>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 40px auto; padding: 24px; background: #FFF5F5; color: #333;">
          <div style="background: white; border-radius: 16px; padding: 32px; box-shadow: 0 2px 8px rgba(0,0,0,0.04);">
            <h1 style="font-size: 28px; font-weight: 700; margin: 0 0 16px;">
              <span style="color: #F7A31C;">Pay</span><span style="color: #E725E2;">Ranker</span>
            </h1>
            <p style="font-size: 16px; line-height: 1.5; margin: 0 0 16px; color: #333;">
              Hi! Confirm your email so we can save your skills basket and notify you when employers respond.
            </p>
            <p style="margin: 24px 0;">
              <a href="${verifyUrl}"
                 style="background: #E725E2; color: white; text-decoration: none; font-weight: 700; padding: 14px 28px; border-radius: 999px; display: inline-block;">
                Verify my email
              </a>
            </p>
            <p style="font-size: 14px; color: #969696; line-height: 1.5; margin: 16px 0 0;">
              If you didn't sign up for PayRanker, you can ignore this email.
            </p>
            <p style="font-size: 13px; color: #969696; margin: 24px 0 0; word-break: break-all;">
              Having trouble with the button? Copy this link into your browser:<br/>
              <a href="${verifyUrl}" style="color: #E725E2;">${verifyUrl}</a>
            </p>
          </div>
          <p style="font-size: 12px; color: #aaa; text-align: center; margin: 16px 0 0;">
            PayRanker — find the highest-paying jobs for your skills.
          </p>
        </body>
      </html>
    `;

    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromAddr,
        to: email,
        subject: "Verify your PayRanker email",
        html: emailHtml,
      }),
    });

    if (!r.ok) {
      const err = await r.text();
      console.error("Resend error:", err);
      return NextResponse.json({
        sent: false,
        message: "Could not send verification email. Try again later.",
      });
    }

    return NextResponse.json({
      sent: true,
      message: "Verification email sent",
      // Token returned only for dev — production should store in DB
      token: process.env.NODE_ENV === "development" ? token : undefined,
    });
  } catch (error) {
    console.error("Verification email error:", error);
    return NextResponse.json(
      { sent: false, error: "Internal error" },
      { status: 500 }
    );
  }
}
