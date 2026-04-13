/**
 * Server-rendered SEO content for client pages.
 *
 * This renders in the initial HTML so AI crawlers (GPTBot, ClaudeBot,
 * PerplexityBot) can read and cite the page even though the interactive
 * content is React-rendered client-side.
 *
 * Visually hidden but fully accessible + indexable.
 */

interface SEOContentProps {
  title: string;
  description: string;
  bullets?: string[];
  callToAction?: string;
}

export default function SEOContent({
  title,
  description,
  bullets,
  callToAction,
}: SEOContentProps) {
  return (
    <>
      {/* Fallback for crawlers that don't run JS — visible if JS disabled */}
      <noscript>
        <section className="p-8 max-w-2xl mx-auto">
          <h1 className="text-3xl font-bold text-magenta mb-4">{title}</h1>
          <p className="text-base text-gray-700 mb-6">{description}</p>
          {bullets && (
            <ul className="list-disc ml-6 space-y-2">
              {bullets.map((b, i) => (
                <li key={i}>{b}</li>
              ))}
            </ul>
          )}
          {callToAction && (
            <p className="mt-6 font-semibold text-magenta">{callToAction}</p>
          )}
        </section>
      </noscript>

      {/* Visually hidden but readable by crawlers */}
      <div
        className="sr-only"
        aria-hidden="false"
        style={{
          position: "absolute",
          width: 1,
          height: 1,
          padding: 0,
          margin: -1,
          overflow: "hidden",
          clip: "rect(0, 0, 0, 0)",
          whiteSpace: "nowrap",
          border: 0,
        }}
      >
        <h1>{title}</h1>
        <p>{description}</p>
        {bullets && (
          <ul>
            {bullets.map((b, i) => (
              <li key={i}>{b}</li>
            ))}
          </ul>
        )}
        {callToAction && <p>{callToAction}</p>}
      </div>
    </>
  );
}
