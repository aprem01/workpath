"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { X, ArrowRight, Loader2 } from "lucide-react";

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

      // Check if already added
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

        // Dedupe
        if (
          !skills.some(
            (s) =>
              s.normalizedTerm.toLowerCase() ===
              newSkill.normalizedTerm.toLowerCase()
          )
        ) {
          setSkills((prev) => [...prev, newSkill]);
        }

        // Update suggestions
        if (data.aiSuggestions && data.aiSuggestions.length > 0) {
          setSuggestions(
            data.aiSuggestions.filter(
              (s: string) =>
                !skills.some(
                  (sk) => sk.normalizedTerm.toLowerCase() === s.toLowerCase()
                )
            )
          );
        }
      } catch {
        // Fallback: add raw input
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

  // Auto-add skill from URL param
  useEffect(() => {
    const skillParam = searchParams.get("skill");
    if (skillParam && skills.length === 0) {
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
    setSkills((prev) => [...prev, newSkill]);
    setSuggestions((prev) => prev.filter((s) => s !== term));
  }

  return (
    <div className="min-h-screen bg-warmwhite flex flex-col">
      {/* Header */}
      <header className="py-6 px-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <h1 className="text-2xl font-bold">
            <span className="text-magenta">Pay</span>
            <span className="text-amber">Ranker</span>
          </h1>
          {skills.length > 0 && (
            <span className="text-sm text-gray-500">
              {skills.length} skill{skills.length !== 1 ? "s" : ""} added
            </span>
          )}
        </div>
      </header>

      <main className="flex-1 max-w-3xl mx-auto w-full px-4 pb-12">
        {/* Headline */}
        <h2 className="text-3xl sm:text-4xl font-bold text-magenta text-center mb-8">
          Find the highest-paying jobs for your skills.
        </h2>

        <p className="text-sm font-semibold text-gray-700 text-center mb-3">
          Start with one skill
        </p>

        {/* Skill input */}
        <div className="max-w-md mx-auto mb-2">
          <div className="relative">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="ex: driving or cooking"
              disabled={isLoading}
              className="w-full px-5 py-4 text-base rounded-full border-2 border-gray-200 bg-white focus:outline-none focus:border-amber focus:ring-2 focus:ring-amber/20 transition-all placeholder:text-gray-400 text-center disabled:opacity-50"
              autoFocus
            />
            {isLoading && (
              <Loader2
                size={20}
                className="absolute right-5 top-1/2 -translate-y-1/2 text-amber animate-spin"
              />
            )}
          </div>
          <p className="text-xs text-gray-400 text-center mt-2">
            Press Enter to add
          </p>
        </div>

        {/* Down arrow */}
        {skills.length > 0 && (
          <div className="text-center text-magenta text-2xl mb-4">&#8964;</div>
        )}

        {/* YOUR SKILLS basket */}
        {skills.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Your Skills
              </p>
              <p className="text-xs text-gray-400">
                {skills.length} skill{skills.length !== 1 ? "s" : ""} added
              </p>
            </div>
            <div className="bg-white border-2 border-gray-200 rounded-2xl p-4 min-h-[60px]">
              <div className="flex flex-wrap gap-2">
                {skills.map((s, i) => (
                  <span
                    key={`${s.normalizedTerm}-${i}`}
                    className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-semibold animate-pill-pop ${
                      s.isAISuggested
                        ? "bg-amber/20 text-amber-dark"
                        : "bg-amber text-white"
                    }`}
                  >
                    {s.normalizedTerm}
                    <button
                      onClick={() => removeSkill(i)}
                      className="hover:opacity-70 transition-opacity"
                    >
                      <X size={14} />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* AI Suggestions */}
        {suggestions.length > 0 && (
          <div className="mb-8">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Add Related Skills
            </p>
            <div className="flex flex-wrap gap-2">
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => addSuggestion(s)}
                  className="px-3.5 py-1.5 rounded-full text-sm font-semibold bg-amber/15 text-amber-dark border border-amber/30 hover:bg-amber/25 transition-colors animate-suggestion-pulse"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* CTA */}
        {skills.length >= 1 && (
          <div className="text-center mt-10">
            <p className="text-magenta font-semibold mb-4">
              See what your skills already qualify you for.
            </p>
            <button
              onClick={() => router.push("/matches")}
              className={`inline-flex items-center gap-2 px-8 py-3.5 rounded-full font-bold text-white transition-all ${
                skills.length >= 3
                  ? "bg-magenta hover:bg-magenta-dark animate-gentle-pulse"
                  : "bg-magenta/60 cursor-default"
              }`}
              disabled={skills.length < 3}
            >
              See your matches <ArrowRight size={18} />
            </button>
            {skills.length < 3 && (
              <p className="text-xs text-gray-400 mt-2">
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
