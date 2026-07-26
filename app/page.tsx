"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Footer from "@/components/Footer";

/**
 * Landing page — Caroline 6/27 Round 4.
 *
 * Previously this page asked "What are you currently most active in?"
 * and forced a domain pick before the skill input could be used. Two
 * problems Caroline surfaced:
 *
 *  1. The question wasn't natural. A first-time user is trying to
 *     answer "Can this thing help me find jobs?" — not "Pick your
 *     industry." The dropdown required clicking to even understand
 *     the question, which is a warning sign.
 *
 *  2. The framing assumed industry IDENTITY. A massage therapist →
 *     flight attendant → luxury retail person doesn't have "one
 *     industry." Forcing them to pick one signaled "you have to fit
 *     into a box before we'll help you."
 *
 * The Skilmatch side already does the right thing — when a recruiter
 * types "Manager", Skilmatch asks "what kind?" PayRanker should
 * mirror that: classify SKILLS as they come in, not classify the
 * PERSON before they enter one. That happens via the per-skill
 * clarification picker on /skills, which has been live since June.
 *
 * So this page is now just headline → skill input. Location refines
 * later (on /matches and /jobs, via the metro picker there).
 */
export default function LandingPage() {
  const router = useRouter();
  const [skill, setSkill] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = skill.trim();
    if (!trimmed) return;
    router.push(`/skills?skill=${encodeURIComponent(trimmed)}`);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "," && skill.trim()) {
      e.preventDefault();
      router.push(
        `/skills?skill=${encodeURIComponent(skill.trim().replace(/,$/, ""))}`
      );
    }
  }

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

        {/* Skill-first input — the ONLY thing on landing now.
            Industry, location, and other refinements happen later. */}
        <section className="max-w-5xl mx-auto w-full px-6 pb-24">
          <div className="max-w-lg mx-auto">
            <p className="text-lg font-semibold text-center mb-3 text-magenta">
              Start with one skill
            </p>

            <form onSubmit={handleSubmit}>
              <div
                className="rounded-lg p-[2.5px] focus-within:p-[3px] transition-all"
                style={{
                  background: "linear-gradient(to right, #F6A21C, #E725E2)",
                }}
              >
                <input
                  type="text"
                  value={skill}
                  onChange={(e) => setSkill(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="ex: driving, cooking or sales"
                  autoFocus
                  className="w-full px-5 py-3.5 text-base rounded-[6px] bg-white focus:outline-none placeholder:text-graylabel text-center font-medium"
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
      <Footer />
    </div>
  );
}
