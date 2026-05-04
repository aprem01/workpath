"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

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

      {/* Headline + subtext flush-left with logo at all viewport widths */}
      <section className="max-w-5xl mx-auto w-full px-6 pt-12">
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-semibold text-magenta-headline leading-tight mb-3">
          Find the highest-paying jobs for your skills.
        </h2>
        <p className="text-base text-graytext mb-12 max-w-2xl font-medium">
          You have more skills than you think. Enter your skills and see which
          jobs pay the most.
        </p>
      </section>

      {/* Centered input section */}
      <section className="max-w-5xl mx-auto w-full px-6 pb-24">
        <div className="max-w-lg mx-auto">
          <p className="text-lg font-semibold text-magenta text-center mb-3">
            Start with one skill
          </p>

          {/* Gradient-bordered input: orange F6A21C → pink E725E2 */}
          <form onSubmit={handleSubmit}>
            <div
              className="rounded-lg p-[2.5px] focus-within:p-[3px] transition-all"
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
                placeholder="ex: driving, cooking or sales"
                className="w-full px-5 py-3.5 text-base rounded-[6px] bg-white focus:outline-none placeholder:text-graylabel text-center font-medium"
                inputMode="text"
                enterKeyHint="next"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
              />
            </div>
          </form>

          <p className="text-xs text-graytext text-center mt-2 italic font-medium">
            Press Enter to add
          </p>
        </div>
      </section>
    </div>
  );
}
