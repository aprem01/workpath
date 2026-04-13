import type { Metadata } from "next";
import SEOContent from "@/components/SEOContent";

export const metadata: Metadata = {
  title: "Your Job Matches — Sorted by Pay, Not Date",
  description:
    "See the highest-paying jobs you qualify for right now based on the skills in your basket. Plus, jobs that are just 1-2 skills away. Real Chicago job listings from top employers.",
  alternates: { canonical: "https://workpath-iota.vercel.app/jobs" },
  openGraph: {
    title: "Your Job Matches on PayRanker",
    description:
      "Real job listings sorted by highest pay first. Plus 1-2 skills away opportunities.",
  },
};

export default function JobsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SEOContent
        title="Your Job Matches on PayRanker"
        description="The PayRanker Jobs page shows two tabs of job listings based on your skill basket. Tab A (You qualify) contains jobs where you match 100% of the required skills — sorted by highest pay first. Tab B (1-2 skills away) contains jobs where learning just one or two more skills would unlock qualification. All listings are real jobs from Chicago-area employers."
        bullets={[
          "Tab A: Jobs you qualify for right now, sorted by highest pay",
          "Tab B: Jobs that are 1-2 skills away from your current qualifications",
          "Every job shows pay range, shift type, and location",
          "Tap any job to expand and see the full requirements, company info, and apply button",
          "Gap jobs display the missing skills as orange pills — tap them to find online and in-person training nearby",
          "Click Apply to be taken directly to the employer's listing",
          "Anonymous profile mode means employers see your skills, not your identity until you reveal",
        ]}
        callToAction="Add 5+ skills on the Skills page to populate your job matches."
      />
      {children}
    </>
  );
}
