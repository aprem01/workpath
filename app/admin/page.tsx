"use client";

import { useState, useEffect, useCallback } from "react";

interface ZeroMatch {
  skills: string[];
  at: string;
}

interface WindowStats {
  totalRequests: number;
  zeroMatchRequests: number;
  zeroMatchRate: number;
  errorRequests: number;
  avgQualifiedPerRequest: number;
  avgGapPerRequest: number;
  avgDurationMs: number;
  avgSkillCount: number;
  topSkills: { skill: string; count: number }[];
  recentZeroMatches: ZeroMatch[];
}

interface StatsResponse {
  generatedAt: string;
  eventCounts: { event: string; _count: number }[];
  windows: {
    "24h": WindowStats;
    "7d": WindowStats;
    "30d": WindowStats;
  };
}

export default function AdminDashboard() {
  const [key, setKey] = useState("");
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [windowKey, setWindowKey] = useState<"24h" | "7d" | "30d">("24h");

  const fetchStats = useCallback(async (k: string) => {
    if (!k) return;
    setLoading(true);
    setError("");
    try {
      const r = await fetch(`/api/admin/stats?key=${encodeURIComponent(k)}`);
      if (!r.ok) {
        setError(r.status === 401 ? "Wrong key" : `Error ${r.status}`);
        setStats(null);
      } else {
        const data = await r.json();
        setStats(data);
        sessionStorage.setItem("payranker_admin_key", k);
      }
    } catch {
      setError("Network error");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const saved = sessionStorage.getItem("payranker_admin_key");
    if (saved) {
      setKey(saved);
      fetchStats(saved);
    }
  }, [fetchStats]);

  const w = stats?.windows[windowKey];

  return (
    <div className="min-h-screen bg-warmwhite p-6">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">
          <span className="text-magenta">Pay</span>
          <span className="text-amber">Ranker</span>
          <span className="text-gray-500 font-normal text-xl ml-2">
            / admin
          </span>
        </h1>
        <p className="text-sm text-gray-500 mb-6">
          Production analytics &amp; debugging.
        </p>

        {/* Auth */}
        {!stats && (
          <div className="bg-white border border-gray-200 rounded-2xl p-6 max-w-md">
            <label className="block text-sm font-bold text-gray-700 mb-2">
              Admin secret
            </label>
            <input
              type="password"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && fetchStats(key)}
              className="w-full px-4 py-3 rounded-lg border-2 border-gray-200 focus:outline-none focus:border-magenta text-sm"
              placeholder="ADMIN_SECRET env var"
            />
            <button
              onClick={() => fetchStats(key)}
              disabled={!key || loading}
              className="mt-3 w-full bg-magenta text-white font-bold py-3 rounded-lg hover:bg-magenta-dark transition-colors disabled:opacity-50"
            >
              {loading ? "Loading..." : "View Stats"}
            </button>
            {error && (
              <p className="text-sm text-red-600 mt-2 font-medium">{error}</p>
            )}
          </div>
        )}

        {/* Stats viewer */}
        {stats && w && (
          <>
            {/* Window selector */}
            <div className="flex gap-2 mb-6">
              {(["24h", "7d", "30d"] as const).map((k) => (
                <button
                  key={k}
                  onClick={() => setWindowKey(k)}
                  className={`px-5 py-2 rounded-full text-sm font-bold transition-colors ${
                    windowKey === k
                      ? "bg-magenta text-white"
                      : "bg-white text-gray-600 border border-gray-200 hover:border-magenta"
                  }`}
                >
                  Last {k}
                </button>
              ))}
              <button
                onClick={() => fetchStats(key)}
                disabled={loading}
                className="ml-auto px-4 py-2 rounded-full text-sm font-medium text-gray-500 hover:text-magenta"
              >
                ↻ Refresh
              </button>
            </div>

            {/* KPI cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <KpiCard
                label="Match requests"
                value={w.totalRequests.toLocaleString()}
                hint={`${w.errorRequests} errors`}
              />
              <KpiCard
                label="Zero-result rate"
                value={`${(w.zeroMatchRate * 100).toFixed(1)}%`}
                hint={`${w.zeroMatchRequests} requests`}
                warn={w.zeroMatchRate > 0.2}
              />
              <KpiCard
                label="Avg qualified jobs"
                value={w.avgQualifiedPerRequest.toFixed(1)}
                hint={`per request`}
              />
              <KpiCard
                label="Avg API duration"
                value={`${w.avgDurationMs}ms`}
                hint={`avg ${w.avgSkillCount} skills/req`}
                warn={w.avgDurationMs > 3000}
              />
            </div>

            {/* Two-col layout */}
            <div className="grid md:grid-cols-2 gap-6">
              {/* Top skills */}
              <div className="bg-white rounded-2xl p-5 border border-gray-200">
                <h2 className="font-bold text-gray-900 mb-3">
                  Top skills entered
                </h2>
                {w.topSkills.length === 0 ? (
                  <p className="text-sm text-gray-400 italic">No data yet.</p>
                ) : (
                  <div className="space-y-2">
                    {w.topSkills.map((s) => (
                      <div
                        key={s.skill}
                        className="flex items-center justify-between text-sm"
                      >
                        <span className="text-gray-700 truncate pr-2">
                          {s.skill}
                        </span>
                        <span className="font-bold text-magenta shrink-0">
                          {s.count}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Recent zero matches */}
              <div className="bg-white rounded-2xl p-5 border border-gray-200">
                <h2 className="font-bold text-gray-900 mb-3">
                  Recent zero-match requests
                </h2>
                {w.recentZeroMatches.length === 0 ? (
                  <p className="text-sm text-gray-400 italic">
                    None — every request returned at least one job. 🎉
                  </p>
                ) : (
                  <div className="space-y-3">
                    {w.recentZeroMatches.map((m, i) => (
                      <div
                        key={i}
                        className="border-l-2 border-amber pl-3 py-1"
                      >
                        <p className="text-xs text-gray-400 mb-1">
                          {new Date(m.at).toLocaleString()}
                        </p>
                        <p className="text-xs text-gray-700">
                          {m.skills.join(" · ")}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Event counts */}
            <div className="bg-white rounded-2xl p-5 border border-gray-200 mt-6">
              <h2 className="font-bold text-gray-900 mb-3">
                All-time event counts
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {stats.eventCounts.map((e) => (
                  <div
                    key={e.event}
                    className="bg-gray-50 rounded-lg px-3 py-2"
                  >
                    <p className="text-xs text-gray-500">{e.event}</p>
                    <p className="font-bold text-gray-900">
                      {e._count.toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <p className="text-xs text-gray-400 mt-6 text-center italic">
              Generated at {new Date(stats.generatedAt).toLocaleString()}
            </p>
          </>
        )}
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  hint,
  warn,
}: {
  label: string;
  value: string;
  hint?: string;
  warn?: boolean;
}) {
  return (
    <div
      className={`bg-white rounded-2xl p-4 border-2 ${
        warn ? "border-amber" : "border-gray-200"
      }`}
    >
      <p className="text-xs text-gray-500 font-medium mb-1">{label}</p>
      <p
        className={`text-2xl font-bold ${
          warn ? "text-amber-dark" : "text-gray-900"
        }`}
      >
        {value}
      </p>
      {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    </div>
  );
}
