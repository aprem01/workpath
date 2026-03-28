"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Eye, EyeOff } from "lucide-react";

function ProfilePageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isFullProfile = searchParams.get("full") === "true";
  const [handle, setHandle] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [zipCode, setZipCode] = useState("60614");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [workAuth, setWorkAuth] = useState("");
  const [veteranStatus, setVeteranStatus] = useState("");
  const [disabilityStatus, setDisabilityStatus] = useState("");

  useEffect(() => {
    const h = localStorage.getItem("payranker_handle") || "jooka122";
    setHandle(h);
    const profile = localStorage.getItem("payranker_profile");
    if (profile) {
      try {
        const p = JSON.parse(profile);
        if (p.email) setEmail(p.email);
        if (p.zipCode) setZipCode(p.zipCode);
        if (p.firstName) setFirstName(p.firstName);
        if (p.lastName) setLastName(p.lastName);
        if (p.phone) setPhone(p.phone);
      } catch {}
    }
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const profile = {
      email, password: "***", zipCode, firstName, lastName, phone,
      workAuth, veteranStatus, disabilityStatus, handle,
    };
    localStorage.setItem("payranker_profile", JSON.stringify(profile));
    localStorage.setItem("payranker_profile_complete", isFullProfile ? "full" : "basic");
    router.push("/jobs");
  }

  const inputClass = "w-full px-4 py-3 rounded-xl border-2 border-amber/40 bg-amber-light/30 focus:outline-none focus:border-amber text-sm";

  return (
    <div className="min-h-screen bg-warmwhite flex flex-col">
      <header className="py-6 px-4">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-2xl font-bold">
            <span className="text-magenta">Pay</span>
            <span className="text-amber">Ranker</span>
          </h1>
        </div>
      </header>

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 pb-12">
        <div className="bg-white rounded-2xl border border-gray-200 p-6 sm:p-10">
          <h2 className="text-2xl font-bold text-amber-dark mb-2">
            {isFullProfile ? "Complete your profile" : "Create your anonymous profile"}
          </h2>
          {isFullProfile ? (
            <>
              <p className="text-sm text-gray-500 mb-1">Takes less than 1 minute.</p>
              <p className="text-sm text-gray-500 mb-4">Your profile is invisible to employers.</p>
            </>
          ) : (
            <>
              <p className="text-sm text-gray-500 mb-1">Employers can&apos;t see your personal details.</p>
              <p className="text-sm text-gray-500 mb-4">They only see your anonymous handle when you apply to jobs.</p>
            </>
          )}

          <p className="text-sm text-gray-700 mb-8">
            Your anonymous handle is <span className="font-bold text-gray-900">{handle}</span>
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            {isFullProfile && (
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">First Name</label>
                  <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} className={inputClass} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Last Name</label>
                  <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} className={inputClass} />
                </div>
              </div>
            )}

            <div className={isFullProfile ? "grid sm:grid-cols-2 gap-4" : ""}>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Email</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={isFullProfile ? "johndoe@gmail.com" : ""} required className={inputClass} />
              </div>
              {isFullProfile && (
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Phone</label>
                  <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} />
                </div>
              )}
            </div>

            {!isFullProfile && (
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Create Your Password</label>
                <div className="relative">
                  <input type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} className={`${inputClass} pr-12`} />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                <p className="text-xs text-magenta mt-1">(8 characters minimum, include upper-cap, lower-cap, and numbers)</p>
              </div>
            )}

            <div className={isFullProfile ? "grid sm:grid-cols-2 gap-4" : ""}>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Zip Code</label>
                <input type="text" value={zipCode} onChange={(e) => setZipCode(e.target.value)} required maxLength={5} className={`${inputClass} max-w-[140px]`} />
              </div>
              {isFullProfile && (
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Work Authorization Status</label>
                  <select value={workAuth} onChange={(e) => setWorkAuth(e.target.value)} className={`${inputClass} appearance-none`}>
                    <option value="">Select...</option>
                    <option value="citizen">U.S. Citizen</option>
                    <option value="green_card">Green Card</option>
                    <option value="authorized">Authorized to Work</option>
                    <option value="h1b">H-1B</option>
                    <option value="need_sponsorship">Require Sponsorship</option>
                  </select>
                </div>
              )}
            </div>

            {isFullProfile && (
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Veteran Status</label>
                  <select value={veteranStatus} onChange={(e) => setVeteranStatus(e.target.value)} className={`${inputClass} appearance-none`}>
                    <option value="">Select...</option>
                    <option value="veteran">Veteran</option>
                    <option value="not_veteran">Not a Veteran</option>
                    <option value="prefer_not_to_say">Prefer not to say</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Disability Status</label>
                  <select value={disabilityStatus} onChange={(e) => setDisabilityStatus(e.target.value)} className={`${inputClass} appearance-none`}>
                    <option value="">Select...</option>
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                    <option value="prefer_not_to_say">Prefer not to say</option>
                  </select>
                </div>
              </div>
            )}

            <div className="text-center pt-4">
              <button type="submit" className="inline-flex items-center gap-2 px-8 py-3.5 rounded-full font-bold text-white bg-magenta hover:bg-magenta-dark transition-colors">
                {isFullProfile ? "See full job details" : "Continue to your job list"} <ArrowRight size={18} />
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}

export default function ProfilePage() {
  return (
    <Suspense>
      <ProfilePageInner />
    </Suspense>
  );
}
