import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmail, isEmailConfigured } from "@/lib/email";
import { attributionFromCookieHeader, describeAttribution } from "@/lib/attribution";
import { escapeHtml, singleLine } from "@/lib/utils";

export const dynamic = "force-dynamic";

/**
 * Keeps synthetic traffic out of the conversion count. As of 2026-11-11,
 * 36 of the 38 rows under this event are automated loop verifications and
 * one is a retest; exactly one is a real person. An unflagged count here
 * would have read as 38 inbound leads.
 */
function looksLikeTest(email: string, message: string): boolean {
  const e = email.toLowerCase();
  if (e.endsWith("@example.com") || e.endsWith("@test.com")) return true;
  if (/^(loop|retest|probe|smoke)\b/i.test(message.trim())) return true;
  if (/automated (loop|retest|test)/i.test(message)) return true;
  return false;
}

const VALID_TOPICS = new Set([
  "feedback",
  "bug",
  "employer",
  "press",
  "other",
]);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, email, topic, message } = body || {};

    const cleanMessage = typeof message === "string" ? message.trim() : "";
    if (!cleanMessage || cleanMessage.length > 5000) {
      return NextResponse.json(
        { error: "Message is required (max 5000 chars)" },
        { status: 400 }
      );
    }
    const cleanTopic = VALID_TOPICS.has(topic) ? topic : "other";
    const cleanName = typeof name === "string" ? name.trim().slice(0, 120) : "";
    const cleanEmail = typeof email === "string" ? email.trim().slice(0, 200) : "";

    const attr = attributionFromCookieHeader(req.headers.get("cookie"));
    const isTest = looksLikeTest(cleanEmail, cleanMessage);

    await prisma.analyticsEvent.create({
      data: {
        event: "contact_submitted",
        metadata: JSON.stringify({
          name: cleanName,
          email: cleanEmail,
          topic: cleanTopic,
          message: cleanMessage,
          isTest,
          attribution: attr,
        }),
      },
    });

    // Caroline 9/20 #9: her test message was stored correctly but nobody
    // was notified, so from her side it looked like it had gone nowhere.
    // The database row stays the record of truth; this is the ping.
    if (!isTest && isEmailConfigured()) {
      const to = process.env.CONTACT_NOTIFY_TO || "";
      if (to) {
        const result = await sendEmail({
          to,
          subject: singleLine(`PayRanker contact: ${cleanTopic}`),
          text:
            `From: ${cleanName || "(no name)"} <${cleanEmail || "no email"}>\n` +
            `Topic: ${cleanTopic}\n` +
            `Came via: ${describeAttribution(attr)}\n\n${cleanMessage}`,
          // Escape everything. The name and message come from a form
          // field and the campaign comes from the landing URL's query
          // string, so each is an injection vector into the mail we read.
          html:
            `<p><strong>From:</strong> ${escapeHtml(cleanName || "(no name)")} &lt;${escapeHtml(cleanEmail || "no email")}&gt;</p>` +
            `<p><strong>Topic:</strong> ${escapeHtml(cleanTopic)}</p>` +
            `<p><strong>Came via:</strong> ${escapeHtml(describeAttribution(attr))}</p>` +
            `<hr/><p style="white-space:pre-wrap">${escapeHtml(cleanMessage)}</p>`,
        });
        if (!result.sent) {
          // Never fail the user's submission because our notification
          // failed — their message is already saved.
          console.error("contact notify failed:", result.error);
        }
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : "unknown";
    console.error("contact submit error:", errMsg);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
