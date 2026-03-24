"use client";

import { useState } from "react";
import {
  Zap,
  Shield,
  ShieldAlert,
  TrendingUp,
  Clock,
  ChevronRight,
  BookOpen,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Target,
  BrainCircuit,
} from "lucide-react";

interface RecommendedSkill {
  skill: string;
  why: string;
  estimatedHours: number;
  aiResistant: boolean;
  careerImpact: string;
  unlocks: string;
}

interface CareerPath {
  title: string;
  currentMatch: string;
  skillsNeeded: number;
  payRange: string;
  timeToReach: string;
}

interface RoadmapData {
  currentStrengths: string;
  aiRiskAssessment: {
    overallRisk: string;
    summary: string;
    atRiskSkills: string[];
    safeSkills: string[];
  };
  recommendedSkills: RecommendedSkill[];
  careerPaths: CareerPath[];
  aiProofTip: string;
}

interface UpskillRoadmapProps {
  skills: string[];
  onLearnSkill: (skill: string) => void;
}

export default function UpskillRoadmap({ skills, onLearnSkill }: UpskillRoadmapProps) {
  const [roadmap, setRoadmap] = useState<RoadmapData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateRoadmap = async () => {
    if (skills.length === 0) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/skills/roadmap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userSkills: skills }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setRoadmap(data);
      setIsExpanded(true);
    } catch {
      setError("Could not generate your roadmap. Try again.");
    }
    setIsLoading(false);
  };

  const riskColor = (risk: string) => {
    if (risk === "low") return "text-emerald-600 bg-emerald-50 border-emerald-200";
    if (risk === "medium") return "text-amber-600 bg-amber-50 border-amber-200";
    return "text-red-600 bg-red-50 border-red-200";
  };

  const riskIcon = (risk: string) => {
    if (risk === "low") return <Shield size={16} />;
    if (risk === "medium") return <ShieldAlert size={16} />;
    return <AlertTriangle size={16} />;
  };

  if (!isExpanded && !roadmap) {
    return (
      <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl border border-indigo-200 p-5">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center shrink-0">
            <BrainCircuit className="text-indigo-600" size={20} />
          </div>
          <div className="flex-1">
            <h3 className="font-heading font-bold text-gray-900">
              AI Career Roadmap
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              See which of your skills are AI-proof, what to learn next, and
              career paths you can reach in months — not years.
            </p>
            <button
              onClick={generateRoadmap}
              disabled={isLoading || skills.length === 0}
              className="mt-3 px-5 py-2.5 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-colors text-sm flex items-center gap-2 disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> Analyzing your skills...
                </>
              ) : (
                <>
                  <Zap size={16} /> Build my roadmap
                </>
              )}
            </button>
            {error && (
              <p className="text-sm text-red-500 mt-2">{error}</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
        <Loader2 size={32} className="animate-spin text-indigo-600 mx-auto mb-3" />
        <p className="text-gray-600 font-medium">Analyzing your skills with AI...</p>
        <p className="text-gray-500 text-sm mt-1">
          Checking AI vulnerability, career paths, and learning priorities
        </p>
      </div>
    );
  }

  if (!roadmap) return null;

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="font-heading font-bold text-lg text-gray-900 flex items-center gap-2">
          <BrainCircuit size={20} className="text-indigo-600" />
          Your AI Career Roadmap
        </h2>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          {isExpanded ? "Collapse" : "Expand"}
        </button>
      </div>

      {isExpanded && (
        <>
          {/* Strengths */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-sm text-gray-800">
              <span className="font-semibold">Your strengths:</span>{" "}
              {roadmap.currentStrengths}
            </p>
          </div>

          {/* AI Risk Assessment */}
          <div className={`rounded-xl border p-4 ${riskColor(roadmap.aiRiskAssessment.overallRisk)}`}>
            <div className="flex items-center gap-2 mb-2">
              {riskIcon(roadmap.aiRiskAssessment.overallRisk)}
              <h3 className="font-heading font-semibold text-sm uppercase tracking-wide">
                AI Risk: {roadmap.aiRiskAssessment.overallRisk}
              </h3>
            </div>
            <p className="text-sm mb-3">{roadmap.aiRiskAssessment.summary}</p>

            <div className="grid sm:grid-cols-2 gap-3">
              {roadmap.aiRiskAssessment.safeSkills.length > 0 && (
                <div className="bg-white/60 rounded-lg p-3">
                  <p className="text-xs font-semibold text-emerald-700 mb-1.5 flex items-center gap-1">
                    <Shield size={12} /> AI-Proof Skills
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {roadmap.aiRiskAssessment.safeSkills.map((s) => (
                      <span
                        key={s}
                        className="px-2 py-0.5 text-xs rounded-full bg-emerald-100 text-emerald-700 font-medium"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {roadmap.aiRiskAssessment.atRiskSkills.length > 0 && (
                <div className="bg-white/60 rounded-lg p-3">
                  <p className="text-xs font-semibold text-amber-700 mb-1.5 flex items-center gap-1">
                    <AlertTriangle size={12} /> At-Risk Skills
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {roadmap.aiRiskAssessment.atRiskSkills.map((s) => (
                      <span
                        key={s}
                        className="px-2 py-0.5 text-xs rounded-full bg-amber-100 text-amber-700 font-medium"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Recommended Skills to Learn */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="p-4 border-b border-gray-100">
              <h3 className="font-heading font-semibold text-gray-900 flex items-center gap-2">
                <TrendingUp size={16} className="text-indigo-600" />
                Skills to Learn Next
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Prioritized by career impact and AI-resistance
              </p>
            </div>
            <div className="divide-y divide-gray-50">
              {roadmap.recommendedSkills.map((skill, i) => (
                <div key={skill.skill} className="p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start gap-3">
                    <div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-sm font-bold shrink-0 mt-0.5">
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-semibold text-gray-900 capitalize">
                          {skill.skill}
                        </h4>
                        {skill.aiResistant && (
                          <span className="px-1.5 py-0.5 text-[10px] font-bold bg-emerald-100 text-emerald-700 rounded-full flex items-center gap-0.5">
                            <Shield size={10} /> AI-PROOF
                          </span>
                        )}
                        {skill.careerImpact === "high" && (
                          <span className="px-1.5 py-0.5 text-[10px] font-bold bg-amber-100 text-amber-700 rounded-full">
                            HIGH IMPACT
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 mt-0.5">{skill.why}</p>
                      <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <Clock size={12} /> ~{skill.estimatedHours} hrs
                        </span>
                        <span className="flex items-center gap-1">
                          <Target size={12} /> {skill.unlocks}
                        </span>
                      </div>
                      <button
                        onClick={() => onLearnSkill(skill.skill)}
                        className="mt-2 text-sm text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1"
                      >
                        <BookOpen size={14} /> Find resources to learn this
                        <ChevronRight size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Career Paths */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="p-4 border-b border-gray-100">
              <h3 className="font-heading font-semibold text-gray-900 flex items-center gap-2">
                <CheckCircle2 size={16} className="text-teal-primary" />
                Career Paths You Can Reach
              </h3>
            </div>
            <div className="divide-y divide-gray-50">
              {roadmap.careerPaths.map((path) => (
                <div key={path.title} className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold text-gray-900">{path.title}</h4>
                    <span className="text-sm font-bold text-amber-primary">
                      {path.payRange}
                    </span>
                  </div>
                  {/* Progress bar */}
                  <div className="w-full bg-gray-100 rounded-full h-2 mb-2">
                    <div
                      className="h-full rounded-full bg-teal-primary transition-all duration-500"
                      style={{ width: path.currentMatch }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>{path.currentMatch} match</span>
                    <span>
                      {path.skillsNeeded === 0
                        ? "Ready now!"
                        : `${path.skillsNeeded} skill${path.skillsNeeded > 1 ? "s" : ""} away · ${path.timeToReach}`}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* AI-Proof Tip */}
          <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl border border-indigo-200 p-4">
            <p className="text-sm text-indigo-800 flex items-start gap-2">
              <Zap size={16} className="text-indigo-600 shrink-0 mt-0.5" />
              <span>
                <strong>AI-proof tip:</strong> {roadmap.aiProofTip}
              </span>
            </p>
          </div>

          {/* Refresh button */}
          <button
            onClick={generateRoadmap}
            disabled={isLoading}
            className="text-sm text-gray-500 hover:text-indigo-600 font-medium flex items-center gap-1 mx-auto"
          >
            <Zap size={14} /> Refresh roadmap
          </button>
        </>
      )}
    </div>
  );
}
