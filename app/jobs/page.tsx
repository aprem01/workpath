"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2, ChevronDown } from "lucide-react";

interface JobMatch {
  id: string;
  title: string;
  employer: string;
  location: string;
  payMin: number;
  payMax: number;
  payType: string;
  shiftType: string;
  description: string;
  schedule?: string;
  matchedRequired: number;
  totalRequired: number;
  matchedOptional: number;
  totalOptional: number;
  optionalScore: number;
  missingSkills: string[];
  requiredSkills: { normalizedTerm: string; isRequired: boolean }[];
  isReal?: boolean;
  applyUrl?: string;
}

interface Skill {
  normalizedTerm: string;
}

function formatPay(cents: number) {
  return `$${(cents / 100).toFixed(0)}`;
}

function shiftLabel(s: string) {
  const map: Record<string, string> = {
    full_time: "Full-time",
    part_time: "Part-time",
    per_diem: "Per diem",
    contract: "Contract",
  };
  return map[s] || s;
}

export default function JobsPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"qualified" | "gap">("qualified");
  const [qualifiedJobs, setQualifiedJobs] = useState<JobMatch[]>([]);
  const [gapJobs, setGapJobs] = useState<JobMatch[]>([]);
  // realJobs removed — all jobs now come from Adzuna via qualifiedJobs/gapJobs
  const [skills, setSkills] = useState<Skill[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedJob, setExpandedJob] = useState<string | null>(null);
  const [appliedJobs, setAppliedJobs] = useState<Set<string>>(new Set());
  const [profileLevel, setProfileLevel] = useState<string | null>(null);

  useEffect(() => {
    const profile = localStorage.getItem("payranker_profile_complete");

    // No profile at all → must create basic profile first
    if (!profile) {
      router.push("/profile");
      return;
    }

    setProfileLevel(profile);

    const saved = localStorage.getItem("payranker_skills");
    if (!saved) {
      router.push("/profile");
      return;
    }

    const parsed: Skill[] = JSON.parse(saved);
    setSkills(parsed);

    const applied = localStorage.getItem("payranker_applied");
    if (applied) setAppliedJobs(new Set(JSON.parse(applied)));

    async function fetchJobs() {
      try {
        const res = await fetch("/api/jobs/match", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userSkills: parsed.map((s: Skill) => ({
              normalizedTerm: s.normalizedTerm,
              proficiencyLevel: "intermediate",
            })),
          }),
        });
        const data = await res.json();
        const sortByPay = (a: JobMatch, b: JobMatch) => b.payMax - a.payMax;
        setQualifiedJobs((data.qualifiedJobs || []).sort(sortByPay));
        setGapJobs((data.gapJobs || []).sort(sortByPay));
        // realJobs no longer used — all jobs are Adzuna results
      } catch {
        /* network error — show empty state */
      }
      setIsLoading(false);
    }
    fetchJobs();
  }, [router]);

  // userSkillSet no longer needed — Adzuna jobs don't have structured requiredSkills
  void skills; // keep skills in state for future use

  function applyToJob(jobId: string) {
    const updated = new Set(appliedJobs);
    updated.add(jobId);
    setAppliedJobs(updated);
    localStorage.setItem(
      "payranker_applied",
      JSON.stringify(Array.from(updated))
    );
  }

  /* ------------------------------------------------------------------ */
  /*  Job row                                                            */
  /* ------------------------------------------------------------------ */
  function renderJobRow(job: JobMatch, isGap: boolean) {
    const isExpanded = expandedJob === job.id;
    const isApplied = appliedJobs.has(job.id);

    // For Tab B (gap jobs), hide employer name with "---" placeholder
    // until user completes profile
    const employerDisplay = isGap ? "---" : job.employer;

    // Location modality (Caroline's spec: "On-site • Full-time")
    // Default to On-site since most HHA jobs are
    const locationMode = "On-site";

    return (
      <div key={job.id}>
        {/* ---- Collapsed row ---- */}
        <button
          onClick={() => setExpandedJob(isExpanded ? null : job.id)}
          className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors
                     flex items-center gap-3 border-b border-gray-100"
        >
          {/* Left: title + employer + location */}
          <div className="flex-1 min-w-0">
            <p className="font-bold text-gray-900 text-sm truncate">
              {job.title}
            </p>
            <p className={`text-xs font-semibold truncate ${isGap ? "text-graytext" : "text-amber"}`}>
              {employerDisplay}
            </p>
            <p className="text-xs text-graytext truncate">
              {job.location.split(",")[0]}
            </p>
            {/* Show missing skills in collapsed row for gap jobs */}
            {isGap && job.missingSkills.length > 0 && !isExpanded && (
              <p className="text-[11px] text-amber-dark mt-0.5 truncate">
                Need: {job.missingSkills.join(", ")}
              </p>
            )}
          </div>

          {/* Meta chips: On-site • Full-time */}
          <span className="text-xs text-graytext whitespace-nowrap hidden sm:inline">
            {locationMode}
          </span>
          <span className="text-xs text-graytext whitespace-nowrap hidden sm:inline">
            {shiftLabel(job.shiftType)}
          </span>

          {/* Pay — always visible */}
          <span className="text-sm font-bold text-gray-900 whitespace-nowrap">
            {formatPay(job.payMax)}/hr
          </span>

          <ChevronDown
            size={16}
            className={`text-graytext shrink-0 transition-transform ${
              isExpanded ? "rotate-180" : ""
            }`}
          />
        </button>

        {/* ---- Expanded detail ---- */}
        {isExpanded && (
          <div className="px-4 py-4 bg-gray-50 border-b border-gray-100 animate-fade-in">
            {/* Description */}
            <p className="text-sm text-gray-600 mb-3 leading-relaxed">
              {job.description}
            </p>

            {/* Schedule */}
            {job.schedule && (
              <p className="text-sm text-gray-500 mb-3">{job.schedule}</p>
            )}

            {/* Gap-specific: missing skills callout */}
            {isGap && job.missingSkills.length > 0 && (
              <div className="bg-amber-light rounded-lg p-3 mb-4">
                <p className="text-xs font-semibold text-amber-dark mb-1">
                  Additional skills may help you stand out:
                </p>
                {job.missingSkills.map((ms) => (
                  <p
                    key={ms}
                    className="text-sm text-amber-dark flex items-center gap-2"
                  >
                    <span className="text-amber">+</span> {ms}
                  </p>
                ))}
              </div>
            )}

            {/* CTA — depends on whether it's a gap job or qualified */}
            {isGap ? (
              // Tab B: redirect to upskill/training, NOT apply (they don't have the skills yet)
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  router.push("/skills");
                }}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full
                           font-bold text-white bg-magenta hover:bg-magenta-dark
                           transition-colors text-sm"
              >
                Explore these skills <ArrowRight size={14} />
              </button>
            ) : isApplied ? (
              <div>
                <span className="inline-flex items-center gap-1.5 px-5 py-2 rounded-full text-sm font-bold bg-gray-200 text-gray-500">
                  Applied
                </span>
              </div>
            ) : job.applyUrl ? (
              <a
                href={job.applyUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => {
                  e.stopPropagation();
                  applyToJob(job.id);
                }}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full
                           font-bold text-white bg-magenta hover:bg-magenta-dark
                           transition-colors text-sm"
              >
                Apply on company site <ArrowRight size={14} />
              </a>
            ) : (
              <button
                onClick={() => applyToJob(job.id)}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full
                           font-bold text-white bg-magenta hover:bg-magenta-dark
                           transition-colors text-sm"
              >
                Apply <ArrowRight size={14} />
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  /* ------------------------------------------------------------------ */
  /*  Column wrapper (used in both mobile + desktop)                     */
  /* ------------------------------------------------------------------ */
  function renderQualifiedColumn() {
    return (
      <>
        <div
          className="px-4 py-3 text-center"
          style={{ background: "linear-gradient(to top, #E725E2, #EFC5FF)" }}
        >
          <p className="text-white text-base font-bold">You qualify</p>
          <p className="text-white/85 text-xs">
            {qualifiedJobs.length} matching jobs found
          </p>
        </div>
        <div>
          {qualifiedJobs.length === 0 ? (
            <div className="p-6 text-center">
              <p className="text-sm text-gray-500 font-medium mb-2">
                No perfect matches yet
              </p>
              <p className="text-xs text-gray-400 mb-3">
                You&apos;re close! Check the &quot;1–2 more Skills&quot; column — learn one skill and jobs move here.
              </p>
              <a
                href="/skills"
                className="text-sm text-magenta font-semibold hover:underline"
              >
                + Add more skills
              </a>
            </div>
          ) : (
            qualifiedJobs.map((j) => renderJobRow(j, false))
          )}
        </div>
      </>
    );
  }

  function renderGapColumn() {
    return (
      <>
        <div
          className="px-4 py-3 text-center"
          style={{ background: "linear-gradient(to top, #808184, #D0D2D3)" }}
        >
          <p className="text-white text-base font-bold">With 1–2 more Skills</p>
          <p className="text-white/85 text-xs">
            {gapJobs.length}+ jobs found with 1–2 more skills
          </p>
        </div>
        <div>
          {gapJobs.length === 0 ? (
            <div className="p-6 text-center">
              <p className="text-sm text-gray-500 font-medium mb-2">
                {qualifiedJobs.length > 0
                  ? "You qualify for all nearby jobs!"
                  : "Add more skills to find jobs within reach"}
              </p>
              <a
                href="/skills"
                className="text-sm text-magenta font-semibold hover:underline"
              >
                + Add more skills
              </a>
            </div>
          ) : (
            <>
              {gapJobs.map((j) => renderJobRow(j, true))}
              <div className="p-3 text-center border-t border-gray-100">
                <a
                  href="/skills"
                  className="text-xs text-magenta font-semibold hover:underline"
                >
                  + Add more skills to unlock more jobs
                </a>
              </div>
            </>
          )}
        </div>
      </>
    );
  }

  /* ------------------------------------------------------------------ */
  /*  Loading state                                                      */
  /* ------------------------------------------------------------------ */
  if (isLoading) {
    return (
      <div className="min-h-screen bg-warmwhite flex items-center justify-center">
        <Loader2 className="animate-spin text-magenta" size={32} />
      </div>
    );
  }

  /* ------------------------------------------------------------------ */
  /*  Render                                                             */
  /* ------------------------------------------------------------------ */
  return (
    <div className="min-h-screen bg-warmwhite flex flex-col">
      {/* Header with nav — white top bar */}
      <header className="bg-white border-b border-gray-100 py-5 px-6">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <a href="/" className="text-3xl font-bold tracking-tight">
            <span className="text-magenta">Pay</span>
            <span className="text-amber">Ranker</span>
          </a>
          <nav className="flex items-center gap-6">
            <a
              href="/skills"
              className="text-sm font-semibold text-graytext hover:text-gray-700 transition-colors"
            >
              Your Skills
            </a>
            <button className="text-sm font-semibold text-graytext hover:text-gray-700 transition-colors relative">
              Messages
              <span className="absolute -top-1.5 -right-3 bg-magenta text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                0
              </span>
            </button>
            {/* Hamburger — pink */}
            <button className="text-magenta hover:text-magenta-dark ml-2">
              <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M3 11h18M3 5.5h18M3 16.5h18" />
              </svg>
            </button>
          </nav>
        </div>
      </header>

      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-4">
        {/* Email verification banner — non-blocking */}
        {profileLevel && (
          <div className="mb-4 px-4 py-3 bg-amber-light rounded-xl flex items-center gap-3">
            <span className="text-amber text-lg">✉</span>
            <p className="text-sm text-amber-dark">
              <span className="font-semibold">Check your email to secure your account.</span>
              <span className="text-gray-500 ml-1">We sent a verification link.</span>
            </p>
          </div>
        )}

        <p className="text-xs text-gray-500 mb-4">
          Click a position to view more details.
        </p>

        {/* ============================================================ */}
        {/*  MOBILE: Tab switcher + single column                        */}
        {/* ============================================================ */}
        <div className="sm:hidden">
          {/* Tabs */}
          <div className="flex rounded-xl overflow-hidden border border-gray-200 mb-4">
            <button
              onClick={() => setActiveTab("qualified")}
              className={`flex-1 py-3 text-sm font-bold transition-all ${
                activeTab === "qualified"
                  ? "bg-gradient-to-r from-magenta to-magenta-dark text-white"
                  : "bg-gray-100 text-gray-500"
              }`}
            >
              You qualify
            </button>
            <button
              onClick={() => setActiveTab("gap")}
              className={`flex-1 py-3 text-sm font-bold transition-all ${
                activeTab === "gap"
                  ? "bg-gradient-to-r from-gray-300 to-gray-400 text-white"
                  : "bg-gray-100 text-gray-500"
              }`}
            >
              With 1–2 more Skills
            </button>
          </div>

          {/* Content */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {activeTab === "qualified"
              ? renderQualifiedColumn()
              : renderGapColumn()}
          </div>
        </div>

        {/* ============================================================ */}
        {/*  DESKTOP: Two columns side-by-side                           */}
        {/* ============================================================ */}
        <div className="hidden sm:grid sm:grid-cols-2 gap-4">
          {/* Left — You qualify */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="max-h-[calc(100vh-200px)] overflow-y-auto">
              {renderQualifiedColumn()}
            </div>
          </div>

          {/* Right — 1-2 skills away */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="max-h-[calc(100vh-200px)] overflow-y-auto">
              {renderGapColumn()}
            </div>
          </div>
        </div>

        {/* All jobs are now real Adzuna listings shown in qualified/gap tabs above */}
      </main>
    </div>
  );
}
