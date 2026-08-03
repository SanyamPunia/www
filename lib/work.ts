/**
 * Work history and side projects, ported from the old site's `lib/constant.ts`.
 * Kept here rather than in `lib/constants.ts`, which holds layout tokens.
 *
 * Both shapes carry only what `WorkRow` reads. `details`, `preview`,
 * `description`, `collaborators` and the companies' job `title` all used to sit
 * here against a detail view that was built and then removed, so nothing had
 * read them for some time. The `preview` arrays had additionally gone stale:
 * every path in them pointed at an image no longer in `public/`.
 *
 * If a detail view comes back, it comes back with content written for it rather
 * than with fields kept warm on the chance that it might.
 */
interface Company {
  name: string;
  /** stable id, used as the row key */
  slug: string;
  logo: string;
  duration: string;
  href: string;
}

interface Project {
  title: string;
  /** stable id, used as the row key */
  slug: string;
  image: string;
  category: string;
  href: string;
}

const companies: Company[] = [
  {
    name: "Oliv AI",
    slug: "oliv-ai",
    logo: "/org/oliv.webp",
    duration: "mar'26 - now",
    href: "https://oliv.ai/",
  },
  {
    name: "Enclave",
    slug: "enclave",
    logo: "/org/enclave.webp",
    duration: "nov'25 - mar'26",
    href: "https://www.enclave.money/",
  },
  {
    name: "Bitscale",
    slug: "bitscale",
    logo: "/org/bitscale.webp",
    duration: "feb'25 - nov'25",
    href: "https://bitscale.ai/",
  },
  {
    name: "Flib",
    slug: "flib",
    logo: "/org/flib.webp",
    duration: "2023 - Now",
    href: "https://flib.store",
  },
  {
    name: "Xurrent",
    slug: "xurrent",
    logo: "/org/xurrent.webp",
    duration: "summer'23 + summer'24",
    href: "https://www.zenduty.com/",
  },
  {
    name: "Google Code-In",
    slug: "google-code-in",
    logo: "/org/google.webp",
    duration: "Oct'18 - Dec'18",
    href: "https://codein.withgoogle.com/archive/2018/",
  },
];

const projects: Project[] = [
  {
    title: "Profanity API",
    slug: "profanity-api",
    image: "/projects/profanity.webp",
    category: "api",
    href: "https://github.com/SanyamPunia/profanity-api",
  },
  {
    title: "unique-forge",
    slug: "unique-forge",
    image: "/projects/uf.webp",
    category: "package",
    href: "https://www.npmjs.com/package/unique-forge",
  },
  {
    title: "envt",
    slug: "envt",
    image: "/projects/envt.webp",
    category: "package",
    href: "https://www.npmjs.com/package/envt",
  },
  {
    title: "rbac-ui",
    slug: "rbac-ui",
    image: "/projects/rbacui.webp",
    category: "package",
    href: "https://www.npmjs.com/package/@rbac-ui/react",
  },
  {
    title: "pageo.me",
    slug: "pageo-me",
    image: "/projects/pageo.webp",
    category: "web",
    href: "https://pageo.me",
  },
  {
    title: "clyp",
    slug: "clyp",
    image: "/projects/clyp.webp",
    category: "web",
    href: "https://clyp-omega.vercel.app/",
  },
  {
    title: "on-snip.org",
    slug: "on-snip-org",
    image: "/projects/onsnip.webp",
    category: "web",
    href: "https://on-snip.org",
  },
  {
    title: "flib.store",
    slug: "flib-store",
    image: "/projects/flib.webp",
    category: "web",
    href: "https://flib.store",
  },
  {
    title: "better-gist",
    slug: "better-gist",
    image: "/projects/bg.webp",
    category: "web",
    href: "https://better-gist.vercel.app/",
  },
];
/**
 * Companies and projects flattened to one shape so a single row component
 * renders both. Derived here rather than in the page so `app/work/page.tsx`
 * stays layout only.
 */
export interface WorkRow {
  slug: string;
  name: string;
  logo: string;
  /** duration for a company, category for a project */
  meta: string;
  href: string;
}

export const workSections: Array<{ label: string; rows: WorkRow[] }> = [
  {
    label: "Companies",
    rows: companies.map((c) => ({
      slug: c.slug,
      name: c.name,
      logo: c.logo,
      meta: c.duration,
      href: c.href,
    })),
  },
  {
    label: "Projects",
    rows: projects.map((p) => ({
      slug: p.slug,
      name: p.title,
      logo: p.image,
      meta: p.category,
      href: p.href,
    })),
  },
];
