import type { Metadata, Viewport } from "next";
import { Sora, DM_Sans } from "next/font/google";
import "./globals.css";

const sora = Sora({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-sora",
  display: "swap",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  display: "swap",
});

export const viewport: Viewport = {
  themeColor: "#0D9488",
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  title: "WorkPath — Your skills are worth more than you think",
  description:
    "Find jobs you already qualify for and discover what's 1-2 skills away. AI-powered skill matching for job seekers.",
  metadataBase: new URL("https://workpath.vercel.app"),
  openGraph: {
    title: "WorkPath — Your skills are worth more than you think",
    description:
      "Find jobs you already qualify for and discover what's 1-2 skills away.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${sora.variable} ${dmSans.variable}`}>
      <body className="font-body antialiased bg-offwhite text-gray-900">
        {children}
      </body>
    </html>
  );
}
