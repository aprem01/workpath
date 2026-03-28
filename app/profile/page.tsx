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
  const [zipCode, setZipCode] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [workAuth, setWorkAuth] = useState("");
  const [veteranStatus, setVeteranStatus] = useState("");
  const [disabilityStatus, setDisabilityStatus] = useState("");

  useEffect(() => {
    const h = localStorage.getItem("payranker_handle") || (isFullProfile ? "pooka122" : "jooka122");
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
        if (p.workAuth) setWorkAuth(p.workAuth);
        if (p.veteranStatus) setVeteranStatus(p.veteranStatus);
        if (p.disabilityStatus) setDisabilityStatus(p.disabilityStatus);
      } catch {}
    }
  }, [isFullProfile]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const profile = {
      email,
      password: "***",
      zipCode,
      firstName,
      lastName,
      phone,
      workAuth,
      veteranStatus,
      disabilityStatus,
      handle,
    };
    localStorage.setItem("payranker_profile", JSON.stringify(profile));
    localStorage.setItem(
      "payranker_profile_complete",
      isFullProfile ? "full" : "basic"
    );
    router.push("/jobs");
  }

  /* ---- Style helpers ---- */
  const labelClass =
    "block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5";

  const amberInput =
    "w-full px-4 py-3 rounded-xl border-2 border-amber/40 bg-amber-light/30 focus:outline-none focus:border-amber text-sm";

  const magentaInput =
    "w-full px-4 py-3 rounded-xl border-2 border-magenta/30 bg-magenta-light/30 focus:outline-none focus:border-magenta text-sm";

  /* Dropdown wrapper with custom amber arrow */
  const selectClass =
    "w-full px-4 py-3 rounded-xl border-2 border-amber/40 bg-amber-light/30 focus:outline-none focus:border-amber text-sm appearance-none";

  const selectWrapperStyle =
    "relative after:content-['▾'] after:absolute after:right-4 after:top-1/2 after:-translate-y-1/2 after:text-amber after:pointer-events-none after:text-lg";

  /* ======================= BASIC PROFILE (Page 3) ======================= */
  if (!isFullProfile) {
    return (
      <div className="min-h-screen bg-warmwhite flex flex-col">
        {/* Header — logo only, no hamburger */}
        <header className="py-6 px-4">
          <div className="max-w-2xl mx-auto">
            <h1 className="text-2xl font-bold">
              <span className="text-magenta">Pay</span>
              <span className="text-amber">Ranker</span>
            </h1>
          </div>
        </header>

        <main className="flex-1 max-w-md mx-auto w-full px-4 pb-12">
          <div className="bg-white rounded-2xl border border-gray-200 p-8 sm:p-10">
            <h2 className="text-2xl font-bold text-amber-dark mb-2">
              Create your anonymous profile
            </h2>
            <p className="text-sm text-gray-500 mb-1">
              Employers can&apos;t see your personal details.
            </p>
            <p className="text-sm text-gray-500 mb-5">
              They only see your anonymous handle when you apply to jobs.
            </p>
            <p className="text-sm text-gray-700 mb-8">
              Your anonymous handle is{" "}
              <span className="font-bold text-gray-900">{handle}</span>
            </p>

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* EMAIL */}
              <div>
                <label className={labelClass}>Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className={magentaInput}
                />
              </div>

              {/* PASSWORD */}
              <div>
                <label className={labelClass}>Create Your Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
                    className={`${magentaInput} pr-12`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                <p className="text-xs text-magenta mt-1.5">
                  (8 characters minimum, include upper-cap, lower-cap, and
                  numbers)
                </p>
              </div>

              {/* ZIP CODE */}
              <div>
                <label className={labelClass}>Zip Code</label>
                <input
                  type="text"
                  value={zipCode}
                  onChange={(e) => setZipCode(e.target.value)}
                  required
                  maxLength={5}
                  className={`${amberInput} max-w-[120px]`}
                />
              </div>

              {/* CTA */}
              <div className="text-center pt-4">
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 px-8 py-3.5 rounded-full font-bold text-white bg-magenta hover:bg-magenta-dark transition-colors"
                >
                  Continue to your job list <ArrowRight size={18} />
                </button>
              </div>
            </form>
          </div>
        </main>
      </div>
    );
  }

  /* ======================= FULL PROFILE (Page 6) ======================= */
  return (
    <div className="min-h-screen bg-warmwhite flex flex-col">
      {/* Header */}
      <header className="py-6 px-4">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-2xl font-bold">
            <span className="text-magenta">Pay</span>
            <span className="text-amber">Ranker</span>
          </h1>
        </div>
      </header>

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 pb-12">
        <div className="bg-white rounded-2xl border border-gray-200 p-8 sm:p-10">
          <h2 className="text-2xl font-bold text-amber-dark mb-2">
            Complete your profile
          </h2>
          <p className="text-sm text-gray-500 mb-1">
            Takes less than 1 minute.
          </p>
          <p className="text-sm text-gray-500 mb-5">
            Your profile is invisible to employers.
          </p>
          <p className="text-sm text-gray-700 mb-8">
            Your anonymous handle is{" "}
            <span className="font-bold text-gray-900">{handle}</span>
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Row 1: FIRST NAME | LAST NAME */}
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>First Name</label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className={amberInput}
                />
              </div>
              <div>
                <label className={labelClass}>Last Name</label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className={amberInput}
                />
              </div>
            </div>

            {/* Row 2: EMAIL | PHONE */}
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={amberInput}
                />
              </div>
              <div>
                <label className={labelClass}>Phone</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className={amberInput}
                />
              </div>
            </div>

            {/* Row 3: ZIP CODE | WORK AUTHORIZATION */}
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Zip Code</label>
                <input
                  type="text"
                  value={zipCode}
                  onChange={(e) => setZipCode(e.target.value)}
                  maxLength={5}
                  className={`${amberInput} max-w-[120px]`}
                />
              </div>
              <div>
                <label className={labelClass}>Work Authorization Status</label>
                <div className={selectWrapperStyle}>
                  <select
                    value={workAuth}
                    onChange={(e) => setWorkAuth(e.target.value)}
                    className={selectClass}
                  >
                    <option value="">Select...</option>
                    <option value="h1b">H-1B</option>
                    <option value="citizen">U.S. Citizen</option>
                    <option value="green_card">Green Card</option>
                    <option value="authorized">Authorized to Work</option>
                    <option value="need_sponsorship">
                      Require Sponsorship
                    </option>
                  </select>
                </div>
              </div>
            </div>

            {/* Row 4: VETERAN STATUS | DISABILITY STATUS */}
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Veteran Status</label>
                <div className={selectWrapperStyle}>
                  <select
                    value={veteranStatus}
                    onChange={(e) => setVeteranStatus(e.target.value)}
                    className={selectClass}
                  >
                    <option value="">Select...</option>
                    <option value="veteran">Veteran</option>
                    <option value="not_veteran">Not a Veteran</option>
                    <option value="prefer_not_to_say">
                      Prefer not to say
                    </option>
                  </select>
                </div>
              </div>
              <div>
                <label className={labelClass}>Disability Status</label>
                <div className={selectWrapperStyle}>
                  <select
                    value={disabilityStatus}
                    onChange={(e) => setDisabilityStatus(e.target.value)}
                    className={selectClass}
                  >
                    <option value="">Select...</option>
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                    <option value="prefer_not_to_say">
                      Prefer not to say
                    </option>
                  </select>
                </div>
              </div>
            </div>

            {/* CTA */}
            <div className="text-center pt-4">
              <button
                type="submit"
                className="inline-flex items-center gap-2 px-8 py-3.5 rounded-full font-bold text-white bg-magenta hover:bg-magenta-dark transition-colors"
              >
                See full job details <ArrowRight size={18} />
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
