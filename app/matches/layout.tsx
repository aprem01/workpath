import type { Metadata } from "next";
import SEOContent from "@/components/SEOContent";

export const metadata: Metadata = {
  title: "Your Skill Match Results",
  description:
    "See how many jobs you qualify for right now — and how many more you could unlock by learning 1-2 more skills. Plus the top skills to add next.",
  alternates: { canonical: "https://workpath-iota.vercel.app/matches" },
};

export default function MatchesLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SEOContent
        title="Your Skill Match Results on PayRanker"
        description="The Matches page shows a side-by-side reveal of your opportunity: the number of jobs you qualify for right now (left panel, pink), and the number of additional jobs you could unlock with just 1-2 more skills (right panel, gray). Below the match reveal, see the most impactful skills to add next — AI-proof skills are prioritized because they unlock more jobs and are resistant to automation."
        bullets={[
          "Left panel: total jobs you qualify for today",
          "Right panel: additional jobs 1-2 skills away",
          "Most people like you add these skills — top gap skills from real job postings",
          "AI-proof skills highlighted — they resist automation and pay more",
          "One click takes you to your full job list",
        ]}
        callToAction="Create your anonymous profile to continue to your job list."
      />
      {children}
    </>
  );
}
