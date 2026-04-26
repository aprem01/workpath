"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Check, ArrowRight } from "lucide-react";

interface InterviewSlot {
  date: string;
  time: string;
  iso: string;
}

interface Message {
  id: string;
  companyName: string;
  contactName: string;
  type: "interview" | "direct_hire";
  subject: string;
  preview: string;
  fullBody: string;
  date: string;
  time: string;
  read: boolean;
  // Interview-specific
  expiresIn?: string; // "24h" or "72h"
  proposedSlots?: InterviewSlot[];
  // Direct hire-specific
  payOffer?: string;
  benefits?: string;
}

const MOCK_MESSAGES: Message[] = [
  {
    id: "1",
    companyName: "Solar Technologies Inc",
    contactName: "Sarah Jackson",
    type: "interview",
    subject: "Request for Interview",
    preview:
      "Hi Daniel, we would love to meet you here at Solar Tech. How is Wednesday April 24 at...",
    fullBody:
      "Hi Daniel, we would love to meet you here at Solar Tech. We're looking for someone with your exact skill set to join our installation team. Pick one of the times below and I'll send you a Zoom link.",
    date: "4/10/26",
    time: "3:15pm",
    read: false,
    expiresIn: "24h",
    proposedSlots: [
      { date: "Tuesday, April 28", time: "2:00 PM", iso: "2026-04-28T14:00" },
      { date: "Wednesday, April 29", time: "10:30 AM", iso: "2026-04-29T10:30" },
      { date: "Thursday, April 30", time: "4:00 PM", iso: "2026-04-30T16:00" },
    ],
  },
  {
    id: "2",
    companyName: "SunPower",
    contactName: "Myriam Nijab",
    type: "interview",
    subject: "Interview Request",
    preview:
      "Hello Daniel, we are looking for a few Solar Panel Installers and we would like to meet...",
    fullBody:
      "Hello Daniel, we are looking for a few Solar Panel Installers and we'd like to meet at your earliest convenience. Pick a time below and I'll send you a Zoom link.",
    date: "4/10/26",
    time: "4:40pm",
    read: false,
    expiresIn: "24h",
    proposedSlots: [
      { date: "Tuesday, March 26", time: "2:00 PM", iso: "2026-03-26T14:00" },
      { date: "Wednesday, March 27", time: "10:30 AM", iso: "2026-03-27T10:30" },
      { date: "Thursday, March 28", time: "4:00 PM", iso: "2026-03-28T16:00" },
    ],
  },
  {
    id: "3",
    companyName: "BetterRoofs",
    contactName: "Karina Mitchell",
    type: "direct_hire",
    subject: "Direct Hire Request",
    preview:
      "Congrats on completing our Solar Installs Program. We would like to hire you for the...",
    fullBody:
      "Congrats on completing our Solar Installs Program. We would like to hire you for the Summer and Fall installs this year and to continue on for the full Spring, Summer, and Fall install season next year. We start June 15 and we pay $65/hr including medical benefits, dental and vision.",
    date: "4/12/26",
    time: "10:15am",
    read: true,
    expiresIn: "72h",
    payOffer: "$65/hr",
    benefits: "Medical, dental, vision",
  },
  {
    id: "4",
    companyName: "SunSystems Inc",
    contactName: "Toni Townsend",
    type: "interview",
    subject: "Request for Interview",
    preview:
      "Would you be available to meet next week for an interview with our Project Manager...",
    fullBody:
      "Would you be available to meet next week for an interview with our Project Manager? We have several openings on our residential solar team and your profile matches well.",
    date: "4/13/26",
    time: "11:45am",
    read: true,
    expiresIn: "24h",
    proposedSlots: [
      { date: "Monday, May 5", time: "1:00 PM", iso: "2026-05-05T13:00" },
      { date: "Tuesday, May 6", time: "11:00 AM", iso: "2026-05-06T11:00" },
      { date: "Wednesday, May 7", time: "3:00 PM", iso: "2026-05-07T15:00" },
    ],
  },
];

