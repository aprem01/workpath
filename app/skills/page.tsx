"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { X, ArrowRight, Loader2, Plus } from "lucide-react";

interface Skill {
  rawInput: string;
  normalizedTerm: string;
  category: string;
  isAISuggested: boolean;
  aiResistanceScore: number;
}

function SkillsPageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [input, setInput] = useState("");
  const [skills, setSkills] = useState<Skill[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Load saved skills
  useEffect(() => {
    const saved = localStorage.getItem("payranker_skills");
    if (saved) {
      try {
        setSkills(JSON.parse(saved));
      } catch {}
    }
  }, []);

  // Save skills to localStorage
  useEffect(() => {
    if (skills.length > 0) {
      localStorage.setItem("payranker_skills", JSON.stringify(skills));
    }
  }, [skills]);

  const normalizeAndAdd = useCallback(
    async (raw: string) => {
      const trimmed = raw.trim();
      if (!trimmed || isLoading) return;

      if (
        skills.some(
          (s) => s.normalizedTerm.toLowerCase() === trimmed.toLowerCase()
        )
      )
        return;

      setIsLoading(true);
      setInput("");

      try {
        const res = await fetch("/api/skills/normalize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            rawSkill: trimmed,
            existingSkills: skills.map((s) => s.normalizedTerm),
          }),
        });
        const data = await res.json();

        const newSkill: Skill = {
          rawInput: trimmed,
          normalizedTerm: data.normalizedTerm || trimmed,
          category: data.category || "other",
          isAISuggested: false,
          aiResistanceScore: data.aiResistanceScore || 50,
        };

        // Dedupe and add
        setSkills((prev) => {
          if (
            prev.some(
              (s) =>
                s.normalizedTerm.toLowerCase() ===
                newSkill.normalizedTerm.toLowerCase()
            )
          )
            return prev;
          return [...prev, newSkill];
        });

        // Replace suggestions with fresh ones from this skill's response
        // Each new skill brings its own relevant suggestions
        const skillSet = new Set(
          [...skills, newSkill].map((s) => s.normalizedTerm.toLowerCase())
        );

        const freshSuggestions = [
          ...(data.aiSuggestions || []),
          ...(data.childSkills || []),
          ...(data.microSkills || []),
        ];

        // Dedupe and exclude skills already in basket
        const seen = new Set<string>();
        const filtered = freshSuggestions.filter((s: string) => {
          const lower = s.toLowerCase();
          if (seen.has(lower) || skillSet.has(lower)) return false;
          seen.add(lower);
          return true;
        });

        setSuggestions(filtered);
      } catch {
        setSkills((prev) => [
          ...prev,
          {
            rawInput: trimmed,
            normalizedTerm: trimmed,
            category: "other",
            isAISuggested: false,
            aiResistanceScore: 50,
          },
        ]);
      }
      setIsLoading(false);
    },
    [skills, isLoading]
  );

  // Auto-add skill from URL param — fresh start when arriving from landing
  useEffect(() => {
    const skillParam = searchParams.get("skill");
    if (skillParam) {
      // Clear previous session when arriving from landing page
      localStorage.removeItem("payranker_skills");
      localStorage.removeItem("payranker_profile_complete");
      localStorage.removeItem("payranker_profile");
      localStorage.removeItem("payranker_applied");
      setSkills([]);
      setSuggestions([]);
      normalizeAndAdd(skillParam);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if ((e.key === "Enter" || e.key === ",") && input.trim()) {
      e.preventDefault();
      normalizeAndAdd(input);
    }
  }

  function removeSkill(index: number) {
    setSkills((prev) => {
      const updated = prev.filter((_, i) => i !== index);
      localStorage.setItem("payranker_skills", JSON.stringify(updated));
      return updated;
    });
  }

  function addSuggestion(term: string) {
    const newSkill: Skill = {
      rawInput: term,
      normalizedTerm: term,
      category: "healthcare",
      isAISuggested: true,
      aiResistanceScore: 70,
    };
    setSkills((prev) => {
      if (
        prev.some(
          (s) => s.normalizedTerm.toLowerCase() === term.toLowerCase()
        )
      )
        return prev;
      return [...prev, newSkill];
    });
    setSuggestions((prev) => prev.filter((s) => s !== term));
  }

  // Filter out suggestions that are already in skills
  const filteredSuggestions = suggestions.filter(
    (s) =>
      !skills.some(
        (sk) => sk.normalizedTerm.toLowerCase() === s.toLowerCase()
      )
  );

  return (
    <div className="min-h-screen bg-warmwhite flex flex-col">
      {/* Header */}
      <header className="py-5 px-4">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl font-bold">
            <span className="text-magenta">Pay</span>
            <span className="text-amber">Ranker</span>
          </h1>
        </div>
      </header>

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 pb-12">
        {/* Headline */}
        <h2 className="text-3xl sm:text-4xl font-bold text-magenta leading-tight mb-10">
          Find the highest-paying jobs for your skills.
        </h2>

        {/* Start with one skill */}
        <p className="text-sm font-bold text-amber-dark text-center mb-3">
          Start with one skill
        </p>

        {/* Skill input — magenta border like design */}
        <div className="max-w-sm mx-auto mb-2">
          <div className="relative">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="ex: driving or cooking"
              disabled={isLoading}
              className="w-full px-5 py-3.5 text-base rounded-lg border-2 border-magenta/40 bg-white focus:outline-none focus:border-magenta focus:ring-2 focus:ring-magenta/15 transition-all placeholder:text-gray-400 text-center disabled:opacity-50"
              autoFocus
            />
            {isLoading && (
              <Loader2
                size={18}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-amber animate-spin"
              />
            )}
          </div>
          <p className="text-xs text-gray-400 text-center mt-2 italic">
            Press Enter to add
          </p>
        </div>

        {/* Down arrow */}
        {skills.length > 0 && (
          <div className="text-center text-magenta text-3xl mb-2 select-none">
            &#8964;
          </div>
        )}

        {/* YOUR SKILLS — thick gray bordered basket like Caroline's design */}
        {skills.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                Your Skills
              </p>
              <button
                onClick={() => {
                  setSkills([]);
                  setSuggestions([]);
                  localStorage.removeItem("payranker_skills");
                }}
                className="text-xs text-gray-400 hover:text-magenta transition-colors"
              >
                Clear all
              </button>
            </div>
            <div className="bg-white border-[3px] border-gray-300 rounded-2xl p-4 min-h-[100px] max-h-[200px] overflow-y-auto">
              <div className="flex flex-wrap gap-2">
                {skills.map((s, i) => (
                  <span
                    key={`${s.normalizedTerm}-${i}`}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-bold animate-pill-pop bg-amber text-white shadow-sm"
                  >
                    {s.normalizedTerm}
                    <button
                      onClick={() => removeSkill(i)}
                      className="hover:opacity-70 transition-opacity ml-0.5"
                    >
                      <X size={14} />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ADD RELATED SKILLS — accumulated AI suggestions */}
        {filteredSuggestions.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                Add Related Skills
              </p>
              <p className="text-xs font-semibold text-magenta">
                {skills.length} skills added
              </p>
            </div>
            <div className="bg-amber-light/50 rounded-2xl p-4 max-h-[220px] overflow-y-auto">
              <div className="flex flex-wrap gap-2">
                {filteredSuggestions.map((s) => (
                  <button
                    key={s}
                    onClick={() => addSuggestion(s)}
                    className="inline-flex items-center gap-1 px-4 py-2 rounded-full text-sm font-bold bg-amber text-white hover:bg-amber-dark transition-colors shadow-sm"
                  >
                    {s}
                    <Plus size={14} />
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* CTA */}
        {skills.length >= 1 && (
          <div className="text-center mt-8">
            <p className="text-magenta font-bold text-lg mb-4">
              See what your skills already qualify you for.
            </p>
            <button
              onClick={() => router.push("/matches")}
              className={`inline-flex items-center gap-2 px-10 py-4 rounded-full font-bold text-white text-lg transition-all ${
                skills.length >= 3
                  ? "bg-magenta hover:bg-magenta-dark shadow-lg animate-gentle-pulse"
                  : "bg-magenta/50 cursor-not-allowed"
              }`}
              disabled={skills.length < 3}
            >
              See your matches <ArrowRight size={20} />
            </button>
            {skills.length < 3 && (
              <p className="text-xs text-gray-400 mt-3">
                Add {3 - skills.length} more skill
                {3 - skills.length !== 1 ? "s" : ""} to continue
              </p>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

export default function SkillsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-warmwhite flex items-center justify-center">
          <Loader2 className="animate-spin text-magenta" size={32} />
        </div>
      }
    >
      <SkillsPageInner />
    </Suspense>
  );
}
