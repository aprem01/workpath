/**
 * Outbound transactional email.
 *
 * Provider history, because it explains the shape of this file:
 *   Resend   — required an MX record on a `send` subdomain. On Namecheap
 *              adding MX means switching Mail Settings off "Email
 *              Forwarding", which would have broken forwarding for
 *              hello@payranker.io. Caroline hit this while adding records.
 *   SendGrid — no MX, but its free tier became a 60-day trial in 2025,
 *              then $19.95/mo. Poor value for a three-user beta.
 *   Postmark — 100/month free indefinitely, two DNS records, no MX, and
 *              the strongest transactional deliverability. Chosen
 *              2026-09-20.
 *
 * Deliverability is the point here, not price. A password reset that
 * lands in spam leaves a jobseeker locked out of an account with no
 * support channel.
 *
 * Every call site in both apps goes through sendEmail(). Switching
 * providers is this file only — that is the whole reason it exists.
 *
 * Env:
 *   POSTMARK_SERVER_TOKEN — Server API token from postmarkapp.com
 *   EMAIL_FROM            — must match a verified Sender Signature or a
 *                           verified domain, e.g.
 *                           "PayRanker <hello@payranker.io>"
 */

export interface SendResult {
  sent: boolean;
  /** Set when the send failed, for logs. Never shown to a user verbatim. */
  error?: string;
  /** false when no provider is configured — a setup gap, not a failure. */
  configured: boolean;
}

function fromAddress(): string {
  // Older names read as fallbacks so a half-migrated environment still
  // sends rather than silently going quiet.
  return (
    process.env.EMAIL_FROM ||
    process.env.RESEND_FROM ||
    ""
  ).trim();
}

/**
 * Is outbound email switched on at all?
 *
 * Depends only on server configuration, never on the recipient, so it is
 * safe to report to a client without leaking whether an account exists.
 */
export function isEmailConfigured(): boolean {
  return Boolean(process.env.POSTMARK_SERVER_TOKEN && fromAddress());
}

export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}): Promise<SendResult> {
  const token = process.env.POSTMARK_SERVER_TOKEN;
  const from = fromAddress();
  if (!token || !from) {
    return { sent: false, configured: false, error: "email not configured" };
  }

  try {
    const res = await fetch("https://api.postmarkapp.com/email", {
      method: "POST",
      headers: {
        "X-Postmark-Server-Token": token,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        From: from,
        To: opts.to,
        Subject: opts.subject,
        HtmlBody: opts.html,
        ...(opts.text ? { TextBody: opts.text } : {}),
        // Keep password resets and verifications on the transactional
        // stream. Mixing them with bulk mail would let a marketing
        // complaint rate degrade delivery of account-critical email.
        MessageStream: "outbound",
      }),
    });

    // Postmark answers 200 with ErrorCode 0 on success; failures carry a
    // non-zero ErrorCode and usually a 422.
    const body = await res.json().catch(() => ({}) as Record<string, unknown>);
    const errorCode = (body as { ErrorCode?: number }).ErrorCode;
    if (res.ok && (errorCode === 0 || errorCode === undefined)) {
      return { sent: true, configured: true };
    }
    const message =
      (body as { Message?: string }).Message || `http ${res.status}`;
    console.error("postmark error:", res.status, errorCode, message);
    return { sent: false, configured: true, error: `${errorCode ?? res.status}: ${message}` };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("postmark send failed:", msg);
    return { sent: false, configured: true, error: msg };
  }
}
