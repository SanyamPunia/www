import type { Metadata } from "next";
import { JsonLd } from "@/components/ui/json-ld";
import { StaticPage } from "@/components/ui/static-page";
import { requireStaticPage } from "@/lib/pages";
import { staticPageSchema } from "@/lib/schema";

/*
 * A trust page: the copy is `lib/pages.ts`, the layout is `StaticPage`, and
 * this file is the route. Its `metadata` and its JSON-LD are the two things that
 * are the route's own, since only the route knows which `WebPage` subtype it is.
 *
 * A missing entry is a build error rather than an empty page, which is the same
 * call `IMPLEMENTED_LABS` makes for the lab routes.
 */
const page = requireStaticPage("privacy");

export const metadata: Metadata = {
  title: page.title,
  description: page.description,
  alternates: {
    canonical: "/privacy",
    types: { "text/markdown": "/privacy.md" },
  },
};

export default function PrivacyRoute() {
  return (
    <StaticPage page={page}>
      <JsonLd schema={staticPageSchema(page, "WebPage")} />
    </StaticPage>
  );
}
