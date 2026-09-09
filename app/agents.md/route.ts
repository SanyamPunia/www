import { agentInstructions } from "@/lib/markdown";

/*
 * `/agents.md`, the agent instruction file.
 *
 * A directory named `agents.md` is how the App Router serves a dotted path, the
 * same shape `app/llms.txt/` takes. Two things make it reachable at that spelling
 * rather than being swallowed on the way:
 *
 * The `.md` rewrites in `next.config.ts` are returned as a plain array, which
 * Next treats as `afterFiles`, so a real route wins over a rewrite and
 * `/agents.md` is not turned into `/md/agents`. And `proxy.ts` never sees it,
 * since its matcher excludes anything containing a dot.
 *
 * Indexable, unlike the per-page markdown documents. This is not a second copy
 * of a page, it is the only place the guidance for an agent is written down.
 */
export const dynamic = "force-static";

export function GET() {
  return new Response(agentInstructions(), {
    headers: { "content-type": "text/markdown; charset=utf-8" },
  });
}
