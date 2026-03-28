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
  const [skills, setSkills] = useState<Skill[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedJob, setExpandedJob] = useState<string | null>(null);
  const [appliedJobs, setAppliedJobs] = useState<Set<string>>(new Set());
  const [profileLevel, setProfileLevel] = useState<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("payranker_skills");
    if (!saved) {
      router.push("/skills");
      return;
    }
    const parsed = JSON.parse(saved);
    setSkills(parsed);
    setProfileLevel(localStorage.getItem("payranker_profile_complete"));

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
        // Sort by pay (highest first)
        const sortByPay = (a: JobMatch, b: JobMatch) => b.payMax - a.payMax;
        setQualifiedJobs((data.qualifiedJobs || []).sort(sortByPay));
        setGapJobs((data.gapJobs || []).sort(sortByPay));
      } catch {}
      setIsLoading(false);
    }
    fetchJobs();
  }, [router]);

  const userSkillSet = new Set(skills.map((s) => s.normalizedTerm.toLowerCase()));

  function applyToJob(jobId: string) {
    const updated = new Set(appliedJobs);
    updated.add(jobId);
    setAppliedJobs(updated);
    localStorage.setItem("payranker_applied", JSON.stringify(Array.from(updated)));
  }

  function renderJobRow(job: JobMatch, isGap: boolean) {
    const isExpanded = expandedJob === job.id;
    const isApplied = appliedJobs.has(job.id);
    const showEmployer = profileLevel === "full";

    return (
      <div key={job.id} className="border-b border-gray-100 last:border-0">
        {/* Row */}
        <button
          onClick={() => setExpandedJob(isExpanded ? null : job.id)}
          className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors flex items-center gap-2"
        >
          <div className="flex-1 min-w-0">
            <p className="font-bold text-gray-900 text-sm truncate">
              {job.title}
            </p>
            <p className="text-xs text-gray-500 truncate">
              {showEmployer ? (
                <span className="text-amber-dark font-semibold">{job.employer}</span>
              ) : (
                job.location.split(",")[0]
              )}
              {" · "}
              {job.location.split(",")[0]}
            </p>
          </div>
          <span className="text-xs text-gray-500 whitespace-nowrap">On-site</span>
          <span className="text-xs text-gray-500 whitespace-nowrap">
            {shiftLabel(job.shiftType)}
          </span>
          <span className="text-sm font-bold text-gray-900 whitespace-nowrap">
            {formatPay(job.payMax)}/hr
          </span>
          <ChevronDown
            size={16}
            className={`text-gray-400 transition-transform ${isExpanded ? "rotate-180" : ""}`}
          />
        </button>

        {/* Expanded detail */}
        {isExpanded && (
          <div className="px-4 pb-4 animate-fade-in">
            <div className="bg-gray-50 rounded-xl p-4">
              {showEmployer && (
                <p className="text-sm text-amber-dark font-semibold mb-2">
                  {job.employer}
                </p>
              )}

              <p className="text-sm text-gray-600 mb-3">{job.description}</p>

              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                Requirements:
              </p>
              <ul className="space-y-1 mb-4">
                {job.requiredSkills
                  .filter((s) => s.isRequired)
                  .map((s) => {
                    const matched = userSkillSet.has(s.normalizedTerm.toLowerCase());
                    return (
                      <li
                        key={s.normalizedTerm}
                        className={`text-sm flex items-center gap-2 ${matched ? "text-green-700" : "text-gray-500"}`}
                      >
                        {matched ? (
                          <Check size={14} className="text-green-600" />
                        ) : (
                          <span className="w-3.5 h-3.5 rounded-full border border-gray-300 inline-block" />
                        )}
                        {s.normalizedTerm}
                      </li>
                    );
                  })}
              </ul>

              {isGap && job.missingSkills.length > 0 && (
                <div className="bg-amber-light rounded-lg p-3 mb-4">
                  <p className="text-xs font-semibold text-amber-dark mb-1">
                    Skills to unlock this job:
                  </p>
                  {job.missingSkills.map((ms) => (
                    <p key={ms} className="text-sm text-amber-dark flex items-center gap-2">
                      <span className="text-amber">+</span> {ms}
                    </p>
                  ))}
                </div>
              )}

              {!profileLevel ? (
                <button
                  onClick={() => router.push("/profile")}
                  className="text-sm text-magenta font-semibold hover:underline"
                >
                  Complete your profile to see employer and apply
                </button>
              ) : profileLevel === "basic" ? (
                <button
                  onClick={() => router.push("/profile?full=true")}
                  className="text-sm text-magenta font-semibold hover:underline"
                >
                  Complete your profile to see employer and apply
                </button>
              ) : isApplied ? (
                <p className="text-sm text-green-600 font-semibold">
                  Applied! You&apos;ll be notified when the employer responds.
                </p>
              ) : (
                <>
                  <p className="text-xs text-magenta mb-2">
                    Apply instantly to be considered
                  </p>
                  <button
                    onClick={() => applyToJob(job.id)}
                    className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full font-bold text-white bg-magenta hover:bg-magenta-dark transition-colors text-sm"
                  >
                    Apply <ArrowRight size={14} />
                  </button>
                  <p className="text-xs text-gray-400 mt-2">
                    You&apos;ll be notified when the employer responds
                  </p>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-warmwhite flex items-center justify-center">
        <Loader2 className="animate-spin text-magenta" size={32} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-warmwhite flex flex-col">
      {/* Header */}
      <header className="py-4 px-4 border-b border-gray-100">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <h1 className="text-2xl font-bold">
            <span className="text-magenta">Pay</span>
            <span className="text-amber">Ranker</span>
          </h1>
          <button className="text-gray-400 hover:text-gray-600">
            <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 12h18M3 6h18M3 18h18" />
            </svg>
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-4">
        <p className="text-xs text-gray-500 mb-4">
          Click a position to view more details.
        </p>

        {/* Mobile: tabs */}
        <div className="sm:hidden">
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
                  ? "bg-gradient-to-r from-gray-400 to-gray-500 text-white"
                  : "bg-gray-100 text-gray-500"
              }`}
            >
              With 1–2 more Skills
            </button>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {activeTab === "qualified" && (
              <>
                <div className="px-4 py-2 bg-gradient-to-r from-magenta to-magenta-dark">
                  <p className="text-white text-xs font-semibold">
                    {qualifiedJobs.length} matching jobs found
                  </p>
                </div>
                {qualifiedJobs.map((j) => renderJobRow(j, false))}
              </>
            )}
            {activeTab === "gap" && (
              <>
                <div className="px-4 py-2 bg-gray-200">
                  <p className="text-gray-600 text-xs font-semibold">
                    {gapJobs.length}+ jobs found with 1–2 more skills
                  </p>
                </div>
                {gapJobs.map((j) => renderJobRow(j, true))}
              </>
            )}
          </div>
        </div>

        {/* Desktop: two columns */}
        <div className="hidden sm:grid sm:grid-cols-2 gap-4">
          {/* Left: You qualify */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 bg-gradient-to-r from-magenta to-magenta-dark">
              <p className="text-white text-sm font-bold">You qualify</p>
              <p className="text-white/70 text-xs">
                {qualifiedJobs.length} matching jobs found
              </p>
            </div>
            <div className="max-h-[calc(100vh-200px)] overflow-y-auto">
              {qualifiedJobs.map((j) => renderJobRow(j, false))}
              {qualifiedJobs.length === 0 && (
                <p className="p-4 text-sm text-gray-400 text-center">
                  Add more skills to see matches
                </p>
              )}
            </div>
          </div>

          {/* Right: 1-2 skills away */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 bg-gray-200">
              <p className="text-gray-700 text-sm font-bold">
                With 1–2 more Skills
              </p>
              <p className="text-gray-500 text-xs">
                {gapJobs.length}+ jobs found with 1–2 more skills
              </p>
            </div>
            <div className="max-h-[calc(100vh-200px)] overflow-y-auto">
              {gapJobs.map((j) => renderJobRow(j, true))}
              {gapJobs.length === 0 && (
                <p className="p-4 text-sm text-gray-400 text-center">
                  No gap jobs found
                </p>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
