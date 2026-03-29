"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, Loader2, ChevronDown } from "lucide-react";

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
  const [realJobs, setRealJobs] = useState<(JobMatch & { isReal?: boolean; applyUrl?: string })[]>([]);
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
        setRealJobs((data.realJobs || []).sort(sortByPay));
      } catch {
        /* network error — show empty state */
      }
      setIsLoading(false);
    }
    fetchJobs();
  }, [router]);

  const userSkillSet = new Set(
    skills.map((s) => s.normalizedTerm.toLowerCase())
  );

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
    const showEmployer = profileLevel === "full";

    return (
      <div key={job.id}>
        {/* ---- Collapsed row ---- */}
        <button
          onClick={() => setExpandedJob(isExpanded ? null : job.id)}
          className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors
                     flex items-center gap-3 border-b border-gray-100"
        >
          {/* Left: title + location + missing skills hint */}
          <div className="flex-1 min-w-0">
            <p className="font-bold text-gray-900 text-sm truncate">
              {job.title}
            </p>
            {showEmployer && (
              <p className="text-xs text-amber font-semibold truncate">
                {job.employer}
              </p>
            )}
            <p className="text-xs text-gray-500 truncate">
              {job.location.split(",")[0]}
            </p>
            {/* Show missing skills in collapsed row for gap jobs */}
            {isGap && job.missingSkills.length > 0 && !isExpanded && (
              <p className="text-[11px] text-amber-dark mt-0.5 truncate">
                Need: {job.missingSkills.join(", ")}
              </p>
            )}
          </div>

          {/* Meta chips */}
          <span className="text-xs text-gray-400 whitespace-nowrap hidden sm:inline">
            On-site
          </span>
          <span className="text-xs text-gray-400 whitespace-nowrap hidden sm:inline">
            {shiftLabel(job.shiftType)}
          </span>

          {/* Pay — always visible */}
          <span className="text-sm font-bold text-gray-900 whitespace-nowrap">
            {formatPay(job.payMax)}/hr
          </span>

          <ChevronDown
            size={16}
            className={`text-gray-400 shrink-0 transition-transform ${
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

            {/* Requirements */}
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Requirements:
            </p>
            <ul className="space-y-1.5 mb-4">
              {job.requiredSkills
                .filter((s) => s.isRequired)
                .map((s) => {
                  const matched = userSkillSet.has(
                    s.normalizedTerm.toLowerCase()
                  );
                  return (
                    <li
                      key={s.normalizedTerm}
                      className={`text-sm flex items-center gap-2 ${
                        matched ? "text-green-700" : "text-gray-500"
                      }`}
                    >
                      {matched ? (
                        <Check size={14} className="text-green-600 shrink-0" />
                      ) : (
                        <span className="w-3.5 h-3.5 rounded-full border border-gray-300 shrink-0 inline-block" />
                      )}
                      {s.normalizedTerm}
                    </li>
                  );
                })}
            </ul>

            {/* Gap-specific: missing skills callout */}
            {isGap && job.missingSkills.length > 0 && (
              <div className="bg-amber-light rounded-lg p-3 mb-4">
                <p className="text-xs font-semibold text-amber-dark mb-1">
                  Skills to unlock this job:
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

            {/* CTA — depends on profile level */}
            {profileLevel === "basic" ? (
              <>
                <p className="text-sm text-magenta font-semibold mb-2">
                  Complete your profile to see employer and apply
                </p>
                <button
                  onClick={() => router.push("/profile?full=true")}
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full
                             font-bold text-white bg-magenta hover:bg-magenta-dark
                             transition-colors text-sm"
                >
                  Continue <ArrowRight size={14} />
                </button>
              </>
            ) : profileLevel === "full" ? (
              isApplied ? (
                <p className="text-sm text-green-600 font-semibold">
                  Applied! You&apos;ll be notified when the employer responds.
                </p>
              ) : (
                <>
                  <p className="text-sm text-magenta font-semibold mb-2">
                    Apply instantly to be considered
                  </p>
                  <button
                    onClick={() => applyToJob(job.id)}
                    className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full
                               font-bold text-white bg-magenta hover:bg-magenta-dark
                               transition-colors text-sm"
                  >
                    Apply <ArrowRight size={14} />
                  </button>
                  <p className="text-xs text-gray-400 mt-2">
                    You&apos;ll be notified when the employer responds
                  </p>
                </>
              )
            ) : null}
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
        <div className="px-4 py-3 bg-gradient-to-r from-magenta to-magenta-dark">
          <p className="text-white text-sm font-bold">You qualify</p>
          <p className="text-white/70 text-xs">
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
        <div className="px-4 py-3 bg-gradient-to-r from-gray-300 to-gray-400">
          <p className="text-white text-sm font-bold">With 1–2 more Skills</p>
          <p className="text-white/80 text-xs">
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
      {/* Header with nav */}
      <header className="py-3 px-4 border-b border-gray-100 bg-white">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <a href="/" className="text-2xl font-bold">
            <span className="text-magenta">Pay</span>
            <span className="text-amber">Ranker</span>
          </a>
          <nav className="flex items-center gap-4">
            <a
              href="/skills"
              className="text-sm font-semibold text-magenta hover:text-magenta-dark transition-colors"
            >
              Your Skills
            </a>
            <button className="text-sm font-semibold text-gray-500 hover:text-gray-700 transition-colors relative">
              Messages
              <span className="absolute -top-1.5 -right-3 bg-magenta text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                0
              </span>
            </button>
            {/* Hamburger */}
            <button className="text-gray-400 hover:text-gray-600 ml-1">
              <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 11h18M3 5.5h18M3 16.5h18" />
              </svg>
            </button>
          </nav>
        </div>
      </header>

      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-4">
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

        {/* Real Jobs from Adzuna */}
        {realJobs.length > 0 && (
          <div className="mt-6 bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 bg-gradient-to-r from-amber to-amber-dark">
              <p className="text-white text-sm font-bold">Live Market Jobs</p>
              <p className="text-white/80 text-xs">
                {realJobs.length} real job{realJobs.length !== 1 ? "s" : ""} matching your skills — from Adzuna
              </p>
            </div>
            <div>
              {realJobs.map((job) => (
                <div key={job.id} className="px-4 py-3 border-b border-gray-100 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-gray-900 text-sm truncate">
                        {job.title}
                      </p>
                      <p className="text-xs text-amber font-semibold truncate">
                        {job.employer}
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        {job.location}
                      </p>
                    </div>
                    <span className="text-xs text-gray-400 whitespace-nowrap hidden sm:inline">
                      {shiftLabel(job.shiftType)}
                    </span>
                    <span className="text-sm font-bold text-gray-900 whitespace-nowrap">
                      {formatPay(job.payMax)}/hr
                    </span>
                    {job.applyUrl && (
                      <a
                        href={job.applyUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-4 py-1.5 bg-magenta text-white text-xs font-bold rounded-full hover:bg-magenta-dark transition-colors whitespace-nowrap"
                      >
                        Apply
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
