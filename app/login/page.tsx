"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Eye, EyeOff, Loader2 } from "lucide-react";
import AppHeader from "@/components/AppHeader";
import Footer from "@/components/Footer";

function LoginInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [state, setState] = useState<"idle" | "sending" | "error">("idle");
  const [error, setError] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setState("sending");
    setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Login failed");
      }
      // Re-hydrate the client-side handle so the rest of the app works.
      if (data.handle) localStorage.setItem("payranker_handle", data.handle);
      if (data.profileComplete)
        localStorage.setItem("payranker_profile_complete", "basic");

      // Open-redirect guard: reject protocol-relative ("//evil.example")
      // and backslash-prefixed URLs before router.push.
      const returnTo = searchParams.get("returnTo");
      const safeReturnTo =
        returnTo &&
        returnTo.startsWith("/") &&
        !returnTo.startsWith("//") &&
        !returnTo.startsWith("/\\")
          ? returnTo
          : "/jobs";
      router.push(safeReturnTo);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
      setState("error");
    }
  }

  return (
    <div className="min-h-screen bg-warmwhite flex flex-col">
      <AppHeader />
      <main className="flex-1 max-w-md mx-auto w-full px-6 pt-12 pb-16">
        <h1 className="text-3xl sm:text-4xl font-bold text-gray-800 mb-2 leading-tight">
          Welcome back
        </h1>
        <p className="text-base text-graytext mb-8">
          Log in to see your matches and continue where you left off.
        </p>

        <form onSubmit={onSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
              autoComplete="email"
              autoCapitalize="none"
              className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:border-magenta focus:ring-1 focus:ring-magenta outline-none text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Password
            </label>
            <div className="relative">
              <input
                type={showPw ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                minLength={8}
                className="w-full px-4 py-3 pr-12 rounded-lg border border-gray-200 focus:border-magenta focus:ring-1 focus:ring-magenta outline-none text-sm"
              />
              <button
                type="button"
                aria-label={showPw ? "Hide password" : "Show password"}
                onClick={() => setShowPw((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 w-10 h-10 flex items-center justify-center"
              >
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          {state === "error" && (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={state === "sending"}
            className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full font-bold text-white bg-magenta hover:bg-magenta-dark transition-colors disabled:opacity-60"
          >
            {state === "sending" ? (
              <Loader2 size={16} className="animate-spin" />
            ) : null}
            Log in <ArrowRight size={16} />
          </button>
        </form>

        <p className="text-sm text-graytext mt-6 text-center">
          New to PayRanker?{" "}
          <a href="/profile" className="text-magenta font-semibold hover:underline">
            Create an anonymous profile
          </a>
        </p>
      </main>
      <Footer />
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginInner />
    </Suspense>
  );
}
