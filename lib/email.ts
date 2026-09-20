/**
 * Outbound transactional email.
 *
 * One seam, one provider behind it. We moved from Resend to SendGrid on
 * 2026-09-20 because Resend requires an MX record on a `send` subdomain,
 * and on Namecheap adding MX means switching Mail Settings away from
 * "Email Forwarding" — which would have broken the forwarding Caroline
 * relies on for hello@payranker.io. SendGrid authenticates with CNAMEs
 * only and never touches Mail Settings.
 *
 * That switch touched five call sites across two apps. Hence this file:
 * the next provider change should be this one function.
 *
 * Env:
 *   SENDGRID_API_KEY  — SG.xxx from sendgrid.com
 *   EMAIL_FROM        — "PayRanker <noreply@payranker.io>" or a bare address
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
  return Boolean(process.env.SENDGRID_API_KEY && fromAddress());
}

function fromAddress(): string {
  // RESEND_FROM is read as a fallback so a half-migrated environment still
  // sends rather than silently going quiet.
  return (process.env.EMAIL_FROM || process.env.RESEND_FROM || "").trim();
}

/** Split "Name <addr@example.com>" into SendGrid's shape. */
function parseFrom(raw: string): { email: string; name?: string } {
  const m = raw.match(/^\s*(.*?)\s*<\s*([^>]+)\s*>\s*$/);
  if (m) return { email: m[2].trim(), name: m[1].trim() || undefined };
  return { email: raw.trim() };
}

export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}): Promise<SendResult> {
  const apiKey = process.env.SENDGRID_API_KEY;
  const from = fromAddress();
  if (!apiKey || !from) {
    return { sent: false, configured: false, error: "email not configured" };
  }

  const content: { type: string; value: string }[] = [];
  // SendGrid requires text/plain before text/html when both are present.
  if (opts.text) content.push({ type: "text/plain", value: opts.text });
  content.push({ type: "text/html", value: opts.html });

  try {
    const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: opts.to }] }],
        from: parseFrom(from),
        subject: opts.subject,
        content,
      }),
    });
    // A successful send is 202 Accepted with an empty body.
    if (res.status >= 200 && res.status < 300) {
      return { sent: true, configured: true };
    }
    const body = await res.text();
    console.error("sendgrid error:", res.status, body.slice(0, 300));
    return { sent: false, configured: true, error: `http ${res.status}` };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("sendgrid send failed:", msg);
    return { sent: false, configured: true, error: msg };
  }
}
