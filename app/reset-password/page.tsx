"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Eye, EyeOff, Loader2 } from "lucide-react";
import AppHeader from "@/components/AppHeader";
import Footer from "@/components/Footer";

function ResetInner() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token") || "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [error, setError] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError("Those passwords don't match.");
      setState("error");
      return;
    }
    setState("sending");
    setError("");
    try {
      const res = await fetch("/api/auth/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Reset failed");
      setState("done");
      setTimeout(() => router.push("/login"), 1800);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reset failed");
      setState("error");
    }
  }

  return (
    <div className="min-h-screen bg-warmwhite flex flex-col">
      <AppHeader />
      <main className="flex-1 max-w-md mx-auto w-full px-6 pt-12 pb-16">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">Choose a new password</h1>
        {!token ? (
          <p className="text-sm text-red-600">
            This reset link is missing its token. Request a new one from the{" "}
            <a href="/login" className="text-magenta font-semibold hover:underline">
              Log in page
            </a>
            .
          </p>
        ) : state === "done" ? (
          <div className="rounded-2xl border border-green-200 bg-green-50 p-5 text-green-800">
            <p className="font-semibold">Password updated.</p>
            <p className="text-sm mt-1">Taking you to the login page…</p>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                New password
              </label>
              <div className="relative">
                <input
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  autoComplete="new-password"
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
              <p className="text-xs text-graytext mt-1.5">
                At least 8 characters, including letters and numbers.
              </p>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                Confirm new password
              </label>
              <input
                type={showPw ? "text" : "password"}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
                className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:border-magenta focus:ring-1 focus:ring-magenta outline-none text-sm"
              />
            </div>
            {state === "error" && (
              <p role="alert" className="text-sm text-red-600">{error}</p>
            )}
            <button
              type="submit"
              disabled={state === "sending"}
              className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full font-bold text-white bg-magenta hover:bg-magenta-dark transition-colors disabled:opacity-60"
            >
              {state === "sending" && <Loader2 size={16} className="animate-spin" />}
              Update password <ArrowRight size={16} />
            </button>
          </form>
        )}
      </main>
      <Footer />
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetInner />
    </Suspense>
  );
}
