"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Eye, EyeOff } from "lucide-react";

function generateHandle(): string {
  const vowels = ["a", "e", "i", "o", "u", "y"];
  const consonants = ["b","c","d","f","g","h","j","k","l","m","n","p","q","r","s","t","v","w","x","z"];
  const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];
  const c1 = pick(consonants).toUpperCase();
  const v1a = pick(vowels);
  const v1b = pick(vowels);
  const c2 = pick(consonants).toUpperCase();
  const v2a = pick(vowels);
  const v2b = Math.random() > 0.4 ? pick(vowels) : "";
  const num = Math.floor(100 + Math.random() * 900);
  return `${c1}${v1a}${v1b}${c2}${v2a}${v2b}${num}`;
}

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
    let h = localStorage.getItem("payranker_handle");
    if (!h) {
      h = generateHandle();
      localStorage.setItem("payranker_handle", h);
    }
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
      email, password: "***", zipCode, firstName, lastName, phone,
      workAuth, veteranStatus, disabilityStatus, handle,
    };
    localStorage.setItem("payranker_profile", JSON.stringify(profile));
    localStorage.setItem("payranker_profile_complete", isFullProfile ? "full" : "basic");
    router.push("/jobs");
  }

  // ─── Style helpers ─────────────────────────────────────────
  const labelClass =
    "block text-[11px] font-bold text-graytext uppercase tracking-wider mb-1.5";

  // Gradient border wrapper: orange F6A21C → pink E725E2
  const gradientBorderStyle = {
    background: "linear-gradient(to right, #F6A21C, #E725E2)",
  };
  const innerInputClass =
    "w-full px-4 py-3 rounded-[10px] bg-white focus:outline-none text-sm font-medium";
  const innerSelectClass =
    "w-full px-4 py-3 rounded-[10px] bg-white focus:outline-none text-sm font-medium appearance-none cursor-pointer pr-10";

  // Header — shared white top bar
  const Header = () => (
    <header className="bg-white border-b border-gray-100 py-5 px-6">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-3xl font-bold tracking-tight">
          <span className="text-magenta">Pay</span>
          <span className="text-amber">Ranker</span>
        </h1>
      </div>
    </header>
  );

  // Reusable gradient-bordered input
  function GradientInput({ children }: { children: React.ReactNode }) {
    return (
      <div
        className="rounded-xl p-[2px]"
        style={gradientBorderStyle}
      >
        {children}
      </div>
    );
  }

  // ═══ BASIC PROFILE ═══
  if (!isFullProfile) {
    return (
      <div className="min-h-screen bg-warmwhite flex flex-col">
        <Header />

        <main className="flex-1 max-w-md mx-auto w-full px-6 pt-12 pb-12">
          {/* Headline — flush left, pink, semibold */}
          <h2 className="text-3xl font-semibold text-magenta-headline mb-2">
            Create your anonymous profile
          </h2>
          <p className="text-sm text-graytext mb-1 font-medium">
            Employers can&apos;t see your personal details.
          </p>
          <p className="text-sm text-graytext mb-6 font-medium">
            They only see your anonymous handle when you apply to jobs.
          </p>
          <p className="text-sm text-graytext mb-8">
            Your anonymous handle is{" "}
            <span className="font-bold text-graytext">{handle}</span>
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className={labelClass}>Email</label>
              <GradientInput>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className={innerInputClass}
                />
              </GradientInput>
            </div>

            <div>
              <label className={labelClass}>Create Your Password</label>
              <GradientInput>
                <div className="relative bg-white rounded-[10px]">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
                    className={`${innerInputClass} pr-12`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </GradientInput>
              <p className="text-xs text-graytext italic mt-1.5 font-medium">
                (8 characters minimum, include upper-cap, lower-cap, and numbers)
              </p>
            </div>

            <div>
              <label className={labelClass}>Zip Code</label>
              <div className="max-w-[140px]">
                <GradientInput>
                  <input
                    type="text"
                    value={zipCode}
                    onChange={(e) => setZipCode(e.target.value)}
                    required
                    maxLength={5}
                    className={innerInputClass}
                  />
                </GradientInput>
              </div>
            </div>

            <div className="text-center pt-6">
              <button
                type="submit"
                className="inline-flex items-center gap-2 px-8 py-3.5 rounded-full font-bold text-white bg-magenta hover:bg-magenta-dark transition-colors"
              >
                Continue to your job list <ArrowRight size={18} />
              </button>
            </div>
          </form>
        </main>
      </div>
    );
  }

  // ═══ FULL PROFILE ═══
  return (
    <div className="min-h-screen bg-warmwhite flex flex-col">
      <Header />

      <main className="flex-1 max-w-2xl mx-auto w-full px-6 pt-12 pb-12">
        <h2 className="text-3xl font-semibold text-magenta-headline mb-2">
          Complete your profile
        </h2>
        <p className="text-sm text-graytext mb-1 font-medium">
          Takes less than 1 minute.
        </p>
        <p className="text-sm text-graytext mb-6 font-medium">
          Your profile is invisible to employers.
        </p>
        <p className="text-sm text-graytext mb-8">
          Your anonymous handle is{" "}
          <span className="font-bold text-graytext">{handle}</span>
        </p>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Row 1: name */}
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>First Name</label>
              <GradientInput>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className={innerInputClass}
                />
              </GradientInput>
            </div>
            <div>
              <label className={labelClass}>Last Name</label>
              <GradientInput>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className={innerInputClass}
                />
              </GradientInput>
            </div>
          </div>

          {/* Row 2: contact */}
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Email</label>
              <GradientInput>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={innerInputClass}
                />
              </GradientInput>
            </div>
            <div>
              <label className={labelClass}>Phone</label>
              <GradientInput>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className={innerInputClass}
                />
              </GradientInput>
            </div>
          </div>

          {/* Row 3: zip + work auth */}
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Zip Code</label>
              <div className="max-w-[140px]">
                <GradientInput>
                  <input
                    type="text"
                    value={zipCode}
                    onChange={(e) => setZipCode(e.target.value)}
                    maxLength={5}
                    className={innerInputClass}
                  />
                </GradientInput>
              </div>
            </div>
            <div>
              <label className={labelClass}>Work Authorization Status</label>
              <GradientInput>
                <div className="relative bg-white rounded-[10px]">
                  <select
                    value={workAuth}
                    onChange={(e) => setWorkAuth(e.target.value)}
                    className={innerSelectClass}
                  >
                    <option value="">Select...</option>
                    <option value="citizen">U.S. Citizen</option>
                    <option value="green_card">Green Card</option>
                    <option value="h1b">H-1B Visa</option>
                    <option value="authorized">Authorized to Work</option>
                    <option value="need_sponsorship">Require Sponsorship</option>
                  </select>
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-magenta pointer-events-none">▾</span>
                </div>
              </GradientInput>
            </div>
          </div>

          {/* Row 4: veteran + disability */}
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Veteran Status</label>
              <GradientInput>
                <div className="relative bg-white rounded-[10px]">
                  <select
                    value={veteranStatus}
                    onChange={(e) => setVeteranStatus(e.target.value)}
                    className={innerSelectClass}
                  >
                    <option value="">Select...</option>
                    <option value="veteran">Veteran</option>
                    <option value="not_veteran">Not a Veteran</option>
                    <option value="prefer_not_to_say">Prefer not to say</option>
                  </select>
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-magenta pointer-events-none">▾</span>
                </div>
              </GradientInput>
            </div>
            <div>
              <label className={labelClass}>Disability Status</label>
              <GradientInput>
                <div className="relative bg-white rounded-[10px]">
                  <select
                    value={disabilityStatus}
                    onChange={(e) => setDisabilityStatus(e.target.value)}
                    className={innerSelectClass}
                  >
                    <option value="">Select...</option>
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                    <option value="prefer_not_to_say">Prefer not to say</option>
                  </select>
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-magenta pointer-events-none">▾</span>
                </div>
              </GradientInput>
            </div>
          </div>

          <div className="text-center pt-6">
            <button
              type="submit"
              className="inline-flex items-center gap-2 px-8 py-3.5 rounded-full font-bold text-white bg-magenta hover:bg-magenta-dark transition-colors"
            >
              See full job details <ArrowRight size={18} />
            </button>
          </div>
        </form>
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
