import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const viewport: Viewport = {
  themeColor: "#E91E9C",
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  title: "PayRanker — Find the highest-paying jobs for your skills",
  description:
    "Enter your skills in plain English. See jobs you qualify for right now, sorted by pay. Free for job seekers.",
  metadataBase: new URL("https://workpath-iota.vercel.app"),
  openGraph: {
    title: "PayRanker — Jobs listed by which pays you the most",
    description:
      "Find the highest-paying jobs for your skills. Free for job seekers.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable}>
      <head>
        {/* Native bridge — activates iOS features inside Capacitor */}
        <script src="/native-bridge.js" defer />
      </head>
      <body className="font-sans antialiased bg-warmwhite text-gray-900">
        {children}
      </body>
    </html>
  );
}
