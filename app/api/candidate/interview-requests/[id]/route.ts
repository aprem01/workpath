import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifySessionCookie } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * PATCH /api/candidate/interview-requests/[id]
 *
 * Body: { action: "accept" | "decline", pii?: { firstName, lastName, phone, workAuthStatus } }
 *
 * Caroline 8/23 Round 8 P03 gate: on accept, the candidate MUST have
 * first name, last name, phone number, and work auth status persisted.
 * If any are missing, the endpoint refuses with 428 Precondition
 * Required so the UI can prompt the candidate to fill them in.
 * Optionally the client can pass `pii:{…}` in the same call to persist
 * the missing fields in one round trip.
 */
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const cookieRaw = req.headers
      .get("cookie")
      ?.split(";")
      .map((c) => c.trim())
      .find((c) => c.startsWith("payranker_session="))
      ?.slice("payranker_session=".length);
    const session = verifySessionCookie(cookieRaw);
    if (!session) {
      return NextResponse.json({ error: "not logged in" }, { status: 401 });
    }
    const user = await prisma.user.findUnique({
      where: { anonymousHandle: session.handle },
    });
    if (!user) {
      return NextResponse.json({ error: "user not found" }, { status: 404 });
    }
    const app = await prisma.application.findFirst({
      where: { id: params.id, userId: user.id },
    });
    if (!app) {
      return NextResponse.json(
        { error: "interview request not found" },
        { status: 404 }
      );
    }

    const body = await req.json();
    const action = body?.action as "accept" | "decline" | undefined;
    if (action !== "accept" && action !== "decline") {
      return NextResponse.json({ error: "invalid action" }, { status: 400 });
    }

    if (action === "decline") {
      await prisma.application.update({
        where: { id: app.id },
        data: { status: "interview_declined" },
      });
      return NextResponse.json({ ok: true });
    }

    // Accept path. Optionally persist submitted PII first.
    const pii = body?.pii as
      | {
          firstName?: string;
          lastName?: string;
          phone?: string;
          workAuthStatus?: string;
        }
      | undefined;
    if (pii) {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          firstName:
            typeof pii.firstName === "string" && pii.firstName.trim()
              ? pii.firstName.trim()
              : user.firstName,
          lastName:
            typeof pii.lastName === "string" && pii.lastName.trim()
              ? pii.lastName.trim()
              : user.lastName,
          phone:
            typeof pii.phone === "string" && pii.phone.trim()
              ? pii.phone.trim()
              : user.phone,
          workAuthStatus:
            typeof pii.workAuthStatus === "string" && pii.workAuthStatus.trim()
              ? pii.workAuthStatus.trim()
              : user.workAuthStatus,
        },
      });
    }
    // Re-read the user so the completeness check reflects the update.
    const fresh = await prisma.user.findUnique({ where: { id: user.id } });
    if (
      !fresh?.firstName ||
      !fresh?.lastName ||
      !fresh?.phone ||
      !fresh?.workAuthStatus
    ) {
      return NextResponse.json(
        {
          error: "profile_incomplete",
          message:
            "Please provide your first name, last name, phone number, and work authorization before accepting the interview request.",
          missing: [
            !fresh?.firstName && "firstName",
            !fresh?.lastName && "lastName",
            !fresh?.phone && "phone",
            !fresh?.workAuthStatus && "workAuthStatus",
          ].filter(Boolean),
        },
        { status: 428 }
      );
    }
    await prisma.application.update({
      where: { id: app.id },
      data: { status: "interview_accepted" },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : "unknown";
    console.error("interview-accept error:", errMsg);
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
