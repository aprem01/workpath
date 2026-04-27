import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const BASE_URL = "https://workpath-iota.vercel.app";

export const viewport: Viewport = {
  themeColor: "#E725E2",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export const metadata: Metadata = {
  title: {
    default: "PayRanker — Find the highest-paying jobs for your skills",
    template: "%s | PayRanker",
  },
  description:
    "Enter your skills in plain English. See jobs you qualify for right now, sorted by pay — not date. Discover what's just 1-2 skills away. Free for job seekers.",
  metadataBase: new URL(BASE_URL),
  applicationName: "PayRanker",
  authors: [{ name: "PayRanker" }],
  generator: "Next.js",
  keywords: [
    "jobs",
    "job search",
    "skills",
    "pay",
    "salary",
    "career change",
    "hiring",
    "Chicago jobs",
    "home health aide",
    "caregiving jobs",
    "upskill",
    "certification",
    "AI-proof jobs",
    "skill-based hiring",
    "anonymous job search",
  ],
  creator: "PayRanker",
  publisher: "PayRanker",
  alternates: {
    canonical: BASE_URL,
  },
  openGraph: {
    title: "PayRanker — Jobs listed by which pays you the most",
    description:
      "Find the highest-paying jobs for your skills. Enter skills in plain English. Free for job seekers.",
    type: "website",
    url: BASE_URL,
    siteName: "PayRanker",
    locale: "en_US",
    images: [
      {
        url: `${BASE_URL}/payranker-logo.png`,
        width: 1200,
        height: 630,
        alt: "PayRanker — Skills-based job matching",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "PayRanker — Find the highest-paying jobs for your skills",
    description:
      "Enter your skills in plain English. See jobs sorted by pay. Free for job seekers.",
    images: [`${BASE_URL}/payranker-logo.png`],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  category: "business",
};

// JSON-LD structured data for AI crawlers + search engines
const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${BASE_URL}/#organization`,
      name: "PayRanker",
      url: BASE_URL,
      logo: {
        "@type": "ImageObject",
        url: `${BASE_URL}/payranker-logo.png`,
        width: 220,
        height: 46,
      },
      description:
        "Skill-based job matching platform. Jobs sorted by pay, not date. Free for job seekers.",
      sameAs: ["https://skillmatch-red.vercel.app"],
    },
    {
      "@type": "WebSite",
      "@id": `${BASE_URL}/#website`,
      url: BASE_URL,
      name: "PayRanker",
      description:
        "Find the highest-paying jobs for your skills. Free for job seekers.",
      publisher: { "@id": `${BASE_URL}/#organization` },
      potentialAction: {
        "@type": "SearchAction",
        target: {
          "@type": "EntryPoint",
          urlTemplate: `${BASE_URL}/skills?skill={search_term_string}`,
        },
        "query-input": "required name=search_term_string",
      },
    },
    {
      "@type": "WebApplication",
      name: "PayRanker",
      url: BASE_URL,
      description:
        "AI-powered skill-based job matching. Enter skills in plain English, see jobs you qualify for now and jobs that are 1-2 skills away.",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web, iOS",
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
      },
      featureList: [
        "AI skill normalization",
        "Jobs sorted by pay (highest first)",
        "Skill gap analysis",
        "Free online + in-person training resources",
        "Anonymous job search",
        "Real-time job listings",
      ],
    },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable}>
      <head>
        {/* JSON-LD structured data — helps AI crawlers + search engines understand content */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="font-sans antialiased bg-warmwhite text-gray-900">
        {children}
      </body>
    </html>
  );
}
