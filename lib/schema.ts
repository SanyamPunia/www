import type { BlogMeta } from "./blogs";
import { SITE_URL } from "./constants";
import type { LabMetadata } from "./labs";
import { socials } from "./site";

/**
 * JSON-LD builders. Pure, so they stay in `lib`, and rendered by
 * `components/ui/json-ld.tsx`.
 *
 * Everything here is derived from the same data the pages render, never
 * restated. That is not tidiness: the shared rules ban marking up anything the
 * page does not visibly show, and a hand-written copy of a title or date is
 * exactly how a page ends up claiming something it no longer says.
 *
 * Two deliberate omissions.
 *
 * `dateModified` is absent rather than mirrored from `datePublished`. Nothing in
 * the repo records when a post was last edited, and stamping the publish date
 * there would assert "never edited since" as a fact.
 *
 * The email is absent too. It is public on the page already, but putting it in
 * machine-readable markup hands it to every scraper for no ranking benefit.
 */

const PERSON_ID = `${SITE_URL}/#person`;
const SITE_ID = `${SITE_URL}/#website`;

const NAME = "Sanyam Punia";
const ROLE = "Full-stack developer";

type Json = Record<string, unknown>;

const person = (): Json => ({
  "@type": "Person",
  "@id": PERSON_ID,
  name: NAME,
  url: SITE_URL,
  jobTitle: ROLE,
  // every profile that is verifiably the same person, which is what `sameAs`
  // is for: it lets a crawler merge these into one entity
  sameAs: Object.values(socials),
  address: { "@type": "PostalAddress", addressCountry: "IN" },
});

const website = (): Json => ({
  "@type": "WebSite",
  "@id": SITE_ID,
  url: SITE_URL,
  name: NAME,
  inLanguage: "en-US",
  publisher: { "@id": PERSON_ID },
});

/** `@graph` so Person and WebSite are one document that can cross-reference. */
export function homeSchema(): Json {
  return { "@context": "https://schema.org", "@graph": [person(), website()] };
}

/** `ProfilePage` rather than `WebPage`: /work is about the person. */
export function workSchema(): Json {
  return {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    url: `${SITE_URL}/work`,
    isPartOf: { "@id": SITE_ID },
    mainEntity: person(),
  };
}

export function blogPostSchema(meta: BlogMeta): Json {
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: meta.title,
    description: meta.description,
    datePublished: meta.date,
    url: `${SITE_URL}/blogs/${meta.slug}`,
    mainEntityOfPage: { "@id": `${SITE_URL}/blogs/${meta.slug}` },
    isPartOf: { "@id": SITE_ID },
    author: person(),
    inLanguage: "en-US",
  };
}

/**
 * `SoftwareSourceCode` rather than a bare `CreativeWork`, because that is what
 * these are and it is the type that carries `codeRepository` for the source
 * link the page already shows.
 */
export function labSchema(lab: LabMetadata): Json {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareSourceCode",
    name: lab.title,
    description: lab.description[0],
    dateCreated: lab.createdAt,
    url: `${SITE_URL}/lab/${lab.slug}`,
    isPartOf: { "@id": SITE_ID },
    author: person(),
    programmingLanguage: "TypeScript",
    ...(lab.source ? { codeRepository: lab.source } : {}),
  };
}

/**
 * The index pages. `ItemList` carries the actual rows, in the order the page
 * renders them, so the markup and the page cannot disagree about what is listed.
 */
export function collectionSchema({
  path,
  name,
  description,
  items,
}: {
  path: string;
  name: string;
  description: string;
  items: Array<{ slug: string; title: string }>;
}): Json {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    url: `${SITE_URL}${path}`,
    name,
    description,
    isPartOf: { "@id": SITE_ID },
    inLanguage: "en-US",
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: items.length,
      itemListElement: items.map((item, index) => ({
        "@type": "ListItem",
        position: index + 1,
        url: `${SITE_URL}${path}/${item.slug}`,
        name: item.title,
      })),
    },
  };
}
