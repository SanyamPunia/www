# CLAUDE.md

@~/.claude/rules/base.md

@~/.claude/rules/frontend.md

@~/.claude/rules/typescript.md

@~/.claude/rules/seo.md

## Project overview

The personal site, rebuilt light. Next.js App Router. The home page is a
single vertically centered column on white. MDX blog posts live under
`app/blogs/`, interactive experiments under `app/lab/`.

This project replaces the previous dark version of the same site. It is
intended to be force-pushed over `github.com/SanyamPunia/www`.

## Commands

```bash
pnpm dev          # next dev --turbopack
pnpm build        # next build --turbopack
pnpm lint         # biome check
pnpm format       # biome format --write
pnpm tc           # tsc --noEmit
pnpm check        # all three, this is the gate
```

`pnpm check` must be green before any push.

## Stack declaration

| Parameter | This project |
|---|---|
| Package manager | `pnpm` |
| Icon library | `@phosphor-icons/react` v2, see Icons below |
| Motion library | `motion` (imported from `motion/react`), **not** `framer-motion` |
| Color system | A fixed **light** theme. Semantic tokens only, see below. |
| Type scale | Named tokens `text-lead` / `text-body` / `text-action` / `text-meta` |
| Default radius | `rounded-full` pills and avatars, `rounded-lg` cards, `rounded-md` inputs |
| Focus pattern | `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary/15 focus-visible:ring-offset-2` |
| Body font | `Inter` variable via `next/font/google`, displayed all lowercase |
| Annotation font | `Caveat` variable, same loader, **one lab only**, see below |
| Class helper | `cn()` from `lib/utils.ts` |
| Formatter and linter | Biome, not ESLint or Prettier |
| Page width | `CONTENT_WIDTH` in `lib/constants.ts`, consumed by `PageShell` |

## Color tokens

Defined once in `app/globals.css` under `@theme`. **No raw hex and no palette
utilities in components.** If a colour is needed that has no token, add the
token here first.

| Token | Value | Use |
|---|---|---|
| `bg` | `#ffffff` | page background |
| `surface` | `#fafafa` | raised panels |
| `fill` | `#f4f4f5` | pill background, resting |
| `fill-hover` | `#ebebec` | pill and list-row hover |
| `fill-active` | `#e0e0e2` | pressed state, one step past hover |
| `stroke-soft` | `#f2f2f2` | dividers in long lists, where `stroke` reads as a table |
| `stroke` | `#ebebeb` | hairline rules, borders |
| `stroke-strong` | `#dcdcdc` | scrollbar thumb, emphasised edges |
| `text-primary` | `#1a1a1a` | lead copy, headings |
| `text-secondary` | `#6b6b6b` | body copy |
| `text-muted` | `#9b9b9b` | metadata, footer |
| `accent` | `#3b82f6` | **logo mark only**, never text or links |
| `danger` | `#b84a41` | invalid input, see below |
| `selection` | `#34d399` | text selection highlight, see below |
| `inverse-bg` | `#0a0a0a` | dark ground, see below |
| `inverse-fill` | `#111111` | raised tile on a dark ground |
| `inverse-stroke` | `#1e1e1e` | hairline on a dark ground |
| `inverse-text` | `#fafafa` | lead copy on a dark ground |
| `inverse-text-secondary` | `#8f8f8f` | supporting copy on a dark ground |

**`selection` is user-driven, not decoration.** Nothing renders in it until
someone drags across text, which is why a saturated hue over a whole run of
prose does not reopen "no accent colour on text or links". It pairs with
`text-primary` at 9.05:1, so selected prose reads as well as unselected.

Only the selected text constrains this tone. The carets did too while they
straddled the highlight, but they sit wholly outside it now, so it is free to
move. The floor is around `#0b9160`, where dark text drops to 4.34 and the
selected text would have to go light.

**Carets at the ends of a selection are a component, not CSS.** `::selection`
accepts `color`, `background-color`, `text-decoration`, `text-shadow` and the
text-fill properties, and nothing else: no `content`, no pseudo-elements of its
own. `components/ui/selection-pins.tsx` measures the live `Range` instead and
draws two hairlines, mounted once in the root layout since selecting text is a
whole-document behaviour. Their height comes from the line rect they terminate,
so they match whatever type they sit in, and each carries a `size-1.25` knob
centred on both tips. `size-1` would be 3.2px on this scale, and a fractional box
cannot resolve a clean circle, so one of the two renders squared off.

They sit **outside** the highlight, not straddling it, and that is what lets them
be `stroke-strong`, the same token the `InlineLink` underline uses at rest. A
straddling caret has to survive both the white page and the highlight, which no
light grey does: over the emerald, `text-muted` is 1.26 and `text-secondary`
1.52, so the inner half simply disappears.

**`danger` is the one status tone.** Hue carries meaning here rather than
decoration, the same exception the brand marks and the syntax colours get, so
it does not reopen "no accent colour on text or links". It is 4.91:1 on
`surface` and is the lightest red that still clears 4.5:1 at the 14.4px
semibold it is used at. `#c2544b` was the first pick and fails at 4.31. There
is deliberately no success or warning tone, add one only when a surface needs
it, with the contrast checked the same way.

**The `inverse-*` set is not dark mode.** Nothing switches to it and there is
still no `dark:` variant anywhere. It is a surface a component opts into when a
light ground genuinely cannot work, and both callers so far are the same problem:
white content with nothing to sit on.

- `components/labs/spring-image/` renders `/assets/logo.webp`, the site's own
  mark in white, which on `bg` painted as an empty ring. Recolouring the mark was
  not an option, so the ground inverted.
- `components/labs/document-pocket/` is a container full of white paper. The
  light version was built first, with the pocket in `fill-active` and the paper
  in `bg`, and it failed: every value in the piece sat inside 12% lightness of
  every other, so the pocket, the paper and the page were one flat wash. The
  darkest fill token is `stroke-strong` at 86% lightness, so there is no light
  answer to reach for. The interior went `inverse-bg` and the front panel
  `inverse-fill`.

The values are the previous dark build's, so the two versions of the site stay
recognisably related. `inverse-text` is 18.97:1 on `inverse-bg` and
`inverse-text-secondary` is 6.12:1. Check any new pairing: `#6f6f6f` was the
first choice for the secondary tone and fails at 3.94.

**Shading a dark surface is light, not palette.** Nothing in the set is a lit
edge or a sheen, and neither wants a token: they are the same material catching
light. Use white and black at low alpha over an `inverse-*` ground, in the
component. `document-pocket` is the reference for this.

Reach for this only when the alternative is invisible content. A surface that
is merely *nicer* dark is not a reason, that is the dark build this project
deliberately replaced.

## Local overrides

- **No dark mode.** One light theme. The shared "every surface works in light
  and dark" rule does not apply, there is nothing to switch to. This replaces
  the previous version's inverse override (it was dark-only).
- **No accent colour on text or links.** Hierarchy comes from tone and weight
  alone. This is deliberate and is most of why the design reads clean.
- **Nothing scales on press. There is no `active:scale-[0.98]` in this
  codebase.** The shared rule mandates it on every tappable element and this
  project overrides it outright. At this scale a 2% transform shifts an edge by
  a fraction of a pixel, under the threshold for reading as motion and over the
  threshold for changing antialiasing, so fine detail smears sideways rather
  than shrinking. GitHub, X, Bitscale and SoundCloud all showed it plainly.
  Layer promotion (`transform-gpu`) and whole-pixel box dimensions were both
  tried and neither helps, because an inline target sits wherever text layout
  puts it and the transform is sub-pixel by definition.

  Press is a background step instead: `hover:bg-fill` then
  `active:bg-fill-hover` on unfilled targets, `active:bg-fill-active` where the
  resting state is already filled. Do not reintroduce the scale.
