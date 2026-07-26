export default function BetaBanner() {
  return (
    <div className="bg-magenta/5 border-b border-magenta/10 text-[12px] text-graytext text-center py-1.5 px-4">
      <span className="font-semibold text-magenta">Chicago Beta</span>{" "}
      &middot; Live jobs and training near Chicago. Coverage in other
      metros is limited.{" "}
      <a href="/eeo" className="underline hover:text-magenta">
        Equal opportunity
      </a>
      .
    </div>
  );
}
