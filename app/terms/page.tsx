import PageShell from "@/components/PageShell";

export const metadata = {
  title: "Terms of Service — PayRanker",
  description: "Terms of Service for PayRanker.io.",
};

export default function TermsPage() {
  return (
    <PageShell
      title="Terms of Service"
      subtitle="Last updated: July 2026 · Chicago Beta Program"
    >
      <p>
        These Terms of Service (&quot;Terms&quot;) govern your use of
        PayRanker.io (&quot;PayRanker&quot;, &quot;we&quot;,
        &quot;us&quot;). By creating an account or using the service you
        agree to these Terms.
      </p>

      <h2>1. Beta Program</h2>
      <p>
        PayRanker is currently operated as a beta program in Chicago. Job
        matches, wage estimates, and training suggestions are provided
        for informational purposes and may contain errors. We do not
        guarantee that any job listing is currently open, that any
        employer will respond, or that any wage estimate reflects the
        offer a specific employer will make.
      </p>

      <h2>2. Your Account</h2>
      <p>
        You are responsible for the accuracy of information you enter,
        including your skills, ZIP code, and any contact details. You
        agree not to impersonate another person or misrepresent your
        skills to obtain employment.
      </p>

      <h2>3. Employer Data</h2>
      <p>
        We do not share personally identifying information with
        employers unless you actively apply, message, or opt into
        recruiter contact. Skills you enter are used to match you to
        jobs and, in aggregate anonymized form, to improve the platform.
      </p>

      <h2>4. Third-Party Content</h2>
      <p>
        Job listings, training providers, and wage data are sourced from
        third parties including the U.S. Bureau of Labor Statistics,
        O*NET, and public job APIs. We are not responsible for the
        content of any external site linked from PayRanker.
      </p>

      <h2>5. Prohibited Use</h2>
      <ul>
        <li>Scraping or bulk-extracting data from the platform.</li>
        <li>Reselling matches or training suggestions.</li>
        <li>Using PayRanker to send unsolicited messages to workers.</li>
      </ul>

      <h2>6. Termination</h2>
      <p>
        We may suspend or terminate accounts that violate these Terms.
        You may delete your account at any time by contacting us.
      </p>

      <h2>7. Disclaimer</h2>
      <p>
        THE SERVICE IS PROVIDED &quot;AS IS&quot;. WE DISCLAIM ALL
        WARRANTIES, EXPRESS OR IMPLIED, INCLUDING FITNESS FOR A
        PARTICULAR PURPOSE. WE ARE NOT AN EMPLOYMENT AGENCY AND DO NOT
        GUARANTEE EMPLOYMENT OUTCOMES.
      </p>

      <h2>8. Contact</h2>
      <p>
        Questions about these Terms? <a href="/contact">Contact us</a>.
      </p>
    </PageShell>
  );
}
