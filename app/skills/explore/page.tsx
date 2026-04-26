"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import {
  ArrowLeft,
  MapPin,
  Globe,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { formatPay } from "@/lib/utils";

interface Skill {
  normalizedTerm: string;
}

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
  missingSkills: string[];
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

interface MissingSkillCard {
  skill: string;
  payMin: number;
  payMax: number;
  jobCount: number;
  resources?: UpskillData;
  loading: boolean;
}

const MAX_NEAR_YOU = 2;
const MAX_ONLINE = 2;
const MAX_SKILL_CARDS = 5;

export default function ExploreSkillsPage() {
  const [zipCode, setZipCode] = useState<string>("60614");
  const [skillCards, setSkillCards] = useState<MissingSkillCard[]>([]);
  const [highestUnlockedPay, setHighestUnlockedPay] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [hasSkills, setHasSkills] = useState(true);

  useEffect(() => {
    // Read zip code from saved profile
    const profileData = localStorage.getItem("payranker_profile");
    let zip = "60614";
    if (profileData) {
      try {
        const p = JSON.parse(profileData);
        if (p.zipCode) zip = p.zipCode;
      } catch {}
    }
    setZipCode(zip);

    const saved = localStorage.getItem("payranker_skills");
    if (!saved) {
      setHasSkills(false);
      setIsLoading(false);
      return;
    }

    let parsed: Skill[] = [];
    try {
      parsed = JSON.parse(saved);
    } catch {
      setHasSkills(false);
      setIsLoading(false);
      return;
    }

    if (!parsed.length) {
      setHasSkills(false);
      setIsLoading(false);
      return;
    }

    async function loadAll() {
      try {
        // 1) Match jobs to compute missing skills
        const res = await fetch("/api/jobs/match", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userSkills: parsed.map((s) => ({
              normalizedTerm: s.normalizedTerm,
              proficiencyLevel: "intermediate",
            })),
          }),
        });
        const data = await res.json();
        const qualifiedJobs: JobMatch[] = data.qualifiedJobs || [];
        const gapJobs: JobMatch[] = data.gapJobs || [];

        // Highest pay among qualified (unlocked) jobs
        const highest = qualifiedJobs.reduce(
          (max, j) => (j.payMax > max ? j.payMax : max),
          0
        );
        setHighestUnlockedPay(highest);

        // 2) Aggregate missing-skill data from gap jobs
        // For each missing skill, find jobs where it's the ONLY missing skill,
        // and record their pay range. If none qualify (no single-gap jobs),
        // fall back to all gap jobs that mention this skill.
        const skillToSingleGapJobs = new Map<string, JobMatch[]>();
        const skillToAnyGapJobs = new Map<string, JobMatch[]>();

        for (const job of gapJobs) {
          const missing = job.missingSkills || [];
          for (const ms of missing) {
            const key = ms;
            if (!skillToAnyGapJobs.has(key))
              skillToAnyGapJobs.set(key, []);
            skillToAnyGapJobs.get(key)!.push(job);

            if (missing.length === 1) {
              if (!skillToSingleGapJobs.has(key))
                skillToSingleGapJobs.set(key, []);
              skillToSingleGapJobs.get(key)!.push(job);
            }
          }
        }

        // Build candidate cards. Prefer skills that unlock the most jobs
        // (single-gap first, then any-gap as fallback).
        const candidates: {
          skill: string;
          jobs: JobMatch[];
          singleGap: boolean;
        }[] = [];

        const seen = new Set<string>();
        skillToSingleGapJobs.forEach((jobs, skill) => {
          candidates.push({ skill, jobs, singleGap: true });
          seen.add(skill);
        });
        skillToAnyGapJobs.forEach((jobs, skill) => {
          if (seen.has(skill)) return;
          candidates.push({ skill, jobs, singleGap: false });
          seen.add(skill);
        });

        // Sort: single-gap first, then by highest payMax, then by job count
        candidates.sort((a, b) => {
          if (a.singleGap !== b.singleGap) return a.singleGap ? -1 : 1;
          const aMax = a.jobs.reduce((m, j) => Math.max(m, j.payMax), 0);
          const bMax = b.jobs.reduce((m, j) => Math.max(m, j.payMax), 0);
          if (bMax !== aMax) return bMax - aMax;
          return b.jobs.length - a.jobs.length;
        });

        const top = candidates.slice(0, MAX_SKILL_CARDS);

        const initialCards: MissingSkillCard[] = top.map((c) => {
          const payMin = c.jobs.reduce(
            (m, j) => Math.min(m, j.payMin || j.payMax),
            Number.POSITIVE_INFINITY
          );
          const payMax = c.jobs.reduce((m, j) => Math.max(m, j.payMax), 0);
          return {
            skill: c.skill,
            payMin: payMin === Number.POSITIVE_INFINITY ? 0 : payMin,
            payMax,
            jobCount: c.jobs.length,
            loading: true,
          };
        });

        setSkillCards(initialCards);
        setIsLoading(false);

        // 3) Fetch upskill resources in parallel for each top skill
        await Promise.all(
          initialCards.map(async (card, idx) => {
            try {
              const r = await fetch("/api/upskill/find", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  skill: card.skill,
                  zipCode: zip,
                }),
              });
              const u: UpskillData = await r.json();
              setSkillCards((prev) => {
                const next = [...prev];
                if (next[idx]) {
                  next[idx] = {
                    ...next[idx],
                    resources: u,
                    loading: false,
                  };
                }
                return next;
              });
            } catch {
              setSkillCards((prev) => {
                const next = [...prev];
                if (next[idx]) {
                  next[idx] = {
                    ...next[idx],
                    resources: { online: [], inPerson: [] },
                    loading: false,
                  };
                }
                return next;
              });
            }
          })
        );
      } catch {
        setIsLoading(false);
      }
    }

    loadAll();
  }, []);

  const skillsAway = Math.min(2, Math.max(1, skillCards.length || 1));

  return (
    <div className="min-h-screen bg-warmwhite flex flex-col">
      {/* White top bar */}
      <header className="bg-white border-b border-gray-100 py-5 px-6">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <a href="/">
            <Image
              src="/payranker-logo.png"
              alt="PayRanker"
              width={220}
              height={46}
              priority
            />
          </a>
          <nav className="flex items-center gap-5">
            <a
              href="/skills"
              className="text-sm font-semibold text-graytext hover:text-gray-700 transition-colors hidden sm:inline"
            >
              Your Skills
            </a>
            <a
              href="/matches"
              className="text-sm font-semibold text-graytext hover:text-gray-700 transition-colors hidden sm:inline"
            >
              Your Matches
            </a>
            <a
              href="/messages"
              className="text-sm font-semibold text-graytext hover:text-magenta transition-colors hidden sm:inline"
            >
              Messages
            </a>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/arrowhead-filled.png"
              alt=""
              width={20}
              height={12}
              className="hidden sm:inline"
            />
            <button
              className="text-magenta hover:text-magenta-dark"
              aria-label="Menu"
            >
              <svg
                width="24"
                height="24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <path d="M3 11h18M3 5.5h18M3 16.5h18" />
              </svg>
            </button>
          </nav>
        </div>
      </header>

      {/* Back link */}
      <div className="max-w-3xl mx-auto w-full px-6 pt-5">
        <a
          href="/jobs"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-graytext hover:text-gray-700 transition-colors"
        >
          <ArrowLeft size={16} />
          Back
        </a>
      </div>

      <main className="flex-1 max-w-3xl mx-auto w-full px-6 pt-6 pb-16">
        {/* Page title */}
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-700 mb-2 leading-tight">
          Add these skills to access higher-paying jobs:
        </h1>
        <p className="text-base text-graytext font-medium mb-8">
          You are {skillsAway} to 2 skills away from qualifying for jobs up to{" "}
          <span className="font-semibold text-gray-700">
            {highestUnlockedPay > 0
              ? `${formatPay(highestUnlockedPay)}/hr`
              : "$XX/hr"}
          </span>
        </p>

        {/* Loading state */}
        {isLoading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="animate-spin text-amber" size={32} />
          </div>
        )}

        {/* No skills state */}
        {!isLoading && !hasSkills && (
          <div className="bg-white border border-gray-200 rounded-2xl p-8 text-center shadow-sm">
            <p className="text-base text-graytext font-medium mb-4">
              Add some skills first to see what you&apos;re close to unlocking.
            </p>
            <a
              href="/skills"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full font-bold text-white bg-magenta hover:bg-magenta-dark transition-colors"
            >
              Add your skills
            </a>
          </div>
        )}

        {/* No skill cards state (skills loaded, no gap jobs) */}
        {!isLoading && hasSkills && skillCards.length === 0 && (
          <div className="bg-white border border-gray-200 rounded-2xl p-8 text-center shadow-sm">
            <p className="text-base text-graytext font-medium">
              You already qualify for the top jobs in your area! Add more
              skills to discover specialized opportunities.
            </p>
          </div>
        )}

        {/* Skill cards */}
        <div className="space-y-5">
          {skillCards.map((card) => (
            <SkillCard key={card.skill} card={card} zipCode={zipCode} />
          ))}
        </div>
      </main>
    </div>
  );
}

