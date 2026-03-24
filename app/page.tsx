"use client";

import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Sparkles,
  Target,
  Heart,
  CheckCircle2,
} from "lucide-react";

export default function LandingPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-offwhite">
      {/* Nav */}
      <header className="border-b border-gray-100 bg-white/60 backdrop-blur-sm">
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
      <section className="max-w-5xl mx-auto px-4 pt-16 pb-20 sm:pt-24 sm:pb-28">
        <div className="max-w-2xl">
          <h2 className="font-heading text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 leading-tight mb-6">
            Your skills are worth{" "}
            <span className="text-amber-primary">more than you think.</span>
          </h2>
          <p className="text-xl text-gray-600 mb-8 leading-relaxed">
            Tell us what you can do — we&apos;ll show you jobs that fit right
            now, and the 1–2 steps to jobs that pay more.
          </p>
          <button
            onClick={() => router.push("/onboarding")}
            className="px-8 py-4 bg-amber-primary text-white font-bold text-lg rounded-xl hover:bg-amber-600 transition-all hover:shadow-lg hover:shadow-amber-primary/20 flex items-center gap-2"
          >
            Start with your skills <ArrowRight size={20} />
          </button>
          <p className="text-sm text-gray-500 mt-3">
            No account needed. See results in 2 minutes.
          </p>
        </div>
      </section>

      {/* Value props */}
      <section className="bg-white border-y border-gray-100">
        <div className="max-w-5xl mx-auto px-4 py-16 sm:py-20">
          <div className="grid sm:grid-cols-3 gap-8 sm:gap-12">
            <div>
              <div className="w-12 h-12 rounded-xl bg-teal-primary/10 flex items-center justify-center mb-4">
                <Sparkles className="text-teal-primary" size={24} />
              </div>
              <h3 className="font-heading text-lg font-bold text-gray-900 mb-2">
                No resume needed
              </h3>
              <p className="text-gray-600 leading-relaxed">
                Enter your skills in plain English — &quot;cooking,&quot;
                &quot;driving,&quot; &quot;caring for people.&quot; Our AI
                understands what you mean.
              </p>
            </div>
            <div>
              <div className="w-12 h-12 rounded-xl bg-amber-primary/10 flex items-center justify-center mb-4">
                <Target className="text-amber-primary" size={24} />
              </div>
              <h3 className="font-heading text-lg font-bold text-gray-900 mb-2">
                See exactly what&apos;s missing
              </h3>
              <p className="text-gray-600 leading-relaxed">
                Not just rejections — a clear path. We show you the 1–2 skills
                between you and a better-paying job, with free ways to learn
                them.
              </p>
            </div>
            <div>
              <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center mb-4">
                <Heart className="text-emerald-600" size={24} />
              </div>
              <h3 className="font-heading text-lg font-bold text-gray-900 mb-2">
                Free for job seekers, always
              </h3>
              <p className="text-gray-600 leading-relaxed">
                We charge employers who want to find great candidates — not you.
                Your job search should never cost you money.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="max-w-5xl mx-auto px-4 py-16 sm:py-20">
        <h2 className="font-heading text-3xl font-bold text-gray-900 mb-10 text-center">
          How it works
        </h2>
        <div className="grid sm:grid-cols-3 gap-8">
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
              desc: "For each missing skill, we link you to free or low-cost training. Mark it as learned and watch new jobs unlock.",
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
      <section className="bg-teal-primary text-white">
        <div className="max-w-5xl mx-auto px-4 py-16 sm:py-20 text-center">
          <h2 className="font-heading text-3xl sm:text-4xl font-bold mb-4">
            Ready to find work that fits?
          </h2>
          <p className="text-teal-100 text-lg mb-8 max-w-xl mx-auto">
            Join hundreds of Chicago workers who&apos;ve found better jobs
            through skills they already had.
          </p>
          <button
            onClick={() => router.push("/onboarding")}
            className="px-8 py-4 bg-white text-teal-primary font-bold text-lg rounded-xl hover:bg-gray-50 transition-colors inline-flex items-center gap-2"
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
            Helping Chicago workers find jobs that fit. MVP — Home Health Aide
            vertical.
          </p>
        </div>
      </footer>
    </div>
  );
}
