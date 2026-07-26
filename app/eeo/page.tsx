import PageShell from "@/components/PageShell";

export const metadata = {
  title: "Equal Opportunity Statement — PayRanker",
  description: "PayRanker's commitment to equal opportunity and non-discrimination.",
};

export default function EEOPage() {
  return (
    <PageShell
      title="Equal Opportunity Statement"
      subtitle="Last updated: July 2026"
    >
      <p>
        PayRanker is committed to equal opportunity for all workers. We
        do not tolerate discrimination on the basis of race, color,
        religion, national origin, sex, sexual orientation, gender
        identity or expression, age, disability, veteran status,
        marital status, pregnancy, genetic information, or any other
        legally protected characteristic.
      </p>

      <h2>How this applies to job matching</h2>
      <p>
        Our matching engine ranks jobs by pay and skill fit — never by
        the demographic attributes of the job seeker. Skill baskets are
        the only input to which jobs surface. Optional profile fields
        (veteran status, disability status, work authorization) are
        collected because some employers offer targeted programs
        (veteran hiring initiatives, ADA accommodations) — they are
        never used to hide jobs from you.
      </p>

      <h2>How this applies to employers on Skilmatch</h2>
      <p>
        Employers using our Skilmatch platform agree to non-discrimination
        as a term of service. Employers may not filter candidates by
        protected class, and our platform does not expose demographic
        attributes to employers unless a candidate has explicitly opted
        into a targeted program.
      </p>

      <h2>Accommodations</h2>
      <p>
        We provide reasonable accommodations for job seekers with
        disabilities using our platform. If you need an accommodation,
        please <a href="/contact">contact us</a>.
      </p>

      <h2>Concerns</h2>
      <p>
        If you believe you have experienced discrimination through our
        platform or by an employer using our platform, please{" "}
        <a href="/contact">contact us</a>. You may also file a complaint
        with the U.S. Equal Employment Opportunity Commission at{" "}
        <a href="https://www.eeoc.gov" target="_blank" rel="noopener noreferrer">
          eeoc.gov
        </a>{" "}
        or the Illinois Department of Human Rights.
      </p>
    </PageShell>
  );
}
