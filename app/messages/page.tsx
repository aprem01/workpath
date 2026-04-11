"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Check } from "lucide-react";

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
}

// Mock messages — in production these come from the DB
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
      "Hi Daniel, we would love to meet you here at Solar Tech. How is Wednesday April 24 at 2pm? We're looking for someone with your exact skill set to join our installation team. Please let us know 3 earliest times when you are available for an interview and I'll send you a Zoom link.",
    date: "4/10/26",
    time: "3:15pm",
    read: false,
  },
  {
    id: "2",
    companyName: "SunPower",
    contactName: "Myriam Nijab",
    type: "interview",
    subject: "Request for Interview",
    preview:
      "Hello Daniel, we are looking for a few Solar Panel Installers and we would like to meet...",
    fullBody:
      "Hello Daniel, we are looking for a few Solar Panel Installers and we would like to meet with you at your earliest convenience to discuss details of the positions and if you would be a good fit. Please let us know 3 earliest times when you are available for an interview and I'll send you a Zoom link.",
    date: "4/10/26",
    time: "4:40pm",
    read: false,
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
      "Would you be available to meet next week for an interview with our Project Manager? We have several openings on our residential solar team and your profile matches well. We offer competitive pay starting at $42/hr with benefits after 90 days.",
    date: "4/13/26",
    time: "11:45am",
    read: true,
  },
];

export default function MessagesPage() {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [respondedIds, setRespondedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    // Check if user has a profile
    const profile = localStorage.getItem("payranker_profile_complete");
    if (!profile) {
      router.push("/profile");
      return;
    }
    setMessages(MOCK_MESSAGES);

    // Load responded IDs
    const saved = localStorage.getItem("payranker_responded");
    if (saved) setRespondedIds(new Set(JSON.parse(saved)));
  }, [router]);

  function toggleMessage(id: string) {
    setExpandedId(expandedId === id ? null : id);
  }

  function respond(id: string) {
    const updated = new Set(respondedIds);
    updated.add(id);
    setRespondedIds(updated);
    localStorage.setItem(
      "payranker_responded",
      JSON.stringify(Array.from(updated))
    );
  }

  return (
    <div className="min-h-screen bg-warmwhite flex flex-col">
      {/* White top bar with full nav */}
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
            <span className="text-sm font-semibold text-magenta">
              Messages
            </span>
            {/* Filled down-arrow nav element */}
            <Image
              src="/arrowhead-filled.png"
              alt=""
              width={20}
              height={12}
              aria-hidden="true"
              className="hidden sm:inline"
            />
            {/* Hamburger */}
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

        {/* Message list */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          {messages.map((msg) => {
            const isExpanded = expandedId === msg.id;
            const hasResponded = respondedIds.has(msg.id);
            const isDirectHire = msg.type === "direct_hire";

            return (
              <div
                key={msg.id}
                className="border-b border-gray-100 last:border-0"
              >
                {/* Collapsed row */}
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

                {/* Expanded message body */}
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
                          : "You replied to this message."}
                      </p>
                    ) : (
                      <>
                        <div className="flex items-center justify-center gap-3">
                          {/* Decline — gray pill */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              respond(msg.id);
                            }}
                            className="px-6 py-2.5 rounded-full text-sm font-bold text-gray-600 bg-gray-200 hover:bg-gray-300 transition-colors"
                          >
                            Decline
                          </button>

                          {/* Reply or Accept — magenta or green pill */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              respond(msg.id);
                            }}
                            className={`px-6 py-2.5 rounded-full text-sm font-bold text-white transition-colors inline-flex items-center gap-1.5 ${
                              isDirectHire
                                ? "bg-green-600 hover:bg-green-700"
                                : "bg-magenta hover:bg-magenta-dark"
                            }`}
                          >
                            {isDirectHire ? "Accept" : "Reply"}
                            <Image
                              src="/arrowhead-filled.png"
                              alt=""
                              width={12}
                              height={8}
                              className="rotate-[-90deg] brightness-0 invert"
                              aria-hidden="true"
                            />
                          </button>
                        </div>

                        {isDirectHire && (
                          <p className="text-xs text-graytext italic text-center mt-2">
                            if you accept, review and sign the company&apos;s
                            contract
                          </p>
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
