import { llmsFull } from "@/lib/markdown";

/*
 * Every document in one file, for a client that would rather make one request
 * than follow the index.
 *
 * `noindex`, unlike `llms.txt`. This one really is every indexable page's body
 * at a single URL, which is the duplication canonicals exist to prevent.
 */
export const dynamic = "force-static";

export function GET() {
  return new Response(llmsFull(), {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "x-robots-tag": "noindex",
    },
  });
}
