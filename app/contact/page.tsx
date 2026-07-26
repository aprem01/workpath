"use client";

import { useState } from "react";
import AppHeader from "@/components/AppHeader";
import Footer from "@/components/Footer";

export default function ContactPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [topic, setTopic] = useState("feedback");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim()) return;
    setStatus("sending");
    setErrorMsg("");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, topic, message }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || "Failed to send");
      }
      setStatus("sent");
      setName("");
      setEmail("");
      setMessage("");
      setTopic("feedback");
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  return (
    <div className="min-h-screen bg-warmwhite flex flex-col">
      <AppHeader />
      <main className="flex-1 max-w-2xl mx-auto w-full px-6 pt-10 pb-16">
        <h1 className="text-3xl sm:text-4xl font-bold text-gray-800 mb-3 leading-tight">
          Contact Us
        </h1>
        <p className="text-lg text-graytext mb-8 leading-relaxed">
          Feedback, bugs, partnership questions — send them here. We read
          every message.
        </p>

        {status === "sent" ? (
          <div className="rounded-2xl border border-green-200 bg-green-50 p-6 text-green-800">
            <p className="font-semibold">Thanks — your message is in.</p>
            <p className="text-sm mt-2">
              We reply within a few business days.{" "}
              <a href="/" className="underline">Back to PayRanker</a>.
            </p>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-5 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                Name <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-magenta focus:ring-1 focus:ring-magenta outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                Email <span className="text-gray-400 font-normal">(so we can reply)</span>
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-magenta focus:ring-1 focus:ring-magenta outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                Topic
              </label>
              <select
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-magenta focus:ring-1 focus:ring-magenta outline-none bg-white"
              >
                <option value="feedback">Product feedback</option>
                <option value="bug">Bug report</option>
                <option value="employer">Employer / recruiter inquiry</option>
                <option value="press">Press or partnership</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                Message <span className="text-red-500">*</span>
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                required
                rows={6}
                className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-magenta focus:ring-1 focus:ring-magenta outline-none resize-y"
              />
            </div>
            {status === "error" && (
              <p className="text-sm text-red-600">{errorMsg}</p>
            )}
            <button
              type="submit"
              disabled={status === "sending" || !message.trim()}
              className="w-full sm:w-auto px-6 py-2.5 rounded-full bg-magenta text-white font-bold hover:bg-magenta-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {status === "sending" ? "Sending..." : "Send message"}
            </button>
          </form>
        )}

        <p className="text-xs text-graytext mt-6">
          By submitting this form you agree to our{" "}
          <a href="/privacy" className="text-magenta hover:underline">Privacy Policy</a>{" "}
          and{" "}
          <a href="/terms" className="text-magenta hover:underline">Terms of Service</a>.
        </p>
      </main>
      <Footer />
    </div>
  );
}
