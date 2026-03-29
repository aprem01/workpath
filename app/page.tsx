"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";

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
      {/* Nav */}
      <header className="py-6 px-4">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-2xl font-bold">
            <span className="text-magenta">Pay</span>
            <span className="text-amber">Ranker</span>
          </h1>
        </div>
      </header>

      {/* Hero */}
      <section className="flex-1 flex flex-col items-center px-4 pt-12 sm:pt-20 pb-24">
        <div className="max-w-2xl w-full text-center">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-magenta leading-tight mb-4">
            Find the highest-paying jobs for your skills.
          </h2>

          <p className="text-base text-gray-500 mb-10 max-w-md mx-auto">
            You have more skills than you think. Add a few and instantly see which jobs pay the most.
          </p>

          <form onSubmit={handleSubmit} className="relative max-w-sm mx-auto mb-2">
            <input
              type="text"
              value={skill}
              onChange={(e) => setSkill(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ex: cooking, caregiving, sales, coding"
              className="w-full px-5 py-3.5 text-base rounded-lg border-2 border-gray-200 bg-white focus:outline-none focus:border-magenta/40 focus:ring-2 focus:ring-magenta/10 transition-all placeholder:text-gray-400 text-center"
              autoFocus
            />
            {skill.trim() && (
              <button
                type="submit"
                className="absolute right-2 top-1/2 -translate-y-1/2 bg-magenta text-white p-2.5 rounded-full hover:bg-magenta-dark transition-colors"
              >
                <ArrowRight size={18} />
              </button>
            )}
          </form>

          <p className="text-xs text-gray-400">Press Enter to add</p>
        </div>
      </section>
    </div>
  );
}
