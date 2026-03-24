"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  AlertCircle,
  Loader2,
  ArrowRight,
  BookOpen,
  X,
  Plus,
  ChevronRight,
} from "lucide-react";
import SkillPill from "@/components/SkillPill";
import ProfileSelector from "@/components/ProfileSelector";
import ProgressBar from "@/components/ProgressBar";
import { formatPayRange } from "@/lib/utils";
import { migrateIfNeeded, syncCurrentSkillsToActiveProfile } from "@/lib/profiles";

interface SkillData {
  normalizedTerm: string;
  category: string;
  proficiencyLevel: string;
  rawInput: string;
  isAISuggested: boolean;
}

interface JobResult {
  id: string;
  title: string;
  employer: string;
  location: string;
  description: string;
  payMin: number;
  payMax: number;
  payType: string;
  optionalScore: number;
  matchedRequired: number;
  totalRequired: number;
  matchedOptional: number;
  totalOptional: number;
  missingSkills: string[];
}

interface UpskillResource {
  title: string;
  provider: string;
  url: string;
  isFree: boolean;
  estimatedHours: number;
  difficulty: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"qualified" | "gap">("qualified");
  const [skills, setSkills] = useState<SkillData[]>([]);
  const [qualifiedJobs, setQualifiedJobs] = useState<JobResult[]>([]);
  const [gapJobs, setGapJobs] = useState<JobResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [drawerSkill, setDrawerSkill] = useState<string | null>(null);
  const [drawerResources, setDrawerResources] = useState<UpskillResource[]>([]);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [showAllSkills, setShowAllSkills] = useState(false);
  const [appliedJobs, setAppliedJobs] = useState<Set<string>>(new Set());

  const applyToJob = (jobId: string) => {
    setAppliedJobs((prev) => new Set(prev).add(jobId));
    // Persist to localStorage
    const stored = JSON.parse(localStorage.getItem("workpath_applied") || "[]");
    if (!stored.includes(jobId)) {
      stored.push(jobId);
      localStorage.setItem("workpath_applied", JSON.stringify(stored));
    }
  };

