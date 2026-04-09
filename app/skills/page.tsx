"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { X, ArrowRight, Loader2, Plus } from "lucide-react";
import Image from "next/image";

interface Skill {
  rawInput: string;
  normalizedTerm: string;
  category: string;
  isAISuggested: boolean;
  aiResistanceScore: number;
}

const PLACEHOLDER_SKILLS = ["driving", "cooking", "sales"];

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
        const skillSet = new Set(
          [...skills, newSkill].map((s) => s.normalizedTerm.toLowerCase())
        );

        const freshSuggestions = [
          ...(data.aiSuggestions || []),
          ...(data.childSkills || []),
          ...(data.microSkills || []),
        ];

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

  // Show placeholder pills only when basket is empty
  const showPlaceholders = skills.length === 0;

  return (
    <div className="min-h-screen bg-warmwhite flex flex-col">
      {/* White top bar */}
      <header className="bg-white border-b border-gray-100 py-5 px-6">
        <div className="max-w-5xl mx-auto">
          <a href="/">
            <Image
              src="/payranker-logo.png"
              alt="PayRanker"
              width={220}
              height={46}
              priority
            />
          </a>
        </div>
      </header>

      <main className="flex-1 max-w-5xl mx-auto w-full px-6 pt-12 pb-12">
        {/* Headline — flush left with logo, stable */}
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-semibold text-magenta-headline leading-tight mb-3">
          Find the highest-paying jobs for your skills.
        </h2>
        <p className="text-base text-graytext mb-12 max-w-2xl font-medium">
          You have more skills than you think. Enter your skills and see which
          jobs pay the most.
        </p>

        {/* Skill input */}
        <div className="max-w-lg mx-auto">
          <p className="text-lg font-semibold text-magenta text-center mb-3">
            Start with one skill
          </p>

          {/* Gradient-bordered input */}
          <div
            className="rounded-lg p-[2.5px] relative"
            style={{
              background: "linear-gradient(to right, #F6A21C, #E725E2)",
            }}
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="ex: driving, cooking or sales"
              disabled={isLoading}
              className="w-full px-5 py-3.5 text-base rounded-[6px] bg-white focus:outline-none placeholder:text-graylabel text-center font-medium disabled:opacity-50"
              autoFocus
            />
            {isLoading && (
              <Loader2
                size={18}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-amber animate-spin"
              />
            )}
          </div>
          <p className="text-xs text-graytext text-center mt-2 italic font-medium">
            Press Enter to add
          </p>

          {/* Wide pink down-arrow — Caroline's PNG */}
          <div className="flex justify-center my-4">
            <Image
              src="/arrowhead.png"
              alt=""
              width={36}
              height={20}
              aria-hidden="true"
            />
          </div>
        </div>

        {/* YOUR SKILLS basket — wider per Caroline */}
        <div className="max-w-4xl mx-auto mt-6">
          <p className="text-xs font-bold text-graytext uppercase tracking-wider mb-2">
            Your Skills
          </p>
          <div className="bg-white border-[3px] border-gray-200 rounded-2xl p-4 min-h-[100px]">
            <div className="flex flex-wrap gap-2">
              {showPlaceholders ? (
                // Light grey placeholder pills
                PLACEHOLDER_SKILLS.map((p) => (
                  <span
                    key={p}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-bold bg-gray-200 text-gray-400"
                  >
                    {p}
                    <X size={14} className="text-gray-400" />
                  </span>
                ))
              ) : (
                skills.map((s, i) => (
                  <span
                    key={`${s.normalizedTerm}-${i}`}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-bold animate-pill-pop text-white shadow-sm"
                    style={{
                      background: "linear-gradient(to top, #E725E2, #EFC5FF)",
                    }}
                  >
                    {s.normalizedTerm}
                    <button
                      onClick={() => removeSkill(i)}
                      className="hover:opacity-70 transition-opacity ml-0.5"
                    >
                      <X size={14} />
                    </button>
                  </span>
                ))
              )}
            </div>
          </div>
        </div>

        {/* ADD RELATED SKILLS — accumulated AI suggestions */}
        {filteredSuggestions.length > 0 && (
          <div className="max-w-4xl mx-auto mt-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-bold text-graytext uppercase tracking-wider">
                Add Related Skills
              </p>
              <p className="text-xs font-semibold text-magenta">
                {skills.length} skill{skills.length !== 1 ? "s" : ""} added
              </p>
            </div>
            <div className="bg-white border-[3px] border-gray-200 rounded-2xl p-4 max-h-[240px] overflow-y-auto">
              <div className="flex flex-wrap gap-2">
                {filteredSuggestions.map((s) => (
                  <button
                    key={s}
                    onClick={() => addSuggestion(s)}
                    className="inline-flex items-center gap-1 px-4 py-2 rounded-full text-sm font-bold text-white hover:brightness-110 transition-all shadow-sm"
                    style={{
                      background: "linear-gradient(to top, #F7A31C, #F7D323)",
                    }}
                  >
                    {s}
                    <Plus size={14} />
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* CTA — minimum 5 skills */}
        {skills.length >= 1 && (
          <div className="text-center mt-10">
            <p className="text-magenta font-semibold text-lg mb-4">
              See what your skills already qualify you for.
            </p>
            <button
              onClick={() => router.push("/matches")}
              className={`inline-flex items-center gap-2 px-10 py-4 rounded-full font-bold text-white text-lg transition-all ${
                skills.length >= 5
                  ? "bg-magenta hover:bg-magenta-dark shadow-lg animate-gentle-pulse"
                  : "bg-magenta/40 cursor-not-allowed"
              }`}
              disabled={skills.length < 5}
            >
              See your matches <ArrowRight size={20} />
            </button>
            {skills.length < 5 && (
              <p className="text-xs text-graytext mt-3 italic">
                Add {5 - skills.length} more skill
                {5 - skills.length !== 1 ? "s" : ""} to continue
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
