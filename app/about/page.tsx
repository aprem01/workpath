import PageShell from "@/components/PageShell";

export const metadata = {
  title: "About — PayRanker",
  description:
    "PayRanker is a Chicago-based labor-market platform for hourly workers, starting with the Home Health Aide vertical.",
};

export default function AboutPage() {
  return (
    <PageShell
      title="About PayRanker"
      subtitle="A Chicago-based labor-market platform for hourly workers."
    >
      <p>
        PayRanker is a beta product currently focused on the Chicago metro
        area, starting with the Home Health Aide / caregiver vertical. We
        combine BLS wage and projection data, real Chicago job listings,
        and an O*NET-derived skill taxonomy to surface the highest-paying
        jobs a worker&apos;s current skills already qualify them for — and
        the specific training that unlocks the next pay tier.
      </p>

      <h2>How we build</h2>
      <p>
        We ship weekly with our Chicago beta cohort. Every match, every
        training suggestion, every skill normalization is reviewed with
        real workers before it goes live. If a worker types
        &quot;caregiving&quot; and we return &quot;Home Health Aide&quot;
        that&apos;s a call we made after talking to the people it&apos;s
        for.
      </p>

      <h2>Chicago Beta</h2>
      <p>
        We are operating as an early beta program. Job data comes from
        real listings; training data comes from real providers.
        Coverage outside Chicago is limited today and is expanding as we
        onboard additional metros.
      </p>

      <h2>Contact</h2>
      <p>
        For product questions, press, or partnerships:{" "}
        <a href="/contact">use our contact form</a>.
      </p>
    </PageShell>
  );
}
