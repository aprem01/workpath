"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

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
      {/* White top bar — will hold nav later */}
      <header className="bg-white border-b border-gray-100 py-5 px-6">
        <div className="max-w-5xl mx-auto">
          {/* Logo placeholder — to be replaced with PNG file from Caroline */}
          <h1 className="text-3xl font-bold tracking-tight">
            <span className="text-magenta">Pay</span>
            <span className="text-amber">Ranker</span>
          </h1>
        </div>
      </header>

      <main className="flex-1 max-w-5xl mx-auto w-full px-6 pt-12 pb-24">
        {/* Headline — flush left, large tagline */}
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-semibold text-magenta-headline leading-tight mb-3">
          Find the highest-paying jobs for your skills.
        </h2>
        <p className="text-base text-graytext mb-16 max-w-2xl">
          You have more skills than you think. Enter your skills and see which
          jobs pay the most.
        </p>

        {/* Centered input section */}
        <div className="max-w-md mx-auto">
          <p className="text-sm font-semibold text-magenta text-center mb-3">
            Start with one skill
          </p>

          <form onSubmit={handleSubmit} className="relative">
            <input
              type="text"
              value={skill}
              onChange={(e) => setSkill(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="ex: driving, cooking or sales"
              className="w-full px-5 py-3.5 text-base rounded-lg border-2 border-magenta/30 bg-white focus:outline-none focus:border-magenta focus:ring-2 focus:ring-magenta/15 transition-all placeholder:text-graylabel text-center font-medium"
              autoFocus
            />
          </form>

          <p className="text-xs text-graytext text-center mt-2 italic font-medium">
            Press Enter to add
          </p>
        </div>
      </main>
    </div>
  );
}
