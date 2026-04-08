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
    { skill: string; count: number; avgPay: number; aiResistanceScore: number; isAIProof: boolean }[]
  >([]);

  useEffect(() => {
    const saved = localStorage.getItem("payranker_skills");
    if (!saved) {
      router.push("/skills");
      return;
    }
    const parsed: Skill[] = JSON.parse(saved);
    setSkills(parsed);

    // Assign abstract anonymous handle silently (keeto325 style)
    if (!localStorage.getItem("payranker_handle")) {
      const syl = ["kee","joo","mee","too","noo","bee","zee","loo","ka","to","bu","mi","ze","ri","lu","na","fi","da"];
      const s1 = syl[Math.floor(Math.random() * syl.length)];
      const s2 = syl[Math.floor(Math.random() * syl.length)];
      const num = Math.floor(100 + Math.random() * 900);
      localStorage.setItem("payranker_handle", `${s1}${s2}${num}`);
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

        // Use pre-computed top gap skills from API (sorted by AI-resistance + count)
        const sorted = (data.topGapSkills || []).slice(0, 3);
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
      {/* ── White top bar with nav ── */}
      <header className="bg-white border-b border-gray-100 py-5 px-6">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <a href="/" className="text-3xl font-bold tracking-tight">
            <span className="text-magenta">Pay</span>
            <span className="text-amber">Ranker</span>
          </a>
          <nav className="flex items-center gap-6">
            <a href="/skills" className="text-sm font-semibold text-graytext hover:text-gray-700 transition-colors">
              Your Skills
            </a>
            <button className="text-magenta hover:text-magenta-dark ml-1">
              <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M3 11h18M3 5.5h18M3 16.5h18" />
              </svg>
            </button>
          </nav>
        </div>
      </header>

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 pt-8 pb-12">
        {/* ── Two-panel match reveal ── */}
        <div className="grid sm:grid-cols-2 rounded-2xl overflow-hidden shadow-sm mb-10">
          {/* LEFT — You qualify */}
          <div className="flex flex-col">
            {/* Header bar — gradient bottom to top: dark pink → light pink */}
            <div
              className="px-5 py-3 text-center"
              style={{
                background: "linear-gradient(to top, #E725E2, #EFC5FF)",
              }}
            >
              <p className="text-white font-bold text-base tracking-wide">
                You qualify
              </p>
            </div>
            {/* Content area */}
            <div className="bg-white flex-1 px-6 py-10 flex flex-col items-center justify-center text-center">
              {/* Aligned counts: number + label on same line, same size */}
              <p className="text-magenta font-bold text-3xl animate-count-up leading-none">
                {qualifiedCount} matching jobs found
              </p>
              <p className="text-graytext text-xs mt-3">
                Based on your current skills
              </p>
            </div>
          </div>

          {/* RIGHT — With 1-2 more Skills */}
          <div className="flex flex-col">
            {/* Header bar — gradient bottom to top: dark grey → light grey */}
            <div
              className="px-5 py-3 text-center"
              style={{
                background: "linear-gradient(to top, #808184, #D0D2D3)",
              }}
            >
              <p className="text-white font-bold text-base tracking-wide">
                With 1–2 more Skills
              </p>
            </div>
            {/* Content area — same vertical alignment as left */}
            <div className="bg-gray-50 flex-1 px-6 py-10 flex flex-col items-center justify-center text-center">
              <p className="text-gray-900 font-bold text-3xl animate-count-up leading-none">
                +{gapCount} additional jobs
              </p>
              <p className="text-graytext text-xs mt-3">
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

            {/* Amber pill chips with gradient */}
            <div className="flex flex-wrap gap-2 mb-3">
              {topGapSkills.map((gs) => (
                <span
                  key={gs.skill}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-bold text-white shadow-sm"
                  style={{
                    background: "linear-gradient(to top, #F7A31C, #F7D323)",
                  }}
                >
                  {gs.skill}
                  {gs.isAIProof && (
                    <span className="text-[10px] bg-white/25 px-1.5 py-0.5 rounded-full">
                      AI-proof
                    </span>
                  )}
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
                AI-proof skills prioritized. High impact on job access.
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
