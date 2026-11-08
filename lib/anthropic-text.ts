/**
 * The text of a model response, whatever else the model emitted alongside it.
 *
 * Reading `content[0].text` was correct on Haiku 4.5, where thinking was off
 * unless a request asked for it. Haiku 5.5 runs adaptive thinking by default,
 * so `content[0]` is a thinking block — empty, because `display` defaults to
 * "omitted" — and the answer sits in a later block. `content[0].text` is then
 * undefined, which surfaces as a JSON parse failure or a TypeError rather
 * than as anything that names the cause.
 *
 * Returns "" when there is no text block at all, so callers keep whatever
 * failure handling they already have instead of dereferencing undefined.
 */
export function responseText(msg: {
  content: Array<{ type: string; text?: string }>;
}): string {
  for (const block of msg.content) {
    if (block.type === "text" && typeof block.text === "string") {
      return block.text;
    }
  }
  return "";
}
