"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Check, ArrowRight } from "lucide-react";
import AppHeader from "@/components/AppHeader";

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

  // Track the *type* of response per message so the confirmation copy is accurate
  const [responseTypes, setResponseTypes] = useState<Record<string, string>>(
    {}
  );

  useEffect(() => {
    const profile = localStorage.getItem("payranker_profile_complete");
    if (!profile) {
      // /profile has noindex; redirecting there from an indexable page
      // makes Lighthouse think /messages is also blocked. Send unfunneled
      // visitors to /skills instead — start of the basket flow.
      router.push("/skills");
      return;
    }
    // Caroline 7/28 Round 7: seeding MOCK_MESSAGES made the inbox look
    // pre-populated for every visitor, which was misleading. Inbox stays
    // empty until real interview / direct-hire requests arrive. MOCK_MESSAGES
    // remains defined above only for local dev — set NEXT_PUBLIC_MSG_DEMO=1
    // to opt in.
    if (process.env.NEXT_PUBLIC_MSG_DEMO === "1") {
      setMessages(MOCK_MESSAGES);
    }
    const saved = localStorage.getItem("payranker_responded");
    if (saved) setRespondedIds(new Set(JSON.parse(saved)));
    const types = localStorage.getItem("payranker_response_types");
    if (types) {
      try {
        setResponseTypes(JSON.parse(types));
      } catch {}
    }
    // Caroline 8/23 Round 8: fetch real interview requests for the
    // logged-in candidate.
    void loadInterviewRequests();
  }, [router]);

  const [interviewRequests, setInterviewRequests] = useState<
    Array<{
      id: string;
      status: string;
      appliedAt: string;
      job: {
        id: string;
        title: string;
        employer: string;
        location: string;
        payMin: number;
        payMax: number;
      };
    }>
  >([]);
  const [canAccept, setCanAccept] = useState(true);
  const [acceptTarget, setAcceptTarget] = useState<string | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [workAuth, setWorkAuth] = useState("");
  const [acceptState, setAcceptState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [acceptError, setAcceptError] = useState("");

  async function loadInterviewRequests() {
    try {
      const res = await fetch("/api/candidate/interview-requests", {
        credentials: "include",
      });
      if (!res.ok) return;
      const data = await res.json();
      setInterviewRequests(data.requests || []);
      setCanAccept(!!data.canAccept);
    } catch {
      // network failure — inbox will just show what it has locally
    }
  }

  async function submitAccept() {
    if (!acceptTarget) return;
    setAcceptState("sending");
    setAcceptError("");
    try {
      const res = await fetch(
        `/api/candidate/interview-requests/${acceptTarget}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            action: "accept",
            pii: canAccept
              ? undefined
              : {
                  firstName: firstName.trim() || undefined,
                  lastName: lastName.trim() || undefined,
                  phone: phone.trim() || undefined,
                  workAuthStatus: workAuth.trim() || undefined,
                },
          }),
        }
      );
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error === "profile_incomplete" ? j.message : (j.error || "Failed"));
      }
      setAcceptState("sent");
      await loadInterviewRequests();
      setTimeout(() => setAcceptTarget(null), 1200);
    } catch (err) {
      setAcceptState("error");
      setAcceptError(err instanceof Error ? err.message : "Failed");
    }
  }

  function toggleMessage(id: string) {
    setExpandedId(expandedId === id ? null : id);
    setCustomMode(null);
  }

  /**
   * action: "time_selected" | "not_interested" | "custom_time"
   *       | "accept_offer" | "pass_offer"
   */
  function respond(id: string, action: string) {
    const updated = new Set(respondedIds);
    updated.add(id);
    setRespondedIds(updated);
    localStorage.setItem(
      "payranker_responded",
      JSON.stringify(Array.from(updated))
    );
    const types = { ...responseTypes, [id]: action };
    setResponseTypes(types);
    localStorage.setItem("payranker_response_types", JSON.stringify(types));
    setCustomMode(null);
  }

  return (
    <div className="min-h-screen bg-warmwhite flex flex-col">
      <AppHeader />

      <main className="flex-1 max-w-5xl mx-auto w-full px-6 pt-8 pb-12">
        {/* Caroline 8/23 Round 8 P03: Interview requests panel. When the
            candidate lacks first name / last name / phone / work auth,
            Accept opens a PII-completion modal — those fields must be on
            file before employers see anything beyond the anonymous
            handle. */}
        {interviewRequests.length > 0 && (
          <div className="mb-8">
            <p className="text-xs font-bold text-graytext uppercase tracking-wider mb-3">
              Interview requests
            </p>
            <div className="space-y-3">
              {interviewRequests.map((r) => (
                <div
                  key={r.id}
                  className="bg-white rounded-2xl border-2 border-magenta/25 p-4 shadow-sm"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold text-gray-800">
                        {r.job.employer} — {r.job.title}
                      </p>
                      <p className="text-xs text-graytext mt-0.5">
                        {r.job.location} · ${(r.job.payMax / 100).toFixed(0)}/hr
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {r.status === "interview_accepted" ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-green-100 text-green-700">
                          ✓ Accepted
                        </span>
                      ) : (
                        <>
                          <button
                            onClick={() => {
                              setAcceptTarget(r.id);
                              setAcceptState("idle");
                              setAcceptError("");
                            }}
                            className="px-4 py-1.5 rounded-full text-xs font-bold bg-magenta text-white hover:bg-magenta-dark"
                          >
                            Accept
                          </button>
                          <button
                            onClick={async () => {
                              try {
                                await fetch(
                                  `/api/candidate/interview-requests/${r.id}`,
                                  {
                                    method: "PATCH",
                                    headers: { "Content-Type": "application/json" },
                                    credentials: "include",
                                    body: JSON.stringify({ action: "decline" }),
                                  }
                                );
                                await loadInterviewRequests();
                              } catch {
                                // network failure — UI will retry next mount
                              }
                            }}
                            className="px-4 py-1.5 rounded-full text-xs font-bold border border-gray-200 text-graytext hover:bg-gray-50"
                          >
                            Decline
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        <p className="text-xs font-bold text-graytext uppercase tracking-wider mb-4">
          Your Inbox
        </p>

        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          {messages.length === 0 && (
            <div className="px-6 py-16 flex flex-col items-center justify-center text-center">
              <div className="w-14 h-14 rounded-full bg-magenta/10 flex items-center justify-center mb-4">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#E725E2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                  <polyline points="22,6 12,13 2,6"/>
                </svg>
              </div>
              <p className="text-gray-900 font-bold text-base mb-1">No messages yet</p>
              <p className="text-graytext text-sm max-w-xs">
                When an employer reaches out about your skills, you&rsquo;ll see it here. Your profile stays anonymous until you choose to share.
              </p>
            </div>
          )}
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
                        {(() => {
                          const a = responseTypes[msg.id];
                          if (a === "accept_offer")
                            return "You accepted this offer.";
                          if (a === "pass_offer")
                            return "You passed on this offer.";
                          if (a === "time_selected")
                            return "Your time selection was sent.";
                          if (a === "custom_time")
                            return "Your availability was sent.";
                          if (a === "not_interested")
                            return "You marked this as not interested.";
                          return "Response sent.";
                        })()}
                      </p>
                    ) : isDirectHire ? (
                      // ─── DIRECT HIRE OFFER FLOW ──────────────────────
                      <>
                        <div className="flex items-center justify-center gap-3">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              respond(msg.id, "pass_offer");
                            }}
                            className="px-6 py-2.5 rounded-full text-sm font-bold text-gray-600 bg-gray-200 hover:bg-gray-300 transition-colors"
                          >
                            Pass
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              respond(msg.id, "accept_offer");
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
                                      respond(msg.id, "time_selected");
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
                                  respond(msg.id, "not_interested");
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
                                onClick={() => respond(msg.id, "custom_time")}
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

      {/* Caroline 8/23 Round 8 P03: PII-completion modal — required
          before accepting an interview request. If canAccept is true
          already we just confirm; otherwise we ask for first name,
          last name, phone, work-auth status. Employers see PII only
          after this modal completes. */}
      {acceptTarget && (
        <div
          className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center px-4"
          onClick={() => acceptState !== "sending" && setAcceptTarget(null)}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-800">
                {canAccept
                  ? "Accept interview request"
                  : "Complete your profile"}
              </h3>
              <p className="text-xs text-graytext mt-1">
                {canAccept
                  ? "Confirming will reveal your name and phone to this employer."
                  : "Employers see your details only after you accept an interview. Please add these before we send the accept confirmation."}
              </p>
            </div>
            {acceptState === "sent" ? (
              <div className="px-6 py-8 text-center">
                <p className="text-base font-bold text-green-700 mb-1">
                  Interview accepted.
                </p>
                <p className="text-sm text-graytext">
                  The employer now sees your contact details.
                </p>
              </div>
            ) : (
              <div className="px-6 py-5 space-y-3">
                {!canAccept && (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <label className="block text-sm">
                        <span className="font-semibold text-gray-700">First name</span>
                        <input
                          className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-200 outline-none focus:border-magenta focus:ring-1 focus:ring-magenta text-sm"
                          value={firstName}
                          onChange={(e) => setFirstName(e.target.value)}
                          required
                          autoComplete="given-name"
                        />
                      </label>
                      <label className="block text-sm">
                        <span className="font-semibold text-gray-700">Last name</span>
                        <input
                          className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-200 outline-none focus:border-magenta focus:ring-1 focus:ring-magenta text-sm"
                          value={lastName}
                          onChange={(e) => setLastName(e.target.value)}
                          required
                          autoComplete="family-name"
                        />
                      </label>
                    </div>
                    <label className="block text-sm">
                      <span className="font-semibold text-gray-700">Phone</span>
                      <input
                        type="tel"
                        className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-200 outline-none focus:border-magenta focus:ring-1 focus:ring-magenta text-sm"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        required
                        autoComplete="tel"
                      />
                    </label>
                    <label className="block text-sm">
                      <span className="font-semibold text-gray-700">Work authorization</span>
                      <select
                        className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-200 outline-none focus:border-magenta focus:ring-1 focus:ring-magenta text-sm bg-white"
                        value={workAuth}
                        onChange={(e) => setWorkAuth(e.target.value)}
                        required
                      >
                        <option value="">Select…</option>
                        <option value="authorized">Authorized to work in the U.S.</option>
                        <option value="need_sponsorship">Will need sponsorship</option>
                        <option value="prefer_not_to_say">Prefer not to say</option>
                      </select>
                    </label>
                  </>
                )}
                {acceptState === "error" && (
                  <p className="text-sm text-red-600" role="alert">
                    {acceptError}
                  </p>
                )}
                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    onClick={() => setAcceptTarget(null)}
                    disabled={acceptState === "sending"}
                    className="text-sm font-semibold text-graytext hover:text-magenta disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={submitAccept}
                    disabled={acceptState === "sending"}
                    className="px-5 py-2 rounded-full text-white font-bold bg-magenta hover:bg-magenta-dark disabled:opacity-60"
                  >
                    {acceptState === "sending" ? "Sending…" : "Accept interview"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

