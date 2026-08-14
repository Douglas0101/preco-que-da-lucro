/**
 * Model output is untrusted dependency data.  Keep the small markdown subset
 * understood by the renderer, remove control characters/raw HTML and cap the
 * size before persistence or returning it to the browser.
 */
export function sanitizeAiOutput(value: string): string {
  return Array.from(value)
    .filter((character) => {
      const code = character.charCodeAt(0);
      return !(
        code <= 8 ||
        code === 11 ||
        code === 12 ||
        (code >= 14 && code <= 31) ||
        code === 127
      );
    })
    .join("")
    .replace(/<[^>]*>/g, "")
    .slice(0, 12_000)
    .trim();
}
