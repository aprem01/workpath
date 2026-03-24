"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, ArrowLeft, Sparkles, Loader2, MapPin, Check } from "lucide-react";
import { getProfilesState, addProfile, updateProfile } from "@/lib/profiles";
import SkillPill from "@/components/SkillPill";
import ProgressBar from "@/components/ProgressBar";

interface Skill {
  id: string;
  rawInput: string;
  normalizedTerm: string;
  category: string;
  proficiencyLevel: string;
  isAISuggested: boolean;
}

interface NormalizeResponse {
  normalizedTerm: string;
  category: string;
  proficiencyLevel: string;
  isRecognized: boolean;
  aiSuggestions: string[];
  note: string;
}

// Sparkle colors from the design system
const SPARKLE_COLORS = ["#0D9488", "#F5A623", "#6366f1", "#10b981", "#f43f5e"];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [situation, setSituation] = useState("");
  const [openToLearning, setOpenToLearning] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [showCelebration, setShowCelebration] = useState(false);
  const [sparkles, setSparkles] = useState<Array<{ id: number; x: number; y: number; color: string }>>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const skillsContainerRef = useRef<HTMLDivElement>(null);
  const prevSkillCount = useRef(0);

  // Celebrate when hitting 8 skills
  useEffect(() => {
    if (skills.length >= 8 && prevSkillCount.current < 8) {
      setShowCelebration(true);
      const timer = setTimeout(() => setShowCelebration(false), 1200);
      return () => clearTimeout(timer);
    }
    prevSkillCount.current = skills.length;
  }, [skills.length]);

  // Spawn sparkle particles on skill add
  const spawnSparkles = useCallback(() => {
    if (!skillsContainerRef.current) return;
    const rect = skillsContainerRef.current.getBoundingClientRect();
    const newSparkles = Array.from({ length: 6 }, (_, i) => ({
      id: Date.now() + i,
      x: Math.random() * rect.width,
      y: Math.random() * 20,
      color: SPARKLE_COLORS[Math.floor(Math.random() * SPARKLE_COLORS.length)],
    }));
    setSparkles(newSparkles);
    setTimeout(() => setSparkles([]), 700);
  }, []);

  const addSkill = async (raw: string, isFromSuggestion = false) => {
    const trimmed = raw.trim();
    if (!trimmed) return;

    setIsLoading(true);
    setSuggestions([]);

    try {
      const res = await fetch("/api/skills/normalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rawSkill: trimmed,
          existingSkills: skills.map((s) => s.normalizedTerm),
        }),
      });

      const data: NormalizeResponse = await res.json();

      // Don't add duplicates
      if (
        skills.some(
          (s) =>
            s.normalizedTerm.toLowerCase() ===
            data.normalizedTerm.toLowerCase()
        )
      ) {
        setIsLoading(false);
        setInputValue("");
        return;
      }

      const newSkill: Skill = {
        id: crypto.randomUUID(),
        rawInput: trimmed,
        normalizedTerm: data.normalizedTerm,
        category: data.category,
        proficiencyLevel: data.proficiencyLevel,
        isAISuggested: isFromSuggestion,
      };

      setSkills((prev) => [...prev, newSkill]);
      spawnSparkles();
      setSuggestions(
        data.aiSuggestions.filter(
          (s) =>
            !skills.some(
              (sk) => sk.normalizedTerm.toLowerCase() === s.toLowerCase()
            )
        )
      );
      setInputValue("");
    } catch {
      // Fallback
      const newSkill: Skill = {
        id: crypto.randomUUID(),
        rawInput: trimmed,
        normalizedTerm: trimmed.toLowerCase(),
        category: "other",
        proficiencyLevel: "beginner",
        isAISuggested: isFromSuggestion,
      };
      setSkills((prev) => [...prev, newSkill]);
      spawnSparkles();
      setInputValue("");
    }

    setIsLoading(false);
    inputRef.current?.focus();
  };

  const removeSkill = (id: string) => {
    setSkills((prev) => prev.filter((s) => s.id !== id));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      if (!isLoading) {
        addSkill(inputValue);
      }
    }
  };

  const handleFinish = () => {
    // Store skills in localStorage for the dashboard to pick up
    const skillData = skills.map((s) => ({
      normalizedTerm: s.normalizedTerm,
      category: s.category,
      proficiencyLevel: s.proficiencyLevel,
      rawInput: s.rawInput,
      isAISuggested: s.isAISuggested,
    }));
    localStorage.setItem("workpath_skills", JSON.stringify(skillData));
    localStorage.setItem(
      "workpath_user_profile",
      JSON.stringify({ situation, openToLearning, zipCode })
    );
    // Sync with profile system
    const state = getProfilesState();
    if (state.activeProfileId) {
      // Update existing active profile
      updateProfile(state.activeProfileId, { skills: skillData });
    } else {
      // First time — create a profile
      addProfile("My Skills", skillData);
    }
    router.push("/dashboard");
  };

  return (
    <div className="min-h-screen bg-offwhite">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="font-heading text-xl font-bold text-gray-900">
            Work<span className="text-amber-primary">Path</span>
          </h1>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            Step {step} of 3
          </div>
        </div>
      </header>

      {/* Step indicator */}
      <div className="max-w-2xl mx-auto px-4 pt-6">
        <div className="flex gap-2">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${
                s <= step ? "bg-teal-primary" : "bg-gray-200"
              }`}
            />
          ))}
        </div>
      </div>

      <main className="max-w-2xl mx-auto px-4 py-8 overflow-hidden">
        {/* Step 1: Skills */}
        {step === 1 && (
          <div className="animate-slide-in-right">
            <h2 className="font-heading text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
              What can you do?
            </h2>
            <p className="text-gray-600 mb-6">
              Type any skill you have — cooking, driving, taking care of people,
              anything counts. We&apos;ll match you with real jobs.
            </p>

            {/* Skill input */}
            <div className="relative mb-4">
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type a skill and press Enter..."
                disabled={isLoading}
                className="w-full px-4 py-3.5 rounded-xl border-2 border-gray-200 focus:border-teal-primary focus:ring-2 focus:ring-teal-primary/20 outline-none text-lg transition-all disabled:opacity-50 bg-white"
              />
              {isLoading && (
                <div className="absolute right-4 top-1/2 -translate-y-1/2">
                  <Loader2 className="animate-spin text-teal-primary" size={20} />
                </div>
              )}
            </div>

            {/* Skill pills with sparkle effect */}
            {skills.length > 0 && (
              <div ref={skillsContainerRef} className={`relative flex flex-wrap gap-2 mb-4 rounded-xl p-3 -mx-3 transition-all ${showCelebration ? "celebration-ring bg-teal-primary/5" : ""}`}>
                {/* Sparkle particles */}
                {sparkles.map((s) => (
                  <span
                    key={s.id}
                    className="sparkle-particle"
                    style={{
                      left: s.x,
                      top: s.y,
                      backgroundColor: s.color,
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      ["--sx" as any]: `${(Math.random() - 0.5) * 40}px`,
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      ["--sy" as any]: `${-20 - Math.random() * 30}px`,
                    }}
                  />
                ))}

                {/* Celebration checkmark */}
                {showCelebration && (
                  <div className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-teal-primary text-white flex items-center justify-center animate-sparkle-burst z-10">
                    <Check size={16} strokeWidth={3} />
                  </div>
                )}

                {skills.map((skill) => (
                  <SkillPill
                    key={skill.id}
                    term={skill.normalizedTerm}
                    category={skill.category}
                    isAISuggested={skill.isAISuggested}
                    onRemove={() => removeSkill(skill.id)}
                    animate
                  />
                ))}
              </div>
            )}

            {/* AI Suggestions */}
            {suggestions.length > 0 && (
              <div className="mb-6 p-4 bg-amber-primary/5 rounded-xl border border-amber-primary/20">
                <p className="text-sm text-gray-600 mb-2 flex items-center gap-1.5">
                  <Sparkles size={14} className="text-amber-primary" />
                  You might also know:
                </p>
                <div className="flex flex-wrap gap-2">
                  {suggestions.map((s) => (
                    <span key={s} className="animate-suggestion-pulse rounded-full">
                      <SkillPill
                        term={s}
                        variant="suggestion"
                        onClick={() => addSkill(s, true)}
                      />
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Progress */}
            <div className="mb-8">
              <ProgressBar
                value={skills.length}
                max={8}
                label={
                  skills.length < 8
                    ? `You've added ${skills.length} skill${skills.length !== 1 ? "s" : ""}. Most matches happen at 8+.`
                    : `Great! ${skills.length} skills added — you're ready for strong matches.`
                }
              />
            </div>

            <button
              onClick={() => setStep(2)}
              disabled={skills.length === 0}
              className="w-full sm:w-auto px-8 py-3.5 bg-teal-primary text-white font-semibold rounded-xl hover:bg-teal-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              Continue <ArrowRight size={18} />
            </button>
          </div>
        )}

        {/* Step 2: Situation */}
        {step === 2 && (
          <div className="animate-slide-in-right">
            <h2 className="font-heading text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
              Tell us about your situation
            </h2>
            <p className="text-gray-600 mb-8">
              This helps us show you the most helpful jobs first.
            </p>

            <div className="space-y-3 mb-8">
              <p className="font-medium text-gray-800">
                What best describes you?
              </p>
              {[
                { value: "lost_job", label: "I lost my job recently" },
                { value: "better_job", label: "I want a better job" },
                { value: "exploring", label: "I\u2019m exploring options" },
              ].map((opt) => (
                <label
                  key={opt.value}
                  className={`radio-premium flex items-center gap-4 p-5 rounded-xl border-2 cursor-pointer ${
                    situation === opt.value
                      ? "border-teal-primary bg-teal-primary/5 shadow-sm"
                      : "border-gray-200 hover:border-gray-300 bg-white"
                  }`}
                >
                  <input
                    type="radio"
                    name="situation"
                    value={opt.value}
                    checked={situation === opt.value}
                    onChange={(e) => setSituation(e.target.value)}
                    className="sr-only"
                  />
                  <div
                    className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors duration-200 ${
                      situation === opt.value
                        ? "border-teal-primary bg-teal-primary/10"
                        : "border-gray-300"
                    }`}
                  >
                    <div
                      className={`w-3 h-3 rounded-full bg-teal-primary radio-dot ${
                        situation === opt.value
                          ? "radio-dot-active"
                          : "radio-dot-inactive"
                      }`}
                    />
                  </div>
                  <span className="text-gray-800 font-medium">{opt.label}</span>
                </label>
              ))}
            </div>

            <div className="space-y-3 mb-8">
              <p className="font-medium text-gray-800">
                Are you open to learning 1–2 new skills?
              </p>
              {[
                { value: "yes", label: "Yes, I\u2019m open to it" },
                { value: "no", label: "Not right now" },
              ].map((opt) => (
                <label
                  key={opt.value}
                  className={`radio-premium flex items-center gap-4 p-5 rounded-xl border-2 cursor-pointer ${
                    openToLearning === opt.value
                      ? "border-teal-primary bg-teal-primary/5 shadow-sm"
                      : "border-gray-200 hover:border-gray-300 bg-white"
                  }`}
                >
                  <input
                    type="radio"
                    name="learning"
                    value={opt.value}
                    checked={openToLearning === opt.value}
                    onChange={(e) => setOpenToLearning(e.target.value)}
                    className="sr-only"
                  />
                  <div
                    className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors duration-200 ${
                      openToLearning === opt.value
                        ? "border-teal-primary bg-teal-primary/10"
                        : "border-gray-300"
                    }`}
                  >
                    <div
                      className={`w-3 h-3 rounded-full bg-teal-primary radio-dot ${
                        openToLearning === opt.value
                          ? "radio-dot-active"
                          : "radio-dot-inactive"
                      }`}
                    />
                  </div>
                  <span className="text-gray-800 font-medium">{opt.label}</span>
                </label>
              ))}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep(1)}
                className="px-6 py-3.5 border-2 border-gray-200 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition-colors flex items-center gap-2"
              >
                <ArrowLeft size={18} /> Back
              </button>
              <button
                onClick={() => setStep(3)}
                disabled={!situation || !openToLearning}
                className="flex-1 sm:flex-none px-8 py-3.5 bg-teal-primary text-white font-semibold rounded-xl hover:bg-teal-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                Continue <ArrowRight size={18} />
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Location */}
        {step === 3 && (
          <div className="animate-slide-in-right">
            <h2 className="font-heading text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
              Where are you looking for work?
            </h2>
            <p className="text-gray-600 mb-8">
              We&apos;ll show you jobs near you first.
            </p>

            <div className="relative mb-8">
              <MapPin
                className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
                size={20}
              />
              <input
                type="text"
                value={zipCode}
                onChange={(e) =>
                  setZipCode(e.target.value.replace(/\D/g, "").slice(0, 5))
                }
                placeholder="Enter your zip code"
                className="w-full pl-12 pr-4 py-3.5 rounded-xl border-2 border-gray-200 focus:border-teal-primary focus:ring-2 focus:ring-teal-primary/20 outline-none text-lg transition-all bg-white"
                inputMode="numeric"
              />
            </div>

            {/* Summary */}
            <div className="p-5 bg-white rounded-xl border border-gray-200 mb-8">
              <h3 className="font-heading font-semibold text-gray-900 mb-3">
                Your profile summary
              </h3>
              <div className="flex flex-wrap gap-2 mb-3">
                {skills.slice(0, 6).map((s) => (
                  <SkillPill
                    key={s.id}
                    term={s.normalizedTerm}
                    category={s.category}
                  />
                ))}
                {skills.length > 6 && (
                  <span className="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium bg-gray-100 text-gray-600">
                    +{skills.length - 6} more
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-500">
                {skills.length} skills ·{" "}
                {situation === "lost_job"
                  ? "Recently displaced"
                  : situation === "better_job"
                  ? "Looking for better work"
                  : "Exploring options"}{" "}
                · {openToLearning === "yes" ? "Open to learning" : "Not learning right now"}
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep(2)}
                className="px-6 py-3.5 border-2 border-gray-200 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition-colors flex items-center gap-2"
              >
                <ArrowLeft size={18} /> Back
              </button>
              <button
                onClick={handleFinish}
                disabled={zipCode.length < 5}
                className="flex-1 sm:flex-none px-8 py-3.5 bg-amber-primary text-white font-bold rounded-xl hover:bg-amber-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-lg"
              >
                Find my jobs <ArrowRight size={18} />
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
