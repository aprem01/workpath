"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { ChevronDown } from "lucide-react";
import { DOMAINS } from "@/lib/domains";

export default function LandingPage() {
  const router = useRouter();
  const [domain, setDomain] = useState<string>("");
  const [skipped, setSkipped] = useState(false);
  const [skill, setSkill] = useState("");

  // Restore prior selection — pick OR skip.
  useEffect(() => {
    const saved = localStorage.getItem("payranker_domain");
    if (saved) setDomain(saved);
    if (localStorage.getItem("payranker_domain_skipped") === "true") {
      setSkipped(true);
    }
  }, []);

  function handleDomainChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value;
    setDomain(next);
    if (next) {
      localStorage.setItem("payranker_domain", next);
      // Picking a domain supersedes a prior Skip.
      localStorage.removeItem("payranker_domain_skipped");
      setSkipped(false);
    }
  }

  function handleSkip() {
    setSkipped(true);
    setDomain("");
    localStorage.setItem("payranker_domain_skipped", "true");
    localStorage.removeItem("payranker_domain");
  }

  const ready = Boolean(domain) || skipped;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = skill.trim();
    if (!ready || !trimmed) return;
    router.push(`/skills?skill=${encodeURIComponent(trimmed)}`);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "," && skill.trim() && ready) {
      e.preventDefault();
      router.push(
        `/skills?skill=${encodeURIComponent(skill.trim().replace(/,$/, ""))}`
      );
    }
  }

  const inputReady = ready;

  return (
    <div className="min-h-screen bg-warmwhite flex flex-col">
      {/* White top bar */}
      <header className="bg-white border-b border-gray-100 py-5 px-6">
        <div className="max-w-5xl mx-auto">
          <Image
            src="/payranker-logo.png"
            alt="PayRanker"
            width={220}
            height={46}
            priority
          />
        </div>
      </header>

      <main>
      {/* Headline + subtext flush-left with logo */}
      <section className="max-w-5xl mx-auto w-full px-6 pt-12">
        <h2 className="text-2xl sm:text-3xl lg:text-[2.5rem] font-semibold text-magenta-headline leading-tight mb-4 whitespace-normal sm:whitespace-nowrap">
          Find the highest-paying jobs for your skills.
        </h2>
        <p className="text-lg text-graytext mb-12 max-w-3xl font-medium">
          You have more skills than you think. Enter your skills and see which
          jobs pay the most.
        </p>
      </section>

      <section className="max-w-5xl mx-auto w-full px-6 pb-24">
        {/* STEP 1 — Background dropdown (now OPTIONAL — Caroline 6/9).
            Workers whose careers span industries can skip and let the
            per-skill clarification picker provide context per ambiguous
            skill instead of locking the whole profile to one domain. */}
        <div className="max-w-lg mx-auto">
          <p className="text-base font-semibold text-magenta text-center mb-3">
            What are you currently most active in?
          </p>

          <div
            className={`rounded-lg p-[2.5px] focus-within:p-[3px] transition-all relative ${
              skipped ? "opacity-40" : ""
            }`}
            style={{
              background: "linear-gradient(to right, #F6A21C, #E725E2)",
            }}
          >
            <select
              value={domain}
              onChange={handleDomainChange}
              aria-label="Choose what you're currently most active in"
              className="w-full px-5 py-3.5 text-base rounded-[6px] bg-white focus:outline-none text-center font-medium appearance-none cursor-pointer pr-12"
              style={{
                color: domain ? "#1f2937" : "#8C8C8C",
              }}
            >
              <option value="" disabled>
                Choose your current focus…
              </option>
              {DOMAINS.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label}
                </option>
              ))}
            </select>
            <ChevronDown
              size={18}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-magenta pointer-events-none"
            />
          </div>

          <div className="flex items-center justify-between mt-2">
            <p className="text-xs text-graytext italic font-medium">
              You can change this later
            </p>
            <button
              type="button"
              onClick={handleSkip}
              className={`text-xs font-semibold underline transition-colors ${
                skipped
                  ? "text-magenta"
                  : "text-graytext hover:text-magenta"
              }`}
            >
              {skipped ? "Skipped ✓" : "Skip if it varies"}
            </button>
          </div>
        </div>

        {/* STEP 2 — Skill input (enabled after domain pick) */}
        <div className="max-w-lg mx-auto mt-10">
          <p
            className={`text-lg font-semibold text-center mb-3 transition-colors ${
              inputReady ? "text-magenta" : "text-graylabel"
            }`}
          >
            Start with one skill
          </p>

          <form onSubmit={handleSubmit}>
            <div
              className={`rounded-lg p-[2.5px] focus-within:p-[3px] transition-all ${
                inputReady ? "" : "opacity-40"
              }`}
              style={{
                background:
                  "linear-gradient(to right, #F6A21C, #E725E2)",
              }}
            >
              <input
                type="text"
                value={skill}
                onChange={(e) => setSkill(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  inputReady
                    ? "ex: driving, cooking or sales"
                    : "Pick your background first ↑"
                }
                disabled={!inputReady}
                className="w-full px-5 py-3.5 text-base rounded-[6px] bg-white focus:outline-none placeholder:text-graylabel text-center font-medium disabled:cursor-not-allowed"
                inputMode="text"
                enterKeyHint="next"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
              />
            </div>
          </form>

          <p className="text-sm sm:text-base text-graytext text-center mt-2 italic font-medium">
            Press Enter to add
          </p>
        </div>
      </section>
      </main>
    </div>
  );
}
