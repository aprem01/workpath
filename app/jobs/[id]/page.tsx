"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, MapPin, DollarSign, Clock, Check } from "lucide-react";
import { formatPayRange } from "@/lib/utils";

interface JobDetail {
  id: string;
  title: string;
  employer: string;
  location: string;
  description: string;
  payMin: number;
  payMax: number;
  payType: string;
  vertical: string;
  postedAt: string;
  requiredSkills: Array<{
    normalizedTerm: string;
    proficiencyLevel: string;
    isRequired: boolean;
  }>;
}

export default function JobDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [job, setJob] = useState<JobDetail | null>(null);

  useEffect(() => {
    fetch(`/api/jobs/${params.id}`)
      .then((r) => r.json())
      .then(setJob)
      .catch(() => {});
  }, [params.id]);

  if (!job) {
    return (
      <div className="min-h-screen bg-offwhite flex items-center justify-center">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  const required = job.requiredSkills.filter((s) => s.isRequired);
  const optional = job.requiredSkills.filter((s) => !s.isRequired);

  return (
    <div className="min-h-screen bg-offwhite">
      <header className="border-b border-gray-200 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <button
            onClick={() => router.back()}
            className="text-sm text-gray-600 hover:text-gray-900 flex items-center gap-1"
          >
            <ArrowLeft size={16} /> Back to jobs
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        <div className="bg-white rounded-xl border border-gray-200 p-6 sm:p-8">
          <div className="flex items-start gap-4 mb-6">
            <div className="w-14 h-14 rounded-xl bg-teal-primary/10 flex items-center justify-center text-teal-primary font-bold text-xl shrink-0">
              {job.employer[0]}
            </div>
            <div>
              <h1 className="font-heading text-2xl font-bold text-gray-900">
                {job.title}
              </h1>
              <p className="text-gray-600">{job.employer}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-4 mb-6 text-sm">
            <span className="flex items-center gap-1.5 text-gray-600">
              <MapPin size={16} /> {job.location}
            </span>
            <span className="flex items-center gap-1.5 text-amber-primary font-bold">
              <DollarSign size={16} />{" "}
              {formatPayRange(job.payMin, job.payMax, job.payType)}
            </span>
            <span className="flex items-center gap-1.5 text-gray-600">
              <Clock size={16} /> {job.payType}
            </span>
          </div>

          <div className="mb-6">
            <h2 className="font-heading font-semibold text-gray-900 mb-2">
              About this job
            </h2>
            <p className="text-gray-600 leading-relaxed">{job.description}</p>
          </div>

          {required.length > 0 && (
            <div className="mb-6">
              <h2 className="font-heading font-semibold text-gray-900 mb-3">
                Required skills
              </h2>
              <div className="space-y-2">
                {required.map((s, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <Check size={16} className="text-teal-primary" />
                    <span className="capitalize">{s.normalizedTerm}</span>
                    <span className="text-gray-400">
                      · {s.proficiencyLevel}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {optional.length > 0 && (
            <div className="mb-8">
              <h2 className="font-heading font-semibold text-gray-900 mb-3">
                Nice to have
              </h2>
              <div className="space-y-2">
                {optional.map((s, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <span className="w-4 h-4 rounded-full border-2 border-gray-300" />
                    <span className="capitalize">{s.normalizedTerm}</span>
                    <span className="text-gray-400">
                      · {s.proficiencyLevel}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button className="w-full sm:w-auto px-8 py-3.5 bg-teal-primary text-white font-bold rounded-xl hover:bg-teal-700 transition-colors text-lg">
            Apply Now
          </button>
        </div>
      </main>
    </div>
  );
}
