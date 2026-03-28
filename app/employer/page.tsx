import Link from "next/link";

export default function EmployerLanding() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Hero */}
      <div className="max-w-4xl mx-auto px-6 pt-20 pb-16 text-center">
        <h1 className="text-4xl font-bold tracking-tight text-slate-900 mb-2">
          <span className="text-emerald-600">Skill</span>Match
        </h1>
        <p className="text-lg text-slate-500 mb-10">by PayRanker</p>

        <h2 className="text-3xl sm:text-4xl font-semibold text-slate-900 mb-4">
          Find candidates who actually have the skills you need
        </h2>
        <p className="text-lg text-slate-600 max-w-2xl mx-auto mb-8">
          Post a job. We rank candidates by skill match. You only pay when you
          unlock a candidate.
        </p>

        <Link
          href="/employer/post-job"
          className="inline-block bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-8 py-3 rounded-lg text-lg transition-colors"
        >
          Post a job &rarr;
        </Link>
      </div>

      {/* How it works */}
      <div className="max-w-4xl mx-auto px-6 pb-20">
        <h3 className="text-2xl font-semibold text-slate-900 text-center mb-10">
          How it works
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="text-center p-6 rounded-xl bg-white border border-slate-200 shadow-sm">
            <div className="text-3xl mb-3">1</div>
            <h4 className="font-semibold text-slate-900 mb-2">Post a job</h4>
            <p className="text-slate-600 text-sm">
              List required and preferred skills. We normalize them against our
              skill graph.
            </p>
          </div>
          <div className="text-center p-6 rounded-xl bg-white border border-slate-200 shadow-sm">
            <div className="text-3xl mb-3">2</div>
            <h4 className="font-semibold text-slate-900 mb-2">
              We rank candidates
            </h4>
            <p className="text-slate-600 text-sm">
              Candidates are matched and ranked by skill overlap. No resumes, no
              bias — just skills.
            </p>
          </div>
          <div className="text-center p-6 rounded-xl bg-white border border-slate-200 shadow-sm">
            <div className="text-3xl mb-3">3</div>
            <h4 className="font-semibold text-slate-900 mb-2">
              Unlock the best matches
            </h4>
            <p className="text-slate-600 text-sm">
              Review anonymous profiles. Pay only when you unlock a candidate to
              see their contact info.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
