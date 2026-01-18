export interface Company {
  name: string;
  logo: string;
  title: string;
  duration: string;
  href: string;
  details: string[];
  preview: string[];
}

export interface Project {
  title: string;
  image: string;
  description: string;
  details: string;
  category: string;
  href: string;
  preview: string[];
}

export const companies: Company[] = [
  {
    name: "Enclave",
    logo: "/org/enclave.webp",
    title: "Frontend engineer",
    duration: "nov'25 - now",
    href: "https://www.enclave.money/",
    details: [
      "building a professional trading terminal for [fireplace.gg](https://fireplace.gg)",
      "optimizing trade markets for high-frequency socket connections handling massive data throughput",
      "working with websockets and real-time frontend architecture",
      "implementing trading terminal ui/ux using `next.js` and `typescript`, occasionally contributing to backend development",
    ],
    preview: ["/org/preview/enclave/1.webp", "/org/preview/enclave/2.webp"],
  },
  {
    name: "Bitscale",
    logo: "/org/bitscale.webp",
    title: "Founding Engineer",
    duration: "feb'25 - nov'25",
    href: "https://bitscale.ai/",
    details: [
      "founding engineer responsible for leading frontend architecture",
      "introduced design primitives for consistency and accessible ui patterns",
      "built core features including workbooks, grid system revamp, data sources, and bitpilot (ai agentic orchestration platform)",
      "implemented websocket-based data streaming for real-time updates",
      "developed programmatic seo system, generating 10k+ pages using llm services and lambda data pipeline workflows",
    ],
    preview: ["/org/preview/bitscale/1.webp"],
  },
  {
    name: "Flib",
    logo: "/org/flib.webp",
    title: "Founder/CEO",
    duration: "2023 - Now",
    href: "https://flib.store",
    details: [
      "founded and led the company",
      "delivered custom merchandise to major clients including google, salesforce india, colleges, and startups",
      "developed the complete tech platform with user-facing, admin, and storefront interfaces",
    ],
    preview: ["/org/preview/flib/1.webp"],
  },
  {
    name: "Xurrent (Zenduty acq.)",
    logo: "/org/xurrent.webp",
    title: "Frontend Engineer Intern",
    duration: "summer'23 + summer'24",
    href: "https://www.zenduty.com/",
    details: [
      "implemented bat test cases, reducing runtime from 30 minutes to 2 minutes by identifying and fixing edge cases",
      "integrated posthog analytics, conducted ab testing, and delivered insights to marketing team for data-driven ux decisions",
      "developed frontend using `gatsby` and `react` with `typescript`",
    ],
    preview: ["/org/preview/xurrent/1.webp"],
  },
  {
    name: "Google Code-In",
    logo: "/org/google.webp",
    title: "Finalist | Score Lab",
    duration: "Oct'18 - Dec'18",
    href: "https://codein.withgoogle.com/archive/2018/",
    details: [
      "completed 42 tasks as a finalist for score lab, working on diverse projects spanning design, development tooling, and testing",
    ],
    preview: ["/org/preview/google/1.webp"],
  },
];

export const projects: Project[] = [
  {
    title: "Profanity API",
    image: "/projects/profanity.webp",
    description: "profanity check at scale using hono, upstash & cloudflare",
    details:
      "scalable rest api to check profanity in chunks at scale. built with hono for backend, upstash vector database, and deployed on cloudflare workers for global edge computing.",
    category: "api",
    href: "https://github.com/SanyamPunia/profanity-api",
    preview: [],
  },
  {
    title: "unique-forge",
    image: "/projects/uf.webp",
    description: "type-safe nanoid alternative to generate secure IDs",
    details:
      "customizable and secure id generator with async and prefix/suffix support for js/ts. features synchronous, asynchronous, and cryptographically secure id generation. supports custom alphabets, adjustable length, and formatted ids with prefixes or suffixes.",
    category: "package",
    href: "https://www.npmjs.com/package/unique-forge",
    preview: ["/projects/preview/uf/1.webp"],
  },
  {
    title: "envt",
    image: "/projects/envt.webp",
    description:
      "type-safe client-side environment variables with runtime validation",
    details:
      "eliminate `process.env.undefined_var` runtime errors and get compile-time safety for client-side environment variables. supports `NEXT_PUBLIC_`, `PUBLIC_`, `VITE_`, and `REACT_APP_` prefixes. provides type checking, runtime validation, and enum support for environment configuration.",
    category: "package",
    href: "https://www.npmjs.com/package/envt",
    preview: [],
  },
  {
    title: "pageo.me",
    image: "/projects/pageo.webp",
    description: "simplest way to share all your links",
    details:
      "create a sleek personal page in seconds with minimal setup. features multiple layouts (list and grid), analytics tracking, github sync for version control, custom domains, and built-in contact forms. instant setup in under a minute with full control and no bloat.",
    category: "web",
    href: "https://pageo.me",
    preview: [
      "/projects/preview/pageo/1.webp",
      "/projects/preview/pageo/2.webp",
      "/projects/preview/pageo/3.webp",
    ],
  },
  {
    title: "clyp",
    image: "/projects/clyp.webp",
    description: "create better screenshots",
    details:
      "makes your screenshots look better by allowing you to add beautiful backgrounds, custom styling, and various style attributes. built using next.js, shadcn, tailwindcss, and posthog for analytics.",
    category: "web",
    href: "https://clyp-omega.vercel.app/",
    preview: ["/projects/preview/clyp/1.webp"],
  },
  {
    title: "on-snip.org",
    image: "/projects/onsnip.webp",
    description: "real-time collaborative messaging rooms",
    details:
      "real-time collaborative messaging platform built with next.js, express, socket.io, and redis. features instant messaging rooms, real-time message updates, and persistent message storage. frontend on vercel, backend on heroku with upstash redis for data persistence.",
    category: "web",
    href: "https://on-snip.org",
    preview: [
      "/projects/preview/onsnip/1.webp",
      "/projects/preview/onsnip/2.webp",
    ],
  },
  {
    title: "flib.store",
    image: "/projects/flib.webp",
    description: "built flib's app with next.js, typescript, zustand",
    details:
      "complete b2b merch automating and streamlining platform. built with next.js, drizzle orm, xata postgres, zustand for state management, typescript, and deployed on vercel. handles merchandise automation and order management for b2b operations.",
    category: "web",
    href: "https://flib.store",
    preview: [
      "/projects/preview/flib/1.webp",
      "/projects/preview/flib/2.webp",
      "/projects/preview/flib/3.webp",
      "/projects/preview/flib/4.webp",
    ],
  },
  {
    title: "better-gist",
    image: "/projects/bg.webp",
    description: "generate `shareable` code snippets",
    details:
      "generate shareable snippet links quickly and effortlessly. built with next.js v15, tailwind css, supabase for database, codemirror for code editing, and framer motion for animations. enables quick code snippet sharing with syntax highlighting and persistent storage.",
    category: "web",
    href: "https://better-gist.vercel.app/",
    preview: ["/projects/preview/bg/1.webp"],
  },
  {
    title: "stick_it",
    image: "/projects/stickit.webp",
    description: "seamlessly generate priority to-do wallpapers on the go",
    details:
      "seamlessly generate priority to-do wallpapers. built with next.js, tailwind css, and framer motion. deployed on vercel. allows users to create custom wallpapers with their priority tasks for visual reminders and productivity.",
    category: "web",
    href: "https://stick-it-olive.vercel.app/",
    preview: [
      "/projects/preview/stickit/1.webp",
      "/projects/preview/stickit/2.webp",
    ],
  },
];
