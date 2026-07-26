import PageShell from "@/components/PageShell";

export const metadata = {
  title: "Privacy Policy — PayRanker",
  description: "How PayRanker collects, uses, and protects your data.",
};

export default function PrivacyPage() {
  return (
    <PageShell
      title="Privacy Policy"
      subtitle="Last updated: July 2026"
    >
      <p>
        PayRanker respects your privacy. This policy explains what we
        collect, how we use it, and the choices you have.
      </p>

      <h2>What we collect</h2>
      <ul>
        <li>Skills you enter and industry contexts you assign to them.</li>
        <li>Optional profile fields (ZIP code, preferred metro, contact handle).</li>
        <li>Interactions with job listings and training resources (which cards you open, apply, or dismiss).</li>
        <li>Basic device information (browser, screen size) for compatibility.</li>
      </ul>

      <h2>What we do NOT collect</h2>
      <ul>
        <li>Social Security numbers.</li>
        <li>Immigration or citizenship status.</li>
        <li>Bank or credit-card information (PayRanker is free for workers).</li>
      </ul>

      <h2>How we use it</h2>
      <ul>
        <li>To match your skills to real jobs and training providers.</li>
        <li>To improve our skill taxonomy and matching quality (in aggregate).</li>
        <li>To debug crashes and errors.</li>
      </ul>

      <h2>Sharing</h2>
      <p>
        We do not sell your data. We do not share personally identifying
        information with employers unless you actively apply or opt into
        recruiter contact. Anonymized, aggregate skill data may be used
        to publish labor-market insights.
      </p>

      <h2>Your choices</h2>
      <ul>
        <li>Delete your saved skills at any time from the Skills page.</li>
        <li>Request account deletion by <a href="/contact">contacting us</a>.</li>
        <li>Use the site without a profile — skills are stored locally in your browser.</li>
      </ul>

      <h2>Cookies</h2>
      <p>
        See our <a href="/cookies">Cookie Notice</a> for details on the
        cookies and local storage we use.
      </p>

      <h2>Contact</h2>
      <p>
        Questions? <a href="/contact">Contact us</a>.
      </p>
    </PageShell>
  );
}
