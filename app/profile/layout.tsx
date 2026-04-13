import type { Metadata } from "next";
import SEOContent from "@/components/SEOContent";

export const metadata: Metadata = {
  title: "Create Your Anonymous Profile",
  description:
    "Your profile is invisible to employers. They only see your anonymous handle when you apply to jobs. Minimal info required to get started — just email, password, and zip code.",
  alternates: { canonical: "https://workpath-iota.vercel.app/profile" },
  robots: { index: false },
};

export default function ProfileLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SEOContent
        title="Create Your Anonymous Profile on PayRanker"
        description="The PayRanker profile is anonymous by default. Employers cannot see your personal details. They only see your auto-generated anonymous handle — a name like 'KeeTo325' — when you apply to jobs. You choose when to reveal your real name. The basic profile requires only email, password, and zip code. A full profile (name, phone, work authorization, veteran status, disability status) unlocks richer matching."
        bullets={[
          "Anonymous handle auto-generated — employers only see this until you reveal",
          "Basic profile: email + password + zip code",
          "Full profile unlocks richer matching: first name, last name, phone, work authorization, veteran status, disability accommodation needs",
          "Zip code used to find in-person training resources near you",
          "Profile stored securely, never shared without your consent",
        ]}
      />
      {children}
    </>
  );
}
