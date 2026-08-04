"use client";

import { useState, useEffect, useCallback, useRef, Suspense, memo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { X, ArrowRight, Loader2, Plus } from "lucide-react";
import Image from "next/image";
import { getDomainById } from "@/lib/domains";
import Footer from "@/components/Footer";
import BetaBanner from "@/components/BetaBanner";

interface Skill {
  rawInput: string;
  normalizedTerm: string;
  category: string;
  isAISuggested: boolean;
  aiResistanceScore: number;
  /**
   * Industry context attached to *this skill* — not to the person.
   * Caroline's career-mobility insight: "Management" means something
   * different in Logistics vs Healthcare, but the WORKER may have done
   * both. Store the picked industry on the skill, render as
   * "Management (Logistics)" on the pill.
   *
   * Set when the clarification chip picker resolves an ambiguous skill.
   * Undefined for unambiguous skills.
   */
  context?: string;
}

const PLACEHOLDER_SKILLS = ["driving", "cooking", "sales"];

/**
 * Isolated, memoized skill input.
 *
 * Why this exists: Marielee (4/26 beta tester, Android) reported the
 * keyboard dismissed on every keystroke. Cause: this input was inline
 * in the page component, so every parent re-render (skills add, suggestions
 * update, loading state) caused Android's IME to re-evaluate focus and dismiss.
 *
 * Fix: extract into its own memo'd component with stable handlers. Parent
 * state changes no longer cause this component to re-render unless its own
 * props change (value/onChange/onSubmit). Also removed `autoFocus` which
 * was retriggering on Android with each parent render.
 */
const SkillInput = memo(function SkillInput({
  value,
  onChange,
  onSubmit,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: (v: string) => void;
}) {
  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if ((e.key === "Enter" || e.key === ",") && value.trim()) {
      e.preventDefault();
      onSubmit(value);
    }
  }

  return (
    <div
      className="rounded-lg p-[2.5px] relative"
      style={{
        background: "linear-gradient(to right, #F6A21C, #E725E2)",
      }}
    >
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="ex: driving, cooking or sales"
        className="w-full px-5 py-3.5 text-base rounded-[6px] bg-white focus:outline-none placeholder:text-graylabel text-center font-medium"
        // Android keyboard hints
        inputMode="text"
        enterKeyHint="done"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
      />
    </div>
  );
});

function SkillsPageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [input, setInput] = useState("");
  const [skills, setSkills] = useState<Skill[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  // Caroline 5/22 Phase-1 UX: block adding the NEXT skill while the
  // previous one's suggestions are still loading. Ref lets us gate the
  // submit handler without adding isLoading to normalizeAndAdd's deps
  // (that would remount the memoized SkillInput and drop Android IME).
  const isLoadingRef = useRef(false);
  const domainId = ""; // Round 5: legacy anchor removed; per-skill clarification is the only path
  // Caroline 5/22 sketch: "if skill is ambiguous AI requests the industry
  // clarification." When the user types a skill that lives in 2+ industries
  // AND their domain anchor doesn't cover it, we pause the add and show a
  // chip picker — they confirm which industry they meant before it joins
  // the basket. Prevents "Management" silently locking to Healthcare just
  // because the user picked that domain.
  const [pendingClarification, setPendingClarification] = useState<{
    rawSkill: string;
    industries: string[];
  } | null>(null);

  // Caroline 7/18 Round 5: legacy payranker_domain from Round 3 was still
  // forcing the AI to interpret every subsequent skill through the anchor's
  // lens (Charles → Creative Direction → Children's Activity Design because
  // caregiving was the anchor). Wipe on load so returning users get a clean
  // slate; per-skill clarification is now the only path for attaching
  // industry context.
  useEffect(() => {
    if (typeof window !== "undefined") localStorage.removeItem("payranker_domain");
  }, []);
  void getDomainById; // legacy import kept for now
  void router; // referenced elsewhere

  // Load saved skills — also re-runs when the page is restored from
  // browser back-forward cache (bfcache).
  // Caroline's beta tester Rosalyn (5/4) reported that hitting "back"
  // from /jobs left the "See your matches" CTA greyed out because
  // bfcache restored the React state from before useEffect ran. The
  // pageshow listener with event.persisted catches that case.
  useEffect(() => {
    function loadSkills() {
      const saved = localStorage.getItem("payranker_skills");
      if (saved) {
        try {
          setSkills(JSON.parse(saved));
        } catch {}
      }
    }
    loadSkills();

    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) loadSkills();
    };
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, []);

  // Save skills to localStorage
  useEffect(() => {
    if (skills.length > 0) {
      localStorage.setItem("payranker_skills", JSON.stringify(skills));
    }
  }, [skills]);

  // Sync basket to the DB so Skilmatch can see real candidates.
  // Debounced: fires 800ms after the basket goes idle so we don't hit
  // the route on every keystroke. Requires an anonymousHandle (which
  // /matches generates automatically). No-op until that exists.
  useEffect(() => {
    if (skills.length === 0) return;
    if (typeof window === "undefined") return;
    let handle = localStorage.getItem("payranker_handle");
    if (!handle) {
      // Generate one now so the first sync has a key. Matches the
      // syllable scheme used elsewhere (/matches).
      const syl = ["kee","joo","mee","too","noo","bee","zee","loo","ka","to","bu","mi","ze","ri","lu","na","fi","da"];
      const s1 = syl[Math.floor(Math.random() * syl.length)];
      const s2 = syl[Math.floor(Math.random() * syl.length)];
      handle = `${s1}${s2}${Math.floor(100 + Math.random() * 900)}`;
      localStorage.setItem("payranker_handle", handle);
    }
    const t = setTimeout(() => {
      void fetch("/api/users/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          anonymousHandle: handle,
          zipCode: undefined,
          profileComplete: localStorage.getItem("payranker_profile_complete")
            ? true
            : false,
          skills,
        }),
      }).catch(() => {
        // Non-blocking: localStorage remains the source of truth client-side
      });
    }, 800);
    return () => clearTimeout(t);
  }, [skills]);

  const normalizeAndAdd = useCallback(
    async (raw: string, bypassClarification = false, context?: string) => {
      const trimmed = raw.trim();
      if (!trimmed) return;

      // Phase-1 gate: don't accept another skill while suggestions for the
      // previous skill are still being fetched. Prevents state-race where
      // skill B's suggestions overwrite skill A's mid-render.
      if (isLoadingRef.current) return;

      if (
        skills.some(
          (s) => s.normalizedTerm.toLowerCase() === trimmed.toLowerCase()
        )
      )
        return;

      // Per-skill clarification gate. If the skill is ambiguous AND the
      // user's domain anchor doesn't disambiguate it, pause and ask.
      // bypassClarification=true is used by the picker chip once the
      // user has resolved the ambiguity. `context` carries which industry
      // they picked — stored on the skill so "Management (Logistics)"
      // travels with it through matching.
      //
      // We POST to /api/skills/clarify so the 900KB+ O*NET taxonomy
      // stays on the server. Fire-and-forget on network failure — better
      // to add the skill than to block on a timeout.
      if (!bypassClarification) {
        try {
          const res = await fetch("/api/skills/clarify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ skill: trimmed, domainId }),
          });
          const data = await res.json();
          if (data.candidates) {
            setPendingClarification({
              rawSkill: trimmed,
              industries: data.candidates,
            });
            setInput("");
            return;
          }
        } catch {
          // Network failure → proceed without clarification rather than
          // blocking the worker.
        }
      }

      // OPTIMISTIC UI: add the skill immediately so the user sees their input
      const optimisticSkill: Skill = {
        rawInput: trimmed,
        normalizedTerm: trimmed,
        category: "other",
        isAISuggested: false,
        aiResistanceScore: 50,
        context,
      };
      setSkills((prev) => [...prev, optimisticSkill]);
      setInput("");
      isLoadingRef.current = true;
      setIsLoading(true); // shows "Finding related skills..." indicator

      try {
        const res = await fetch("/api/skills/normalize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            rawSkill: trimmed,
            existingSkills: skills.map((s) => s.normalizedTerm),
            // Domain context anchors interpretation: "management" means
            // different things in healthcare vs. logistics vs. retail.
            domainId,
          }),
        });
        const data = await res.json();

        // Update the optimistic skill with the normalized term from AI
        if (data.normalizedTerm && data.normalizedTerm.toLowerCase() !== trimmed.toLowerCase()) {
          setSkills((prev) =>
            prev.map((s) =>
              s.normalizedTerm.toLowerCase() === trimmed.toLowerCase()
                ? {
                    ...s,
                    normalizedTerm: data.normalizedTerm,
                    category: data.category || "other",
                    aiResistanceScore: data.aiResistanceScore || 50,
                  }
                : s
            )
          );
        } else {
          // Just update the score/category in place
          setSkills((prev) =>
            prev.map((s) =>
              s.normalizedTerm.toLowerCase() === trimmed.toLowerCase()
                ? {
                    ...s,
                    category: data.category || "other",
                    aiResistanceScore: data.aiResistanceScore || 50,
                  }
                : s
            )
          );
        }

        // Update suggestions
        const finalNormalized = data.normalizedTerm || trimmed;
        const skillSet = new Set(
          [...skills.map((s) => s.normalizedTerm), finalNormalized].map((s) =>
            s.toLowerCase()
          )
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
        // Optimistic skill is already added, no need to do anything
      }
      isLoadingRef.current = false;
      setIsLoading(false);
    },
    [skills]
  );

  // Auto-add skill from URL param
  useEffect(() => {
    const skillParam = searchParams.get("skill");
    if (skillParam && skills.length === 0) {
      normalizeAndAdd(skillParam);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  function removeSkill(index: number) {
    setSkills((prev) => {
      const updated = prev.filter((_, i) => i !== index);
      localStorage.setItem("payranker_skills", JSON.stringify(updated));
      return updated;
    });
  }

  // Caroline 7/18 Round 5 P4: "Skills Basket reset should truly clear
  // prior state" — removing skills alone left the AI suggestions, the
  // legacy domain anchor, and the sync-handle in place, which was
  // surprising to users on shared devices. Reset means wipe.
  function resetBasket() {
    if (skills.length === 0) return;
    const confirmed = window.confirm(
      "Start over? This clears every skill in your basket and resets suggestions."
    );
    if (!confirmed) return;
    setSkills([]);
    setSuggestions([]);
    setInput("");
    setPendingClarification(null);
    if (typeof window !== "undefined") {
      localStorage.removeItem("payranker_skills");
      localStorage.removeItem("payranker_domain");
      localStorage.removeItem("payranker_metro");
    }
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
      <BetaBanner />
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
        {/* Caroline 6/27: removed the domain badge. Industry context now
            lives ON skills (via the per-skill clarification picker),
            not on the person. */}

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

          {/* Gradient-bordered input — memoized to keep Android keyboard open
              (Marielee's bug 4/26: keyboard dismissed on each keystroke).
              Wrapper dims while loading to signal input is temporarily
              blocked (Caroline's Phase-1 UX: one skill at a time). */}
          <div
            className={
              isLoading
                ? "opacity-50 pointer-events-none transition-opacity"
                : "transition-opacity"
            }
            aria-busy={isLoading}
          >
            <SkillInput
              value={input}
              onChange={setInput}
              onSubmit={(v) => normalizeAndAdd(v)}
            />
          </div>
          {/* Status line — Caroline 7/28 Round 7: the interruptor was too
              small to see; the user's eye jumps to the new pink pill in the
              basket. Big, high-contrast callout above the basket makes the
              "select any that apply, then add your next skill" loop
              obvious. */}
          {isLoading ? (
            <div
              role="status"
              className="mt-4 mx-auto max-w-2xl rounded-2xl border-2 border-magenta/40 bg-magenta/[0.06] px-5 py-4"
            >
              <p className="text-base sm:text-lg font-bold text-magenta flex items-start justify-center gap-2 leading-snug text-center">
                <Loader2 size={20} className="animate-spin shrink-0 mt-0.5" />
                <span>
                  Finding related skills below&hellip; Select any that apply,
                  then add your next skill.
                </span>
              </p>
            </div>
          ) : (
            <p className="text-xs text-graytext text-center mt-2 italic font-medium">
              Press Enter to add
            </p>
          )}

          {/* Per-skill industry clarification (Caroline 5/22 sketch).
              "Management" lives in many industries — make the user pick
              which one before it joins the basket. */}
          {pendingClarification && (
            <div className="mt-3 p-4 rounded-xl border-2 border-magenta/30 bg-magenta/5">
              <p className="text-sm font-semibold text-gray-800 mb-2">
                &ldquo;{pendingClarification.rawSkill}&rdquo; — which industry did you mean?
              </p>
              <div className="flex flex-wrap gap-2 mb-2">
                {pendingClarification.industries.map((ind) => (
                  <button
                    key={ind}
                    onClick={() => {
                      const raw = pendingClarification.rawSkill;
                      setPendingClarification(null);
                      // Attach the picked industry as `context` on the
                      // skill itself — not on the person. Pill renders as
                      // "Management (Logistics)" so the worker can see
                      // and edit the resolution.
                      void normalizeAndAdd(raw, true, ind);
                    }}
                    className="px-3 py-1.5 rounded-full text-sm font-semibold bg-white border-2 border-magenta/40 text-magenta hover:bg-magenta hover:text-white transition-colors"
                  >
                    {ind}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setPendingClarification(null)}
                className="text-xs text-graytext hover:text-magenta underline"
              >
                Cancel
              </button>
            </div>
          )}

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
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-bold text-graytext uppercase tracking-wider">
              Your Skills
            </p>
            {skills.length > 0 && (
              <button
                type="button"
                onClick={resetBasket}
                className="text-xs font-semibold text-graytext hover:text-magenta transition-colors underline underline-offset-2"
              >
                Start over
              </button>
            )}
          </div>
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
                    {s.context && (
                      <span className="text-[10px] font-semibold bg-white/25 px-1.5 py-0.5 rounded-full">
                        {s.context}
                      </span>
                    )}
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
              <p className="text-base text-magenta mt-3 font-semibold">
                Add {5 - skills.length} more skill
                {5 - skills.length !== 1 ? "s" : ""} to continue
              </p>
            )}
          </div>
        )}
      </main>
      <Footer />
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
