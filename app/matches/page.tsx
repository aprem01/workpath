"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

interface Skill {
  rawInput: string;
  normalizedTerm: string;
  category: string;
  isAISuggested: boolean;
  aiResistanceScore: number;
}

interface MatchResults {
  qualifiedJobs: { id: string; title: string; payMin: number; payMax: number }[];
  gapJobs: {
    id: string;
    title: string;
    payMin: number;
    payMax: number;
    missingSkills: string[];
  }[];
}

export default function MatchRevealPage() {
  const router = useRouter();
  const [, setSkills] = useState<Skill[]>([]);
  const [results, setResults] = useState<MatchResults | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [topGapSkills, setTopGapSkills] = useState<
    { skill: string; count: number; avgPay: number }[]
  >([]);

  useEffect(() => {
    const saved = localStorage.getItem("payranker_skills");
    if (!saved) {
      router.push("/skills");
      return;
    }
    const parsed: Skill[] = JSON.parse(saved);
    setSkills(parsed);

    // Assign anonymous handle silently
    if (!localStorage.getItem("payranker_handle")) {
      const adj = [
        "Skilled", "Bright", "Swift", "Steady", "Sharp",
        "Ready", "Bold", "Quick", "Strong", "Smart",
      ];
      const nouns = [
        "Pro", "Star", "Ace", "Hero", "Champ",
        "Maven", "Scout", "Guide", "Lead", "Spark",
      ];
      const handle = `${adj[Math.floor(Math.random() * adj.length)]}${nouns[Math.floor(Math.random() * nouns.length)]}_${Math.floor(1000 + Math.random() * 9000)}`;
      localStorage.setItem("payranker_handle", handle);
    }

    async function fetchMatches() {
      try {
        const res = await fetch("/api/jobs/match", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userSkills: parsed.map((s) => ({
              normalizedTerm: s.normalizedTerm,
              proficiencyLevel: "intermediate",
            })),
          }),
        });
        const data = await res.json();
        setResults(data);

        // Calculate top gap skills — most common missing skills from gapJobs
        const skillFreq: Record<string, { count: number; totalPay: number }> = {};
        for (const job of data.gapJobs || []) {
          for (const ms of job.missingSkills || []) {
            if (!skillFreq[ms]) skillFreq[ms] = { count: 0, totalPay: 0 };
            skillFreq[ms].count++;
            skillFreq[ms].totalPay += job.payMax;
          }
        }
        const sorted = Object.entries(skillFreq)
          .sort((a, b) => b[1].count - a[1].count)
          .slice(0, 3)
          .map(([skill, { count, totalPay }]) => ({
            skill,
            count,
            avgPay: Math.round(totalPay / count / 100),
          }));
        setTopGapSkills(sorted);
      } catch {
        setResults({ qualifiedJobs: [], gapJobs: [] });
      }
      setIsLoading(false);
    }
    fetchMatches();
  }, [router]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-warmwhite flex flex-col items-center justify-center">
        <Loader2 className="animate-spin text-magenta mb-4" size={40} />
        <p className="text-gray-600 font-medium">
          Matching your skills to jobs...
        </p>
      </div>
    );
  }

  const qualifiedCount = results?.qualifiedJobs.length || 0;
  const gapCount = results?.gapJobs.length || 0;

  return (
    <div className="min-h-screen bg-warmwhite flex flex-col">
      {/* ── Header ── */}
      <header className="py-6 px-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight">
            <span className="text-magenta">Pay</span>
            <span className="text-amber">Ranker</span>
          </h1>
          {/* Hamburger menu icon — 3 lines */}
          <button
            aria-label="Menu"
            className="text-gray-400 hover:text-gray-600 flex flex-col justify-center gap-[5px]"
          >
            <span className="block w-6 h-[2px] bg-current" />
            <span className="block w-6 h-[2px] bg-current" />
            <span className="block w-6 h-[2px] bg-current" />
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 pb-12">
        {/* ── Two-panel match reveal ── */}
        <div className="grid sm:grid-cols-2 rounded-2xl overflow-hidden border border-gray-200 mb-10">
          {/* LEFT — You qualify */}
          <div className="flex flex-col">
            {/* Header bar */}
            <div className="bg-gradient-to-r from-magenta to-magenta-dark px-5 py-3">
              <p className="text-white font-bold text-sm tracking-wide">
                You qualify
              </p>
            </div>
            {/* Content area */}
            <div className="bg-white border-l-4 border-magenta flex-1 px-6 py-8 flex flex-col items-center justify-center text-center">
              {/* Magenta chevron down */}
              <svg
                className="text-magenta mb-3"
                width="28"
                height="16"
                viewBox="0 0 28 16"
                fill="none"
              >
                <path
                  d="M2 2L14 14L26 2"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <p className="text-magenta font-bold text-4xl animate-count-up">
                {qualifiedCount}
              </p>
              <p className="text-magenta font-bold text-lg mt-1">
                matching jobs found
              </p>
              <p className="text-gray-400 text-xs mt-2">
                Based on your current skills
              </p>
            </div>
          </div>

          {/* RIGHT — With 1-2 more Skills */}
          <div className="flex flex-col">
            {/* Header bar */}
            <div className="bg-gradient-to-r from-gray-300 to-gray-400 px-5 py-3">
              <p className="text-white font-bold text-sm tracking-wide">
                With 1–2 more Skills
              </p>
            </div>
            {/* Content area */}
            <div className="bg-gray-50 flex-1 px-6 py-8 flex flex-col items-center justify-center text-center">
              <p className="text-gray-900 font-bold text-4xl animate-count-up">
                +{gapCount}
              </p>
              <p className="text-gray-900 font-bold text-lg mt-1">
                additional jobs
              </p>
              <p className="text-gray-400 text-xs mt-2">
                Unlock with 1–2 more skills.
              </p>
            </div>
          </div>
        </div>

        {/* ── Top gap skills ── */}
        {topGapSkills.length > 0 && (
          <div className="mb-10">
            <p className="text-gray-700 font-bold mb-3">
              Most people like you add these skills:
            </p>

            {/* Amber pill chips */}
            <div className="flex flex-wrap gap-2 mb-3">
              {topGapSkills.map((gs) => (
                <span
                  key={gs.skill}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-semibold bg-amber text-white"
                >
                  {gs.skill}
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 12 12"
                    fill="none"
                    className="shrink-0"
                  >
                    <path
                      d="M6 2V10M2 6H10"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </svg>
                </span>
              ))}
            </div>

            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-400">
                Quick to learn. High impact on job access.
              </p>
              <button
                onClick={() => router.push("/skills")}
                className="text-sm font-semibold text-magenta hover:underline"
              >
                Explore these skills&nbsp;&rarr;
              </button>
            </div>
          </div>
        )}

        {/* ── CTA section ── */}
        <div className="text-center mt-4">
          <p className="text-magenta font-bold text-lg mb-4">
            {qualifiedCount} jobs ready to view
          </p>
          <button
            onClick={() => router.push("/profile")}
            className="inline-flex items-center gap-2 px-8 py-3.5 rounded-full font-bold text-white bg-magenta hover:bg-magenta-dark transition-colors text-base"
          >
            See your job list&nbsp;&rarr;
          </button>
          <p className="text-xs text-gray-400 italic mt-3">
            Create your anonymous profile to continue
          </p>
        </div>
      </main>
    </div>
  );
}
