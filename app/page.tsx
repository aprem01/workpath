"use client";

import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Sparkles,
  Target,
  Heart,
  CheckCircle2,
  Shield,
  BrainCircuit,
  TrendingUp,
  BookOpen,
} from "lucide-react";

export default function LandingPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-offwhite">
      {/* Nav */}
      <header className="border-b border-gray-100 bg-white/60 backdrop-blur-sm sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="font-heading text-2xl font-bold text-gray-900">
            Work<span className="text-amber-primary">Path</span>
          </h1>
          <button
            onClick={() => router.push("/onboarding")}
            className="text-sm font-semibold text-teal-primary hover:text-teal-700 transition-colors"
          >
            Get started
          </button>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-5xl mx-auto px-4 pt-16 pb-20 sm:pt-24 sm:pb-28 relative overflow-hidden">
        {/* Animated glow behind hero */}
        <div className="hero-glow" aria-hidden="true" />

        <div className="max-w-2xl relative z-10">
          <h2 className="font-heading text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 leading-tight mb-6">
            Your skills are worth{" "}
            <span className="text-amber-primary">more than you think.</span>
          </h2>
          <p className="text-xl text-gray-600 mb-8 leading-relaxed">
            Tell us what you can do — we&apos;ll show you jobs that fit right
            now, the 1–2 steps to jobs that pay more, and how to stay ahead as
            AI changes the workforce.
          </p>
          <button
            onClick={() => router.push("/onboarding")}
            className="px-8 py-4 bg-amber-primary text-white font-bold text-lg rounded-xl hover:bg-amber-600 transition-all hover:shadow-lg hover:shadow-amber-primary/20 flex items-center gap-2 animate-gentle-pulse"
          >
            Start with your skills <ArrowRight size={20} />
          </button>
          <p className="text-sm text-gray-500 mt-3">
            No account needed. See results in 2 minutes.
          </p>
        </div>
      </section>

      {/* Value props */}
      <section className="bg-white border-y border-gray-100 scroll-reveal">
        <div className="max-w-5xl mx-auto px-4 py-16 sm:py-20">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="value-card rounded-2xl p-6 -m-6 cursor-default">
              <div className="w-12 h-12 rounded-xl bg-teal-primary/10 flex items-center justify-center mb-4">
                <Sparkles className="text-teal-primary" size={24} />
              </div>
              <h3 className="font-heading text-lg font-bold text-gray-900 mb-2">
                No resume needed
              </h3>
              <p className="text-gray-600 leading-relaxed text-sm">
                Enter your skills in plain English — &quot;cooking,&quot;
                &quot;driving,&quot; &quot;caring for people.&quot; Our AI
                understands what you mean.
              </p>
            </div>
            <div className="value-card rounded-2xl p-6 -m-6 cursor-default">
              <div className="w-12 h-12 rounded-xl bg-amber-primary/10 flex items-center justify-center mb-4">
                <Target className="text-amber-primary" size={24} />
              </div>
              <h3 className="font-heading text-lg font-bold text-gray-900 mb-2">
                See exactly what&apos;s missing
              </h3>
              <p className="text-gray-600 leading-relaxed text-sm">
                Not just rejections — a clear path. We show you the 1–2 skills
                between you and a better-paying job, with free ways to learn
                them.
              </p>
            </div>
            <div className="value-card rounded-2xl p-6 -m-6 cursor-default">
              <div className="w-12 h-12 rounded-xl bg-indigo-100 flex items-center justify-center mb-4">
                <Shield className="text-indigo-600" size={24} />
              </div>
              <h3 className="font-heading text-lg font-bold text-gray-900 mb-2">
                AI-proof your career
              </h3>
              <p className="text-gray-600 leading-relaxed text-sm">
                See which of your skills are safe from automation and which ones
                to strengthen. Stay ahead of the curve, not behind it.
              </p>
            </div>
            <div className="value-card rounded-2xl p-6 -m-6 cursor-default">
              <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center mb-4">
                <Heart className="text-emerald-600" size={24} />
              </div>
              <h3 className="font-heading text-lg font-bold text-gray-900 mb-2">
                Free for job seekers
              </h3>
              <p className="text-gray-600 leading-relaxed text-sm">
                We charge employers who want to find great candidates — not you.
                Your job search should never cost you money.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Upskill & AI Section */}
      <section className="ai-section-gradient scroll-reveal">
        <div className="max-w-5xl mx-auto px-4 py-16 sm:py-20">
          <div className="text-center mb-12">
            <h2 className="font-heading text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              AI is changing work.{" "}
              <span className="bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 bg-clip-text text-transparent bg-[length:200%_auto] animate-gradient-shift">
                We help you stay ready.
              </span>
            </h2>
            <p className="text-gray-600 text-lg max-w-2xl mx-auto">
              Some jobs are being automated. Others are growing. WorkPath tells
              you exactly where you stand and what to do about it.
            </p>
          </div>

          <div className="grid sm:grid-cols-3 gap-6">
            <div className="value-card bg-white rounded-xl border border-gray-200 p-6">
              <div className="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center mb-4">
                <BrainCircuit className="text-red-500" size={20} />
              </div>
              <h3 className="font-heading font-bold text-gray-900 mb-2">
                Know your AI risk
              </h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                Our AI career roadmap scans your skills and tells you which ones
                are safe from automation and which ones need attention. No
                guessing.
              </p>
            </div>
            <div className="value-card bg-white rounded-xl border border-gray-200 p-6">
              <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center mb-4">
                <BookOpen className="text-emerald-600" size={20} />
              </div>
              <h3 className="font-heading font-bold text-gray-900 mb-2">
                Free upskill resources
              </h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                For every skill gap, we link you to free or low-cost training —
                Red Cross, Khan Academy, YouTube, government programs. Learn on
                your schedule.
              </p>
            </div>
            <div className="value-card bg-white rounded-xl border border-gray-200 p-6">
              <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center mb-4">
                <TrendingUp className="text-amber-600" size={20} />
              </div>
              <h3 className="font-heading font-bold text-gray-900 mb-2">
                Career paths, not dead ends
              </h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                See exactly which roles you can reach in 2–6 months, what they
                pay, and the shortest path to get there. Your roadmap updates as
                you learn.
              </p>
            </div>
          </div>

          <div className="mt-10 text-center">
            <p className="text-sm text-indigo-700 font-medium bg-indigo-100/80 backdrop-blur-sm inline-flex items-center gap-2 px-4 py-2 rounded-full">
              <Shield size={16} />
              Human skills like empathy, physical care, and trust-building are
              AI-proof — and you probably already have them.
            </p>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="max-w-5xl mx-auto px-4 py-16 sm:py-20 scroll-reveal">
        <h2 className="font-heading text-3xl font-bold text-gray-900 mb-10 text-center">
          How it works
        </h2>
        <div className="grid sm:grid-cols-4 gap-6">
          {[
            {
              step: "1",
              title: "Tell us your skills",
              desc: "Type what you know. Our AI turns everyday words into professional terms that match real job listings.",
            },
            {
              step: "2",
              title: "See your matches",
              desc: "Instantly see jobs you qualify for today — and jobs that are just 1–2 skills away from your reach.",
            },
            {
              step: "3",
              title: "Close the gap",
              desc: "For each missing skill, we link you to free training. Mark it as learned and watch new jobs unlock.",
            },
            {
              step: "4",
              title: "Future-proof yourself",
              desc: "Get your AI career roadmap — see which skills are automation-proof and what to learn to stay ahead.",
            },
          ].map((item) => (
            <div key={item.step} className="text-center">
              <div className="w-10 h-10 rounded-full bg-amber-primary text-white font-bold flex items-center justify-center mx-auto mb-4 text-lg">
                {item.step}
              </div>
              <h3 className="font-heading font-bold text-gray-900 mb-2">
                {item.title}
              </h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                {item.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="bg-teal-primary text-white scroll-reveal">
        <div className="max-w-5xl mx-auto px-4 py-16 sm:py-20 text-center">
          <h2 className="font-heading text-3xl sm:text-4xl font-bold mb-4">
            Ready to find work that fits?
          </h2>
          <p className="text-teal-100 text-lg mb-8 max-w-xl mx-auto">
            Join Chicago workers who&apos;ve found better jobs through skills
            they already had — and learned the 1–2 things that unlocked even
            more.
          </p>
          <button
            onClick={() => router.push("/onboarding")}
            className="px-8 py-4 bg-white text-teal-primary font-bold text-lg rounded-xl hover:bg-gray-50 transition-all hover:shadow-lg hover:shadow-white/20 inline-flex items-center gap-2"
          >
            <CheckCircle2 size={20} />
            Get started — it&apos;s free
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400">
        <div className="max-w-5xl mx-auto px-4 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="font-heading text-white font-bold">
            Work<span className="text-amber-primary">Path</span>
          </p>
          <p className="text-sm">
            Helping Chicago workers find jobs, close skill gaps, and stay ahead
            of AI.
          </p>
        </div>
      </footer>
    </div>
  );
}
