import prisma from "./prisma";

export type AnalyticsEventName =
  | "skill_added"
  | "match_revealed"
  | "tab_b_viewed"
  | "upskill_clicked"
  | "job_applied"
  | "profile_completed"
  | "job_expanded"
  | "suggestion_accepted"
  | "page_view";

export async function trackEvent(
  event: AnalyticsEventName,
  userId?: string | null,
  metadata?: Record<string, unknown>
) {
  try {
    await prisma.analyticsEvent.create({
      data: {
        event,
        userId: userId || null,
        metadata: metadata ? JSON.stringify(metadata) : null,
      },
    });
  } catch {
    // Silent fail — never block user flow for analytics
  }
}
