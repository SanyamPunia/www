# Portfolio v3, build progress

Working doc for resuming this build in a fresh session. Read this plus
`CLAUDE.md` and you have everything.

Last verified: 2026-08-01, `pnpm check` green, and the home page confirmed
rendering against the running dev server.

---

## The goal

Rebuild the personal site as a clean light page: white background, one narrow
column, content vertically centered, all lowercase, no accent colour. Modelled
on a reference screenshot of an agency site. Content is carried over from the
old dark site at `../www`.

**This directory is deliberately not a git repo.** The plan is to `git init`
later, point it at the existing remote, and force push over the old site.

```bash
git init && git add -A && git commit -m "feat: new portfolio"
git remote add origin git@github.com:SanyamPunia/www.git
git push --force origin main
```

Two things to know before that push. It overwrites the history on `www`, so
tag or branch `main` first if the old site should stay recoverable. And the
Vercel project attached to that repo rebuilds on push, so it goes live
immediately. Env var names are unchanged from `../www`, so nothing new to add
in Vercel.

---

## Status

| # | Phase | Status |
|---|---|---|
| 1 | Scaffold, tokens, type scale, layout primitives | **done** |
| 2 | Home page | **done**, open items below |
| 3 | Port content, assets, API routes | not started |
| 4 | Relight `/work` | **done**, see notes |
| 5 | Relight `/blogs` and the MDX shell | **done**, all 4 posts |
| 6 | Relight `/lab` and 11 experiments | **done**, all 11 live |
| 7 | SEO surface and final gate | not started |

---

## Done

### Phase 1, scaffold

Hand-written rather than `create-next-app`, so there are no defaults to undo.

- `package.json`, `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`,
  `biome.json`, `.gitignore`
- `app/globals.css` with the full light token set under `@theme`
- Named type scale: `text-lead` / `text-body` / `text-action` / `text-meta`
- `app/fonts.ts` (Inter variable), `app/layout.tsx` with metadata
- `lib/utils.ts` (`cn`, `ordinal`), `lib/constants.ts`
- `components/ui/page-shell.tsx` owns `min-h-svh` centering and column width
- `components/providers/motion-provider.tsx`, `reducedMotion="user"` globally
- `CLAUDE.md` with the stack declaration and token table

### Phase 2, home page

Four regions, top to bottom: lead paragraph, supporting paragraph, closing
note, hairline rule, footer. The reference's action row was built and then
removed, see the open items.

- `app/page.tsx`, server component, composes everything
- `components/home/reveal.tsx`, stagger container so children stay server
  components
- `components/home/site-footer.tsx`, page nav left, social marks right
- `components/ui/inline-link.tsx`, the one treatment for links in prose
- `components/ui/tooltip.tsx` on Radix, for the icon-only social links
- `lib/site.ts`, all copy constants and URLs in one place

### Reference measurements, already applied

Derived from a closeup by scaling its 97px lead line spacing against the 21px
`text-lead` of the time, a factor of 3.08. Do not re-derive these.

**The page has since moved off these numbers deliberately.** The whole design
was rescaled to 0.8 and the type collapsed to one size, so the table is the
origin of the layout, not a description of it. Current values live in
`CLAUDE.md`.

| | reference | as applied then | now |
|---|---|---|---|
| column | ~682px | `42rem` | `33.6rem` |
| block rhythm | ~48 to 52px | `gap-12` | `gap-12`, at 0.8 scale |
| lead inline icons | 4 | 3 | none, removed |
| action row | pill + text link | both | removed |

The reference peppers its lead with emoji, which the rules ban, so Phosphor
icons carried the same texture for a while before being dropped entirely. Its
background looked like a soft wash in the first screenshot, that was video
compression, it is flat white. Its footer is sparser than ours, two links and
one social, but ours is real navigation so it was left alone.

### Decisions worth not relitigating

- **Light only, pure white.** No dark mode. Documented as a local override.
- **No accent colour on text or links.** Hierarchy from tone and weight alone.
  This is most of why the reference reads clean.
- **All lowercase**, like the old site, but applied with `text-transform` on
  `body` rather than by writing the copy that way. The markup keeps real
  casing so crawlers and screen readers are unaffected. Sentence case was
  tried first and dropped.
- **Inter, not the Apple system stack.** The reference is a macOS screenshot so
  it is probably real SF Pro, but the system stack would hand Windows and
  Android visitors a different site.
- **The font was shopped and Inter won.** A whole round of alternatives was
  tried and the page came back here. Do not reopen this without a reason.
  - *Sora*, shipped and reverted. Tall x-height on tight sidebearings, it
    packed the line and read congested in paragraph setting. It is a heading
    face.
  - *Geist*, shipped and reverted. It fixed the density but it is a close
    cousin of Inter, same neutral grotesque lineage, so it bought nothing
    visible for the cost of a swap.
  - *Outfit*, never shipped. Pure geometric, circular bowls flatten word shapes
    in running text, and it is the house style of the template market.
  - *Haffer* and *Louize*, both commercial and absent from Google Fonts. A
    foundry **Trial** licence covers evaluation and mockups, not web embedding,
    so neither can ship without a purchased webfont licence and
    `next/font/local`.
