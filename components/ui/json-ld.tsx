/**
 * Renders a JSON-LD block. Server component, so the markup is in the initial
 * HTML rather than injected on hydration, which is the only way a crawler that
 * does not run JavaScript will see it.
 *
 * `<` is escaped because a `</script>` sequence inside a string value would
 * otherwise close the tag early and break the page. JSON.stringify does not do
 * this for you.
 */
export function JsonLd({ schema }: { schema: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      // biome-ignore lint/security/noDangerouslySetInnerHtml: the only way to emit a JSON-LD script body, and the input is built from local data in lib/schema.ts, never user input
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(schema).replace(/</g, "\\u003c"),
      }}
    />
  );
}
