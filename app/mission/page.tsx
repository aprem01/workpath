import PageShell from "@/components/PageShell";

export const metadata = {
  title: "Our Mission — PayRanker",
  description:
    "PayRanker exists to help hourly workers see the highest-paying jobs their real skills already qualify them for.",
};

export default function MissionPage() {
  return (
    <PageShell
      title="Our Mission"
      subtitle="You have more skills than you think. Our job is to make sure they pay you what they're worth."
    >
      <p>
        PayRanker exists because the labor market is quietly punishing millions
        of hourly workers who already have the skills to earn more — but who
        never see the jobs that would pay them for those skills. Job boards
        ask for a resume most workers don&apos;t have and rank listings by
        keyword, not by what the person actually knows how to do.
      </p>

      <h2>What we do</h2>
      <p>
        You tell us what you can do — in plain English. Cooking, driving,
        CPR, customer service, whatever it is. We translate those into the
        professional terms employers search for, cluster them by industry,
        and surface the highest-paying real jobs in your area that already
        match. For roles that are one or two skills away, we show you
        exactly which training options unlock the pay bump — online and
        in-person, near your ZIP code.
      </p>

      <h2>Who we serve first</h2>
      <p>
        Chicago is our first city, and Home Health Aides / caregivers are
        our first cohort. It&apos;s an industry where a worker doing
        $18/hr caregiving is often 0-1 certifications away from $26/hr
        specialty work — but the map from &quot;what I can do&quot; to
        &quot;what pays more&quot; has never been visible. We&apos;re
        making it visible.
      </p>

      <h2>What we don&apos;t do</h2>
      <ul>
        <li>We don&apos;t hide the highest-paying jobs behind a paywall.</li>
        <li>We don&apos;t inflate your skills into &quot;out of your league&quot; jargon that gets your application ignored.</li>
        <li>We don&apos;t share your data with employers unless you actively apply.</li>
      </ul>

      <p>
        We&apos;re a Chicago beta. If a job we surfaced changed your pay,
        or a suggestion missed the mark, we want to hear it —{" "}
        <a href="/contact">tell us here</a>.
      </p>
    </PageShell>
  );
}
