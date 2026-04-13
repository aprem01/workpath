import type { Metadata } from "next";
import SEOContent from "@/components/SEOContent";

export const metadata: Metadata = {
  title: "Your Inbox — Interview Requests & Direct Hire Offers",
  description:
    "View messages from employers. Interview requests, direct hire offers with pay details, and more. Reply, decline, or accept directly from your inbox.",
  alternates: { canonical: "https://workpath-iota.vercel.app/messages" },
};

export default function MessagesLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SEOContent
        title="Your PayRanker Inbox"
        description="The Messages page is your inbox for communications from employers. There are two types: Interview Requests (employers asking to meet) and Direct Hire Requests (employers offering you a position with pay and start date). Each message can be expanded inline to read the full content and respond with Decline, Reply, or Accept."
        bullets={[
          "Interview Requests — employers asking to schedule an interview",
          "Direct Hire Requests — employers offering you a position with pay and terms",
          "Tap any message to expand and read the full text",
          "Decline, Reply, or Accept directly from the inbox",
          "Your anonymous handle is what employers see until you choose to reveal",
        ]}
      />
      {children}
    </>
  );
}
