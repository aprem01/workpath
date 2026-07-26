import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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

    return NextResponse.json({ ok: true });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : "unknown";
    console.error("contact submit error:", errMsg);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
