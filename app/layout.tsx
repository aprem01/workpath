import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "WorkPath — Your skills are worth more than you think",
  description:
    "Find jobs you already qualify for and discover what's 1-2 skills away. AI-powered skill matching for job seekers.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="font-body antialiased bg-offwhite text-gray-900">
        {children}
      </body>
    </html>
  );
}
