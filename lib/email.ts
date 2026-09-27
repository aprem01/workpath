/**
 * Outbound transactional email.
 *
 * One seam, one provider behind it. Postmark since 2026-09-20.
 *
 * Resend -> SendGrid -> Postmark, all in one day. Resend wants an MX
 * record on a `send` subdomain. SendGrid no longer has a free tier at
 * all: the 60 day trial ends and the account drops to 0 emails/month.
 * Postmark's Developer plan is 100 emails/month with no expiry, and it
 * authenticates with a DKIM TXT plus a Return-Path CNAME and no MX, so
 * payranker.io stays on Namecheap Email Forwarding and the forwarding
 * Caroline relies on for hello@payranker.io keeps working.
 *
 * Two provider swaps have now touched only this function and none of the
 * five call sites. That is the whole point of the file.
 *
 * Env:
 *   POSTMARK_SERVER_TOKEN — Server API token, from the Server's API
 *                           Tokens tab. NOT the Account API token.
 *   EMAIL_FROM            — "PayRanker <hello@payranker.io>", or a bare
 *                           address. Must match a confirmed Sender
 *                           Signature (or a verified domain) EXACTLY,
 *                           or Postmark rejects with ErrorCode 400/401.
 */

export interface SendResult {
  sent: boolean;
  /** Set when the send failed, for logs. Never shown to a user verbatim. */
  error?: string;
  /** false when no provider is configured — a setup gap, not a failure. */
  configured: boolean;
}

/**
 * Is outbound email switched on at all?
 *
 * Callers use this to tell "we emailed you" apart from "we cannot email
 * yet". Depends only on server config, never on the recipient, so it is
 * safe to report to a client without leaking whether an account exists.
 */
export function isEmailConfigured(): boolean {
  return Boolean(serverToken() && fromAddress());
}

// Trimmed because the token goes into a header verbatim. A trailing
// newline picked up from `vercel env add` would otherwise produce a bare
// 401 that reads exactly like a wrong token.
function serverToken(): string {
  return (process.env.POSTMARK_SERVER_TOKEN || "").trim();
}

function fromAddress(): string {
  // SENDGRID_FROM / RESEND_FROM are read as fallbacks so a half-migrated
  // environment still sends rather than silently going quiet.
  return (
    process.env.EMAIL_FROM ||
    process.env.SENDGRID_FROM ||
    process.env.RESEND_FROM ||
    ""
  ).trim();
}

/**
 * Postmark ErrorCodes, narrowed to the ones that actually occur here.
 *
 * These strings are for logs only. 406 in particular must never reach a
 * caller: it would reveal that a given address has bounced before, which
 * turns any "we sent you a link" endpoint back into an enumeration oracle.
 */
function describeFailure(code: number | undefined, status: number): string {
  if (status === 401) return "bad server token (http 401)";
  switch (code) {
    case 10:
      return "bad server token";
    case 300:
      return "invalid request — check EMAIL_FROM and the recipient address";
    case 400:
      return "sender signature not confirmed — the Postmark link is unclicked";
    case 401:
      return "sender signature not found — EMAIL_FROM must match it exactly";
    case 405:
    case 412:
      return "account pending Postmark approval — off-domain sends are blocked";
    case 406:
      return "recipient suppressed by Postmark (earlier bounce or complaint)";
    case 429:
      return "rate limited by Postmark";
    default:
      return code ? `postmark error ${code}` : `http ${status}`;
  }
}

export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}): Promise<SendResult> {
  const token = serverToken();
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
        // Postmark takes the whole "Name <addr>" string, so unlike
        // SendGrid there is nothing to parse apart here.
        From: from,
        To: opts.to,
        Subject: opts.subject,
        HtmlBody: opts.html,
        ...(opts.text ? { TextBody: opts.text } : {}),
        // Transactional stream. Sending these on a broadcast stream
        // would get password resets batched and delayed.
        MessageStream: "outbound",
      }),
    });

    // Postmark answers 200 with ErrorCode 0 on success. On failure the
    // numeric ErrorCode in the body says far more than the HTTP status
    // does — a 422 alone cannot tell an unconfirmed signature apart from
    // a suppressed recipient — so read the body before deciding.
    const body = (await res.json().catch(() => null)) as
      | { ErrorCode?: number; Message?: string; MessageID?: string }
      | null;

    if (res.ok && body?.ErrorCode === 0) {
      return { sent: true, configured: true };
    }

    console.error(
      "postmark error:",
      res.status,
      body?.ErrorCode,
      (body?.Message || "").slice(0, 300)
    );
    return {
      sent: false,
      configured: true,
      error: describeFailure(body?.ErrorCode, res.status),
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("postmark send failed:", msg);
    return { sent: false, configured: true, error: msg };
  }
}