function SkillCard({
  card,
  zipCode,
}: {
  card: MissingSkillCard;
  zipCode: string;
}) {
  const inPerson = card.resources?.inPerson || [];
  const online = card.resources?.online || [];
  const showNearYou = inPerson.length > 0;

  const payRange =
    card.payMin > 0 && card.payMax > 0 && card.payMin !== card.payMax
      ? `${formatPay(card.payMin)}-${formatPay(card.payMax)}/hr`
      : card.payMax > 0
      ? `${formatPay(card.payMax)}/hr`
      : "";

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
      {/* Header row */}
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <span
          className="inline-flex items-center px-4 py-1.5 rounded-full text-sm font-bold text-white shadow-sm"
          style={{
            background: "linear-gradient(to top, #F7A31C, #F7D323)",
          }}
        >
          {card.skill}
        </span>
        {payRange && (
          <span className="text-sm font-semibold text-graytext">
            Unlocks jobs paying ~{payRange}
          </span>
        )}
      </div>

      {/* Loading inside card */}
      {card.loading && (
        <div className="flex items-center gap-2 text-sm text-graytext py-4">
          <Loader2 size={14} className="animate-spin text-amber" />
          Finding training options...
        </div>
      )}

      {/* Near You — only show if results exist */}
      {!card.loading && showNearYou && (
        <div className="mb-5">
          <div className="flex items-center gap-1.5 mb-3">
            <MapPin size={12} className="text-graytext" />
            <p className="text-[11px] font-bold text-graytext uppercase tracking-wider">
              Near You
            </p>
          </div>
          <div className="divide-y divide-gray-100">
            {inPerson.slice(0, MAX_NEAR_YOU).map((r, i) => (
              <ResourceRow key={i} r={r} showDistance />
            ))}
          </div>
          {inPerson.length > MAX_NEAR_YOU && (
            <div className="text-center mt-2">
              <a
                href={inPerson[0]?.url || "#"}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs font-bold text-amber hover:text-amber-dark transition-colors"
              >
                view more <ChevronRight size={12} />
              </a>
            </div>
          )}
        </div>
      )}

      {/* Online section — always show if any online options */}
      {!card.loading && online.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 mb-3">
            <Globe size={12} className="text-graytext" />
            <p className="text-[11px] font-bold text-graytext uppercase tracking-wider">
              Online
            </p>
          </div>
          <div className="divide-y divide-gray-100">
            {online.slice(0, MAX_ONLINE).map((r, i) => (
              <ResourceRow key={i} r={r} showDistance={false} />
            ))}
          </div>
          {online.length > MAX_ONLINE && (
            <div className="text-center mt-2">
              <a
                href={online[0]?.url || "#"}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs font-bold text-amber hover:text-amber-dark transition-colors"
              >
                view more <ChevronRight size={12} />
              </a>
            </div>
          )}
        </div>
      )}

      {/* Truly nothing — fallback (shouldn't happen with API, but just in case) */}
      {!card.loading && online.length === 0 && inPerson.length === 0 && (
        <p className="text-sm text-graytext italic">
          No standard training found for this skill. Search{" "}
          <a
            href={`https://www.google.com/search?q=${encodeURIComponent(
              card.skill + " training " + zipCode
            )}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-amber hover:text-amber-dark font-semibold"
          >
            local options
          </a>
          .
        </p>
      )}
    </div>
  );
}

function ResourceRow({
  r,
  showDistance,
}: {
  r: UpskillResource;
  showDistance: boolean;
}) {
  return (
    <a
      href={r.url || "#"}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 py-3 hover:bg-amber/5 transition-colors group px-1 -mx-1 rounded-lg"
    >
      {/* Provider + distance */}
      <div className="w-44 shrink-0">
        <p className="text-sm font-bold text-gray-900 leading-tight">
          {r.provider}
        </p>
        {showDistance && r.distance && (
          <p className="text-xs text-graytext mt-0.5 flex items-center gap-1">
            <MapPin size={10} className="text-graytext" />
            {r.distance}
          </p>
        )}
      </div>

      {/* Course name */}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-700 truncate group-hover:text-gray-900">
          {r.title}
        </p>
        {(r.cost || r.duration) && (
          <p className="text-xs text-graytext mt-0.5 truncate">
            {[r.cost, r.duration].filter(Boolean).join(" • ")}
          </p>
        )}
      </div>

      {/* Right arrow */}
      <ChevronRight
        size={18}
        className="text-amber shrink-0 group-hover:translate-x-0.5 transition-transform"
      />
    </a>
  );
}