- **All lowercase**, via `text-transform` on `body` in `app/globals.css`, not by
  writing the copy in lowercase. The markup keeps real casing, so crawlers,
  screen readers and copied text still get "Oliv AI". Write new copy in
  sentence case and let the stylesheet do it. `code`, `pre`, `kbd` and `samp`
  are exempt, lowercasing code would corrupt it.

  **Form controls need `text-transform: inherit` spelled out.** They do not
  inherit it on their own, and Tailwind's preflight `font: inherit` does not
  cover it, since text-transform is not part of the font shorthand. Without
  that rule any label inside a `<button>` keeps its source casing while the
  prose around it lowercases.

## Scale

The design sits at 0.8 of a conventional scale. **That factor is baked into the
tokens, so every value in `@theme` is the size it actually paints.** There is
no root override, `html` stays at the browser default.

`--spacing: 0.2rem` is the important one. Tailwind derives every `gap-*`,
`p-*`, `h-*` and `size-*` from it as `calc(var(--spacing) * n)`, so that single
token rescales all of them and no call site carries a scale factor. The radius
tokens and the type scale are set the same way.

Two rules follow:

- **Never reintroduce a global root font-size.** It would multiply on top of
  these tokens, and it silently catches anything added later, including
  third-party UI that was never designed against this scale.
- **Resize the page by changing `--spacing` and the type tokens together**, not
  by adjusting individual utilities at call sites.

Values in `px` sit outside the scale and stay fixed. That is correct for
hairlines and focus rings, and it is why new sizes should be `rem` or `em`.

## Type scale

`text-lead` 16.8px/1.5 opening paragraph, primary tone.
`text-body` 14.4px/1.6 supporting paragraphs, secondary tone.
`text-action` 12.8px/1.5 weight 500, buttons and inline links.
`text-meta` 12px/1.6 muted tone, footers, tooltips and quiet notes.

No ad-hoc `text-[15px]`, and no Tailwind default sizes either. `text-xs` and
friends are not on this scale, so they render out of proportion with everything
around them. Add a scale token if a genuinely new size is needed.

**`cn()` has to be told this scale exists, and `lib/utils.ts` tells it.**
tailwind-merge classifies `text-*` by reading the value: a t-shirt size is a
font size and anything else is a colour. These roles are named rather than
sized, so `text-meta` was landing in the colour group beside
`text-text-primary` and losing, and `cn("text-meta", "text-text-primary")`
returned the colour alone. No error, no warning, the element just inherited
whatever size sat above it.

It only bites when a role and a tone meet inside one `cn()` call, which is why
it survived: rare enough to read as a design decision rather than a dropped
class. It had silently unsized both `DropdownMenu` rows, and it is what made
the post rail render larger than the prose it indexes. `extendTailwindMerge`
declares the group once and fixes every call site, which is the only scale at
which this is fixable, since the failure is invisible at each one.

**A new role here needs a matching entry in `TYPE_SCALE` in `lib/utils.ts`.**

**Every home page paragraph is `text-body`.** Only tone separates them, primary
for the opening one and secondary for the two below it. Matching them at
`text-lead` instead was tried first and looked worse, the larger supporting
paragraph read as a wall. Do not "fix" any of them back to `text-lead`, and do
not drop the closing note to `text-meta`, it was deliberately raised to match
the paragraph above it.

`text-meta` serves the footer, tooltips, section labels and row metadata.

**One font is not on this scale, and that is the point.** `Caveat` in
`app/fonts.ts` is a handwriting face used by `components/labs/document-pocket/`
and nothing else, at a size derived from the demo's own width rather than from a
token. A note pencilled beside an experiment is not prose on the page, so it is
sized as part of the drawing. Do not promote it to the scale, do not use it for
UI, and do not add another off-scale face without the same kind of reason.

Next scopes a font to the components that use it, so it is fetched on the one lab
page that renders it and nowhere else, verified against `/`, `/lab` and `/work`.
`next/font` self-hosts it, so no page makes a third-party request for it.

**`text-lead` is the page title, and only that.** `/work`, `/blogs` and every
post open with a real `<h1>` at `text-lead`, followed by a `text-body`
`text-secondary` line, grouped at `gap-2` so the two read as one block. No
weight change, nothing on this site is bold, the step is size and tone.

**On an index the lead line is secondary, never primary.** The list is the
content and that line is context. At primary it is the same size and the same
tone as every row title and the page reads as one flat list.

The home page is the exception and keeps its `sr-only` h1: its opening
paragraph genuinely is the content, not a description of content.

## Icons

