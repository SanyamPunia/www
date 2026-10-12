import type { Metadata } from "next";
import { IconSheet } from "@/components/icon-sheet/icon-sheet";
import { JsonLd } from "@/components/ui/json-ld";
import { PageShell } from "@/components/ui/page-shell";
import { PageTransition } from "@/components/ui/page-transition";
import { ICONS_DESCRIPTION } from "@/lib/icons";
import { iconSetSchema } from "@/lib/schema";

export const metadata: Metadata = {
  title: "Icons",
  description: ICONS_DESCRIPTION,
  alternates: {
    canonical: "/icons",
    types: { "text/markdown": "/icons.md" },
  },
};

/** the icons and nothing else, so the page keeps its title for a screen reader only */
export default function IconsPage() {
  return (
    <PageTransition>
      <PageShell>
        <JsonLd schema={iconSetSchema()} />
        <h1 className="sr-only">Icons</h1>
        <IconSheet />
      </PageShell>
    </PageTransition>
  );
}