export default function MessagesPage() {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [respondedIds, setRespondedIds] = useState<Set<string>>(new Set());

  // Custom availability fallback ("Suggest another time")
  const [customMode, setCustomMode] = useState<string | null>(null); // message id
  const [customDate, setCustomDate] = useState("");
  const [customMessage, setCustomMessage] = useState("");

  useEffect(() => {
    const profile = localStorage.getItem("payranker_profile_complete");
    if (!profile) {
      router.push("/profile");
      return;
    }
    setMessages(MOCK_MESSAGES);
    const saved = localStorage.getItem("payranker_responded");
    if (saved) setRespondedIds(new Set(JSON.parse(saved)));
  }, [router]);

  function toggleMessage(id: string) {
    setExpandedId(expandedId === id ? null : id);
    setCustomMode(null);
  }

  function respond(id: string) {
    const updated = new Set(respondedIds);
    updated.add(id);
    setRespondedIds(updated);
    localStorage.setItem(
      "payranker_responded",
      JSON.stringify(Array.from(updated))
    );
    setCustomMode(null);
  }

  return (
    <div className="min-h-screen bg-warmwhite flex flex-col">
      {/* White top bar with nav */}
      <header className="bg-white border-b border-gray-100 py-5 px-6">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <a href="/">
            <Image
              src="/payranker-logo.png"
              alt="PayRanker"
              width={220}
              height={46}
              priority
            />
          </a>
          <nav className="flex items-center gap-5">
            <a
              href="/skills"
              className="text-sm font-semibold text-graytext hover:text-gray-700 transition-colors hidden sm:inline"
            >
              Your Skills
            </a>
            <a
              href="/matches"
              className="text-sm font-semibold text-graytext hover:text-gray-700 transition-colors hidden sm:inline"
            >
              Your Matches
            </a>
            <span className="text-sm font-semibold text-magenta">Messages</span>
            <Image
              src="/arrowhead-filled.png"
              alt=""
              width={20}
              height={12}
              aria-hidden="true"
              className="hidden sm:inline"
            />
            <button className="text-magenta hover:text-magenta-dark">
              <svg
                width="24"
                height="24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <path d="M3 11h18M3 5.5h18M3 16.5h18" />
              </svg>
            </button>
          </nav>
        </div>
      </header>

      <main className="flex-1 max-w-5xl mx-auto w-full px-6 pt-8 pb-12">
        <p className="text-xs font-bold text-graytext uppercase tracking-wider mb-4">
          Your Inbox
        </p>

        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          {messages.map((msg) => {
            const isExpanded = expandedId === msg.id;
            const hasResponded = respondedIds.has(msg.id);
            const isDirectHire = msg.type === "direct_hire";
            const isCustomMode = customMode === msg.id;

            return (
              <div
                key={msg.id}
                className="border-b border-gray-100 last:border-0"
              >
                {/* Collapsed header — always visible */}
                <button
                  onClick={() => toggleMessage(msg.id)}
                  className="w-full text-left px-6 py-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-magenta text-sm">
                        {msg.companyName}
                      </p>
                      <p
                        className={`text-sm font-medium mt-0.5 ${
                          isDirectHire
                            ? "text-green-600 font-bold"
                            : "text-gray-600"
                        }`}
                      >
                        {msg.subject} by {msg.contactName}
                      </p>
                      {!isExpanded && (
                        <p className="text-xs text-graytext mt-1 truncate italic">
                          {msg.preview}
                        </p>
                      )}
                    </div>
                    <p className="text-xs text-graytext whitespace-nowrap shrink-0">
                      {msg.date} • {msg.time}
                    </p>
                  </div>
                </button>

                {/* Expanded */}
                {isExpanded && (
                  <div className="px-6 pb-5 animate-fade-in">
                    <p className="text-sm text-gray-700 leading-relaxed mb-5">
                      {msg.fullBody}
                    </p>

                    {hasResponded ? (
                      <p className="text-sm text-graytext italic flex items-center gap-1.5">
                        <Check size={14} className="text-green-600" />
                        {isDirectHire
                          ? "You accepted this offer."
                          : "Your time selection was sent."}
                      </p>
                    ) : isDirectHire ? (
                      // ─── DIRECT HIRE OFFER FLOW ──────────────────────
                      <>
                        <div className="flex items-center justify-center gap-3">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              respond(msg.id);
                            }}
                            className="px-6 py-2.5 rounded-full text-sm font-bold text-gray-600 bg-gray-200 hover:bg-gray-300 transition-colors"
                          >
                            Pass
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              respond(msg.id);
                            }}
                            className="inline-flex items-center gap-1.5 px-6 py-2.5 rounded-full text-sm font-bold text-white bg-green-600 hover:bg-green-700 transition-colors"
                          >
                            Review Offer <ArrowRight size={14} />
                          </button>
                        </div>
                        <p className="text-xs text-graytext italic text-center mt-3">
                          Expires in {msg.expiresIn || "72h"}.
                        </p>
                      </>
                    ) : (
                      // ─── INTERVIEW REQUEST FLOW ──────────────────────
                      <>
                        {!isCustomMode ? (
                          <>
                            {/* Time slot picker */}
                            {msg.proposedSlots && (
                              <div className="space-y-2 mb-4">
                                {msg.proposedSlots.map((slot, i) => (
                                  <button
                                    key={i}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      respond(msg.id);
                                    }}
                                    className="w-full px-5 py-3 rounded-xl border-2 border-gray-200 hover:border-magenta hover:bg-magenta/5 transition-all text-left flex items-center justify-between group"
                                  >
                                    <div>
                                      <p className="text-sm font-semibold text-gray-900">
                                        {slot.date}
                                      </p>
                                      <p className="text-xs text-graytext">
                                        {slot.time}
                                      </p>
                                    </div>
                                    <ArrowRight
                                      size={16}
                                      className="text-gray-300 group-hover:text-magenta transition-colors"
                                    />
                                  </button>
                                ))}
                              </div>
                            )}

                            {/* Action buttons */}
                            <div className="flex items-center justify-center gap-3">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  respond(msg.id);
                                }}
                                className="px-6 py-2.5 rounded-full text-sm font-bold text-gray-600 bg-gray-200 hover:bg-gray-300 transition-colors"
                              >
                                Not Interested
                              </button>
                            </div>

                            <div className="text-center mt-3">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setCustomMode(msg.id);
                                }}
                                className="text-xs text-magenta font-semibold hover:underline"
                              >
                                Can&apos;t make these times? Suggest another
                                time →
                              </button>
                            </div>

                            <p className="text-xs text-graytext italic text-center mt-3">
                              Expires in {msg.expiresIn || "24h"}. Responding
                              quickly increases your visibility.
                            </p>
                          </>
                        ) : (
                          // ─── CUSTOM AVAILABILITY FALLBACK ────────────
                          <div
                            className="bg-magenta/5 rounded-xl p-4 border border-magenta/20"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <p className="text-sm font-bold text-magenta mb-3">
                              Let us know your availability
                            </p>

                            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">
                              I&apos;m available on or after
                            </label>
                            <input
                              type="date"
                              value={customDate}
                              onChange={(e) => setCustomDate(e.target.value)}
                              className="w-full px-4 py-2.5 rounded-xl border-2 border-magenta/30 bg-white focus:outline-none focus:border-magenta text-sm mb-3"
                            />

                            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">
                              Optional message
                            </label>
                            <textarea
                              value={customMessage}
                              onChange={(e) =>
                                setCustomMessage(e.target.value)
                              }
                              placeholder="e.g., I'm available after 5pm, have flexibility for a wedding, but available after March 28."
                              rows={3}
                              className="w-full px-4 py-2.5 rounded-xl border-2 border-magenta/30 bg-white focus:outline-none focus:border-magenta text-sm mb-3 resize-none"
                            />

                            <div className="flex items-center justify-end gap-3">
                              <button
                                onClick={() => setCustomMode(null)}
                                className="px-4 py-2 rounded-full text-xs font-bold text-gray-600 bg-gray-200 hover:bg-gray-300 transition-colors"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={() => respond(msg.id)}
                                disabled={!customDate}
                                className="inline-flex items-center gap-1.5 px-5 py-2 rounded-full text-xs font-bold text-white bg-magenta hover:bg-magenta-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                Send Availability <ArrowRight size={12} />
                              </button>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {messages.length === 0 && (
            <div className="p-8 text-center">
              <p className="text-sm text-graytext font-medium">
                No messages yet. Apply to jobs to start receiving messages from
                employers.
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

