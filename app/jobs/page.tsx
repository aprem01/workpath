"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2, ChevronDown, Globe, MapPin, ExternalLink } from "lucide-react";

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

interface UpskillResource {
  title: string;
  provider: string;
  url: string;
  cost: string;
  duration: string;
  isOnline: boolean;
  address?: string;
  city?: string;
  distance?: string;
}

interface UpskillData {
  online: UpskillResource[];
  inPerson: UpskillResource[];
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
  const [zipCode, setZipCode] = useState<string>("");
  // Upskill resources cache: skill name → loading/data
  const [upskillCache, setUpskillCache] = useState<
    Record<string, { loading: boolean; data?: UpskillData }>
  >({});
  // Which missing skill is currently expanded (skill name)
  const [expandedSkill, setExpandedSkill] = useState<string | null>(null);

  useEffect(() => {
    const profile = localStorage.getItem("payranker_profile_complete");

    // No profile at all → must create basic profile first
    if (!profile) {
      router.push("/profile");
      return;
    }

    setProfileLevel(profile);

    // Read zip code from saved profile for upskill location filtering
    const profileData = localStorage.getItem("payranker_profile");
    if (profileData) {
      try {
        const p = JSON.parse(profileData);
        if (p.zipCode) setZipCode(p.zipCode);
      } catch {}
    }

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

  // Fetch upskill resources for a missing skill (with cache)
  async function fetchUpskillResources(skill: string) {
    if (upskillCache[skill]?.data || upskillCache[skill]?.loading) return;

    setUpskillCache((prev) => ({
      ...prev,
      [skill]: { loading: true },
    }));

    try {
      const res = await fetch("/api/upskill/find", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skill, zipCode }),
      });
      const data: UpskillData = await res.json();
      setUpskillCache((prev) => ({
        ...prev,
        [skill]: { loading: false, data },
      }));
    } catch {
      setUpskillCache((prev) => ({
        ...prev,
        [skill]: { loading: false, data: { online: [], inPerson: [] } },
      }));
    }
  }

  // Toggle skill expansion + fetch resources on first open
  function toggleSkillExpansion(skill: string) {
    if (expandedSkill === skill) {
      setExpandedSkill(null);
    } else {
      setExpandedSkill(skill);
      fetchUpskillResources(skill);
    }
  }

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
            {/* Description — hide for Tab B (gap jobs) until full profile complete */}
            {isGap && profileLevel !== "full" ? (
              <p className="text-sm text-graytext mb-3 leading-relaxed font-medium tracking-wider">
                ___
              </p>
            ) : (
              <p className="text-sm text-gray-600 mb-3 leading-relaxed">
                {job.description}
              </p>
            )}

            {/* Schedule */}
            {job.schedule && (
              <p className="text-sm text-gray-500 mb-3">{job.schedule}</p>
            )}

            {/* Gap-specific: missing skills as clickable orange pills */}
            {isGap && job.missingSkills.length > 0 && (
              <div className="mb-4">
                <p className="text-xs font-bold text-graytext uppercase tracking-wider mb-2">
                  Tap a skill to find training:
                </p>
                <div className="space-y-3">
                  {job.missingSkills.map((ms) => {
                    const isSkillExpanded = expandedSkill === ms;
                    const resources = upskillCache[ms];
                    return (
                      <div key={ms}>
                        {/* Clickable orange pill */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleSkillExpansion(ms);
                          }}
                          className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold text-white shadow-sm hover:brightness-110 transition-all"
                          style={{
                            background:
                              "linear-gradient(to top, #F7A31C, #F7D323)",
                          }}
                        >
                          {ms}
                          <ChevronDown
                            size={12}
                            className={`transition-transform ${isSkillExpanded ? "rotate-180" : ""}`}
                          />
                        </button>

                        {/* Expanded: upskill resources */}
                        {isSkillExpanded && (
                          <div className="mt-2 bg-white border border-gray-200 rounded-xl p-4 animate-fade-in">
                            {resources?.loading ? (
                              <div className="flex items-center gap-2 text-sm text-graytext">
                                <Loader2 size={14} className="animate-spin text-amber" />
                                Finding training options...
                              </div>
                            ) : resources?.data ? (
                              <div className="space-y-4">
                                {/* ONLINE */}
                                {resources.data.online.length > 0 && (
                                  <div>
                                    <div className="flex items-center gap-1.5 mb-2">
                                      <Globe size={12} className="text-amber-dark" />
                                      <p className="text-[11px] font-bold text-graytext uppercase tracking-wider">
                                        Online options
                                      </p>
                                    </div>
                                    <div className="space-y-1.5">
                                      {resources.data.online.map((r, i) => (
                                        <a
                                          key={i}
                                          href={r.url || "#"}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          onClick={(e) => e.stopPropagation()}
                                          className="flex items-start justify-between gap-3 p-2.5 rounded-lg hover:bg-amber/5 transition-colors group"
                                        >
                                          <div className="flex-1 min-w-0">
                                            <p className="text-sm font-bold text-gray-900 group-hover:text-amber-dark">
                                              {r.title}
                                            </p>
                                            <p className="text-xs text-graytext mt-0.5">
                                              {r.provider} • {r.cost} • {r.duration}
                                            </p>
                                          </div>
                                          <ExternalLink
                                            size={14}
                                            className="text-graytext group-hover:text-amber-dark shrink-0 mt-1"
                                          />
                                        </a>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* IN-PERSON */}
                                {resources.data.inPerson.length > 0 && (
                                  <div>
                                    <div className="flex items-center gap-1.5 mb-2">
                                      <MapPin size={12} className="text-amber-dark" />
                                      <p className="text-[11px] font-bold text-graytext uppercase tracking-wider">
                                        In-person {zipCode && `near ${zipCode}`}
                                      </p>
                                    </div>
                                    <div className="space-y-1.5">
                                      {resources.data.inPerson.map((r, i) => (
                                        <a
                                          key={i}
                                          href={r.url || "#"}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          onClick={(e) => e.stopPropagation()}
                                          className="flex items-start justify-between gap-3 p-2.5 rounded-lg hover:bg-amber/5 transition-colors group"
                                        >
                                          <div className="flex-1 min-w-0">
                                            <p className="text-sm font-bold text-gray-900 group-hover:text-amber-dark">
                                              {r.title}
                                            </p>
                                            <p className="text-xs text-graytext mt-0.5">
                                              {r.provider} • {r.cost} • {r.duration}
                                            </p>
                                            {r.address && (
                                              <p className="text-xs text-graytext mt-0.5 flex items-center gap-1">
                                                <MapPin size={10} />
                                                {r.address}
                                                {r.distance && ` • ${r.distance}`}
                                              </p>
                                            )}
                                          </div>
                                          <ExternalLink
                                            size={14}
                                            className="text-graytext group-hover:text-amber-dark shrink-0 mt-1"
                                          />
                                        </a>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {resources.data.online.length === 0 &&
                                  resources.data.inPerson.length === 0 && (
                                    <p className="text-sm text-graytext italic">
                                      No standard training found for this skill.
                                    </p>
                                  )}
                              </div>
                            ) : null}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* CTA — orange text + arrow for Tab B (no pink) */}
            {isGap ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  router.push("/skills");
                }}
                className="inline-flex items-center gap-1.5 text-sm font-bold text-amber hover:text-amber-dark transition-colors"
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
          <a href="/">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/payranker-logo.png" alt="PayRanker" width={220} height={46} />
          </a>
          <nav className="flex items-center gap-5">
            <a href="/skills" className="text-sm font-semibold text-graytext hover:text-gray-700 transition-colors hidden sm:inline">
              Your Skills
            </a>
            <a href="/matches" className="text-sm font-semibold text-graytext hover:text-gray-700 transition-colors hidden sm:inline">
              Your Matches
            </a>
            <a href="/messages" className="text-sm font-semibold text-graytext hover:text-magenta transition-colors hidden sm:inline">
              Messages
            </a>
            {/* Filled down-arrow nav element */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/arrowhead-filled.png" alt="" width={20} height={12} className="hidden sm:inline" />
            {/* Hamburger — pink */}
            <button className="text-magenta hover:text-magenta-dark">
              <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M3 11h18M3 5.5h18M3 16.5h18" />
              </svg>
            </button>
          </nav>
        </div>
      </header>

      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-4">
        {/* Email verification banner — pink, no yellow-on-yellow */}
        {profileLevel && (
          <div className="mb-4 px-4 py-3 bg-white border border-magenta/20 rounded-xl flex items-center gap-3">
            <span className="text-magenta text-xl">✉</span>
            <p>
              <span className="text-magenta font-bold text-base">
                Check your email to secure your account.
              </span>
              <span className="text-magenta font-medium ml-2">
                We sent a verification link.
              </span>
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