- **If a change is ever wanted again, these were the shortlist**, all verified
  present in the catalog: `Schibsted Grotesk` and `Host Grotesk` for a warmer
  neutral, `Karla` for character, `DM Sans` for a visibly geometric change, and
  `Instrument Serif` or `Newsreader` set on the lead paragraph only, which is
  the highest-impact option and keeps Inter doing the readable work.
- **If the page ever reads tight, the lever is line height, not the font.**
  The body copy sits at 1.6. `text-lead` still exists in the scale but has no
  call sites, every paragraph is `text-body` now.
- **There is no real mono yet.** `--font-mono` is still Tailwind's default
  `ui-monospace` stack. Phase 5 code blocks and the keyboard-shortcut styling
  both need one. Pick it when `/blogs` gets built.
- **The visible lead is a `<p>`, not an `<h1>`.** A 40-word h1 is bad for
  screen readers. There is an `sr-only` h1 carrying the real page heading.
- **Reduced motion via `MotionConfig`**, not a blanket CSS `!important` reset.
- **No press scaling anywhere.** `active:scale-[0.98]` smeared small marks at
  this type scale. Background steps replaced it. Documented in `CLAUDE.md`,
  do not reintroduce it.
- **One font, already uniform.** Inter reaches every section. `body` sets
  `font-family: var(--font-sans)`, Tailwind's `--default-font-family` resolves
  to the same value on `html`, and preflight gives form controls `font:
  inherit`, so the button matches too. What separates the sections is size and
  tone, not typeface. Verified against the compiled stylesheet, do not go
  hunting for a font mismatch that is not there.

### Package currency

Everything is on latest as of 2026-08-01, deliberately not inherited from
`../www`, which was well behind.

| | old `www` | here |
|---|---|---|
| next | 16.1.0 | 16.2.12 |
| typescript | 5.x | 7.0.2 |
| biome | 2.2.0 | 2.5.6 |
| @types/node | 20 | 26.1.2 |
| framer-motion 12.23 | | `motion` 12.43 |
| lucide-react | 0.544 | replaced by `@phosphor-icons/react` 2.1.10 |
| sugar-high | 0.9.3 | 1.2.1 |

`torph` 0.0.9 was added for the copy button's label morph and removed with it.

Two compatibility notes, both already handled and documented in `CLAUDE.md`:

- **TypeScript 7** is the native Go port and dropped the JS compiler API Next
  reads by default. `experimental.useTypeScriptCli` in `next.config.ts` routes
  Next's typecheck through the `tsc` CLI. Removing that flag breaks `next dev`
  with an unhandled rejection.
- **Biome 2.5** needs `css.parser.tailwindDirectives` on, or it fails to parse
  `@theme` in `app/globals.css`.

### Traps already hit, do not repeat

- **`pnpm add` from the wrong directory.** An install once landed in
  `../` instead of here, creating a stray `package.json`, `pnpm-lock.yaml` and
  `node_modules` in the parent. The tooltip import then resolved up the tree,
  so the build passed locally while the dep was missing from this
  `package.json`. It would have failed on Vercel. Cleaned up, and
  `turbopack.root` is now pinned in `next.config.ts` so Next stops inferring
  the parent as the workspace root. **Always confirm cwd before `pnpm add`.**
- **Brand SVGs need an explicit decorative declaration.** Biome's
  `a11y/noSvgWithoutTitle` fires on any `<svg>` with no `title`, `role`, or
  `aria-hidden`. The marks in `components/icons/` set `aria-hidden="true"` and
  `focusable="false"` before the prop spread, since the anchor wrapping them
  carries the label.
- **`public/` is excluded from Biome** in `biome.json`, otherwise it lints the
  raw SVG assets copied from the old site.

---

## Open items on the home page

1. **No mark row.** The reference has a logo plus an overlapping avatar pair.
   There is no headshot anywhere in `../www/public/`, and `logo.webp` is a pure
   white silhouette from the dark build, sampled at `rgb(255,255,255)` across
   all 44,701 opaque pixels, so it renders invisible on white. The logo was
   pulled from `page.tsx` and the row is absent entirely. Decide: add a
   headshot plus a re-inked mark to `public/assets/`, or leave the page
   starting on the lead paragraph. The `accent` token is already reserved for
   that mark. A CSS `mask-image` fill from the token works if the asset stays
   a white raster.
2. **The quiet note is static.** It currently reads as a fixed sentence. Phase
   3 wires the live now-playing and visitor count into it.
3. **The action row is gone and so is its whole chain.** Deleted, not parked:
   `copy-email-button.tsx`, `playTapSound`, `public/media/tap.wav` and the
   `torph` dependency. The page has no call to action, the footer's mailto icon
   is the only contact route. `EMAIL` survives because that icon uses it.
4. **`app/favicon.ico` is white on transparent**, carried over from the dark
   build. 345 opaque pixels, every one of them `255,255,255`. It shows on dark
   browser chrome and vanishes on light, which is the default. Invert it to
   near-black, or replace it, before shipping.