Phosphor supplies every UI icon. Social brand marks come from
[svgl.app](https://svgl.app) and live in `components/icons/`, one file per mark,
with the source route named in a comment. svgl has no Medium, so that single
mark stays on Phosphor's `MediumLogoIcon`.

**Brand marks keep their real brand hex.** This is the one sanctioned exception
to the semantic-tokens-only rule: a brand colour is not a theme colour, it
belongs to the company, and tinting it makes it a different logo. The hex lives
in the mark's own component and nowhere else. Do not add these to `@theme`, and
do not reach for them in any other context.

Because the fill is fixed, a mark does not answer to `currentColor`, so the
footer's hover on a social link is the background step alone. `MediumLogoIcon`
is the exception and still tints, since Phosphor draws in `currentColor`.

Marks set `aria-hidden="true"` and `focusable="false"` before the prop spread,
since the anchor wrapping them carries the label and Biome's
`a11y/noSvgWithoutTitle` fires otherwise.

**The one emoji in the codebase is a cursor, and it is artwork rather than a
glyph.** `components/labs/tether-button/cursors.tsx` vendors two OpenMoji black
hands as SVG. It is a lab asset, not a UI icon, and the shared "icons, never
emojis" rule still stands everywhere else. See the Lab section for why a text
glyph could not serve.

- **Import the `*Icon`-suffixed exports only.** `CheckIcon`, not `Check`. The
  bare names are deprecated in 2.1 and will be removed.
- **Server components import from `@phosphor-icons/react/dist/ssr`.** The main
  barrel pulls in `createContext` and throws in RSC. Only a `"use client"` file
  may import from `@phosphor-icons/react` directly.
- Sizing is `size-*`, never the `size` prop, so the Tailwind scale stays the one
  source of truth. Inline-in-text icons use `size-[0.9em]` so they track the
  copy they sit in.
- Weight stays at the `regular` default. Do not pass `weight` per call site.

## Inline links

`InlineLink` is the one treatment for a link in prose, and it renders in two
shapes off a single rule: **a link whose host has a mark becomes a pill, a link
without one stays underlined text.** Call sites pass nothing extra, the shape
is derived from the href.

- The pill is the same `rounded-full bg-fill` shape as the primary button, sized
  entirely in `em` so it tracks the text it sits in. Never give it a fixed
  height or a per-call-site size.
- **`leading-none` on the pill is load-bearing. Do not remove it.** An
  inline-flex takes the prose line-height for its own text item, so without it
  the pill is the whole line box plus its padding: 27.36px inside a 23.04px
  line, overlapping the lines above and below by 4.32px. It is not a style
  choice, it is what keeps the pill inside its own line.

  The trap is that raising the paragraph's leading looks like the fix and is
  not. It grows the pill by exactly the same amount, so the overlap never
  moves. That was tried first and did nothing. `py-[0.25em]` then spends the
  reclaimed height back, so the pill paints the size it always did.
- **Prose leading is looser below `sm`**, set on `--text-body--line-height` in
  `app/globals.css`. A narrow column wraps often enough that nearly every line
  carries a pill, so 1.44px between them reads as touching, and 1.85 takes it to
  5.04px. A wide column almost never stacks two, and keeps the tighter 1.6.
- Marks live in `public/assets/favicons`, registered by host in
  `lib/favicons.ts` with their intrinsic width and height. They are downloaded,
  never hotlinked and never fetched from Google's favicon service, so a page
  load makes no third-party request.
- The registry carries dimensions because not every mark is square. A wide one
  set to the square height runs twice as long and swamps the line, so wide
  marks get a smaller height to match the others' visual mass.
- Adding a link to a new host means adding its mark to the registry, otherwise
  it silently renders as a plain underlined link.

## Layout

Every page renders inside `PageShell` (`components/ui/page-shell.tsx`), which
owns the `min-h-svh` centering and the column width. `align="center"` for the
home page, `align="top"` for the longer index pages. Never set a per-page
`max-w-*`, change `CONTENT_WIDTH` instead.

## Work page

`app/work/page.tsx` is a server component. `components/work/` holds the client
pieces, `lib/work.ts` the data.

- **Rows, never cards.** A company and a project render through one `WorkRow`
  shape, flattened in `lib/work.ts` so the page stays layout only. Nothing on
  this site is a card, the old build's bordered container did not come across.
- **No disclosure, no client state.** Each row links straight out, so
  `WorkList` is a server component and no row data crosses to the browser. An
  in-place accordion with the open row in `?open=` was built and then removed
  as unnecessary.
- **`lib/work.ts` carries only what `WorkRow` reads.** It used to keep
  `details`, `preview`, `description`, `collaborators` and a job `title` warm
  for that removed detail view. Nothing read them, and the `preview` paths had
  gone stale on top of that: every one pointed at an image no longer in
  `public/`. If a detail view returns it gets content written for it, not fields
  kept on the chance. `Company`, `Project`, `companies` and `projects` are not
  exported either, `workSections` is the module's whole surface.
- **A leader rule, not dividers.** Each row is logo, name, a hairline that
  absorbs all the slack, then the date. Fifteen dividers on top of that read as
  a table.
- **Row logos keep their brand colour**, in one shared `rounded-full` tile with
  a `ring-stroke` hairline. The source logos are six different silhouettes,
  some carrying their own square ground and some bare, so an unframed row never
  settles. `overflow-hidden` on the tile is what unifies them: a logo with its
  own background gets clipped into the circle, a bare mark sits inside it
  against `bg-fill`. Greyscale-at-rest was tried and rejected.

## Page transitions

A crossfade between routes, via React's `<ViewTransition>`.

- `components/ui/page-transition.tsx` wraps **each page's content**, not the
  root layout's children. A layout's children slot keeps its position in the
  tree across a navigation, so React reconciles it as an update rather than an
  unmount and a mount, and `enter`/`exit` never fire.
- **It is propless on purpose.** A bare `<ViewTransition>` uses the browser
  default, which is a crossfade, so there are no keyframes to maintain and
  nothing depends on `::view-transition-old(.class)` selectors, which need
  Chrome 125+ and diverge in Safari. Only the duration is tuned, against
  `root`, in `app/globals.css`.
- Directional slides keyed off a Link's `transitionTypes` were built and then
  removed. They are a bigger effect than these pages need and they cost that
  class-selector dependency. Re-adding means a types map on the boundary,
  `transitionTypes` on the links, and keyframes per direction.
- **No config flag. Do not add one back.** This needed
  `experimental.viewTransition` in `next.config.ts` up to Next 16.2, and 16.3
  dropped the key: view transitions work in the App Router with nothing set, and
  passing it now fails the typecheck with "'viewTransition' does not exist in
  type 'ExperimentalConfig'". See
  `node_modules/next/dist/docs/01-app/02-guides/view-transitions.md`.
- **The App Router's `react` is Next's own bundled copy, which is the copy
  exporting `ViewTransition`.** The installed `react@19.2.8` does not export it,
  so `require("react").ViewTransition` is `undefined` in Node and that is
  expected. It is a bundler alias rather than a package resolution.
- `@types/react` declares it in `canary.d.ts`, opted into by
  `types/react-canary.d.ts`. A triple-slash reference rather than a
  `compilerOptions.types` array, which would switch off automatic `@types`
  discovery for everything else.

## Blogs

`app/blogs/page.tsx` is the index. A post is a directory under it holding three
files:

- `meta.json`, `{ title, description, date, readTime }`. **`date` is ISO
  `YYYY-MM-DD`**, formatted for display by `formatBlogDate`. The old site
  stored display strings like "mar 19, 2023" and sorted them lexically, which
  put March before November and gave crawlers nothing machine-readable.
- `page.mdx`, **pure content, no layout**. The old site put the page shell
  inside every post's MDX, so each carried its own copy and they drifted.
- `page.tsx`, the route. It exports `metadata` from the json and renders
  `<BlogPost meta={meta}><Content /></BlogPost>`.

`page.mdx` is not a route on its own, `pageExtensions` excludes md and mdx.

- `mdx-components.tsx` is the one place prose is styled. Everything there sits
  on the project's type scale and tone tokens, never a Tailwind default size.
  `strong` renders as a tone step, not bold, since nothing on this site is
  bold. List bullets are `before:` dots for the same reason as elsewhere: a
  flex parent blockifies its children and kills a real marker.
- Content headings start at **h2**. The shell renders the h1, so an h1 in the
  body would be a second one.
- Code fences render through `components/ui/code-block.tsx`. `sugar-high`
  emits `sh__*` classes coloured by the `--sh-*` properties in `globals.css`,
  which are **greys, not a syntax rainbow**, so a code block stays inside the
  page's monochrome.
- A missing `meta.json` hides a directory from the index, so a draft can sit
  in the tree unpublished.
- A post's demo component is **colocated** in the post directory when only that
  post uses it, and lives in `components/blogs/` when it might not be. Its
  import goes at the top of `page.mdx`.

### The post rail

`components/blogs/post-rail.tsx` is the left margin above `lg`: the back link,
then the post's own sections with the one being read marked by a bar that
travels between rows rather than a border toggling on each.

- **The back link lives here, not above the title.** Both are chrome about the
  page rather than content in it, and stacking them put a control between the
  reader and the first line. `BlogPost` keeps a second copy in the column
  wrapped in `lg:hidden`, so exactly one is on screen at any width. The rail
  renders even when a post has no sections, because the back link does not
  depend on them.
- **It reads the rendered headings, not the MDX source.** `rehype-slug` writes
  the ids (declared as a string in `next.config.ts`, since Turbopack passes
  plugins to Rust and cannot take a JS function), and the rail queries those
  exact elements out of the `article`. Parsing the source instead would mean
  reimplementing the same slug algorithm and hoping the two never diverge, and
  a divergence there is a dead anchor rather than a build error. The cost is
  that the rail arrives on mount: it is `fixed`, so nothing moves when it does,
  and it fades in on the standard variant rather than appearing.
- **A heading only carries an id if its component passes one through.**
  `Section` and `Subsection` in `mdx-components.tsx` spread their props for
  that reason. Dropping the spread silently empties the rail.
- **A row is a list of tokens, not a string.** Several headings name a file or
  an identifier in a `code` span, and flattening `configure _app.tsx` to text
  loses the one thing that says which half is a filename. The rail indexes the
  headings, so it has to read like them. The code token sets no tone of its
  own, so it follows the row between muted and primary.
- **It is fixed in the margin, never a flex sibling.** As a sibling it takes its
  width out of the row and pushes the column off centre, so a post would stop
  lining up with every other page. It positions off `CONTENT_HALF_REM`, which
  has to move whenever `CONTENT_WIDTH` does. 14rem of clearance for a 12rem
  rail leaves a 2rem gutter, and at exactly `lg` its left edge lands on the
  page's own `px-6`. Any wider and it runs off screen at that width.
- **`pb-1` on the rail is not spacing, it is what keeps a scrollbar away.**
  `BackLink` draws its underline as an `after:` pseudo-element at `-0.1em`,
  which paints below the anchor's box, so on a post with no sections the
  content was one pixel taller than the container. `overflow-y-auto` does not
  care that it is one pixel: it painted a 6px thumb down the right-hand edge
  beside a single link with nothing to scroll.
- **The reading line sweeps in the last screenful, and that is load-bearing.**
  `MorePosts` sits below the article and is shorter than a viewport, so the
  page bottoms out before the final headings can climb to a fixed line. Three
  of the four posts with headings never get their last one above 80px and one
  never gets its last two, which left rows that could never mark themselves.
  The usual patch, snapping to the last entry at the bottom, does not fix it,
  it skips whatever sat between. Do not replace the sweep with a constant.
- Fewer than two headings renders no list. One entry is not a table of
  contents, it is a heading already on screen.
- There is no mobile equivalent. Below `lg` a post has no structural
  navigation, which is the same trade the design makes everywhere else.

### Section anchors

`components/blogs/heading-anchor.tsx` puts a hash on every heading the rail
lists, hidden until that heading is hovered. It is how a reader gets the URL
for one section instead of the whole post.

- **A real `<a href="#id">`, never a button.** That is what updates the address
  bar, scrolls, and lands the heading under its own `scroll-mt` natively, and
  it is what lets the link be opened in a new tab through the browser's own
  menu. The clipboard write is added on top rather than replacing any of it.
- **The confirmation is the icon swapping to a tick, and the anchor is held
  visible while it does.** That second half is what makes it work. The control
  scrolls the heading it sits on, so the pointer is left behind and the hover
  ends in the same frame the tick appears. Tied to `group-hover` alone it swaps
  and hides simultaneously, which is indistinguishable from no feedback. The
  copied state is the only thing allowed to override the hover.
- **The tooltip label never changes.** Radix closes a tooltip on click, so a
  "copied" label there can never be seen. It stays "Copy link to section" and
  the `aria-label` carries the copied state instead. A toast was tried and
  removed: three copies stack three toasts, and the tick is right where the
  reader is already looking.
- The crossfade is `CodeBlock`'s, so both copy controls on a post behave the
  same way. It is not a true path morph. Nothing here can compile one, and
  `torph` animates text rather than geometry.
- The anchor holds its box whether or not it is visible, so revealing it never
  shifts the leader rule beside it. It sits before that rule, since a control
  past the rule's end reads as belonging to the next thing down.
- `BlogPost` mounts one `TooltipProvider` around the article, rather than one
  per heading.

## Lab

`app/lab/page.tsx` is the index, `app/lab/[slug]/page.tsx` the detail. Each
experiment is a directory under `components/labs/`.

- **The page is a server component; the dynamic import map is not.**
  `next/dynamic` rejects `ssr: false` inside a server component, and the
  experiments are all browser-only, so the map lives in
  `components/lab/experiment.tsx` behind `"use client"`. The page keeps its
  metadata, static params and `notFound`.
- **`IMPLEMENTED_LABS` in `lib/labs.ts` gates the routes** and the map is typed
  against it, so listing a slug without adding its component is a build error
  rather than an empty frame. An entry in the registry with no component 404s.
- `file-tree-explorer` is the one slug whose directory is named differently
  (`file-tree`), carried over from the old repo.
- **No preview images.** The old registry pointed at screenshots of the dark
  build, wrong on a white page and wrong about what the components look like
  now. The detail page runs the real component.
- **`bare: true` on a registry entry drops the `Demo` frame**, so that
  experiment gets the column's full width. It is for a demo that draws its own
  container: the frame's hairline then sits a padding-width outside the
  experiment's own edge, and the two nested boxes read as chrome around chrome.
  `tab-overview` is the only entry using it.
- **`flush: true` keeps the frame and drops its padding**, so the experiment
  fills the frame edge to edge. For a demo whose whole surface is the
  interaction rather than a component sitting on a surface: the padding then
  reads as dead space inside the thing you are meant to be poking. Not `bare`,
  which removes the frame: a demo that redefines the cursor needs the hairline to
  say where the new cursor stops, and one that pushes a card off its own edge
  needs a box to clip it against. `tether-button` and `document-pocket` use it.
- Five experiments carry a local `styles.css`. That is the one place the
  one-stylesheet rule bends, they are self-contained demos whose CSS is not
  part of the design system. Four of them still take their colours from tokens
  via `var(--color-*)`. `cursor-origin-button` had one and it was folded into
  Tailwind, including its asymmetric enter/leave timing, so prefer that when
  touching the others.
- **Two experiments define their own hues**, `tab-overview` per terminal session
  and `document-pocket` per sheet of paper. Both are the same case: colour is the
  differentiator between skeletons built from the same few shapes, so it carries
  meaning rather than decorating, which is the exception the brand marks already
  get. Both are scoped to their experiment, the values are not tokens, nothing
  else may reach for them, and labels and body lines stay grey, since the site
  does not put an accent on text. `tab-overview` keeps its values in its own
  stylesheet and `document-pocket` in a `const` beside its card list, which is
  the better of the two: prefer it.

### `tether-button`

The one experiment with a custom cursor. Pressing anywhere on its stage shoots a
web at the nearest edge of the button, and the button goes down when the web
lands rather than when the mouse does.

- **`cursor-none` has to go on the whole subtree, not just the stage.** `cursor`
  inherits, but the UA stylesheet sets `cursor: default` on a `button`, and a
  real declaration beats an inherited value, so the system arrow came back over
  the one element you aim at. `[&_*]:cursor-none` alongside it covers the button
  and anything added to the stage later. A headless screenshot cannot catch this,
  since it never draws the OS cursor.
- **The button also drops `cursor-pointer`**, which would beat the subtree rule
  the same way. This is the only place the shared "cursor-pointer on every
  clickable element" rule is off, and it is off because a second cursor is drawn
  instead.
- **The hands are emoji, vendored as artwork.** `1F446` and `1F91F` from
  OpenMoji, CC BY-SA 4.0, copied into `cursors.tsx` verbatim apart from the
  stroke, which becomes `currentColor`. This is the sanctioned exception to
  "icons, never emojis", the same shape as the brand marks: the request was for
  emoji and the drawings are assets, not glyphs standing in for icons. A text
  glyph could not work here anyway. A colour emoji ignores `color`, renders as
  different art on every OS, and puts its ink at an unpredictable place inside
  its box, which is the one coordinate the web launches from. Noto Emoji
  monochrome was the other route and costs 880KB for two glyphs, since Google
  serves it as one file with no unicode-range split.
- **Each hand carries a second copy of itself, filled, so it is opaque.** The
  `black` set is stroke-only, so the hand was transparent and the button's label
  read straight through it. `silhouette` is the same glyph's `#skin` group taken
  from OpenMoji's `color` set, painted in `bg` under the outline. Filling the
  outline instead does not work and looks like it nearly does: the palm's arcs
  close implicitly and fill, but the pointing hand's index finger is two bare
  `<line>` elements with no interior and the back of the hand is open arcs, so
  the finger stayed see-through. That is invisible at 34px against a white
  ground and obvious over a letter. A thick white understroke was the other
  candidate and covers the finger but not the open back of the hand.
- Being opaque also tucks the strand's last few px behind the palm rather than
  letting it cross the hand.
- **Every drawing declares a hotspot in OpenMoji's own 72 unit box**, read off
  the ink rather than guessed: the pointing hand's fingertip is a semicircular
  cap at (30.95, 7.9), and the horns hand's thumb tip is a cubic extremum at
  (12.59, 11.36). Both sit at the drawing's upper left with the body below and to
  the right, which is what lets one replace the other without the hand lurching.
- **A shot heading into the hand slides its own start along the run.** The horns
  hand's thumb is a 14 unit stroke leaving the hotspot, so a web fired down that
  line paints the thumb out of the drawing. `HORNS_BODY` names the direction the
  hand's mass lies in, and the strand's visible start moves up to
  `LAUNCH_INSET` in proportion to how far the shot points that way. A shot
  heading away, which is the case the reference draws, still leaves the thumb tip.
- **A web that is out is a tether, not a drawing.** The anchor is fixed at
  impact, so holding the press and moving the hand pays the strand out and reels
  it back in against that one point. Re-deriving the nearest edge every frame was
  the other option and is wrong: the splat would slide around the button, and a
  splat that slides is not stuck to anything.
- **So the geometry is per frame, not per shot.** The launch inset and the rim
  the strand stops at both come off the current heading, which turns as the hand
  orbits. Fixing them at launch paints the thumb over on the way past. The inset
  is also capped against the length of the run, or a hand pulled right up to the
  anchor insets past it and the strand inverts.
- **Slack bows the strand, and that is what stops it reading as a redrawn line.**
  The web remembers the run it was spun to cover, which is the run at launch and
  not at landing, so moving closer during the flight lands a web that is already
  slack. Bringing the hand inside that leaves the difference hanging. The spine
  becomes a quadratic and the lobes ride its local normal, so the twist follows
  the curve round instead of staying square to a straight axis, and the lobe
  count comes off the spine's own length rather than the chord or a bowed strand
  stretches its lobes.
- **The bow is scaled by the perpendicular's downward component and capped
  against the run.** Scaling means a horizontal run hangs fully and a vertical one
  does not bow at all, which is what slack rope hanging straight down looks like.
  The cap is a design decision rather than physics: a hand brought right up to
  the anchor leaves the whole rest length hanging, and drawing that honestly is a
  loop several times longer than the gap it spans.
- **Letting go reels the web in and drops it at the same time.** One linear clock
  drives both so they cannot drift: the reel is linear on it and the fall is its
  square, which is constant acceleration. Reeling alone read as a rewind. The
  splat stays where it stuck, so the strand visibly peels off it.
- **The fall is applied to the tip, after the interpolation, never to the rim.**
  Offsetting the rim scales the offset by `progress`, so a strand reeling in
  cancels its own fall exactly as gravity is meant to take over. That is the
  whole trick and it is invisible until you try it the other way.
- **The launch's opacity ramp had to stop applying on release.** The strand
  darkens as it extends, off `progress`, and `progress` also runs back down when
  the web lets go, so the ramp ran in reverse and dimmed the strand just as it
  started to fall. Past the landing the layer's own fade owns the disappearance.
- **That fade is delayed rather than just slow.** Gravity is slowest at the
  start, so an undelayed fade spends its opacity on the part of the drop that has
  barely moved and is gone by the time the strand is really falling.
- **The splat's rotation is fixed at impact.** One spoke lines up with the strand
  as it lands, and after that the hand can orbit freely. A web that turned to keep
  facing the hand would be a web that is not stuck.
- **The tether only tracks inside the stage.** Dragging out freezes the strand
  where it was, which is the same trade the hand makes: it hides on leave, because
  the real cursor is back the moment the pointer is over anything without
  `cursor-none`, and two cursors is worse than a strand that pauses.
- **The button stays down for as long as the pointer does.** Not a fixed timer.
  `MIN_PRESS` is a floor rather than a duration, for a click quicker than the
  web's own flight: without it such a press lands and releases within a few
  frames and never reads. `KEY_PRESS` is the whole press for a keyboard
  activation, which has no lift coming, and `held` is what tells the two apart.
- **The lift is heard on the window, and `blur` counts as one.** A pointer can
  lift outside the stage and outside the window. A window that loses focus
  mid-press never sends the `pointerup`, and a button stuck down forever is worse
  than one that lets go early. Pointer capture was the other way to catch a lift
  outside the stage and costs more than it gives: capture suppresses
  `pointerleave`, so dragging out would leave the drawn hand on screen beside the
  real cursor, which returns the moment the pointer is over anything without
  `cursor-none`.
- **The button is the site's own pill, and the press is a background step.**
  `rounded-full bg-fill`, the same shape `InlineLink` uses, stepping to
  `fill-active` when it goes down. It was a white face with a near-black border
  and a solid black 4px lip, which is the reference's aesthetic rather than this
  one: `shadow-*` appears nowhere else in the codebase outside the toaster's
  third-party override, and nothing here depresses.
- **The two fills are a branch, not a `data-pressed:` variant, because pressed
  has to beat hover.** The button can be pressed from across the stage, so it is
  usually pressed and not hovered, and a press landed on it directly would
  otherwise read as a hover.
- **The step in is instant and only the step back is timed.** At 200ms both ways
  a press shorter than the transition never reaches its own colour, and
  `MIN_PRESS` is 140ms, so the quickest clicks showed almost no press. Same shape
  as the web layer and as `cursor-origin-button`.
- **The shape maths is radius aware, which the pill forced.** One clamp into the
  rect inset by its own radius answers both questions asked of the button: the
  distance from there says whether a press is inside it, and stepping the radius
  along that direction lands on the boundary. A 35px pill carries a 17.6px
  radius, so the corners its bounding box claims and its shape does not come to
  about a tenth of the box, and testing the box alone meant a press beside the
  pill's end counted as a press on the button with no web. `rounded-full` also
  compiles to `calc(infinity * 1px)`, so a computed radius that is not a real
  number falls back to half the shorter side.
- **Nothing clips, and the hand is allowed out of the frame.** Both ends of a
  strand are inside the stage by construction and the splat sits on the button,
  so the hand is the only thing that can reach an edge, and it hangs down and to
  the right of its hotspot. Clipping it to the frame's radius left a 20px
  fragment in the bottom right corner, which reads as a glitch. A cursor that
  carries on past a border reads as a cursor.
- **Showing the web is declarative, darkening it is not.** Two nested groups.
  The outer one's opacity comes from `phase` and is timed in CSS, asymmetric so
  a shot appears at once and only its disappearance is timed, the same shape as
  `cursor-origin-button`. The inner one carries the per-frame darkening. The
  outer used to be an `animate()` on opacity, which the next shot's `cancel()`
  could stop part way and leave a landed web on screen with nothing left to
  clear it. A transition driven by state cannot strand, since phase always
  returns to idle.
- **A new shot blanks the last splat before it paints.** A hidden layer keeps the
  path data it was left with, so without that the previous web flashes at its
  old anchor for the length of the new flight.
- **`web.ts` is pure geometry in stage pixels**, and its SVG carries no
  `viewBox`, so one user unit is one pixel and nothing needs a scale correction.
  Path data is written through `setAttribute` off refs, since a strand rebuilt
  every frame does not belong in a render.
- **Reduced motion is read in the component.** `MotionProvider`'s
  `reducedMotion` governs motion components, not a value animation driving path
  data by hand. The web still lands and the button still presses, it just does
  not travel.

### `document-pocket`

A pocket of paper. Hovering fans the cards out of it and tilts its front panel
forward, hovering one card singles that one out, and clicking a card grows it to
the middle of the stage with the rest pushed off to the sides.

- **A card is staged by animating its `width`, never by scaling it.** A card goes
  from 113px to 322px, so a `scale` would paint its 1px hairline at 3px and turn
  its 6px corner into a stadium. Animating the box means no transform is
  involved, so the ring stays a hairline and the radius stays whatever it is set
  to. This is the whole reason `poses.ts` returns stage pixels rather than
  percentages.
- **Which is what makes the contents `cqw`.** The card is its own container and
  everything inside it is a proportion of its width, so one element is a legible
  miniature in the pocket and a document on stage with its rules and its padding
  growing to match. There is no token for these, they are proportions of a box
  rather than steps on the spacing scale.
- **`cqw` on the container itself does not mean what it looks like, and this cost
  a rebuild.** An element is a query container for its descendants and never for
  itself, so `cqw` in a property on the card resolves against the card's nearest
  *ancestor* container, and with none it falls back to the small viewport. The
  card's padding was `p-[8cqw]`, which on a wide window is about 115px a side on a
  113px card. `box-sizing: border-box` floors a border box at its own padding, so
  the cards inflated past twice their size, `overflow-hidden` clipped every bar
  out of them, and the result was five blank rectangles cascading down and right
  of the pocket. Every value on the descendant spans was correct the whole time,
  which is what made it hard to see. Card padding lives on `SHEET`, inside the
  card.
- **The stage is `bg-fill`, not the frame's white.** The paper is white, and on
  white a fanned card is a hairline and a shadow and nothing else. This is the
  same reasoning as the pocket going dark, one step down.
- **The pocket is matte, so nothing here is glossy.** No travelling highlight and
  no specular band, both of which read as moulded plastic. What sells a matte
  surface instead is grain, a cavity that darkens with depth, and edges catching a
  single pixel of light.
- **Grain is the single biggest thing separating a matte surface from a flat
  fill.** A diffuse material scatters light, and grain is what that looks like. It
  is also what stops a near-black wall and a near-black panel reading as two
  vector rectangles with a seam between them. One inline `feTurbulence` data URI,
  284 bytes, so the page makes no request for it. `overlay` on the dark faces,
  which by its own maths does nothing to pure black and everything to a mid tone,
  so the grain appears exactly where the surface is lit and stays out of the
  shadows, which is the right way round. `multiply` on the paper, so it can only
  darken and never blow a white sheet out.
- **The cavity gradient is load-bearing twice.** It makes the interior read as
  open and lit from where the paper leaves, and it is also the only reason the
  grain is visible on that face at all, since `overlay` has nothing to work with
  on the unlit part.
- **Every base tone stays in a class and only the light goes into `style`.** So
  `bg-inverse-bg` with a `backgroundImage` gradient over it, never a `background`
  shorthand carrying a colour. That is what keeps the token rule intact while the
  shading stays white and black at alpha.
- **Three stacked shadows outward, three inset.** Outward: a contact shadow to
  seat it, a mid layer for form, a wide ambient one for depth, each faint alone,
  because a single shadow dark enough to read at this size looks like a drop
  shadow rather than like light. Inset: a lit top edge for the back lip, a bottom
  occlusion where floor meets wall, and `inset 0 0 40px` for the depth itself,
  since an interior is darkest where it meets its own walls.
- **The panel's upward shadow is what seats the paper.** A shadow paints in its
  own element's layer, and the panel is above the cards, so it lands on the white
  paper rather than under it.
- **The floor shadow sits behind the wall, centred on the pocket's bottom edge.**
  The pocket hides its top half and only the spill shows. `FLOOR` is all the room
  there is underneath, which is why it is short and wide rather than deep: taller
  blurs straight into the frame's edge.
- **The paper's lift is Tailwind classes, not an inline `boxShadow`.** A ring is a
  box-shadow too, so an inline value overwrites the card's hairline instead of
  composing with it, where Tailwind composes its own through `--tw-shadow`. The
  hairline also stepped down from `stroke-strong` to `stroke` once the lift was
  real, because a strong edge under a real shadow reads as a drawn border.
- **The panel's hover is a `::before` wash, not a second background.** Its face is
  a gradient, so a `bg-*` class cannot step it. `aria-expanded` carries the same
  wash, per the open-trigger rule.
- **The pocket's corner radius is one pixel value off the measured stage.** A
  percentage pair, `x% / y%` per face picked so both land on the same pixel, is
  the obvious answer and was the first one: it tracks each box, where a fixed
  `rem` is only in sync at one width. It did not paint. The panel came out square
  while the wall, on the same treatment, was round, and the cause was never
  isolated. A pixel value sidesteps it, still tracks the pocket since the stage is
  measured anyway, and serves both faces with one number.
- **Motion was blamed for that and is innocent, which is worth knowing here.** It
  only pulls a property out of `style` and into its own values when that property
  is a transform, an `origin*`, or, with `layout`/`layoutId` set, something its
  scale correctors cover. `getValueAsType` coerces numbers only, so a string in
  `style` passes through untouched. Static strings and multi-layer `boxShadow`
  values are safe to hand a motion component. Do not design around a restriction
  that is not there.
- **Uniform cards are what buy both.** The reference fans five different widths,
  and a `translateX` percentage resolves against the element's own width, so one
  offset moves a narrow card further than a wide one and every value needs
  converting per card. Identical cards delete that whole layer.
- **Corner radius is not proportional to the card.** It roughly doubles while the
  card roughly triples, because a radius that keeps its ratio to a card three
  times the size reads as a stadium rather than a corner.
- **Three layers under one perspective, and none of them nested.** An element
  carrying `perspective` is its own stacking context, so a pocket wrapper would
  make the cards sit wholly above or wholly below both of its faces. They have to
  interleave: wall, then cards, then the shorter front panel.
- **The panel getting wider at the top as it tilts is correct, not a bug.** At
  `-26deg` its top edge comes about 73px toward the viewer, which at
  `perspective: 1000px` magnifies it by 1.08 and pushes its top corners about
  10px past the wall's sides. A panel leaning out of a pocket does that.
- **The panel never fades, and `TILT.staged` is what it is because of that.** It
  used to drop to `opacity: 0` at -78deg while a card was staged, and a panel that
  dissolves and re-materialises is not something a panel does: it looked
  deliberate on the way out and wrong on the way back. It also never needed to get
  out of the way, since a staged card renders above it. So it leans instead and
  the scrim above it is what veils the pocket. -52 is the most it can lean and
  still read as a panel: 110px of visible face, against 38px at -78, which is a
  bar. Behind the scrim it composites to 76% lightness on a 95% ground, so
  the pocket reads as depth behind glass rather than as a dark shape.
- **The stage clips, unlike `tether-button`'s.** A card pushed aside for a staged
  one is meant to hang off the edge with a sliver showing, which puts most of it
  outside the frame, and `Demo` does not clip its own contents. Without
  `overflow-hidden` a card slides out over the page beside the frame. The radius
  has to be `Demo`'s own, since `flush` means the two are the same box.
- **The sliver step is small so the deepest card stays on screen.** At 0.05 of
  the stage the fourth card out cleared the edge completely, so from either end
  of the pile two cards simply were not there and the arrow keys had nothing
  saying they went anywhere.
- **Hover is answered by `hitTest`, not by the DOM, and this is the single most
  important thing in the experiment.** One `pointermove` on the stage, tested
  against the fan's geometry in `poses.ts`. The DOM cannot do this job: it hit
  tests boxes as they are currently animated, so a card that moves in response to
  being hovered moves out from under the pointer, the hover drops, the card falls
  back, and the hover re-acquires. `hitTest` reads the **neutral** boxes, with
  nothing hovered, so a hover cannot change the geometry that decides the hover
  and the loop cannot exist.
- **Two DOM-driven versions were built and neither could be made stable.** The
  first singled a card out by raising it 27px, which moved its own bottom edge off
  the pointer that had just arrived there: the fan flickered continuously and a
  card could not be reached at all unless the pointer crossed the whole band
  inside one frame. Sinking the other cards instead (`SINK`) fixed that one, and
  left a second: a singled-out card straightens from as much as 10 degrees, which
  sweeps its corners up to 6.4px outside its new box. Containing that needs `GROW`
  at 1.20, and a card that jumps a fifth bigger under the pointer reads as a zoom
  rather than as one sheet picked out of a stack. A 60ms grace period on the
  release absorbed some of it and none of the cause.
- **Which is why the two motion rules in `pose` still matter.** Growth is centred,
  so every edge of a singled-out card moves outward, and neighbours only ever lean
  away from the card under the pointer. Anything added there has to keep both
  properties, or the visible card and the tested box drift apart.
- **The cost is a few pixels at four corners.** The outermost part of a
  straightened card is outside the box being tested, so it is not hoverable. That
  is the trade for a fan that behaves the same slowly as it does quickly, which is
  the whole bug: replaying the reported gesture at 70 samples and at 8 now gives
  one transition either way.
- **Cards are only tested while the fan is out.** Shut, they sit behind the front
  panel, so the pocket is the only thing there is to be over.
- **The pocket's reach is as big as the pocket currently is.** Shut it is the
  footprint, so the fan only ever *opens* from the pocket and never from empty
  stage. Open it is the box around the pocket and the whole fan, because a fanned
  card reaches well past the pocket's sides: testing the footprint alone leaves a
  dead band outside the pocket's left and right edges and below the cards, and
  every shallow diagonal from the front face out to an outer card crosses it, so
  the fan shut halfway and dropped the card being reached for. One box rather than
  the union of two, since a union of rectangles has the same hole. This cannot
  oscillate, because opening only widens the region and the shut region is a
  subset of the open one. Verified: 200 diagonal drags from a grid of points on
  the front face to every card, none losing the fan; 9045 points outside the shut
  footprint, none opening it; 6392 dwell tests, none unstable.
- **Every sheet carries its own hue, at two strengths.** `mark` is saturated and
  paints exactly one element, `tint` is a wash and paints exactly one block, and
  the body lines stay grey. Every `mark` clears 3:1 on white paper, which is what
  a meaningful graphic needs, and every `tint` lands between 1.25 and 1.42, the
  same band as the `stroke-strong` grey it replaces at 1.37, so a card gains a hue
  without gaining weight. Ordered so no two neighbours in the fan sit near each
  other in hue, since neighbours are what overlap.
- **`SLOT` is the whole of the closed state.** It sets how much paper shows above
  the front panel, and that strip is the only thing saying the pocket has anything
  in it. At 0.18 it was 14% of a card, which read as a seam. 0.10 shows 30%. The
  floor is where the card's own top passes the pocket's, which is paper poking out
  of the back of a shut pocket.
- **`FAN_GROW` is 8%, and has to stay subtle.** A sheet clear of the stack is
  nearer the eye than one still filed. It applies to every card in the fan, so it
  multiplies with `GROW` on whichever one is singled out, and two visible size
  steps on one card read as a zoom. It cannot affect hover stability, since it
  applies whether or not anything is hovered.
- **The listeners are bound to the node, not written as JSX props.** The stage is
  not a control, it is a region the pointer passes through, and it has no honest
  interactive role to carry: `group`, the closest ARIA has, means a set of form
  fields. `focusin` and `focusout` sit there too, since they bubble and a card
  taking focus has to reach up to them.
- **Closing a card asks whether the pointer is still on the pocket.** No
  `pointermove` is coming to answer it, so without that the fan shuts under a
  pointer that never moved.
- **The pile remembers the last card staged and keeps it on top.** Restacking on
  landing is a visible z-snap the instant the cards settle, and a real folder
  remembers what you last pulled out of it.
- **An odd card count is deliberate.** It gives a true centre card that sits
  square and unrotated at rest, which is what makes the fan read as a fan opening
  rather than as a stack being shuffled. That card also gets the one arrangement
  with a header, since at rest it is on top and its header is the only part of
  any card showing above the panel.
- **Closing is sequenced, opening is not.** The panel waits `WIND`'s delay before
  it winds back up, so the paper is home before the pocket shuts over it. Folding
  the fan away and shutting the panel at the same time reads as one collapse, and
  the paper going back in is the half of the gesture worth watching. The delay is
  a share of the cards' own duration rather than a second number to keep in sync,
  and at 0.6 of it the panel overlaps their tail instead of waiting on it. Strictly
  sequential is what the reference does and is most of a second of animation for a
  pointer that has already left. It applies to the panel coming back only: tilting
  open has to answer the pointer at once, and leaning back for a staged card rides
  that card's own spring so the two read as one movement.
- **The hint is the only thing saying the demo is interactive.** Nothing about a
  dark box says "hover me", so without the note in the bottom left corner the
  experiment reads as a still image. It is the one place on the site with a
  handwriting face, because the note is *about* the demo rather than part of it and
  Inter would read as another label inside the piece. It leaves once the fan is
  out, since a hint that outlives the thing it points at is clutter.
- **The arrow is drawn in the stage's own units, not its own viewBox.**
  `STAGE_VIEWBOX` is derived from the aspect, so it maps 1:1 and a stroke width in
  those units scales with the stage like every other value here. The head is one
  stroke running barb, tip, barb with a bow on each side, because straight barbs
  read as a vector arrowhead and this is meant to look drawn.
- **It is `pointer-events-none`, and that is not optional.** The stage's own
  `pointermove` decides everything in this experiment, so anything laid over the
  stage has to be transparent to it. It is also hidden under
  `@media (hover: hover)`, since the copy is a lie on a touch screen, where the
  panel is tappable instead.
- **The front panel is a real `<button>`.** It carries `aria-expanded` and its
  matching hover, per the open-trigger rule, and it is what opens the pocket on
  touch, where there is no hover to fan it with.
- **Reduced motion is read with `useReducedMotion`.** Unlike `tether-button`
  these are motion components, so `MotionProvider` governs the transforms, but
  `width`, `height` and `borderRadius` are not transforms and would still ease.
  One `INSTANT` transition covers all of them.

## Motion

**Every page opens on the same stagger.** `Reveal` wraps the page column and
each top-level block is a `RevealItem`. `Reveal` passes children straight
through, so anything inside it stays a server component, which is why
`WorkSection` still renders on the server despite sitting inside one. Blocks
sit at `gap-12`.

`MotionProvider` in the root layout sets `reducedMotion="user"` globally, so
Motion skips transform and layout animation for anyone with the OS setting on.
Do not add a blanket CSS `!important` reduced-motion reset, it is redundant and
fights the library.

Standard variants, reused rather than reinvented:

```ts
// fade + blur + rise
initial={{ opacity: 0, y: 4, filter: "blur(6px)" }}
animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
transition={{ duration: 0.4, ease: "easeOut" }}

// staggered children
variants={{ hidden: {}, show: { transition: { staggerChildren: 0.08, delayChildren: 0.35 } } }}
```

## The signature

`public/assets/signature.svg` is the mark at the left of the footer, drawn on
rather than faded in. `components/home/signature.tsx` fetches and injects it
once it is in view, and the `.signature` rules in `app/globals.css` own the
reveal.

- **The asset is a pen path, not a font conversion.** It used to be six glyph
  outlines from the source font, one per letter, each a closed contour running
  around the stroke and back. Stroking those and animating `stroke-dashoffset`
  started every letter wherever its own contour began, so the mark assembled
  itself from six places at once. The file now holds two centreline strokes in
  writing order: the top of the `s` through the `y`'s tail, then the last `a`
  and `m` after the one pen lift the mark has.
- **The strokes were derived from the outlines, not redrawn.** The outlines were
  rasterised, thinned to a skeleton, split at the crossings, and walked as an
  Eulerian trail with a straightest-continuation rule at each one. An arc whose
  ink is wider than a single stroke is two strokes merged into one ribbon, which
  is the `n` tips and the `m` entry, so the trail runs out and back along it.
  Nothing in the repo reproduces that, so treat the two paths as source.
- **`stroke-width` is 4.4, which is not the pen's real width.** The old runtime
  stroked the outlines at 2.5, and stroking an outline paints the fill dilated
  by half that on each side, so the mark on screen was about 2.4 times bolder
  than the font draws it. 4.4 on the centreline reproduces that at 93% pixel
  overlap, checked in a browser at 32px and at 96px. The designed weight is
  nearer 2.2, which is a deliberate change rather than a fix if it is made.
- **The viewBox is baked in, and the asset carries its own paint attributes.**
  The component used to strip every fill, set stroke, width and caps per path,
  measure each path with `getTotalLength()`, and retighten the viewBox from
  `getBBox()` because the source box was a 375 square with the ink low inside
  it. All of that is in the file now, so the component measures nothing.
- **`pathLength="1"` is what keeps the stylesheet in plain numbers.** Without it
  every dash length would have to be measured in JS first.
- **The dash pattern is `1 2` resting at 1.02.** A pattern of `1` repeats every
  two path lengths, so at offset 1 a dash begins exactly on the end of the path,
  and a zero-length dash under `stroke-linecap: round` paints as a dot: a blob
  sitting past the end of the mark while a stroke waits its turn. The gap of 2
  puts that repeat out of reach, and the 0.02 keeps the pattern's other boundary
  off the start of the path, since engines differ on whether a dash that ends at
  zero length paints there.
- **The two durations are one write split by length.** 1.1s and 0.4s are the
  paths' 73/27 share of a 1.5s total, so both move at the same pen speed and the
  second starts where the first stops. Durations that are not proportional read
  as two different hands.
- **Reduced motion is handled in the stylesheet.** These are raw keyframes, so
  `MotionProvider`'s `reducedMotion` does not govern them, the same as
  `disc-spin`.

## Toolchain notes

- **TypeScript 7.** The compiler is the native port, which dropped the JS
  compiler API Next reads by default. `experimental.useTypeScriptCli` in
  `next.config.ts` routes Next's typecheck through the `tsc` CLI instead.
  Removing that flag breaks `next dev` with an unhandled rejection.
- **Biome 2.5.** `css.parser.tailwindDirectives` must stay on or Biome fails to
  parse `@theme` in `app/globals.css`.

## Spotify now-playing

`lib/spotify.ts` is the provider, `app/api/now-playing/` the route the client
polls, `components/home/now-playing.tsx` the album cover stacked behind the
avatar at the top of the home page.

Environment, all server-only except the last:

| Variable | Required | Purpose |
|---|---|---|
| `SPOTIFY_CLIENT_ID` | yes | from the Spotify developer dashboard |
| `SPOTIFY_CLIENT_SECRET` | yes | same |
| `SPOTIFY_REFRESH_TOKEN` | yes | minted once, see below |
| `NEXT_PUBLIC_BASE_URL` | only to mint | the origin the OAuth redirect returns to |

- **Missing credentials are not an error.** `lib/spotify.ts` checks for them and
  reports nothing playing, so the site boots with the cover absent. The old
  version threw from a helper and relied on an outer catch, which meant a typo
  in a variable name looked identical to Spotify being down.
- **The route sends `Cache-Control: no-store`, and `force-dynamic` is not enough
  on its own.** That flag governs prerendering, not the CDN, so a response with
  an `s-maxage` window still gets cached at the edge in production and every
  visitor in a region shares one poll. The client's `cache: "no-store"` only
  covers the browser, so the header has to say it too. There are three fetches
  in this feature and all three are `no-store`: the token exchange, the
  currently-playing call, and the route's own response. Do not reintroduce a
  cache window here, a stale now-playing line is the one thing the feature
  cannot survive.
- **Minting the refresh token is a one-off manual flow.** Set the first two
  variables plus `NEXT_PUBLIC_BASE_URL=http://localhost:3000`, add
  `http://localhost:3000/api/spotify/callback` to the app's redirect allow-list
  in the dashboard, visit `/api/spotify/login`, approve, and the callback
  returns the token as JSON to paste into `SPOTIFY_REFRESH_TOKEN`. Spotify
  matches the redirect URI byte for byte, which is the whole reason
  `NEXT_PUBLIC_BASE_URL` exists rather than the flow reading `SITE_URL`.
  Neither auth route is linked from anywhere and neither stores anything.
- **It renders inside `Avatar`, not as its own block.** It was a "p.s. currently
  listening to X" paragraph in the column first, and that could not work: a block
  arriving on a network response cannot join the opening stagger, so it either
  interrupted the sequence or turned up after it, and it needed a timed cue to
  look deliberate either way. Living inside a `RevealItem` that already animates
  means no cue and no extra child. Do not put it back in the column.
- **The reveal is keyed off the tooltip's `data-state`, not only `:hover`.** The
  tooltip sits 8px to the right, so moving onto it leaves the anchor and `:hover`
  drops while Radix keeps the tooltip open, which slid the cover back under an
  open label. `hover:` stays alongside it, because `data-state` only flips after
  `delayDuration` and waiting 150ms to start moving reads as lag.
- **The cover's ring is not `ring-inset`.** Its `<img>` is `size-full` and paints
  over an inset ring, so there was no visible edge at all. This is the same trap
  as the number-counter and the dashed border: a child paints over a parent's
  inset ring.
- **The disc turns via `paused` / `running`, not by adding the animation on
  hover.** `disc-spin` is always attached and only its play state toggles, so
  leaving the pill holds the disc at whatever angle it reached. Gating the
  animation itself would restart it at `0deg` and snap on every unhover. It is
  `motion-safe:`, since `MotionProvider` does not govern raw CSS keyframes.
- **`disc-spin` is declared in `globals.css` rather than using
  `animate-[spin_…]`.** Tailwind only emits its own `spin` keyframes when
  `animate-spin` is used, so naming `spin` in an arbitrary value can compile to
  an animation with nothing to run.
- `pickCover` takes the 300px art, not the 64px one. 64 is closest to the 40px
  disc by pixel count and the wrong choice, since it is already soft at 2x.
- The mark in the tooltip is `components/icons/spotify.tsx`. `Tooltip`'s `label`
  takes a `ReactNode` for that, and its content is a flex row so a mark and text
  align without the call site rebuilding the box.

## Structured data

`lib/schema.ts` builds the JSON-LD, `components/ui/json-ld.tsx` renders it. Every
route emits exactly one block: `Person` + `WebSite` in a `@graph` on the home
page, `ProfilePage` on `/work`, `CollectionPage` with an `ItemList` on the two
indexes, `BlogPosting` per post, `SoftwareSourceCode` per experiment.

- **Everything is derived, never restated.** Titles, dates and lists come from
  `meta.json`, `labsRegistry` and `getAllBlogs`, the same data the page renders.
  The shared rules ban marking up what a page does not visibly show, and a
  hand-copied title is how that happens by accident.
- **`dateModified` is deliberately absent.** Nothing records when a post was
  last edited, so stamping `datePublished` there would assert "never edited
  since" as fact.
- **The email is deliberately absent.** It is already public on the page, but
  machine-readable markup hands it to scrapers for no ranking benefit.
- The renderer escapes `<` as a unicode escape. A `</script>` inside any string value
  would otherwise close the tag early, and `JSON.stringify` does not do this.

## Internal linking

`MorePosts` and `MoreLabs` sit at the foot of every post and experiment.

Before them each of those pages was a leaf with exactly one inbound link, its own
index, and nothing linked between them, so there was no cluster for a crawler to
follow. They are titled "More posts" / "More experiments", not "Related":
there is no tag or topic data to compute relatedness from, so a heading
promising it would be a claim the ordering cannot support. `MoreLabs` filters on
`isImplemented`, or it would point every lab page at a 404.

## SEO routes

`robots.ts`, `sitemap.ts` and `not-found.tsx`, all reading `SITE_URL`.

- **`sitemap.ts` lists only routes that resolve.** Lab pages are gated on
  `IMPLEMENTED_LABS`, so a registry entry without a component 404s and must not
  be advertised. Every entry is implemented today, which is exactly why the
  filter belongs in the code rather than in someone's memory.
- **No invented timestamps.** The old sitemap stamped `new Date()` on the four
  static routes, so every crawl saw them claim they had changed that second.
  `lastModified` is omitted where nothing real backs it, and `/blogs` and
  `/lab` borrow the newest date from the content they list.
- **`robots.ts` allows `/` rather than enumerating routes.** The old version
  listed every blog and lab path into `allow`, which `allow: "/"` already
  covers and which went stale on every new post. `/api/` is the one real
  exclusion, because `/api/spotify/login` redirects to Spotify's authorize
  screen.
- **`not-found.tsx` sets `robots: { index: false }`.** An indexed 404 competes
  with the real pages for the same terms. It centres rather than aligning top,
  since there is no content to scroll, and it carries no `BackLink` because the
  copy already names every route worth reaching.

## Directories

- `app/` routes. `components/ui/` shared primitives, `components/home/` and
  `components/work/` are per-surface, `components/icons/` holds brand marks.
  `components/home/avatar.tsx` is the first block on the home page: the photo,
  with the now-playing cover stacked behind it.
  A per-surface component moves to `components/ui/` the moment a second
  surface needs it, which is how `reveal.tsx` got there.
- `app/api/` route handlers. Only Spotify lives here, see below. Everything
  under it is `Disallow`ed in `robots.ts`.
- `lib/` no React. `constants.ts` layout tokens, `site.ts` copy and URLs,
  `work.ts` work data, `favicons.ts` the host-to-mark registry,
  `spotify.ts` the now-playing provider, `schema.ts` the JSON-LD builders,
  `utils.ts`.
- `types/` ambient declarations only. Currently just the React canary
  reference. Anything untyped from npm gets its `.d.ts` here.

## Keeping this current

Any new top-level directory gets documented here before the task is done. Any
new colour token gets a row in the token table. Any new type-scale entry gets a
line in the type scale section.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
