import type { Metadata } from "next";
import SEOContent from "@/components/SEOContent";

export const metadata: Metadata = {
  title: "Add Your Skills — Skills Basket & AI Suggestions",
  description:
    "Enter your skills in plain English — cooking, driving, CPR, Python, anything. Our AI normalizes them to the professional terms employers recognize, then suggests related skills to help you qualify for more jobs.",
  alternates: { canonical: "https://workpath-iota.vercel.app/skills" },
  openGraph: {
    title: "Add Your Skills to PayRanker",
    description:
      "Type any skill, we'll normalize it and suggest related skills that unlock higher-paying jobs.",
  },
};

export default function SkillsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SEOContent
        title="Add Your Skills to PayRanker"
        description="The PayRanker Skills page is where you build your skill basket — a list of what you can do. Enter any skill in plain English: cooking, driving, CPR, Python, customer service. Our AI normalizes each skill to the canonical professional term employers search for, then suggests related skills that commonly co-occur. Add 5 or more skills to unlock your matches."
        bullets={[
          "Type a skill in the input field and press Enter — it becomes a pink skill pill instantly",
          'AI normalizes plain English to professional terms (e.g., "cooking" becomes "Meal Preparation")',
          "Related skill suggestions appear below your basket — tap to add them",
          "Remove any skill by tapping the X on its pill",
          "Skills are categorized: healthcare, trades, tech, admin, food service, transport, and more",
          "Each skill has an AI-resistance score — physical and interpersonal skills are most automation-proof",
          "After adding 5+ skills, see the highest-paying jobs you already qualify for",
        ]}
        callToAction="Type your first skill above and press Enter to begin."
      />
      {children}
    </>
  );
}
