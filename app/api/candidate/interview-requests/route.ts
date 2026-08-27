import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifySessionCookie } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * GET /api/candidate/interview-requests
 *
 * Returns pending + accepted interview requests for the logged-in
 * candidate. Requires the payranker_session cookie.
 */
export async function GET(req: Request) {
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
    if (!user) return NextResponse.json({ requests: [] });

    const rows = await prisma.application.findMany({
      where: {
        userId: user.id,
        status: { in: ["interview_requested", "interview_accepted"] },
      },
      include: {
        job: {
          select: {
            id: true,
            title: true,
            employer: true,
            location: true,
            payMin: true,
            payMax: true,
            shiftType: true,
          },
        },
      },
      orderBy: { appliedAt: "desc" },
    });

    // Whether the candidate has enough PII on file to accept — this is
    // the Round 8 P03 gate. The UI uses `canAccept:false` to open the
    // "Complete profile" modal instead of the accept confirmation.
    const canAccept =
      !!user.firstName &&
      !!user.lastName &&
      !!user.phone &&
      !!user.workAuthStatus;

    return NextResponse.json({
      requests: rows.map((r) => ({
        id: r.id,
        status: r.status,
        appliedAt: r.appliedAt.toISOString(),
        job: r.job,
      })),
      canAccept,
      missing: canAccept
        ? []
        : [
            !user.firstName && "firstName",
            !user.lastName && "lastName",
            !user.phone && "phone",
            !user.workAuthStatus && "workAuthStatus",
          ].filter(Boolean),
    });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : "unknown";
    console.error("interview-requests list error:", errMsg);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
