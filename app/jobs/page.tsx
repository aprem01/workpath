"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Loader2, ChevronDown, Globe, MapPin, ExternalLink, Check } from "lucide-react";
import AppHeader from "@/components/AppHeader";
import Footer from "@/components/Footer";
import { METROS, DEFAULT_METRO_ID } from "@/lib/metros";

interface JobMatch {
  id: string;
  title: string;
  employer: string;
  location: string;
  vertical?: string;
  payMin: number;
  payMax: number;
  payType: string;
  // Round 7 (Rosalyn 8/10): Adzuna's salary_is_predicted or a missing
  // salary_max defaults now flag the pay as "estimated" so the UI can
  // show ≈ instead of promising the exact number. Rosalyn hit this on
  // Raising Cane's (posted $17.25, Adzuna returned $19-22).
  payEstimated?: boolean;
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
  /**
   * Phase 3 transferability — server-computed score from the worker's
   * nearest TAXONOMY role to this job's nearest TAXONOMY role.
   * Null when no clear taxonomic mapping exists for either side.
   */
  transferability?: {
    score: number;
    percent: number;
    fromRole?: string;
    toRole?: string;
  } | null;
  /**
   * Phase 4 wage benchmark — BLS OEWS Chicago / National wage for the
   * TAXONOMY role this job mapped to. payDiffPct is positive when the
   * listing pays above median, negative when below.
   */
  wage?: {
    medianHourly: number;
    medianAnnual: number;
    metro: "Chicago" | "National";
    payDiffPct: number | null;
  } | null;
  /**
   * Phase 4 employment projection — BLS 2024-2034 growth %.
   * Label is a short worker-facing phrase ("growing fast", "declining").
   */
  projection?: {
    growthPct: number;
    label: string;
  } | null;
  /**
   * Phase 5 workplace conditions — BLS SOII + NCS + CPS data.
   * Highlight is a 1–2 phrase summary like "Health insurance prevalent ·
   * Heavy overtime common". Workers see this above the description.
   */
  workplace?: {
    injuriesPer100: number;
    healthInsurancePct: number;
    avgHoursPerWeek: number;
    overtimePrevalencePct: number;
    highlight: string;
  } | null;
}

interface Skill {
  normalizedTerm: string;
  context?: string;
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

function JobsPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<"qualified" | "gap">("qualified");
  const [qualifiedJobs, setQualifiedJobs] = useState<JobMatch[]>([]);
  const [gapJobs, setGapJobs] = useState<JobMatch[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedJob, setExpandedJob] = useState<string | null>(null);
  const [appliedJobs, setAppliedJobs] = useState<Set<string>>(new Set());
  const [profileLevel, setProfileLevel] = useState<string | null>(null);
  const [zipCode, setZipCode] = useState<string>("");
  // Caroline 6/27 Round 4: metro picker lives here now (was on landing).
  // Refines results AFTER the worker has seen them — the "where" question
  // comes second, after "what can my skills do?".
  const [metroId, setMetroId] = useState<string>(DEFAULT_METRO_ID);
  // Upskill resources cache: skill name → loading/data
  const [upskillCache, setUpskillCache] = useState<
    Record<string, { loading: boolean; data?: UpskillData }>
  >({});
  // Which missing skill is currently expanded (skill name)
  const [expandedSkill, setExpandedSkill] = useState<string | null>(null);
  // Email verification state
  const [userEmail, setUserEmail] = useState<string>("");
  const [emailVerificationSent, setEmailVerificationSent] = useState<boolean>(false);
  const [emailVerified, setEmailVerified] = useState<boolean>(false);

