import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmail, isEmailConfigured } from "@/lib/email";

export const dynamic = "force-dynamic";

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

    await prisma.analyticsEvent.create({
      data: {
        event: "contact_submitted",
        metadata: JSON.stringify({
          name: cleanName,
          email: cleanEmail,
          topic: cleanTopic,
          message: cleanMessage,
        }),
      },
    });

    // Caroline 9/20 #9: her test message was stored correctly but nobody
    // was notified, so from her side it looked like it had gone nowhere.
    // The database row stays the record of truth; this is the ping.
    if (isEmailConfigured()) {
      const to = process.env.CONTACT_NOTIFY_TO || "";
      if (to) {
        const result = await sendEmail({
          to,
          subject: `PayRanker contact: ${cleanTopic}`,
          text: `From: ${cleanName || "(no name)"} <${cleanEmail || "no email"}>\nTopic: ${cleanTopic}\n\n${cleanMessage}`,
          html:
            `<p><strong>From:</strong> ${cleanName || "(no name)"} &lt;${cleanEmail || "no email"}&gt;</p>` +
            `<p><strong>Topic:</strong> ${cleanTopic}</p>` +
            `<hr/><p style="white-space:pre-wrap">${cleanMessage}</p>`,
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