5. **The old icon row also linked `/llms.txt`**, with a bot glyph. Not carried
   over, it is not a social. `public/llms.txt` exists and Phase 7 wants a
   content refresh, so decide then whether it deserves a link.

---

## What is left

### Phase 4, `/work`, done

One line per company or project, linking straight out. Logo, name, a leader
rule that absorbs the slack, then the date.

An in-place accordion with the open row in `?open=` was built first and then
removed as unnecessary. With it went `rich-text.tsx`, the caret, the Suspense
boundary and all client state, so `WorkList` is now a server component and no
row data reaches the browser.

- `lib/work.ts`, 6 companies and 9 projects, ported from `../www/lib/constant.ts`
  with slugs added and flattened to one `WorkRow` shape
- `components/work/work-list.tsx`, the whole surface

`details`, `preview` and `collaborators` are still in `lib/work.ts` but are not
on `WorkRow` and render nowhere. They are kept so a detail view can be rebuilt
by widening that type, not by re-porting content. The old modals and
`image-with-skeleton.tsx` were never ported.

Worth knowing: **`public/projects/onsnip.webp` is light ink on transparency**
and reads as an empty circle, the same trap as `logo.webp` and the Enclave
favicon. Every other logo is opaque and renders fine.

### Phase 5, `/blogs`, done

Index plus all four posts. The system is documented in `CLAUDE.md`, the parts
worth knowing here:

- The page shell came **out** of the MDX. Every old post carried its own
  `<main><MaxWidthWrapper>` chrome, four copies free to drift. `BlogPost` owns
  it now and the MDX is pure content.
- **Dates are ISO.** They were display strings sorted lexically, which put
  March before November. Converted and each one checked back against the
  source, one had been mistranscribed in the process and was corrected.
- `sugar-high` tokens are greys pointing at the text tokens, so code sits
  inside the monochrome instead of being the loudest thing on the page.
- Both demo components were relit: `framer-motion` to `motion/react`, lucide to
  Phosphor, raw greys to tokens. The dropdown demo needed a real primitive, so
  `@radix-ui/react-dropdown-menu` and `components/ui/dropdown-menu.tsx` came
  with it.

Still open: the blog like button is Firebase-backed and waits on Phase 3, and
the ported screenshots under `public/blogs/` were shot on dark backgrounds.

### Phase 3, port content, assets, API routes

`public/` is already copied (56 files: org logos, project shots, lab previews,
CV pdf, signature, logo, tap sound). Still to do:

- `lib/constant.ts` from `../www`, 6 companies and 9 projects with previews
- `app/api/*`: spotify, now-playing, one-dollar-stats pageviews, npm package
  stats, blog likes
- `hooks/`: `use-pageviews`, `use-blog-likes`, `use-sound`, `use-mobile`
- `lib/firebase.ts`, `lib/spotify.ts`, `lib/blog-likes.ts`, `lib/fetcher.ts`

  **`firebase` and `swr` were removed from `package.json`**, they had zero
  imports. Phase 3 is where they come back, so reinstall them then rather than
  wondering why the plan references packages that are not there. The stale
  `@firebase/util` and `protobufjs` entries went out of
  `pnpm.onlyBuiltDependencies` with them, only `sharp` remains.
- Copy `.env.local` and `.env.example` from `../www`, unchanged names:
  `NEXT_PUBLIC_BASE_URL`, `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`,
  `SPOTIFY_REFRESH_TOKEN`, six `NEXT_PUBLIC_FIREBASE_*`, `ONE_DOLLAR_STATS`
- Wire now-playing and visitor count into the home page note line


### Phase 5, `/blogs`

- Index plus 4 MDX posts, `meta.json` each, `mdx-components.tsx`
- `code-block.tsx` and `code-parser.tsx`
- **Needs a light `sugar-high` token set.** The old one is all greys on
  `#0c0c0c` and will be unreadable on white.
- Blog like button, relit, Firebase-backed

### Phase 6, `/lab`

- Index, `[slug]` detail page, `lib/labs.registry.ts`, 11 components
- Five carry their own `styles.css` with hardcoded darks needing a light pass:
  `animated-dashed-border`, `cursor-origin-button`, `file-tree`,
  `phrase-transition`, `split-to-edit`
- **Every lab component imports from `framer-motion`.** Rewrite to
  `motion/react`. Mechanical, but it is 11 files.
- **Every lab component imports lucide icons.** Rewrite to Phosphor
  `*Icon` exports, `dist/ssr` for anything not marked `"use client"`.

### Phase 7, SEO and final gate

- `robots.ts`, `sitemap.ts`, `not-found.tsx`, favicon
- `public/llms.txt` is already copied, needs a content refresh
- OG and twitter images
- `/cv` and `/resume` redirects are already in `next.config.ts`
- `pnpm check` green

---

## Commands

```bash
pnpm dev          # next dev --turbopack
pnpm build        # next build --turbopack
pnpm lint         # biome check
pnpm format       # biome format --write
pnpm tc           # tsc --noEmit
pnpm check        # all three, this is the gate
```

Reference copy of the old site lives at `../www`. It is a real git repo on
`main` with remote `SanyamPunia/www`, untouched by any of this work.
