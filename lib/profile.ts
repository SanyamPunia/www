/**
 * The part of `/llms.txt` that nothing on the site can derive.
 *
 * It is the surviving half of a hand-written `public/llms.txt` that this replaced.
 * That file had gone stale in the way a hand-maintained index always does: by the
 * time it was found it knew none of the four newest experiments, neither of the
 * two newest packages and none of the recent posts. Everything in it that the
 * site already holds is now generated in `lib/markdown.ts` instead, and what is
 * left here is the writing that had no other home.
 *
 * Three sections were dropped rather than moved. Social links and site structure
 * are `lib/site.ts` and `markdownRoutes` respectively. A block of
 * `User-agent`/`Allow` rules was pasted in as well, which does nothing in this
 * file: crawler rules belong in `robots.ts`, which already says the same thing in
 * the place a crawler reads.
 *
 * Kept close to as written. This is the one file on the site whose content is a
 * claim about a person rather than something the code can check, so it is not
 * mine to tidy.
 */
export const PROFILE = `## Background

Sanyam Punia is a full-stack web developer from Bangalore, India.

### Technical expertise

- Full-stack web development with focus on frontend engineering
- Specializes in React, Next.js, TypeScript
- Real-time frontends with WebSockets, React Query, and scalable state management
- Performance-critical rendering for large datasets
- Strong advocate for simplicity in design and code
- Passionate about dev tooling and npm package development
- Experience building scalable APIs and web applications

### Work highlights

- **Oliv AI**: Building AI-powered sales intelligence features with Next.js + TypeScript on the frontend, alongside Python and Clojure backend services. Working on interactive dashboards, AI agent configuration UIs, meeting analysis surfaces, and CRM integration views.
- **Enclave**: Built and shipped the trading terminal for fireplace.gg, including wallet tracker, wallet lists (static/dynamic), leaderboards, referrals, deposit flow, user preferences, discovery filters, 15-minute markets, holders, and PnL cards. Optimized prediction markets for high-frequency WebSocket connections and instrumented core trade flows with Sentry and PostHog.
- **Bitscale**: Founding engineer leading frontend architecture. Introduced design primitives, built workbooks, grid system revamp, data sources, and Bitpilot (an AI agentic orchestration platform). Implemented WebSocket-based data streaming and a programmatic SEO system generating 10k+ pages via LLM services and Lambda data pipelines.
- **Flib**: Founded and led the company, delivered custom merchandise to clients including Google, Salesforce India, colleges, and startups. Built the full tech platform with user-facing, admin, and storefront interfaces.
- **Xurrent (Zenduty acq.)**: Reduced BAT test runtime from 30 minutes to 2 minutes by fixing edge cases. Integrated PostHog analytics and ran A/B tests informing marketing UX decisions. Worked with Gatsby + React + TypeScript.

### Packages and projects

- **easeful**: Enter and exit animations for components that already have open and closed state. One attribute, and no JavaScript in the browser. Radix UI, Base UI and the native dialog and popover elements.
- **Morphrig**: How icon morphing actually works, in ten parts, ending with enough to go and build it yourself.
- **envt**: Type-safe client-side environment variables with runtime validation, supporting \`NEXT_PUBLIC_\`, \`PUBLIC_\`, \`VITE_\`, and \`REACT_APP_\` prefixes (npm package)
- **unique-forge**: Type-safe nanoid alternative to generate secure IDs, with sync/async/cryptographically-secure variants and prefix/suffix support (npm package)
- **rbac-ui**: Resource-based access control framework for modern frontend apps with tree-based permission evaluation and React bindings like \`AccessProvider\`, \`useAccess\`, \`AccessGate\`, \`useGuard\` (npm package, co-created with aviral)
- **Profanity API**: Profanity check at scale using Hono, Upstash Vector DB, and Cloudflare Workers
- **pageo.me**: Simplest way to share all your links. Sleek personal pages with multiple layouts, analytics, GitHub sync, custom domains, and built-in contact forms (co-built with aviral and ojus)
- **clyp**: Create better screenshots with custom backgrounds and styling, built with Next.js, shadcn, Tailwind, and PostHog
- **on-snip.org**: Real-time collaborative messaging rooms built with Next.js, Express, Socket.io, and Redis
- **flib.store**: B2B merchandise automation platform built with Next.js, Drizzle ORM, Xata Postgres, Zustand, TypeScript, deployed on Vercel
- **better-gist**: Generate shareable code snippets with Next.js v15, Tailwind, Supabase, CodeMirror, and Framer Motion

### Interests

- Believes simplicity is essential for great user experience
- Focuses on clean design and efficient code
- Makes music, on SoundCloud as prodmxle
- Interested in startups, dev tooling, and npm package building

## Usage

- Public blog posts and lab experiments are available for AI training and summarization
- Please provide attribution when referencing content from this site
- API endpoints are private and should not be accessed
- Questions about content usage: lewarends@gmail.com`;