  const fetchMatches = useCallback(async (skillsData: SkillData[]) => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/jobs/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userSkills: skillsData.map((s) => ({
            normalizedTerm: s.normalizedTerm,
            proficiencyLevel: s.proficiencyLevel,
          })),
        }),
      });
      const data = await res.json();
      setQualifiedJobs(data.qualifiedJobs || []);
      setGapJobs(data.gapJobs || []);
    } catch {
      console.error("Failed to fetch matches");
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem("workpath_skills");
    if (!stored) {
      router.push("/onboarding");
      return;
    }
    const parsed: SkillData[] = JSON.parse(stored);
    setSkills(parsed);
    fetchMatches(parsed);
    // Migrate to profile system if needed
    migrateIfNeeded();
    // Load applied jobs
    const applied = JSON.parse(localStorage.getItem("workpath_applied") || "[]");
    setAppliedJobs(new Set(applied));
  }, [router, fetchMatches]);

  const openUpskillDrawer = async (skillTerm: string) => {
    setDrawerSkill(skillTerm);
    setDrawerLoading(true);
    setDrawerResources([]);
    try {
      const res = await fetch("/api/skills/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gapSkill: skillTerm }),
      });
      const data = await res.json();
      setDrawerResources(data.resources || []);
    } catch {
      setDrawerResources([]);
    }
    setDrawerLoading(false);
  };

  const markAsLearned = (skillTerm: string) => {
    const newSkill: SkillData = {
      normalizedTerm: skillTerm,
      category: "healthcare",
      proficiencyLevel: "beginner",
      rawInput: skillTerm,
      isAISuggested: false,
    };
    const updated = [...skills, newSkill];
    setSkills(updated);
    localStorage.setItem("workpath_skills", JSON.stringify(updated));
    syncCurrentSkillsToActiveProfile();
    setDrawerSkill(null);
    fetchMatches(updated);
  };

  const visibleSkills = showAllSkills ? skills : skills.slice(0, 6);
  const totalJobs = qualifiedJobs.length + gapJobs.length;
  const completenessScore = Math.min(Math.round((skills.length / 10) * 100), 100);

  return (
    <div className="min-h-screen bg-offwhite">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white/80 backdrop-blur-sm sticky top-0 z-20">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="font-heading text-xl font-bold text-gray-900">
            Work<span className="text-amber-primary">Path</span>
          </h1>
          <div className="flex items-center gap-2">
            <ProfileSelector
              currentSkills={skills}
              onProfileSwitch={(newSkills) => {
                setSkills(newSkills);
                fetchMatches(newSkills);
              }}
              onEditSkills={() => router.push("/onboarding")}
            />
            <button
              onClick={() => router.push("/onboarding")}
              className="text-sm text-teal-primary hover:text-teal-700 font-medium flex items-center gap-1"
            >
              <Plus size={16} /> Add skills
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6">
        {/* Skill pills row */}
        <div className="mb-4">
          <div className="flex flex-wrap gap-2 items-center">
            {visibleSkills.map((s, i) => (
              <SkillPill
                key={i}
                term={s.normalizedTerm}
                category={s.category}
                isAISuggested={s.isAISuggested}
              />
            ))}
            {skills.length > 6 && !showAllSkills && (
              <button
                onClick={() => setShowAllSkills(true)}
                className="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
              >
                +{skills.length - 6} more
              </button>
            )}
            {showAllSkills && skills.length > 6 && (
              <button
                onClick={() => setShowAllSkills(false)}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Show less
              </button>
            )}
          </div>
        </div>

        {/* Completeness bar */}
        <div className="mb-6 p-4 bg-white rounded-xl border border-gray-200">
          <ProgressBar
            value={completenessScore}
            label={
              completenessScore < 80
                ? `Your profile is ${completenessScore}% complete — add ${Math.max(0, 10 - skills.length)} more skills to unlock more jobs`
                : `Your profile is strong! ${totalJobs} jobs matched.`
            }
          />
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 mb-6">
          <button
            onClick={() => setActiveTab("qualified")}
            className={`flex-1 sm:flex-none px-6 py-3 text-sm font-semibold border-b-2 transition-colors flex items-center justify-center gap-2 ${
              activeTab === "qualified"
                ? "border-teal-primary text-teal-primary"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            Jobs you qualify for
            {qualifiedJobs.length > 0 && (
              <span className="bg-emerald-100 text-emerald-700 text-xs font-bold px-2 py-0.5 rounded-full">
                {qualifiedJobs.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("gap")}
            className={`flex-1 sm:flex-none px-6 py-3 text-sm font-semibold border-b-2 transition-colors flex items-center justify-center gap-2 ${
              activeTab === "gap"
                ? "border-amber-primary text-amber-800"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            1–2 skills away
            {gapJobs.length > 0 && (
              <span className="bg-amber-100 text-amber-700 text-xs font-bold px-2 py-0.5 rounded-full">
                {gapJobs.length}
              </span>
            )}
          </button>
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-16 text-gray-500">
            <Loader2 className="animate-spin mb-3" size={32} />
            <p>Finding your best matches...</p>
          </div>
        )}

        {/* Tab A: Qualified Jobs */}
        {!isLoading && activeTab === "qualified" && (
          <div className="space-y-4 animate-fade-in">
            {qualifiedJobs.length === 0 ? (
              <div className="text-center py-12">
                <AlertCircle className="mx-auto mb-3 text-gray-400" size={40} />
                <p className="text-gray-600 font-medium">
                  No perfect matches yet
                </p>
                <p className="text-gray-500 text-sm mt-1">
                  Add more skills or check the &quot;1–2 skills away&quot; tab
                </p>
              </div>
            ) : (
              qualifiedJobs.map((job) => (
                <div
                  key={job.id}
                  className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-teal-primary/10 flex items-center justify-center text-teal-primary font-bold text-lg shrink-0">
                      {job.employer[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-heading font-semibold text-gray-900 text-lg">
                        {job.title}
                      </h3>
                      <p className="text-gray-600 text-sm">
                        {job.employer} · {job.location}
                      </p>
                      <p className="text-amber-primary font-bold mt-1">
                        {formatPayRange(job.payMin, job.payMax, job.payType)}
                      </p>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-sm">
                        <span className="text-emerald-600 flex items-center gap-1">
                          <Check size={14} /> Matches {job.matchedRequired} of{" "}
                          {job.totalRequired} required skills
                        </span>
                        {job.totalOptional > 0 && (
                          <span className="text-emerald-600 flex items-center gap-1">
                            <Check size={14} /> Matches {job.matchedOptional} of{" "}
                            {job.totalOptional} bonus skills
                          </span>
                        )}
                      </div>
                      <div className="flex gap-2 mt-4">
                        {appliedJobs.has(job.id) ? (
                          <span className="px-5 py-2.5 bg-emerald-100 text-emerald-700 font-semibold rounded-lg text-sm flex items-center gap-1.5">
                            <Check size={14} /> Applied
                          </span>
                        ) : (
                          <button
                            onClick={() => applyToJob(job.id)}
                            className="px-5 py-2.5 bg-teal-primary text-white font-semibold rounded-lg hover:bg-teal-700 transition-colors text-sm flex items-center gap-1.5"
                          >
                            Apply Now <ArrowRight size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Tab B: Gap Jobs */}
        {!isLoading && activeTab === "gap" && (
          <div className="space-y-4 animate-fade-in">
            {gapJobs.length === 0 ? (
              <div className="text-center py-12">
                {qualifiedJobs.length > 0 ? (
                  <>
                    <Check className="mx-auto mb-3 text-emerald-500" size={40} />
                    <p className="text-gray-600 font-medium">
                      You qualify for everything!
                    </p>
                    <p className="text-gray-500 text-sm mt-1">
                      Check the &quot;Jobs you qualify for&quot; tab
                    </p>
                  </>
                ) : (
                  <>
                    <AlertCircle className="mx-auto mb-3 text-gray-400" size={40} />
                    <p className="text-gray-600 font-medium">
                      No close matches yet
                    </p>
                    <p className="text-gray-500 text-sm mt-1">
                      Add more skills to see jobs that are 1–2 skills away
                    </p>
                  </>
                )}
              </div>
            ) : (
              gapJobs.map((job) => (
                <div
                  key={job.id}
                  className="bg-white rounded-xl border border-amber-200 p-5 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-amber-primary/10 flex items-center justify-center text-amber-primary font-bold text-lg shrink-0">
                      {job.employer[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                          Almost there
                        </span>
                      </div>
                      <h3 className="font-heading font-semibold text-gray-900 text-lg">
                        {job.title}
                      </h3>
                      <p className="text-gray-600 text-sm">
                        {job.employer} · {job.location}
                      </p>
                      <p className="text-amber-primary font-bold mt-1">
                        {formatPayRange(job.payMin, job.payMax, job.payType)}
                      </p>

                      {/* Missing skills */}
                      <div className="mt-3 space-y-2">
                        {job.missingSkills.map((skill) => (
                          <div
                            key={skill}
                            className="flex items-center justify-between gap-2 p-3 bg-amber-50 rounded-lg border border-amber-100"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <AlertCircle
                                size={16}
                                className="text-amber-500 shrink-0"
                              />
                              <span className="text-sm text-gray-800">
                                Missing:{" "}
                                <strong className="capitalize">{skill}</strong>
                              </span>
                            </div>
                            <button
                              onClick={() => openUpskillDrawer(skill)}
                              className="text-sm text-teal-primary hover:text-teal-700 font-semibold whitespace-nowrap flex items-center gap-1"
                            >
                              Learn this <ChevronRight size={14} />
                            </button>
                          </div>
                        ))}
                      </div>

                      <div className="flex gap-2 mt-4">
                        <button
                          onClick={() =>
                            job.missingSkills.forEach((s) =>
                              openUpskillDrawer(s)
                            )
                          }
                          className="px-4 py-2.5 bg-amber-primary text-white font-semibold rounded-lg hover:bg-amber-600 transition-colors text-sm flex items-center gap-1.5"
                        >
                          <BookOpen size={14} /> I&apos;ll learn{" "}
                          {job.missingSkills.length === 1
                            ? "this"
                            : "these"}
                        </button>
                        <button className="px-4 py-2.5 border border-gray-200 text-gray-600 font-medium rounded-lg hover:bg-gray-50 transition-colors text-sm">
                          Skip for now
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </main>

      {/* Upskill Drawer */}
      {drawerSkill && (
        <>
          <div
            className="fixed inset-0 bg-black/30 z-30"
            onClick={() => setDrawerSkill(null)}
          />
          <div className="fixed bottom-0 left-0 right-0 z-40 bg-white rounded-t-2xl shadow-xl animate-slide-up max-h-[70vh] overflow-y-auto">
            <div className="p-6 max-w-3xl mx-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-heading font-bold text-lg text-gray-900 capitalize">
                  Learn: {drawerSkill}
                </h3>
                <button
                  onClick={() => setDrawerSkill(null)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              {drawerLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="animate-spin text-teal-primary" size={24} />
                </div>
              ) : drawerResources.length === 0 ? (
                <p className="text-gray-500 py-4">
                  No resources found for this skill.
                </p>
              ) : (
                <div className="space-y-3 mb-6">
                  {drawerResources.map((r, i) => (
                    <div
                      key={i}
                      className="p-4 border border-gray-200 rounded-xl hover:border-teal-primary/30 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h4 className="font-semibold text-gray-900">
                            {r.title}
                          </h4>
                          <p className="text-sm text-gray-600 mt-0.5">
                            {r.provider}
                            {r.estimatedHours
                              ? ` · ${r.estimatedHours} hrs`
                              : ""}
                          </p>
                        </div>
                        {r.isFree && (
                          <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full shrink-0">
                            Free
                          </span>
                        )}
                      </div>
                      {r.url && (
                        <a
                          href={r.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-teal-primary hover:underline mt-2 inline-block"
                        >
                          Open resource →
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <button
                onClick={() => markAsLearned(drawerSkill)}
                className="w-full py-3.5 bg-teal-primary text-white font-bold rounded-xl hover:bg-teal-700 transition-colors flex items-center justify-center gap-2"
              >
                <Check size={18} /> Mark as learned
              </button>
              <p className="text-xs text-gray-500 text-center mt-2">
                This will add the skill to your profile and re-match jobs
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
