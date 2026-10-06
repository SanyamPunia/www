import { renderCard } from "@/app/og/card";
import {
  formatLabDate,
  getLabBySlug,
  isImplemented,
  labsRegistry,
  metaDescription,
} from "@/lib/labs";

// An unported lab 404s, so it gets no image either.
export const dynamicParams = false;

export function generateStaticParams(): { slug: string }[] {
  return labsRegistry
    .filter((lab) => isImplemented(lab.slug))
    .map(({ slug }) => ({ slug }));
}

/** `code` and [text](url) carry no meaning on an image, so only the text stays. */
function plain(text: string): string {
  return text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/`([^`]+)`/g, "$1");
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
): Promise<Response> {
  const { slug } = await params;
  const lab = getLabBySlug(slug);
  if (!lab || !isImplemented(slug)) {
    return new Response("Not found", { status: 404 });
  }

  return renderCard({
    title: lab.title,
    description: plain(metaDescription(lab.description[0])),
    meta: [formatLabDate(lab.createdAt), "Lab"],
  });
}
