"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import AppHeader from "@/components/AppHeader";

interface Skill {
  rawInput: string;
  normalizedTerm: string;
  category: string;
  isAISuggested: boolean;
  aiResistanceScore: number;
  context?: string;
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

interface AdjacentRole {
  socCode: string;
  role: string;
  industry: string;
  score: number;
  sharedSkillCount: number;
  needToLearn: string[];
  credentials?: string[];
}
interface NearestRole {
  socCode: string;
  role: string;
  industry: string;
  matchPercent: number;
  sharedSkillCount: number;
}

export default function MatchRevealPage() {
  const router = useRouter();
  const [skills, setSkills] = useState<Skill[]>([]);
  const [results, setResults] = useState<MatchResults | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [topGapSkills, setTopGapSkills] = useState<
    { skill: string; count: number; avgPay: number; aiResistanceScore: number; isAIProof: boolean }[]
  >([]);
  const [nearestRole, setNearestRole] = useState<NearestRole | null>(null);
  const [adjacent, setAdjacent] = useState<AdjacentRole[]>([]);
  // Caroline 8/23 Round 8: yellow "+" skill pills must be actionable —
  // tapping one adds it to the Skills Basket and recalculates matches
  // without leaving the page.
  const [addingSkill, setAddingSkill] = useState<string | null>(null);

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

    async function fetchMatches(skillsToUse: Skill[] = parsed) {
      try {
        const res = await fetch("/api/jobs/match", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userSkills: skillsToUse.map((s) => ({
              normalizedTerm: s.normalizedTerm,
              proficiencyLevel: "intermediate",
              context: s.context,
            })),
            domainId: localStorage.getItem("payranker_domain") || undefined,
            metroId: localStorage.getItem("payranker_metro") || undefined,
          }),
        });
        const data = await res.json();
        setResults(data);

        // Use pre-computed top gap skills from API (sorted by AI-resistance + count)
        const sorted = (data.topGapSkills || []).slice(0, 3);
        setTopGapSkills(sorted);

        // Phase 3: also fetch adjacent careers so we can surface a
        // "You're closest to X — adjacent roles" panel.
        try {
          const r = await fetch("/api/roles/transfers", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              skills: parsed.map((s) => s.normalizedTerm),
              topN: 5,
            }),
          });
          const tj = await r.json();
          if (tj.nearestRole) setNearestRole(tj.nearestRole);
          if (Array.isArray(tj.transfers)) setAdjacent(tj.transfers);
        } catch {
          // Non-blocking: matches reveal still works without adjacency
        }
      } catch {
        setResults({ qualifiedJobs: [], gapJobs: [] });
      }
      setIsLoading(false);
    }
    fetchMatches();
  }, [router]);

  // Caroline 8/23 Round 8: add a suggested skill (yellow "+") to the
  // basket and recalculate matches without leaving the page.
  async function addSkillAndRecalc(skillLabel: string) {
    setAddingSkill(skillLabel);
    try {
      const nextSkills: Skill[] = [
        ...skills,
        {
          rawInput: skillLabel,
          normalizedTerm: skillLabel,
          category: "other",
          isAISuggested: true,
          aiResistanceScore: 60,
        },
      ];
      setSkills(nextSkills);
      localStorage.setItem("payranker_skills", JSON.stringify(nextSkills));

      const res = await fetch("/api/jobs/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userSkills: nextSkills.map((s) => ({
            normalizedTerm: s.normalizedTerm,
            proficiencyLevel: "intermediate",
            context: s.context,
          })),
          domainId: localStorage.getItem("payranker_domain") || undefined,
          metroId: localStorage.getItem("payranker_metro") || undefined,
        }),
      });
      const data = await res.json();
      setResults(data);
      setTopGapSkills((data.topGapSkills || []).slice(0, 3));
    } catch {
      // best-effort — the skill is already saved to localStorage
    } finally {
      setAddingSkill(null);
    }
  }

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
      <AppHeader />

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
              <p className="text-graytext text-sm mt-3 font-medium">
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
              <p className="text-graytext text-sm mt-3 font-medium">
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

            {/* Amber pill chips with gradient — Caroline 8/23 Round 8:
                tap to add the skill and recalculate matches inline. */}
            <div className="flex flex-wrap gap-2 mb-3">
              {topGapSkills.map((gs) => (
                <button
                  key={gs.skill}
                  type="button"
                  onClick={() => addSkillAndRecalc(gs.skill)}
                  disabled={addingSkill !== null}
                  aria-label={`Add ${gs.skill} to your skills basket and recalculate matches`}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-bold text-white shadow-sm hover:brightness-110 transition disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
                  style={{
                    background: "linear-gradient(to top, #F7A31C, #F7D323)",
                  }}
                >
                  {addingSkill === gs.skill ? (
                    <Loader2 size={12} className="animate-spin shrink-0" />
                  ) : null}
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
                </button>
              ))}
            </div>

            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-400">
                AI-proof skills prioritized. High impact on job access.
              </p>
              <button
                onClick={() => router.push("/skills/explore")}
                className="text-sm font-semibold text-magenta hover:underline"
              >
                Explore these skills&nbsp;&rarr;
              </button>
            </div>
          </div>
        )}

        {/* ── Phase 3: Adjacent careers (Caroline's emotional frame) ──
            "You're closest to Solar Photovoltaic Installer. Adjacent
            careers: Elevator Installer (26% transferable, need 3 more
            skills), Solar Thermal (25%, 3 more)." Replaces the binary
            qualify/don't-qualify cutoff with continuous warmth. */}
        {nearestRole && adjacent.length > 0 && (
          <div className="mb-10">
            <p className="text-gray-700 font-bold mb-1">
              You&rsquo;re closest to{" "}
              <span className="text-magenta">{nearestRole.role}</span>.
            </p>
            <p className="text-graytext text-sm mb-3">
              Adjacent careers you could grow into:
            </p>

            <div className="space-y-2 mb-3">
              {adjacent.slice(0, 5).map((adj) => (
                <div
                  key={adj.socCode}
                  className="px-4 py-3 rounded-xl bg-white border border-gray-200 hover:border-magenta/40 transition-colors"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-gray-900 truncate">{adj.role}</p>
                      <p className="text-xs text-graytext">{adj.industry}</p>
                    </div>
                    <span className="text-magenta font-bold text-sm whitespace-nowrap">
                      {Math.round(adj.score * 100)}% transferable
                    </span>
                  </div>
                  {adj.needToLearn.length > 0 && (
                    <p className="text-[11px] text-amber-dark mt-1.5 truncate">
                      Add: {adj.needToLearn.slice(0, 3).join(" · ")}
                    </p>
                  )}
                </div>
              ))}
            </div>
            <p className="text-xs text-graytext italic">
              You&rsquo;re closer than you think.
            </p>
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
          <p className="text-sm text-graytext italic mt-3 font-medium">
            Create your anonymous profile to continue
          </p>
        </div>
      </main>
    </div>
  );
}
