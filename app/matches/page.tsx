"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2 } from "lucide-react";

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

    // Assign anonymous handle if not already set
    if (!localStorage.getItem("payranker_handle")) {
      const adj = ["Skilled","Bright","Swift","Steady","Sharp","Ready","Bold","Quick","Strong","Smart"];
      const nouns = ["Pro","Star","Ace","Hero","Champ","Maven","Scout","Guide","Lead","Spark"];
      const handle = `${adj[Math.floor(Math.random()*adj.length)]}${nouns[Math.floor(Math.random()*nouns.length)]}_${Math.floor(1000+Math.random()*9000)}`;
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

        // Calculate top gap skills
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
        <p className="text-gray-600 font-medium">Matching your skills to jobs...</p>
      </div>
    );
  }

  const qualifiedCount = results?.qualifiedJobs.length || 0;
  const gapCount = results?.gapJobs.length || 0;

  return (
    <div className="min-h-screen bg-warmwhite flex flex-col">
      {/* Header */}
      <header className="py-6 px-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <h1 className="text-2xl font-bold">
            <span className="text-magenta">Pay</span>
            <span className="text-amber">Ranker</span>
          </h1>
          <button className="text-gray-400 hover:text-gray-600">
            <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 12h18M3 6h18M3 18h18" />
            </svg>
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 pb-12">
        {/* Two-column match reveal */}
        <div className="grid sm:grid-cols-2 gap-0 rounded-2xl overflow-hidden border border-gray-200 mb-10">
          {/* You qualify */}
          <div className="bg-gradient-to-r from-magenta to-magenta-dark p-6 text-center">
            <p className="text-white/80 text-sm font-semibold mb-1">You qualify</p>
            <div className="text-2xl sm:text-3xl font-bold text-white mb-3">&#8964;</div>
            <p className="text-4xl font-bold text-white animate-count-up">
              {qualifiedCount}
            </p>
            <p className="text-white font-semibold">matching jobs found</p>
            <p className="text-white/60 text-xs mt-1">Based on your current skills</p>
          </div>

          {/* With 1-2 more skills */}
          <div className="bg-gray-100 p-6 text-center">
            <p className="text-gray-500 text-sm font-semibold mb-1">
              With 1–2 more Skills
            </p>
            <div className="mt-6">
              <p className="text-4xl font-bold text-gray-900 animate-count-up">
                +{gapCount}
              </p>
              <p className="text-gray-700 font-semibold">additional jobs</p>
              <p className="text-gray-400 text-xs mt-1">
                Unlock with 1–2 more skills
              </p>
            </div>
          </div>
        </div>

        {/* Top gap skills to add */}
        {topGapSkills.length > 0 && (
          <div className="mb-10">
            <p className="text-gray-700 font-semibold mb-3">
              Most people like you add these skills:
            </p>
            <div className="flex flex-wrap gap-2 mb-2">
              {topGapSkills.map((gs) => (
                <span
                  key={gs.skill}
                  className="px-4 py-1.5 rounded-full text-sm font-semibold bg-amber text-white"
                >
                  {gs.skill}
                </span>
              ))}
            </div>
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-400">
                Quick to learn. High impact on job access.
              </p>
              <button
                onClick={() => router.push("/skills")}
                className="text-sm font-semibold text-magenta hover:underline flex items-center gap-1"
              >
                Explore these skills <ArrowRight size={14} />
              </button>
            </div>
          </div>
        )}

        {/* CTA */}
        <div className="text-center">
          <p className="text-magenta font-bold text-lg mb-4">
            {qualifiedCount} jobs ready to view
          </p>
          <button
            onClick={() => router.push("/jobs")}
            className="inline-flex items-center gap-2 px-8 py-3.5 rounded-full font-bold text-white bg-magenta hover:bg-magenta-dark transition-colors"
          >
            See your job list <ArrowRight size={18} />
          </button>
          <p className="text-xs text-gray-400 mt-3">
            Create your anonymous profile to continue
          </p>
        </div>
      </main>
    </div>
  );
}
