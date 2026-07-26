import PageShell from "@/components/PageShell";

export const metadata = {
  title: "Cookie Notice — PayRanker",
  description: "How PayRanker uses cookies and browser storage.",
};

export default function CookiesPage() {
  return (
    <PageShell
      title="Cookie Notice"
      subtitle="Last updated: July 2026"
    >
      <p>
        PayRanker uses a small number of cookies and browser storage
        mechanisms to make the site work. We do not use cookies for
        cross-site tracking or third-party advertising.
      </p>

      <h2>Essential</h2>
      <ul>
        <li>
          <strong>Local storage</strong> — Your entered skills, ZIP code,
          and preferences are stored in your browser so you don&apos;t
          re-enter them each visit. This never leaves your device unless
          you actively create a profile.
        </li>
        <li>
          <strong>Session</strong> — Short-lived cookies keep you signed
          in during a browsing session.
        </li>
      </ul>

      <h2>Analytics</h2>
      <p>
        We track anonymized event counts (page views, match reveals,
        training clicks) to understand what&apos;s working. No
        personally identifying information is included in these events.
      </p>

      <h2>Your controls</h2>
      <p>
        You can clear PayRanker&apos;s local storage at any time from
        your browser&apos;s privacy settings. Doing so will reset your
        skill basket and preferences.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about cookies? <a href="/contact">Contact us</a>.
      </p>
    </PageShell>
  );
}
