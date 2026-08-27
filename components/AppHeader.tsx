"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import BetaBanner from "./BetaBanner";

// Caroline 8/26 Round 8 nav spec — first item is Log in / Log out
// (label toggles based on presence of payranker_handle).
const BASE_MENU: { label: string; href: string; key: string }[] = [
  { label: "Our Mission", href: "/mission", key: "mission" },
  { label: "Your Profile", href: "/profile", key: "profile" },
  { label: "Your Skills", href: "/skills", key: "skills" },
  { label: "Your Matches", href: "/matches", key: "matches" },
  { label: "Your Messages", href: "/messages", key: "messages" },
];

export default function AppHeader() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setLoggedIn(!!localStorage.getItem("payranker_handle"));
  }, []);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // "Your Matches" routes to /jobs when the user already has a profile
  // (handle in localStorage) — otherwise the cold match-reveal page.
  const navigate = (key: string, href: string) => {
    setOpen(false);
    if (key === "matches") {
      const hasProfile =
        typeof window !== "undefined" && !!localStorage.getItem("payranker_handle");
      router.push(hasProfile ? "/jobs" : "/matches");
      return;
    }
    if (key === "auth") {
      if (loggedIn) {
        // Log out: clear the anonymous handle + profile flag; leave saved
        // skills in place so the user can log back in later.
        localStorage.removeItem("payranker_handle");
        localStorage.removeItem("payranker_profile_complete");
        setLoggedIn(false);
        router.push("/");
      } else {
        router.push("/profile");
      }
      return;
    }
    router.push(href);
  };

  const menuItems = [
    {
      label: loggedIn ? "Log out" : "Log in",
      href: loggedIn ? "/" : "/profile",
      key: "auth",
    },
    ...BASE_MENU,
  ];

  return (
    <>
      <BetaBanner />
    <header className="bg-white border-b border-gray-100 py-5 px-6">
      <div className="max-w-5xl mx-auto flex items-center justify-between">
        <a href="/">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/payranker-logo.png" alt="PayRanker" width={220} height={46} />
        </a>
        <div ref={wrapRef} className="relative">
          <button
            aria-label="Open menu"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="text-magenta hover:text-magenta-dark p-1"
          >
            <svg width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M3 11h22M3 5.5h22M3 16.5h22" />
            </svg>
          </button>
          {open && (
            <div className="absolute right-0 mt-2 w-56 rounded-xl bg-white shadow-lg border border-gray-100 py-2 z-50">
              {menuItems.map((item) => (
                <button
                  key={item.key}
                  onClick={() => navigate(item.key, item.href)}
                  className="w-full text-left px-4 py-2.5 text-sm font-semibold text-graytext hover:bg-magenta/5 hover:text-magenta transition-colors"
                >
                  {item.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </header>
    </>
  );
}