  async function resendVerification() {
    if (!userEmail) return;
    try {
      const res = await fetch("/api/auth/send-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: userEmail }),
      });
      const data = await res.json();
      if (data.sent) {
        alert("Verification email sent! Check your inbox.");
      } else {
        alert(data.message || "Email service not configured yet.");
      }
    } catch {
      alert("Could not send email. Try again later.");
    }
  }

  useEffect(() => {
    // Restore the worker's prior metro choice (or default).
    const savedMetro = localStorage.getItem("payranker_metro");
    if (savedMetro) setMetroId(savedMetro);

    const profile = localStorage.getItem("payranker_profile_complete");

    // No profile at all → send them to /skills (start of the funnel).
    // We used to push to /profile, but that has noindex set — when
    // crawlers landed on /jobs with no localStorage they ended up
    // auditing /profile's DOM and reporting /jobs as non-indexable.
    if (!profile) {
      router.push("/skills");
      return;
    }

    setProfileLevel(profile);

    // Read zip code + email from saved profile
    const profileData = localStorage.getItem("payranker_profile");
    if (profileData) {
      try {
        const p = JSON.parse(profileData);
        if (p.zipCode) setZipCode(p.zipCode);
        if (p.email) setUserEmail(p.email);
      } catch {}
    }

    // If user came from email verification link (?verified=1), mark verified
    if (searchParams.get("verified") === "1") {
      localStorage.setItem("payranker_email_verified", "true");
      setEmailVerified(true);
      // Clean URL so refresh doesn't keep verified=1
      router.replace("/jobs");
    } else {
      setEmailVerified(
        localStorage.getItem("payranker_email_verified") === "true"
      );
    }

    // Read email verification state (set by /profile signup flow)
    setEmailVerificationSent(
      localStorage.getItem("payranker_verify_sent") === "true"
    );

    const saved = localStorage.getItem("payranker_skills");
    if (!saved) {
      router.push("/skills");
      return;
    }

    const parsed: Skill[] = JSON.parse(saved);
    setSkills(parsed);

    // Visited = user clicked through to an external job page. Legacy
    // "payranker_applied" key migrated to the new "payranker_visited" name.
    const visited =
      localStorage.getItem("payranker_visited") ||
      localStorage.getItem("payranker_applied");
    if (visited) setAppliedJobs(new Set(JSON.parse(visited)));

    async function fetchJobs() {
      try {
        const res = await fetch("/api/jobs/match", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userSkills: parsed.map((s: Skill) => ({
              normalizedTerm: s.normalizedTerm,
              proficiencyLevel: "intermediate",
              context: s.context,
            })),
            domainId: localStorage.getItem("payranker_domain") || undefined,
            metroId: localStorage.getItem("payranker_metro") || undefined,
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, metroId]);

  // Caroline 6/27: when the worker changes the metro picker, re-fetch
  // the match. Tracked via metroId in deps above.
  function handleMetroChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value;
    setMetroId(next);
    localStorage.setItem("payranker_metro", next);
    setIsLoading(true);
  }

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

  /**
   * Status tracking — we have 3 distinct states, not just "Applied":
   *  - "visited"  — user clicked through to the external job page
   *  - "applied"  — user explicitly confirmed they applied
   *  - "saved"    — user bookmarked for later (future)
   *
   * Caroline's bug: clicking out to view Adzuna was being marked "Applied"
   * which broke trust. Now we mark Visited on click, then ask later.
   */
  function trackApplication(job: JobMatch, action: "viewed" | "applied") {
    if (typeof window === "undefined") return;
    const handle = localStorage.getItem("payranker_handle");
    if (!handle) return; // sync route requires it
    void fetch("/api/applications/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        anonymousHandle: handle,
        jobId: job.id,
        jobTitle: job.title,
        employer: job.employer,
        location: job.location,
        vertical: job.vertical,
        payMin: job.payMin,
        payMax: job.payMax,
        applyUrl: job.applyUrl,
        action,
      }),
    }).catch(() => {
      // Non-blocking: localStorage state still updates client-side
    });
  }

  function markVisited(job: JobMatch) {
    const updated = new Set(appliedJobs); // reuse the set name for backwards-compat
    updated.add(job.id);
    setAppliedJobs(updated);
    localStorage.setItem(
      "payranker_visited",
      JSON.stringify(Array.from(updated))
    );
    trackApplication(job, "viewed");
  }

  function confirmApplied(job: JobMatch) {
    const raw = localStorage.getItem("payranker_applied_confirmed");
    const set = new Set<string>(raw ? JSON.parse(raw) : []);
    set.add(job.id);
    localStorage.setItem(
      "payranker_applied_confirmed",
      JSON.stringify(Array.from(set))
    );
    // Force a re-render by touching state
    setAppliedJobs(new Set(appliedJobs));
    trackApplication(job, "applied");
  }

  function isApplied(jobId: string): boolean {
    if (typeof window === "undefined") return false;
    const raw = localStorage.getItem("payranker_applied_confirmed");
    if (!raw) return false;
    try {
      return new Set<string>(JSON.parse(raw)).has(jobId);
    } catch {
      return false;
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Job row                                                            */
  /* ------------------------------------------------------------------ */
  function renderJobRow(job: JobMatch, isGap: boolean) {
    const isExpanded = expandedJob === job.id;
    const hasVisited = appliedJobs.has(job.id);
    const hasApplied = isApplied(job.id);

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
            {/* Show transferability percentage + missing skills in
                collapsed row for gap jobs (Phase 3 — Caroline's
                emotional frame). Transferability gives the warmth
                ("you're closer than you think"); missing skills give
                the specificity. */}
            {isGap && !isExpanded && (
              <p className="text-[11px] mt-0.5 truncate">
                {job.transferability && job.transferability.percent > 0 && (
                  <span className="text-magenta font-bold">
                    {job.transferability.percent}% match
                  </span>
                )}
                {job.transferability && job.transferability.percent > 0 && job.missingSkills.length > 0 && (
                  <span className="text-graytext"> · </span>
                )}
                {job.missingSkills.length > 0 && (
                  <span className="text-amber-dark">
                    Need: {job.missingSkills.join(", ")}
                  </span>
                )}
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

          {/* Pay — always visible. Phase 4: tag "above/below market"
              when we have a BLS wage benchmark for this role.
              Round 7 (Rosalyn 8/10 Cane's): prefix with ≈ when Adzuna
              flagged the pay as predicted or defaulted. */}
          <div className="text-right whitespace-nowrap">
            <span
              className="text-sm font-bold text-gray-900"
              title={
                job.payEstimated
                  ? "Pay estimated from listing data — the employer may pay a different rate. Confirm on their site."
                  : undefined
              }
            >
              {job.payEstimated ? "≈" : ""}{formatPay(job.payMax)}/hr
            </span>
            {job.wage && typeof job.wage.payDiffPct === "number" && job.wage.payDiffPct !== 0 && (
              <span
                className={`block text-[10px] font-bold ${
                  job.wage.payDiffPct > 0 ? "text-green-600" : "text-red-500"
                }`}
              >
                {job.wage.payDiffPct > 0 ? "+" : ""}
                {job.wage.payDiffPct}% vs median
              </span>
            )}
          </div>

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
            {/* Phase 3 transferability framing — Caroline's "warmth" panel.
                Shows for gap jobs where we can map both sides into the
                taxonomy. "You're 75% of the way from Solar Installer to
                Elevator Installer" replaces the harsh "1-2 skills away"
                cutoff with a continuous, encouraging signal. */}
            {isGap && job.transferability && job.transferability.percent > 0 && (
              <div className="mb-3 px-3 py-2.5 rounded-lg bg-magenta/5 border border-magenta/20">
                <p className="text-sm font-bold text-magenta mb-0.5">
                  You&rsquo;re {job.transferability.percent}% of the way there.
                </p>
                {job.transferability.fromRole && job.transferability.toRole && (
                  <p className="text-xs text-graytext">
                    From <span className="font-semibold">{job.transferability.fromRole}</span>{" "}
                    → <span className="font-semibold">{job.transferability.toRole}</span>
                  </p>
                )}
              </div>
            )}

            {/* Phase 4/5: BLS wage + projection + workplace benchmarks.
                Hard data the worker won't get elsewhere — sits prominently
                above the description so it's read before they bounce. */}
            {(job.wage || job.projection || job.workplace) && (
              <div className="mb-3 grid grid-cols-2 lg:grid-cols-3 gap-2">
                {job.wage && (
                  <div className="px-3 py-2 rounded-lg bg-gray-100 border border-gray-200">
                    <p className="text-[10px] uppercase tracking-wider text-graytext font-bold">
                      {job.wage.metro} median
                    </p>
                    <p className="text-sm font-bold text-gray-900">
                      ${job.wage.medianHourly.toFixed(2)}/hr
                    </p>
                    <p className="text-[10px] text-graytext">
                      ${job.wage.medianAnnual.toLocaleString("en-US")}/yr
                    </p>
                  </div>
                )}
                {job.projection && (
                  <div
                    className={`px-3 py-2 rounded-lg border ${
                      job.projection.growthPct >= 4
                        ? "bg-green-50 border-green-200"
                        : job.projection.growthPct >= -3
                        ? "bg-amber-50 border-amber-200"
                        : "bg-red-50 border-red-200"
                    }`}
                  >
                    <p className="text-[10px] uppercase tracking-wider text-graytext font-bold">
                      2024 → 2034
                    </p>
                    <p
                      className={`text-sm font-bold ${
                        job.projection.growthPct >= 4
                          ? "text-green-700"
                          : job.projection.growthPct >= -3
                          ? "text-amber-700"
                          : "text-red-600"
                      }`}
                    >
                      {job.projection.growthPct > 0 ? "+" : ""}
                      {job.projection.growthPct}% — {job.projection.label}
                    </p>
                  </div>
                )}
                {job.workplace && (
                  <div className="px-3 py-2 rounded-lg bg-blue-50 border border-blue-200 col-span-2 lg:col-span-1">
                    <p className="text-[10px] uppercase tracking-wider text-graytext font-bold">
                      Typical workplace
                    </p>
                    <p className="text-xs text-blue-900 font-semibold leading-snug">
                      {job.workplace.healthInsurancePct}% have health insurance
                      {" · "}
                      {job.workplace.avgHoursPerWeek}h/wk avg
                    </p>
                    {job.workplace.highlight && (
                      <p className="text-[10px] text-blue-700 mt-0.5">
                        {job.workplace.highlight}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

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
                  router.push("/skills/explore");
                }}
                className="inline-flex items-center gap-1.5 text-sm font-bold text-amber hover:text-amber-dark transition-colors"
              >
                Explore these skills <ArrowRight size={14} />
              </button>
            ) : hasApplied ? (
              <div>
                <span className="inline-flex items-center gap-1.5 px-5 py-2 rounded-full text-sm font-bold bg-green-100 text-green-700">
                  <Check size={14} /> Applied
                </span>
              </div>
            ) : hasVisited ? (
              // User clicked through to the external page but didn't confirm.
              // Show truthful "Visited" status + inline "Did you apply?" prompt.
              <div className="flex flex-col gap-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-600 self-start">
                  Visited
                </span>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-graytext">Did you apply?</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      confirmApplied(job);
                    }}
                    className="px-3 py-1 rounded-full bg-magenta text-white font-semibold text-xs hover:bg-magenta-dark transition-colors"
                  >
                    Yes
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      // Re-open the external page
                      if (job.applyUrl) window.open(job.applyUrl, "_blank");
                    }}
                    className="px-3 py-1 rounded-full border border-gray-300 text-graytext font-semibold text-xs hover:bg-gray-50 transition-colors"
                  >
                    Not yet
                  </button>
                </div>
                {job.applyUrl && (
                  <a
                    href={job.applyUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-magenta font-semibold hover:underline self-start"
                  >
                    View again <ExternalLink size={11} />
                  </a>
                )}
              </div>
            ) : job.applyUrl ? (
              <a
                href={job.applyUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => {
                  e.stopPropagation();
                  markVisited(job);
                }}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full
                           font-bold text-white bg-magenta hover:bg-magenta-dark
                           transition-colors text-sm"
              >
                Apply on company site <ArrowRight size={14} />
              </a>
            ) : (
              <button
                onClick={() => markVisited(job)}
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
              {gapJobs.length === 0 ? (
                // Both tabs are empty — likely too-broad/too-many skills
                <>
                  <p className="text-sm text-gray-700 font-bold mb-2">
                    No matches yet
                  </p>
                  <p className="text-xs text-gray-500 mb-3 leading-relaxed">
                    Try focusing on 3–5 specific skills you actually use at
                    work. Broader skill lists return less relevant results.
                  </p>
                  <a
                    href="/skills"
                    className="text-sm text-magenta font-semibold hover:underline"
                  >
                    Edit your skills
                  </a>
                </>
              ) : (
                <>
                  <p className="text-sm text-gray-500 font-medium mb-2">
                    No perfect matches yet
                  </p>
                  <p className="text-xs text-gray-400 mb-3">
                    You&apos;re close! Check the &quot;1–2 more Skills&quot;
                    column — learn one skill and jobs move here.
                  </p>
                  <a
                    href="/skills"
                    className="text-sm text-magenta font-semibold hover:underline"
                  >
                    + Add more skills
                  </a>
                </>
              )}
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
              <p className="text-sm text-gray-700 font-semibold mb-1">
                Higher-paying jobs are just one or two skills away.
              </p>
              <p className="text-xs text-gray-500 mb-3 leading-relaxed">
                We&apos;re expanding coverage of career-progression roles in
                your area. In the meantime, add a certification like
                CPR/First Aid, a state license, or a specialty skill to
                unlock adjacent higher-paying jobs.
              </p>
              <a
                href="/skills"
                className="inline-block text-sm text-magenta font-semibold hover:underline"
              >
                + Add a certification or specialty skill
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
      <AppHeader />

      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-4">
        {/* Verification banner — only when email is actually unverified
            and a real verification email has been sent.
            Hidden in MVP — wired to /api/auth/verify-email when ready. */}
        {profileLevel && emailVerificationSent && !emailVerified && (
          <div className="mb-4 px-4 py-3 bg-white border border-magenta/20 rounded-xl flex items-center gap-3">
            <span className="text-magenta text-xl">✉</span>
            <p>
              <span className="text-magenta font-bold text-base">
                Check your email to secure your account.
              </span>
              <span className="text-magenta font-medium ml-2">
                We sent a verification link to{" "}
                <span className="font-bold">{userEmail}</span>.
              </span>
            </p>
            <button
              onClick={resendVerification}
              className="ml-auto text-xs text-magenta font-bold hover:underline whitespace-nowrap"
            >
              Resend
            </button>
          </div>
        )}

        {/* Metro picker — Caroline 6/27 Round 4. Was on landing, moved
            here so the "where" question comes AFTER the worker sees
            their matches. Includes Remote + Anywhere in the US options
            for non-geographic searches. */}
        <div className="mb-4 flex items-center gap-2 text-sm">
          <span className="text-graytext">Showing jobs in</span>
          <div className="relative">
            <select
              value={metroId}
              onChange={handleMetroChange}
              aria-label="Choose your search area"
              className="text-sm font-semibold text-magenta bg-transparent border-b border-magenta/40 pl-1 pr-6 py-0.5 focus:outline-none cursor-pointer appearance-none"
            >
              {METROS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
            <ChevronDown
              size={13}
              className="absolute right-0 top-1/2 -translate-y-1/2 text-magenta pointer-events-none"
            />
          </div>
        </div>

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
      <Footer />
    </div>
  );
}

export default function JobsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-warmwhite flex items-center justify-center">
          <Loader2 className="animate-spin text-magenta" size={32} />
        </div>
      }
    >
      <JobsPageInner />
    </Suspense>
  );
}
