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
pnpm test:agents  # the agent-readiness checks, against a running server
```

`pnpm check` must be green before any push.

`pnpm test:agents` is the one test suite in the repo. It drives a server that is
already listening rather than starting one, since two Next servers cannot share
one `.next`, and it defaults to the dev port the recorder uses:

```bash
pnpm dev && pnpm test:agents                       # localhost:3100
AGENT_BASE=http://localhost:3200 pnpm test:agents  # a `next start` build
AGENT_BASE=https://sanyam.sh pnpm test:agents      # production
```

See Agent readiness below for what it covers.

## Stack declaration

| Parameter | This project |
|---|---|
| Package manager | `pnpm` |
| Icon library | `@phosphor-icons/react` v2, see Icons below |
| Motion library | `motion` (imported from `motion/react`), **not** `framer-motion`. `gsap` is installed for exactly one lab, `custom-cursor`, see its section. Nothing else imports it, and a component never mixes the two. |
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
| `success` | `#2d7a53` | a task the reader completed, see below |
| `selection` | `#34d399` | text selection highlight, see below |
| `link-work` | `#2f6f6a` | the home page's `/work` link, see Inline links |
| `link-blogs` | `#4a5b96` | the home page's `/blogs` link |
| `link-lab` | `#7a4f78` | the home page's `/lab` link |
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

**`danger` and `success` are the two status tones, and there is no third.** Hue
carries meaning here rather than decoration, the same exception the brand marks
and the syntax colours get, so neither reopens "no accent colour on text or
links". Add a warning tone only when a surface needs one, with the contrast
checked the same way both of these were.

`danger` is 4.91:1 on `surface` and is the lightest red that still clears 4.5:1
at the 14.4px semibold it is used at. `#c2544b` was the first pick and fails at
4.31.

**`success` is weighted to match it rather than picked by eye**, so the pair
reads as one set: 5.22:1 on `bg` against danger's 5.13, 5.00 on `surface`
against 4.91, 4.75 on `fill` against 4.67. On a 10% wash of itself over `bg` the
text measures 4.59, which is the danger pill's own 4.61.

- **What it means is "done", never "correct".** Marking a right answer among
  four is the emphatic neutral's job, which
  `the-submenu-closes-before-you-get-there` documents at length and still does.
  What needed a green is a task the reader finishes: a filled row says "this
  one" and not "you did it". The two live on one page in
  `the-card-flinches-when-you-reach-its-edge`, where the hold meter goes green
  and the quiz below it grades neutral.
- **It is not `selection`.** That emerald is 1.7:1 on white, which is a
  highlight behind text and never a tone for text.
- A lab still scopes its own green where the meaning is narrower than "done".
  `notch-drop`'s `GO` marks the moment a drop becomes possible, and it stays
  scoped.

**The `inverse-*` set is not dark mode.** Nothing switches to it and there is
still no `dark:` variant anywhere. It is a surface a component opts into when a
light ground genuinely cannot work, and every caller so far is a version of the
same problem: white content with nothing to sit on, or nothing dark enough left
in the light tokens to sit it against.

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
- `components/labs/stamp-collection/` lays cream paper on a table, which is the
  same few percent of lightness again, so the table went `inverse-bg`. See its
  own section.
- `components/labs/book-opening/` is a book of white paper, and its two boards
  are what make the stack a book rather than a pile of loose sheets. A board a
  step off the paper cannot do that, since `stroke-strong` at 86% lightness is as
  dark as the light set goes and the board, the paper and the table would land
  inside 5% of each other. **Only the boards invert here and the stage stays
  light**, which is the narrowest use of the set: it is one object on the page,
  not the ground under it.
- `components/labs/island-menu/` is a nav bar that opens into a menu, black
  for the same reason as the notch: the reference is a slab of hardware and
  the page it sits on stays light.
- `components/labs/notch-drop/` is a notch, which is black because the thing
  it stands in for is a piece of hardware, and it is the only dark object on
  its stage. The page under it stays light. Same shape as `book-opening`'s
  boards: one object opts in, not the ground.
- `components/labs/ember-burst/` is a shower of sparks, and light is the one
  thing that cannot be drawn on a white page: a near-white ember on `bg` is
  nothing at all, and the room the burst lights has no lift available to it.
  The stage inverts and the strip of knobs under it stays light, so the set
  covers the picture and never the controls.
- `components/labs/cube-orbit/` unfolds a cube, and a cube is a black plastic
  thing with its stickers stuck on it. A white sticker is the page's own colour,
  so without a ground under it a sixth of the cube is not there at all. Only the
  six blocks of plastic invert and the stage stays light, which is the narrow
  use `book-opening`'s boards make: one object opts in, not the ground.
- `components/labs/window-shade/` is the one caller that does not pick an end.
  **It reads both sets at once and asks for the point between them**, since the
  whole experiment is a cabin crossing from lit to dark on the position of a
  window shade. Every tone on that stage is
  `color-mix(in oklab, <light token>, <inverse token>, shade)`, so nothing there
  is a new colour and the crossing is the two sets the site already has. This is
  still not dark mode: nothing outside that one demo changes, and the page around
  it stays white. See its own section.

The values are the previous dark build's, so the two versions of the site stay
recognisably related. `inverse-text` is 18.97:1 on `inverse-bg` and
`inverse-text-secondary` is 6.12:1. Check any new pairing: `#6f6f6f` was the
first choice for the secondary tone and fails at 3.94.

**`--shadow-stage` is the one shadow token**, declared beside the colours in
`@theme` for the demo stage in `app/blogs/_details-you-can-measure/`. See that
post's section. Nothing else casts a shadow.

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
- **No accent colour on text or links, with one exception.** Hierarchy comes
  from tone and weight alone. This is deliberate and is most of why the design
  reads clean.

  The exception is the three internal links in the home page's copy, `/work`,
  `/blogs` and `/lab`, which take a tone each. It bends the rule for the reason
  the rule exists: every other link in that paragraph carries a favicon pill
  beside it, so those three words were the only ones with nothing at all saying
  they were links until the underline swept in on load. See Inline links below.
  Nothing else on the site may reach for these.
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

  **One lab overrides this override, and the test is the one the reasoning
  above already states.** What the rule protects is a target small enough that
  2% is sub-pixel, and `components/labs/foil-card/` is a 420px card under a
  perspective, where 2% is 9px of edge and the tilt is resampling it on every
  frame anyway. It presses by scaling and is documented as doing so. Nothing
  smaller than that may, and no button, pill, row or inline target may.
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
for the opening one and secondary for the three below it. Matching them at
`text-lead` instead was tried first and looked worse, the larger supporting
paragraph read as a wall. Do not "fix" any of them back to `text-lead`, and do
not drop the closing note to `text-meta`, it was deliberately raised to match
the paragraph above it.

`text-meta` serves the footer, tooltips, section labels and row metadata.

**One font is not on this scale, and that is the point.** `Caveat` in
`app/fonts.ts` is a handwriting face with exactly two callers, both of them
annotations rather than prose: the hint in `components/labs/document-pocket/`, and
`components/ui/new-badge.tsx`. Neither is sized by a token. The hint takes its
size from the demo's own width, since it is part of that drawing, and the badge is
20px, which is 1.39x `text-body`, because Caveat's x-height is far enough below
Inter's that matching the row by token renders visibly smaller than it. Do not promote this face to the scale, do not use it for UI, and do not add a
third off-scale face without the same kind of reason.

Next scopes a font to the components that use it, so it is fetched only on the
pages that render one of those two, and `next/font` self-hosts it, so no page
makes a third-party request for it.

**`NewBadge` marks the newest entry and nothing else, because there is no clock
available.** Both indexes are statically prerendered, so a check against the
current date would be answered once at build time and then keep claiming the same
thing until the next deploy, which is the trap `sitemap.ts` avoids by omitting
`lastModified`. The newest entry is the newest whenever the page is served.

**Which row is newest is the caller's claim, through `markNewest`, and not
something `BlogIndex` or `LabIndex` may assume.** Only a list of everything can
make it. `MorePosts` and `MoreLabs` render through those same two components and
pass a list with the current page filtered out and the rest cut to three, so
row 0 there is the newest of what is left. While the badge keyed off row 0 alone,
reading the newest post put it on the runner-up, which is the one thing the
badge must never do. So the two indexes pass `markNewest` and the two "more"
sections do not.

It hangs in the margin absolutely, so a truncating row title never shares its width,
and it is hidden below `md`. The hand-drawn circle round it is what set that
breakpoint: the word alone reached 44px past the column against 51px of margin at
`sm`, and with the circle plus the margin that clears the row it needs 62px. The
circle is one stroke that overshoots its own start, since a closed ellipse reads
as a border rather than as a pen mark, and **every offset around it is measured
from the circle rather than from the word**, since the circle hangs 6.4px past the
span on all four sides. Sizing the gap to the word alone is what put the circle
inside the row's hover pill. It is the
row's first child, so a screen reader hears "new" before the title.

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
  Three exceptions, and each is a state rather than a style: the signature
  player's transport, where the glyphs are player symbols rather than UI icons
  and take `fill`, `halftone-ripple`'s heart, where a filled heart is what a
  like button's on state has always looked like, and `ember-burst`'s flame,
  which is filled when the wick is lit and an outline when it is out. The last
  two fade the filled glyph in over the outline rather than swapping the
  weight, so the edge stays under it through the change.

## Inline links

`InlineLink` is the one treatment for a link in prose, and it renders in two
shapes off a single rule: **a link whose host has a mark becomes a pill, a link
without one stays underlined text.** Call sites pass nothing extra, the shape
is derived from the href.

**A markless link to `/work`, `/blogs` or `/lab` also takes a tone**, derived
from the href the same way the shape is. The word carries the hue and the rule
under it carries it at 45%, going to full on hover. This is the one place the
"no accent colour on text or links" override bends, and the reason is that those
three are the only links in the home page's copy with no mark beside them: a
sweeping underline says "link" for 450ms on load and nothing after that.

- **`ROUTE_TONE` in `inline-link.tsx` is the whole map, route to token.** It is
  the one component that renders a link in prose, so nothing else needs to know.
  A route with no entry is untoned, which is the default and stays the default.
- **Adding a route means adding its token to `@theme` first**, then a row to the
  colour table, then the entry here.
- **A toned link keeps its hue on hover** and only its rule steps up. Going to
  `text-primary` there would take the colour away at the moment the pointer
  arrives.
- The tones are muted on purpose and checked against the prose they sit in: 5.83,
  6.51 and 6.53 on white against `text-secondary`'s 5.28, so each link reads a
  touch stronger than the paragraph around it and none of them reads as a colour.
- **Hovering a toned link grows a wash of its own hue up out of the rule.** A
  `::before` at `origin-bottom` on a scaleY, so what arrives is the rule
  thickening into the word rather than a box fading in behind it, which is the
  point: the rule is the only thing marking these three as links at rest. Its
  bottom edge is the rule's top edge, `-0.04em` against the rule's `0.14em` at
  `-0.1em`, so the two touch with no seam, and its top is the span's own content
  box, which for Inter sits `0.24em` above cap height and clears both the caps
  and the `y` in "currently" without a measured height. It runs `0.12em` wider
  than the word on each side, where the rule stays the word's own width: 1.7px,
  which is enough that the first and last letter are not sitting on the edge of
  their own highlight and little enough that the wash still reads as the rule
  growing rather than as a second shape.
- **The wash is the tone at 12%, which is a contrast floor rather than a taste.**
  Over white that composites to 4.94, 5.48 and 5.50 against the word sitting on
  it, so a hovered link is still ordinary body-copy contrast. 14% is the last
  step that clears 4.5 on all three.
- **`isolate` on the span is what keeps the negative z-index inside the link.**
  Without it the wash paints behind the paragraph as well, which costs nothing on
  a white page and breaks the moment anything under it has a background.
- Under reduced motion the wash still appears, it just does not travel, the same
  line `book-opening` draws.

- **`external` is derived from the href, and `resource` asks for the same
  treatment by hand.** A path that is a file rather than a page, `/llms.txt`,
  `/robots.txt`, `/cv`, gets a plain anchor instead of `next/link`, since the
  router would try to navigate to one as a route and fall back to a hard load.
  It is a flag on the segment in `lib/pages.ts` and a prop at a JSX call site
  like `not-found.tsx`. Deriving it from the presence of a dot was the other
  option and gets `/cv` wrong.
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

## About, contact and privacy

Three pages that are prose and nothing else. `lib/pages.ts` is the copy,
`components/ui/static-page.tsx` is the layout all three render through, and
`app/about/page.tsx`, `app/contact/page.tsx` and `app/privacy/page.tsx` are the
routes, each holding its own `metadata` and its own JSON-LD type.

They exist because an agent deciding whether a site is worth citing looks for
them, and because the site had nowhere to say what it collects. The audit that
prompted them asked for at least 500 characters on each. Measured: 2573, 1178
and 2097 characters of visible text.

- **The copy is data, for the reason the home page's is.** A page of plain prose
  is also exactly what its markdown variant needs, so it lives where both can
  read it and `lib/markdown.ts` keeps its rule that nothing there restates a
  page's copy. `staticPage` in that file renders the same array as `##` sections.
- **A section is a label and its paragraphs, and that is the whole structure.**
  The label is an `h2` at `text-meta` muted, the site's own section label, the
  same call `WorkSection` makes. `text-lead` stays the page title.
- **One layout, not three pages that look alike.** Three copies of the same
  skeleton drift, and each route file is then metadata and a schema type. A slug
  with no entry in `lib/pages.ts` throws at module scope, so it is a build error
  rather than an empty page, which is the call `IMPLEMENTED_LABS` makes for the
  labs.
- **No prose link to `/work`, `/blogs` or `/lab`.** `InlineLink` derives a hue
  for those three from the href, and that exception is scoped to the home page's
  own paragraph. Navigation to them is `PageNav` at the foot of the page
  instead, which is also the only way out of these three.
- **A link may name a file rather than a page**, through `resource` on the
  segment. See Inline links.
- **Body copy can carry a code span**, through `{ code }` on the segment, which
  is `ProseSegment` widening the home page's `Segment`. `/privacy` names a route
  prefix and an extension, and a path set in running prose reads as prose. The
  home page has nothing to mark up that way, which is why the variant is added
  in `lib/pages.ts` rather than in `lib/site.ts`: adding it to the shared union
  would force `app/page.tsx` to handle a case it can never receive.
- **`siteRoutes` is the one list of pages**, and two things read it: `PageNav`
  at the foot of a static page, minus the page it is on, and the `## Pages`
  section of `/llms.txt`, with each note. A page added there appears in both.
  The note is written for the index rather than for the nav, since the nav shows
  the title alone, which is why it is not the `description`.
- **They are not linked from the home page, and that is deliberate.** The home
  footer carried a row of the three for a while and it was the wrong trade: the
  quietest content on the site sat on the front of the portfolio, 142px of ink in
  a 538px column with 396px of nothing beside it, which left the footer an L with
  a hole in the corner. Right aligning it under the marks fixed the composition
  and did not fix the premise.
- **Nothing that needs these pages was reading that link anyway.** They are for
  an agent deciding whether the site is worth citing, and an agent reads
  `/llms.txt`, `/agents.md` and `sitemap.xml`, all three of which name them with
  their `.md` paths. `PageNav` at the foot of each of the three still carries the
  other two, so the cluster holds together. Do not put the row back on the home
  page. If they ever need a door from the front, it is a sentence in the copy and
  not a nav, which is the rule the rest of this site already follows.
- **`PageNav` has one caller now**, the foot of a static page, where it is that
  page's only way out and the rule at rest is what says these are links.
- **Every claim on `/privacy` is checked against the code, not written from
  memory.** No cookies, no `localStorage`, `sessionStorage` or IndexedDB
  anywhere in the repo, one third-party script, self-hosted fonts, local favicon
  copies, and the album art as the one image a browser fetches from another
  origin. Anything that changes on that list changes the page.

## Page transitions

A crossfade between routes, via React's `<ViewTransition>`.

- `components/ui/page-transition.tsx` wraps **each page's content**, not the
  root layout's children. A layout's children slot keeps its position in the
  tree across a navigation, so React reconciles it as an update rather than an
  unmount and a mount, and `enter`/`exit` never fire.
- **It is nearly propless on purpose.** A bare `<ViewTransition>` uses the
  browser default, which is a crossfade, so there are no keyframes to maintain
  and nothing depends on `::view-transition-old(.class)` selectors, which need
  Chrome 125+ and diverge in Safari. Only the duration is tuned, against
  `root`, in `app/globals.css`.
- **`update="none"` is the one prop, and it fixed a bug every lab had.**
  React animates the boundary for every non-urgent commit inside it, which is
  any state update that did not come straight from a discrete event: a timer,
  an animation's completion callback, a frame loop. Each one ran a 300ms view
  transition nobody could see, since the old and new pages were identical,
  and the document's snapshot sat over the live DOM for its duration, so hit
  testing landed on the root and every pointer event in that window was lost.
  The flip clock found it, ticking once a second: 36 of 133 frames with
  nothing under the pointer and 5 of 16 presses on a card lost, and the
  halftone ripple's like ran one after its ripple ended. Navigations mount and
  unmount this boundary, so `enter` and `exit` still crossfade the pages, and
  `update` had nothing left to do.
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
  **Inline code is the one exception, and it lives in
  `components/ui/code-span.tsx`.** Four surfaces render one: a post's prose and
  its `_emphasis_`, a lab description through `RichText`, a static page's
  `{ code }` segment and the 404's note about the `.md` convention. The class
  string had been typed out at the first two before there was a third.
  `strong` renders as a tone step, not bold, since nothing on this site is
  bold. List bullets are `before:` dots for the same reason as elsewhere: a
  flex parent blockifies its children and kills a real marker.
- **Prose is written in beats: one idea to a paragraph, and the gap between two
  of them does the work indentation would.** Paragraphs are `mb-5`, a little
  over two thirds of a line. At `mb-4` that gap was 0.55 of a line and a run of
  short paragraphs read as one broken column. The limit is the other way round
  as well: four consecutive one-line paragraphs is a stutter, not a rhythm, so
  an opening that states a symptom in three sentences is one paragraph and not
  three.
- **A pulled line is a `blockquote`, in the primary tone.** A post quotes itself
  far more often than it quotes anyone else, lifting out the one sentence the
  argument turns on. Set in the muted tone it read as an aside, which is the
  opposite of what pulling it out was for.
- **Footnotes, through `remark-gfm`.** A measurement, a citation or a piece of
  trivia leaves the running line instead of becoming a parenthesis, and a
  paragraph carrying two parentheses has stopped being a paragraph. Keep a note
  to a sentence or two that backs the exact claim its marker sits on. A note
  that could be deleted without weakening the line should be.
  - `components/blogs/footnote.tsx` is both ends of the round trip, and both
    scroll through `lib/scroll.ts` for `HeadingAnchor`'s reason: a page that
    jumps for one control and glides for another leaves the reader unable to
    tell how far they moved.
  - **The backref is an icon, never the `↩︎` the plugin writes.** That character
    is a glyph standing in for an icon, which the project bans, and it inherits
    the prose font rather than the icon scale.
  - **The backref marks where it lands, and the marker does not.** Coming back
    puts the reader in the middle of a paragraph with the thing they are looking
    for set at 0.7em, and the control they pressed is a screen away, so nothing
    on arrival says which word they left. `markArrival` in `lib/scroll.ts` writes
    `data-arrived` to the marker for 1.6s, which outlasts the glide, and the
    marker takes the filled emphatic neutral for it, the site's own way of saying
    "this one" with no accent colour to spend. Going down needs none of it: it
    lands the reader at the top of a short labelled list, where the row under the
    viewport's edge is the row they asked for.
    - **A grey wash cannot do this job at this size.** `fill-active` is 1.34:1 on
      the page, which reads across a row and is nothing across 8px of numeral.
    - **The pill is padding cancelled by a negative margin**, so the line is set
      exactly where it was and the ground is painted over the space either side.
      `0.15em` is the ceiling and the `ml-[0.12em]` in front of the marker is what
      sets it: the marker's em is 0.7 of the prose's, so that reach is 1.51px
      against a 1.73px gap and the pill cannot touch the word it marks. Measured
      on a 14.4px line, the pill is 7.80 by 14.41px where the digit alone is 4.80
      by 12.00, and the first glyph after the marker sits at the same x either
      way.
    - It is written to the node rather than held in state, since nothing has to
      render for a numeral to change colour, and one mark is live at a time: two
      would say the reader is in two places.
  - **The marker's rise lives on the `sup` and its size on the anchor, and
    splitting them is the whole of getting it to sit right.**
    `vertical-align: super` raises a box by a share of its parent's font size,
    which measured 11px above the baseline on a 14.4px line: level with the cap
    height of the line above, and it read as a digit that had come loose. The
    replacement is `relative -top-[0.3em]` at body size, since an `em` written
    on the marker is 0.7 of the one that is wanted. `ml-[0.12em]` is the thin
    space in front of it. Hard against the word it reads as a letter of it.
  - **The rule above the notes is dashed**, where `hr` between sections is
    solid. A solid rule divides two pieces of content and the notes are not a
    piece of content, they are the apparatus under one. `stroke-strong` rather
    than `stroke`, since a dashed line at `stroke`'s lightness is close to not
    being there, and it is the tone every other dashed line on the site uses.
  - The `footnote-label` heading is intercepted in `mdx-components.tsx` and
    rendered as the site's quiet section label rather than the leader rule, and
    visible rather than `sr-only`: a reader who has just followed a marker down
    should see what they landed in. It appears in `PostRail` like any section.
- **Tables parse now, and they arrived with footnotes rather than being asked
  for.** Styling them was the cheaper half of enabling the plugin, since the
  alternative is a construct that silently renders unstyled the first time
  someone writes one. Header and rows are both `text-body`, separated by tone
  alone: at `text-meta` the header was 12px against the rows' 14.4 and the table
  read as two type sizes stacked.
  - **No `tabular-nums`, and it was there as a default before it was measured.**
    Inter's tabular figures are wider than its proportional ones, so a column of
    them reads as a size up from the prose even though it is not one. Measured
    against the same string in a paragraph: the body text is 160.77px in both to
    two decimals, while `1512ms` goes 49.92px to 55.27 and `-7.14°` 13% wider.
    The table looked bigger and only the digits were. A column that has to align
    down the page can ask for it per post.
  - **An identifier in a cell needs a code span.** `body { text-transform:
    lowercase }` is not exempt for table cells, so a bare `rotateY` header
    renders `rotatey`.
- **`Terms` in `components/blogs/terms.tsx` is a named thing and what it is**,
  which is the shape an argument takes when it weighs three approaches rather
  than making one. The pairs are separated by space and nothing else, since
  hairlines between them read as a table.
  - **It is a component and not an element in the map, and the reason
    generalises.** MDX routes markdown-generated elements through
    `mdx-components.tsx` and leaves literal JSX alone, so a `<dl>` written in a
    post comes out with no styling at all. Measured: a bare `<dl>` with bare
    `<dt>` rows. Anything markdown cannot generate has to be a component.
  - **A term carries no marker and no indent**, so every line starts on the
    prose's own left edge. A bullet hanging in the margin was tried and taken
    back out: it says "list" where the space above each pair already says it,
    and it is a second kind of dot on a page whose real lists have one. What
    separates a term from the section heading above it is that heading's own
    medium weight and leader rule, which nothing in the block has.
  - Markdown inside its children still parses, so a description can carry a code
    span, a link or a footnote marker the way a paragraph can.
- Content headings start at **h2**. The shell renders the h1, so an h1 in the
  body would be a second one.
- Code fences render through `components/ui/code-block.tsx`. `sugar-high`
  emits `sh__*` classes coloured by the `--sh-*` properties in `globals.css`.
  These are the one place on the site with a full palette, since a token's colour
  is what says what kind of token it is, the same exception the brand marks get.
  Punctuation and comments stay grey so they recede.
- A missing `meta.json` hides a directory from the index, so a draft can sit
  in the tree unpublished. Its route is still live.
- **A directory starting with `_` has no route and is not a post.** Next
  treats it as a private folder, and `getAllBlogs` skips it, or the index
  would link to a 404. It is how a finished post is taken down without
  deleting it: rename the directory, and rename it back to publish. The
  relative imports inside it survive the rename, so nothing else changes.
  `_details-you-can-measure` is unpublished this way.
- A post's demo component is **colocated** in the post directory when only that
  post uses it, and lives in `components/blogs/` when it might not be. Its
  import goes at the top of `page.mdx`.
- **A component in the prose has to be handled by `lib/markdown.ts` as well.**
  That fold recognises a self-closing capitalised element on its own line and
  leaves a note in its place, so anything else leaks into the markdown variant
  as a literal tag. `Terms` is the one component unwrapped rather than dropped,
  since what it holds is prose: its rows come back as a bold term and a
  paragraph, trimmed, or four spaces of JSX indentation turns the list into a
  code fence.

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

- **A real `<a href="#id">`, never a button.** That is what puts the section in
  the address bar, and it is what lets the link be opened in a new tab through
  the browser's own menu. The clipboard write is added on top rather than
  replacing any of it.
- **A plain click scrolls smoothly instead of jumping, through `lib/scroll.ts`.**
  The native jump was correct and instant, which is the problem: a reader who
  clicks a section cannot tell whether the page moved a little or a long way.
  `PostRail`'s rows go through the same helper, or a post scrolls two different
  ways depending on which of the two controls was used. Three things there are
  load-bearing. It is `window.scrollTo`, never `scrollIntoView`, which walks up
  and scrolls every scrollable ancestor. The offset is read off the heading's
  computed `scroll-margin-top` rather than restated, so it cannot drift from the
  `scroll-mt-16` in `mdx-components.tsx`. And every modified click still falls
  through to the real `href`, which is most of why these are anchors at all.
  `pushState` writes the hash, since assigning `location.hash` would fire the
  native jump on top of the smooth scroll and land twice.
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
- **The swap to the tick is a real path morph, in `components/ui/copy-mark.tsx`,
  and both copy controls on a post render it** so the two still behave
  identically. It replaced a 150ms `AnimatePresence` crossfade, which at 12px
  reads as the icon going briefly out of focus rather than as one shape becoming
  another.
  - **The glyphs are drawn there rather than imported, and that is what a morph
    costs.** Motion interpolates the numbers inside a string when the parts
    between them match, so two `d` values morph only if they carry the same
    commands in the same order, and no two Phosphor icons do. A `path` helper
    builds each glyph from subpaths of points, which guarantees the structure by
    construction. The shared rule bans a text character standing in for an icon
    and this is not one, it is the call `island-menu` makes for its own drawn
    box: nothing off the shelf can express the in-between.
  - **The tick is written once per pair rather than once**, since a partner has
    to match its own glyph's structure. The copy mark's is five points in two
    subpaths and the hash mark's is eight points in four, and both draw the same
    three-point tick with the leftovers folded onto it. A line drawn twice costs
    nothing, since the second copy lands on the first.
  - **Which point goes where is solved rather than chosen, and it decides
    whether the middle of the morph is legible.** A point may only land on a walk
    along the tick, since consecutive points draw a segment and the only segments
    that exist are its two arms. Of the walks available these are the ones with
    the least travel: 32 units against 61 for the copy mark and 48 against 76 for
    the hash, measured in the 24 unit box. The first mapping sent the square's
    bottom-left corner clean across the icon and crossed its own strokes, and
    every frame of the middle was a scribble. Now the square's right edge becomes
    the long arm, its left edge the short one, and the top and bottom collapse,
    so what the eye sees is a square being squeezed flat.
  - **280ms on `island-menu`'s curve, and both numbers are about spending time in
    the middle.** `torph`'s own `[0.32, 0.72, 0, 1]` was the first pick and leaves
    at over twice its average speed: sampled per frame at 240ms, the fold was over
    by 120 and the only readable frames were the first three. This curve leaves at
    zero, which that lab warns about for a box answering input, and the warning
    was measured on a 520ms move. At 280ms it is 19% through by 80ms, and the
    press has already been answered by the control's own tone.
  - **Reduced motion is read in the component**, since `MotionProvider`'s
    `reducedMotion="user"` governs transforms and layout and `d` is neither.
    Measured under the setting: two distinct `d` values across the change rather
    than sixteen.
- The anchor holds its box whether or not it is visible, so revealing it never
  shifts the leader rule beside it. It sits before that rule, since a control
  past the rule's end reads as belonging to the next thing down.
- `BlogPost` mounts one `TooltipProvider` around the article, rather than one
  per heading.

### `the-submenu-closes-before-you-get-there`

Two menus side by side, one question, and almost no prose. The reader tries the
same move in both, says which one let them, and is told what the difference was.

- **The comparison is the argument, so the boxes break the column and nothing
  else does.** Two menus at 288px will not sit next to each other inside a
  537px measure, and stacking them is not a comparison. Only the grid escapes,
  by half the parent to the left and back by half its own width, with the width
  taking a gutter off `100vw` so the scrollbar cannot cause a second one.
  Running the instruction and the question out there too was the first build,
  and it put two measures on one page with nothing lining up.
- **Everything is derived from `menu.ts`.** The layout and the hit tests read the
  same constants, which for a piece about which region the pointer is in is the
  difference between a demo and a trick. Measuring the DOM would put the answer
  a frame behind the question.
- **The wedge is armed once, on the sample that leaves the row.** Arming it on
  any sample outside the row re-anchors it to the pointer every time, so it never
  expires and moving straight down cannot close the submenu at all. The apex is
  the last point known to be inside the row, not the first known to be outside
  it, since a fast diagonal samples a row or more apart.
- **Every hit test is one `pointermove`.** Per-row `pointerenter` and
  `pointerleave` cannot express this: falling out of the wedge while already
  inside a row fires no event, so the menu freezes in a state nothing corrects.
- **There is no open state.** An open submenu is what a highlighted parent row
  means, not a fact of its own.
- **The menus have no motion.** A native menu marks the row under the cursor on
  the frame it arrives, and anything softer reads as the menu thinking about it,
  which is the one thing a demo about hover cannot look like.
- **The submenu's seat is drawn dashed while it is empty.** The block reserves
  that width so nothing moves when one opens, and the reserve read as a void with
  the menu shoved into a corner. Five children rather than seven for the same
  reason: at seven the reserve stood 96px below the menu.
- **The question is a card, because that is how a question looks.** A heading, a
  row of chips and a button loose on the page said nothing about belonging
  together, and horizontal chips read as filters and go ragged, since "both" and
  "only the right one" are nowhere near the same width. Stacked full-width rows,
  real radios visually hidden inside labels, and the action in a footer.
- **It grades with weight and `danger`, because there is no green.** The site
  ships one status tone and it means wrong. Correct is carried by the emphatic
  neutral instead, a filled row with a solid check, which in a monochrome set
  already reads as "this is the one". Inventing a success token for one quiz
  would put a colour in the table nothing else can use.
- **The captions say nothing about whether the reader managed it.** They did, and
  it was both a spoiler and a lie: the unfixed box can be beaten by going
  sideways, so a reader who did that saw "you got there" under both and was then
  graded wrong for answering "both".
- The closing `Replay` is a loop with nobody driving it, and a separate component
  rather than the interactive one behind a flag: `Sandbox` is all hit testing and
  state, none of which a loop needs. Its wedge apex is computed from where the
  drawn path crosses the row's bottom edge, since eyeballing it puts the apex
  clear of the row and the wedge tells a small lie.
- `select-none` on the stages and the illustration. Dragging across a menu is the
  gesture the piece is about, and without it a text selection paints over every
  row on the way past.
- **This post had no tables to write and that is still true, but the pipeline
  has them now.** `remark-gfm` went in for footnotes and tables came with it.
  See Blogs above.

### `the-card-flinches-when-you-reach-its-edge`

Two cards, one question, and a bug that came out of `foil-card`. The sandbox
shares its build with `the-submenu-closes-before-you-get-there`, and the post
deliberately does not share its shape.

- **It states the loop, draws it, hands it over, and then explains it, and that
  order was a rewrite.** The first version opened on the symptom and led with
  the bug hiding from you, on the argument that a still pointer killing it is
  the post's best material. It is still the best material and it is now the
  section after the demo. What a reader needs first is the one sentence that
  makes everything after it make sense, which is that hovering the card moves
  the card out from under the pointer, and the rest of the post is that sentence
  with the details filled in. The sequence is the loop in two sentences,
  `Replay` so it can be seen, the sandboxes so it can be felt, the surprise, the
  geometry behind it, the fix, and two lines saying where else it applies.
  - **It ends on the fix and nothing after it.** Two sections were cut on the
    same pass as the rewrite: the weaker answers, a timer and a deadband, and a
    section naming the failure, which pointed out that games keep collision
    geometry separate from render geometry and that control theory calls a
    binary controller moving its own input **chattering**. Both were true and
    both were the post carrying on past its own answer. If the naming comes
    back, it is a footnote on the close and not a section.
  - **The register is the conversation that produced the rewrite.** The test on
    a sentence is whether it would survive being said out loud to someone who
    has just met the bug. "The region that decides the state is moved by that
    state" was the pulled line and did not survive it. "Hovering it moves the
    thing you are hovering" is the same claim and does.
- **`Anatomy` in `sandboxes.tsx` is the fix, drawn.** The code block names a
  child and a sibling, which is only a picture to a reader who already has the
  picture, and "so where does the button go" is the question the prose kept
  failing to answer. Two still panels: the card tilted, the pointer parked at
  the same place in both, and an outlined box for whatever catches it. That box
  turns with the card in one panel and stands still in the other, and the answer
  is whether the pointer is inside it.
  - **Three layers, and their order is the whole of getting it to read.** The
    target's area goes under the card, so the card stays white and the only grey
    on the stage is the strip the card is not covering, which is exactly where
    the pointer is standing. Its edge goes over the card, or the child panel has
    nothing in it at all, since there the target and the card are the same box.
    Built as one filled layer over the card, both panels were grey blobs with no
    card left in them.
  - **Nothing in it may name a side.** The panels are `sm:grid-cols-2` and stack
    below that, where "on the left" describes a layout the reader is not looking
    at.
  - The geometry is measured rather than chosen. At 24 degrees through 700 a
    210px card pulls its left edge 14.6px in, so the pointer is parked 5px inside
    the resting edge and stands 9.6px clear of the tilted card. Further in and
    the two panels start to look alike, which is the one thing this drawing
    cannot afford.

- **The demo is an A/B with exactly one variable.** Both sandboxes read the
  pointer against the untransformed slot, so the tilt they compute is identical,
  and the only thing that differs is whether the `<button>` is a child of the
  tilted card or a sibling of it. Anything else differing would make the
  comparison say nothing.
- **The dashed footprint is what makes the bug visible.** The submenu post's bug
  is invisible until it is explained, and this one is a gap opening between the
  pointer and the thing it is pointing at, so drawing the card's flat position
  and leaving it there turns the argument into something a reader sees in one
  frame rather than something they are told.
- **The reader is given a task they can fail, and that is what makes the bug
  findable at all.** Told in prose to go to the edge, a reader waves at the
  middle of the card, watches it tilt nicely and learns nothing: the failure
  lives in a few pixels at the rim and nothing was pointing at them. So there is
  a marked tab to aim at with a target dot in the middle of it, and a bar that
  fills only while the pointer is inside that tab. On the broken card the bar
  starts again every time the hover drops, so the task cannot be finished at
  all. That is the difference between asking "did you feel a flicker" and asking
  "can you finish this", and only the second is a question a reader cannot
  answer wrongly by accident.
  - The tab belongs to the footprint and never to the card, so what the reader
    watches is the card's own edge sliding in behind a tab that has not moved.
  - The counter only counts a leave fired with the pointer still inside the box.
    A leave with it outside is a reader who has gone somewhere else, and
    counting those puts a number on both cards and says nothing. Measured with a
    hand jittering in the strip for two seconds: 9 drops and no fill on the
    broken one, 0 drops and held on the fixed one.
- **The target is a 14 by 72 tab at the middle of the edge, and it was a band
  down the whole of it.** Full height was the congestion: four vertical lines
  inside 20px, the footprint, the tab, the tab's own dashed border and the
  card's ring, with the card's rows shoved right by a padding hack to clear
  them. At mid-height the top and bottom of that edge go back to being one
  hairline and the rows go back to sitting where they sit.
- **The bar is not in the tab, it runs under the card at the card's own width,
  and it is a meter rather than three stacked rows.** A fill rising inside 14px
  is a sliver, and the one thing a reader has to read while they hold should not
  be the smallest thing on the card. It was then a bar with a label and a pill
  floating under the middle of it, which is three unrelated rows: the track is
  the card's width, the label sits at its left end and the state at its right,
  so the group is one readout and the bar's weight is the weight of something
  that is plainly a meter.
  - Constant motion, so the fill runs linear, and it snaps back to zero rather
    than easing, since the snap is the feedback. The empty track picks up a
    `danger` tint once a drop has happened, or the broken card reports its
    failure only in words while the thing the reader is watching stays blank.
  - **The state morphs through `torph` at 160ms and not the site's usual 200.**
    What a drop does to that line is correct it. Measured, a hand jittering in
    the tab drops about every 180ms, and a morph still running when the next one
    starts is the smear `tide-card` documents, so this one lands first.
  - **No `sr-only` copy beside the morph, and the note elsewhere in this file
    saying one is needed does not hold for torph 0.0.10.** Measured on this
    pill: the installed version does not mark its character spans `aria-hidden`,
    so a duplicate read the state twice, `textContent` coming back as "hold the
    tabhold the tab". The `aria-label`s that `island-menu`, `pixel-reveal` and
    `cube-orbit` put on their morphing buttons are still right, since an
    explicit name is correct either way, but check the rendered spans before
    adding another one on that reasoning.
- **The tilt is exaggerated past what a real card would use, and that is the
  demo making a mechanism aimable rather than a mistake.** At a sane 12 degrees
  through an 800px perspective the near edge pulls 6.8px in, and a target that
  narrow is not one a reader can hold: measured, a hand aiming at the middle of
  a 16px band sat 8px in, which is 1.2px inside the card, and filled the bar on
  the broken one. At 24 degrees through 700 the pull is 17.5px even measured at
  the far side of the tab, so no part of the target quietly works. The eight
  pixels the post quotes is `foil-card`'s own card at 8.94 degrees, and it is a
  claim about tilt cards rather than about this drawing.
- **The task is spaced as a task, and the spacing is all of what orders it.**
  It was three groups at one `gap-5`, which reads as a list of three things
  rather than as something with an order, and the heaviest object on the block
  was the question, which is the part you do last. The instruction belongs to
  the cards, so it sits `gap-4` from them, and the question is a separate move
  at `gap-10`. Numbered markers were tried on the two lines and taken back out:
  two plain sentences with real air between them already read in the right
  order, and the numerals were chrome on a block that is mostly chrome.
- **The state under each card is a pill and not a caption.** At `text-meta
  text-text-muted` the only thing on the block reporting whether the task was
  going was the quietest type on it. A filled pill stepping from `fill` to
  `danger` to the emphatic neutral is a readout, and it is what the reader is
  looking straight at while they hold.
- **The tab carries a ping and the copy carries a swatch of it.** Naming a 14px
  patch of grey in prose and hoping a reader finds it is the version that does
  not work, so the instruction renders the tab inline at the running text's own
  size and the target dot pings until that card has been held.
  - **`relative` on the dot's wrapper is load-bearing, and leaving it off
    shipped.** The halo is `absolute size-full`, so its 100% resolves against
    the nearest positioned ancestor, and without `relative` that was the tab
    rather than the 4.8px dot: the halo came out 14 by 72 and `animate-ping`
    scaled it to 28 by 144, which paints a grey stadium straddling the target
    rather than a pulse on the dot. Measured before and after: 28 by 144
    against 6.1 by 6.1 mid-ping. Tailwind's own snippet carries the `relative`
    and it is the whole reason it is there.
  Tailwind emits those keyframes because `animate-ping` is used, and
  `motion-safe:` is what governs them, since `MotionProvider` reaches motion
  components and never a raw keyframe.
- **Four headings**, against the rail's minimum of two.
- **`Replay` leads rather than closes, and that is also what fixes the touch
  case.** It is the loop drawn, so it belongs beside the two sentences that
  state the loop. At the foot of the post it was a closing flourish, and a
  reader on a touch screen met the sandboxes first, which are a hover demo and
  give a finger nothing at all, and only reached the one thing they could
  actually watch after the whole argument. It loops forever with nobody driving
  it, which is motion at the top of a post, and that is the price: it is the
  subject of the post and it is quiet, 208px of greys.
- The stage is `bg-fill`, which is the submenu post's own call for a sandbox
  surface rather than the white `Demo` frame the labs sit in.
- The bug is `foil-card`'s, and that lab's section carries the traces this post
  quotes.
- **It is the first post written to the prose conventions in Blogs above**, and
  the first caller of two of them: footnotes and a table. Each earned its place
  rather than being tried out here.
  - **Two notes, and each backs the exact claim its marker sits on.** What CSS
    leaves undefined, and where the eight pixels was measured. The body states
    the rule and the note gives the specifics, so neither repeats the other. A
    third explained a Schmitt trigger and went with the section that referred to
    it.
  - **The trace is a table, and it was a code fence.** As a fence it took syntax
    highlighting on text that is not code, colouring the figures and the commas,
    and its fourth column had no header at all. Three labelled columns and one
    line under them saying the count.
  - **`Terms` was the third, and it has no caller now.** It held the three
    answers while the winner was the last of them, then the two weaker ones
    after the winner became its own section, and then nothing once those were
    cut. The component and its unwrapping in `lib/markdown.ts` are both still
    there, since what they are is part of the MDX authoring surface rather than
    a feature of this post.
- **`select-none` on the whole block, never on the stages alone.** The task is a
  slow drag across a card and a hold at its edge, which is a gesture aimed at a
  run of type: without it the pointer paints the card's bars, the instruction
  above them and the four answers below, in the site's emerald and with a pair
  of `SelectionPins` carets. A drag that starts on a stage and leaves it anchors
  on the nearest text, which is why the guard is on the parent. Nothing in the
  block is prose. Measured after: no range from a drag across both stages, a
  triple click on the instruction or a drag out into the paragraph below, and
  the post's own prose still selects.
- **The held meter is the first caller of `--color-success`, and the quiz below
  it still grades neutral.** Confirming a task the reader finished and marking
  one right answer among four are different jobs, and the emphatic neutral only
  does the second. See Colour tokens.

### `details-you-can-measure`

**Unpublished for now, under `app/blogs/_details-you-can-measure/`.** The
underscore takes the route away and keeps the post out of the index, see
Blogs above. Rename the directory to publish it again.

Thirteen demos and a list, one per lesson, each with the number that settled
it. The post is this site's notes and the other projects' notes read back, with
Jakub Krehel's list of interface details as the prompt. `frame.tsx` holds the
parts every demo is built from and the demos are colocated, one file per
section or pair.

- **A demo mounts as `<Name />` alone on a line, with every knob inside the
  component.** `lib/markdown.ts` only recognises that shape, so a prop on the
  mount line would leak into the markdown variant as a stray tag. Verified on
  `/blogs/details-you-can-measure.md`: thirteen notes, no stray tags.
- **`Frame` is a stage.** The `Demo` frame's hairline box, white, in three
  fixed rows: the gesture in two to four words in the top left corner, the
  subject centred, the demo's controls bottom right. Every stage puts its
  subject in the same place, so the stages line up down the post.
  - **No task sentence, no caption, no material.** Earlier versions carried a
    sentence above the box and a paragraph under it, then header and footer
    bands, which read as a card with a form in it, then a dot grid borrowed
    from `sticker-peel`, which read as chrome. The prose makes the argument.
    The stage shows the thing and reports the number.
  - **The subject area is a flex column**, so a lane that wants the stage's
    width gets it and a pair of pills still centres. As a centring row the
    spring lane collapsed to nothing.
  - **The stage is lifted by `shadow-stage`, the one shadow token on the
    site.** Three faint layers in `globals.css`, a contact line, a short cast
    and a wide ambient, since one shadow dark enough to read at this size
    looks like a drop shadow rather than like light. The ring stays: a shadow
    this faint draws no edge on white and the top of a lifted box has none.
    Nothing else may reach for the token.
  - **Every discrete text change on a stage morphs through `torph`**, on the
    book opening lab's 200ms and ease: the mode switches, the two toggle pills,
    the pass and fail words, and any `Readout` handed a string. A `Readout`
    handed a node does not morph, which is how the contrast ratio and the
    per-frame counters opt out. Morphing a value that ticks every frame is a
    smear.
  - **The stage is `select-none`.** Every gesture on it is a press or a drag
    across type, and a drag that misses paints a selection and two carets
    over the demo. The lowercase demo used to ask the reader to select and
    copy a label, which that forbids, so a control copies the node's text for
    them and a readout shows what the clipboard got.
  - It moves to `components/blogs/` the day a second post wants it.
- **Every stage reports bottom left and is driven bottom right.** `Frame`
  takes `readouts` and `controls`, and every demo puts its numbers in the one
  and its buttons in the other, so the eye learns the two places once.
- **The thirteen demos, and what each one had to become.** The first build of
  every one was the subject and a number. Each now shows the mechanism.
  - **Press and hold** carries a loupe under each pill: the label rasterised
    once at device resolution, drawn again through a 0.98 transform with
    smoothing on, which is what a compositor does to a scaled layer, then a
    16 by 9px window round the first glyph blown up twelve times with smoothing
    off. The fill side draws the label crisp on the darker ground. A `press
    both` control holds the press for a reader with no mouse.
  - **Tap fast** traces each pill's colour per frame through a 90ms press and
    the 480ms after it, as a line under the pill, with the release marked. The
    timed step reads about 65% at release, the instant one 100%.
  - **Press move** traces both knobs on one time axis as a share of their own
    distance. On one spring the two curves lie on each other, which is the
    claim. `by distance` hands the 8px move the stiffer spring and its curve
    lands early. `SNAPPY` and `TRAVEL` are event-stacking's two springs.
  - **Hover** stamps a rail beside each card with the card's position on every
    frame of the lift. The spring's stamps bunch at the start and the
    ease-out's spread there. `lift both` holds a lift for touch.
  - **Park on a bottom edge** hit tests both rows itself, against each box's
    current rect on every pointer move, which is what `:hover` does, so one
    mechanism serves the real hand and the drawn one. `park a hand` puts a
    cursor icon on each first card's bottom edge with a pixel of jitter for
    three seconds. Measured: 58 hovers on the moving box against 1 on the
    still one. The hit boxes carry a dashed outline so the reader sees which
    one moves.
  - **Drag** fills each lane behind its knob and counts renders through
    `useTextMorph`, morphing every fifth render and once more at the drag's
    end, since a morph per frame is a smear. The drag ends on the window, on
    nib's rules.
  - **Click, tab, tap** shows the three sequences as ghost rows at rest, and
    the first real event replaces them. The grey slab is gone.
  - **Switch the setting** is one sync notice: its icon loops, its bar fills
    itself on arrival and the notice slides in when asked for. Reduced motion
    stops the first two and keeps the third without its trip. The readouts say
    the three durations under each setting.
  - **Drag the swatch** makes the swatch the control, `role="slider"` with
    pointer capture, up and down for lightness and left and right for hue, the
    arrow keys doing the same. The ratio is a needle on a 1 to 8 scale with the
    3.0 and 4.5 floors marked, the text floor labelled above the axis and the
    graphic floor below, since one row of labels collides at the column's
    width. A failed floor's label takes `danger`.
  - **Run** puts a hairline after each number, which jumps with proportional
    digits and holds with tabular ones, and reads the widths of a 1 and an 8
    off hidden spans in the pill's own type: 6.7px and 9.3px against 9.1px for
    both tabular.
  - **Drag an edge** makes the column's dashed edges the handles, each a
    `role="slider"` with arrow keys, narrowing about the centre. The last word
    is marked with a dotted `danger` underline whenever its rect's top differs
    from the word before it, which is a lone last line measured rather than
    guessed.
  - **Hover a row** draws the row's baseline off a zero-width inline-block
    probe, and marks each separator's centre. The middot's centre is measured
    off its ink, drawn to a canvas at the row's font and scanned, since a
    span's rect is the line box and says nothing about where the glyph sits.
    Measured at body size: the middot's ink sits 3.8px above the baseline and
    the element 5.5px, where the line box put both at 5.5. `show guides` pins
    them for touch.
  - **Copy** is unchanged: a control copies the node's text and a readout shows
    what the clipboard got.
- **A readout that changes on hover holds a fixed width, and this was a bug
  of the post's own fifth kind.** The dots demo's readouts arrived on hover and
  wrapped the bottom row to a second line. The taller row shrank the centred
  middle row, the hovered row shifted up out from under a pointer that had not
  moved, the hover ended, the readouts emptied, and the row came back under it.
  Instrumented: `enter 1, leave 1` alternating on every pointer step, with the
  guides never on screen for a whole frame. The hover, park and dots demos give
  their readouts `w-28` to `w-48`, so their arrival cannot reflow the stage.
- **Measured on the dots stage at body size**: the middot's ink centre sits
  3.8px above the baseline and the element's 5.5px, where reading the span's
  line box had put both at 5.5. At lead size the middot is 4.3px up and 4.6px
  wide against the element's 5.4 and 3.2.
- **`Cycle` is the site's mode selector**, the value as the label and two
  arrows saying a press swaps it, `book-opening`'s call.
- **An empty readout is a `MinusIcon`, never a dash.** The first pass used an
  em dash as the placeholder, which is the glyph the frontend rules ban.
- **The lowercase demo's cased pill is an inline style, not a utility.**
  `button { text-transform: inherit }` in `globals.css` is unlayered and beats
  any `@layer utilities` class, so `[text-transform:none]` lost silently and
  the pill rendered lowercase. The list at the end of the post carries the same
  lesson from two other projects.
- **The contrast demo's preset is `INK` imported from
  `components/labs/halftone-ripple`**, converted to OKLCH at module load, so
  the readout says 3.79 rather than the 3.71 a hand-copied approximation gave.
  The hue stays scoped to the lab and the post only reads it.
- **The hover flicker needs a moving hand.** Headless Chrome does not
  re-evaluate `:hover` under a pointer that has not moved after the element
  beneath it transforms away, so a parked pointer counted one hover. With 1px
  of jitter for a second it counted 15 against 2 on the fixed row, and the task
  line says a hand is never quite still.
- **Motion's settle time does depend on distance**, through its absolute
  `restDelta`, so the spring demo measures 263ms for 8px against about 414ms
  for the lane rather than equal times. The copy says not much quicker, not the
  same.
- **The spring lanes are measured once per press, so the readouts beside them
  hold a fixed width.** A readout growing from the icon to `462ms` shrank the
  lane after the knob had been sent to the old end, and the knob overran into
  the label. `KNOB` is 12.8 and `INSET` 3.2, since `size-4` and `left-1` are
  on the 0.2rem scale.
- **The render demo shows nothing until a drag arms it.** Dev's double effect
  counted 2 renders before anyone touched a knob.
- **The drag follows nib's rules**: `pointerdown` on the knob, move, up,
  cancel and blur on the window, and `buttons === 0` ends it.
- Measured on the page: 13 frames, no console errors, the tap demo reads 45%
  against 100%, the render demo 20 against none, the first-frames demo 1.7px
  against 11.9px after 33ms.

### The signature player

`app/blogs/turning-a-signature-into-two-pen-strokes/` is the post that came out
of the signature. The post is about the asset, since the file is what had to be
rebuilt: the player is its demo, and it earns its place by making the two strokes
and the pen lift between them visible. `timeline.ts` is the timing,
`signature-player.tsx` the player, and both are colocated in the post directory
because nothing else uses them.

It was a lab first, and the move is why `IMPLEMENTED_LABS` no longer lists it
and `components/lab/experiment.tsx` no longer maps it. A demo that needs this
much explaining is a post with a demo in it rather than an experiment with a
paragraph under it.

- **The footer's mark cannot be scrubbed, which is why this exists.** It is two
  CSS animations with their own durations and delays, so there is no single value
  to seek. `timeline.ts` turns the same numbers into one progress axis and derives
  both dash offsets from it, which makes a seek and a play the same operation at
  different speeds.
- **Those numbers are restated from `globals.css`, and there is no way round it.**
  A keyframe's duration is not readable from JS without parsing the stylesheet.
  So they are named once in `timeline.ts` with the stylesheet cited, the same
  trade `CONTENT_HALF_REM` makes in `lib/constants.ts`: the two move together.
- **`pathLength="1"` on the asset is what keeps this cheap.** A dash offset is a
  plain number rather than something `getTotalLength()` has to measure, which is
  also why the footer's stylesheet can hold plain numbers.
- **The 0.08s pen lift is kept, not closed up.** `globals.css` ends the first
  stroke at 1.45s and starts the second at 1.53s. On the scrubber that gap is a
  short plateau where the ink stops growing, and it is the one thing about the
  mark that a finished signature cannot show you. It is also why the asset is two
  paths and not one.
- **One fetch feeds both copies.** The ghost and the ink come from the same
  markup, so they cannot disagree about the geometry, and only the ink copy is
  dashed. The dash is set imperatively rather than by borrowing `.signature`,
  since that class carries the animation this replaces.
- **Nothing renders per frame.** One subscription writes the two dash offsets,
  the two block fills, the nib and the slider's position straight to the DOM.
  The slider is uncontrolled, so dragging it never fights a value React is also
  setting, and it is skipped while it has focus so a drag cannot be overwritten
  mid-gesture.
  - **That skip has to give way to playback, and this was a bug.** Space plays
    from the scrubber, so the focused case is the common one rather than the
    exception: with the guard on focus alone the thumb sat still through a whole
    write, and a later arrow key then stepped from wherever the thumb was left
    rather than from the ink. A drag pauses playback on its first `change`, so
    focused and playing cannot both be true once the pointer is really moving.
- **A native `range`, styled through its own pseudo-elements.** The shared rules
  ban a native date input and say nothing about this one, and a hand-rolled
  scrubber starts life as a slider with no keyboard behaviour: arrows, Home and
  End all come free here.
- **The nib is a ring, not a dot.** A filled dot in the ink's own colour merges
  with the stroke's round cap and reads as a thicker bit of line. At radius 5.4 a
  ring clears the 4.4 stroke's own 2.2 and reads as a position. It carries its own
  thin stroke rather than inheriting the mark's, or it would be as heavy as the
  line it tracks, and it is appended to the injected markup rather than shipped in
  the asset, since the asset is the mark and this is a readout about it.
  `getPointAtLength` wants user units even though `pathLength` has renormalised
  the dash pattern, which is why each path's real length is measured once.
- **The nib carries a halo, and that is a contrast problem rather than a
  stacking one.** It is already the last child of the top layer. A ring in the
  ink's own colour still disappears exactly where it crosses that ink, which is
  most of the time, so a wider ring in `--color-bg` sits under it and cuts a gap
  around it. Same trick `tether-button` uses to make a drawing read over
  anything. The halo's colour goes through `style`, since an SVG attribute cannot
  take a `var()`.
  - **The group carries the position, not the circles.** One `transform` per
    frame rather than two coordinates on each of two circles.
- **The nib goes out at both ends and through the lift**, which is exactly when
  the real pen was up.
- **The scrubber is a timeline, not a slider: a lane with a block per stroke in
  it.** The write is two strokes, so the gap between the blocks is the pen lift,
  and the one thing a finished signature cannot show you is visible before
  anything is pressed. Each block fills with its own stroke, off `drawnAt`, which
  is the same fraction that moves that stroke's dash, so the track and the ink
  cannot disagree. It went flat bar with two ticks, then two thin sections with
  labels under them, then this.
  - **It is thick because it is the thing you grab.** A 3.2px bar with a 9.6px
    dot on it is a control you aim at. The lane is `h-10` with `h-7` blocks in it,
    which is a control you drop a finger on, and the height is also what makes
    room for each block to carry its own name.
  - **The thumb is a playhead, `h-7 w-1.5`,** since a dot on a 32px lane reads as
    a stray bead.
  - **A block's name sits inside it, in `text-primary`.** The fill sweeps beneath
    the label, so it is on two grounds in one pass and has to clear both. They
    used to be buttons under the lane that seeked to their own section, and the
    lane took that job: it is thick enough to click a stroke's start directly.
  - **The axis under it is a tick every 0.1s, numbered every other one.** That is
    what makes the blocks read as durations rather than as two proportions. The
    write is 1.58s, so the last tick is 1.5 and the lane runs a little past it,
    which is what an axis over a total that is not round looks like.
  - **The axis row is `h-8`, which is what it actually occupies:** a 4.8px tick
    and then a label at `top-2` on a 19.2px line. At `h-4` the numbers painted
    outside their own box, so the flex gap below could not see them and the
    transport sat on the axis however wide that gap was.
  - **The three groups sit at `gap-8`.** The stage, the timeline and the
    transport are separate things, and at 16px with the numbers hanging out of
    their box the whole block read as one congested slab. Measured: 25.6px
    between each, and the demo is 434px tall on a wide column.
  - **Everything drawn in the lane is inset by half a thumb**, since a range's
    thumb travels between its own centres and not edge to edge. `TRACK_INSET` is
    2.4px, half of the playhead's `w-1.5`. Measured on a 499px lane: block one
    runs 2.4 to 346.6, the lift is 25.0px, block two starts at 371.6.
  - **The fill is a `scaleX` inside a clipping block**, never a width. A width
    relayouts every frame, and scaling a rounded bar squashes its own caps, so the
    block carries the radius and `overflow-hidden` and the bar inside it is a
    plain rectangle.
  - **The range is still native, still the only interactive element, and paints
    nothing but its thumb.** It lies over the lane at full size, so a click
    anywhere on it seeks, and everything under it is `pointer-events-none`. Native
    is what keeps the arrows, Home and End for free.
- **Space is bound to the scrubber, never to the window.** A range ignores it
  natively so nothing is being overridden, and keeping it off the window is what
  stops an embedded demo eating the page's scroll key.
- **It plays itself once when it scrolls into view**, which is what the footer's
  mark does on arrival. Without it the demo is a blank stage with a faint ghost
  on it and nothing saying that play does anything. `useInView(..., { once: true })`
  plus a ref guard, since the effect re-runs whenever `run` changes.
- **`run` is wrapped in `useCallback` so that effect can depend on it**, and as a
  named function expression, because the loop calls it again from its own
  `onComplete` and a `useCallback` has no name to recurse through otherwise.
- **The tint is off by default, and it is the narrowest use of the colour
  exception on the site.** The two strokes are the same ink doing the same thing,
  so which is which cannot be read off the finished mark at all. One press paints
  them apart, indigo at 5.12 and rose at 4.70 on white, which is what a graphic
  needs. The nib's ring takes whichever stroke it is riding, so the write effect
  has to depend on `tint` or the ring keeps the old colour until the next seek.
  **There are two pairs, `ink` and `wash`.** The saturated pair is what a stroke
  on white paper needs and is 1.9:1 under the block labels on the track, so the
  blocks take a light pair instead, which is the `mark` and `tint` split
  `event-stacking` already makes.
  Clearing goes back to the empty string rather than to a colour, so the mark
  returns to whatever `currentColor` is rather than to a guess at it.
- **`select-none` on the whole demo.** Scrubbing is a drag across a row of text,
  so without it a slow drag selects the rate pills and the readouts on the way
  past. Everything in here is a control or a readout about one, so there is
  nothing a reader would want to copy.
- **Speed divides the remaining duration, never the timeline.** Scaling the
  timeline would move the ticks off the strokes they name. Changing rate mid-play
  restarts the run from where it is, since a playback's duration is fixed once it
  has started, and the new rate is passed in rather than read from state that has
  not committed.
- **The default rate is 0.5x, which is what the autoplay plays at.** The demo is
  about the order the strokes are written in and the pause between them, and at
  1x the whole thing is over in 1.58s. The rate lives in state rather than the run
  carrying its own, so the control agrees with what you just watched.
- **One control cycles the speed, and it is in the pill with everything else.**
  It was three pressed pills off to the right, which said their own state and cost
  a whole grid column to sit in. This reverses the earlier note here: a cycling
  button does need a tooltip, and it gets one, because a control carrying a text
  label usually does not. The label is the value, not the action, so nothing on it
  says a press changes anything.
  - **`CONTROL_WIDE` exists because "0.5x" does not fit a square.** `CONTROL` is
    the base plus `w-8`, this one the base plus `w-11`, so no call site overrides
    a width.
  - **The label does not crossfade, unlike the play glyph.** Play and pause are
    two different shapes and a swap between them wants covering. A rate is a
    number being corrected, and a number that fades and turns while it changes
    reads as an effect rather than as a readout.
- **The four icon-only controls carry tooltips and the rate pills do not.** Play,
  stop, loop and the tint have nothing but a glyph. A rate pill carries its own text and
  pressing it sets that rate, so a tooltip there would restate the label, which
  the shared rules call out.
  - **One `TooltipProvider` round the transport**, not one per button, the same
    call `BlogPost` makes for its headings.
  - **A toggle's tooltip names what a press will do, not what is true.** The fill
    and `aria-pressed` already say the state, so the copy is "Loop the write" or
    "Stop looping". Radix closes a tooltip on click and needs a fresh
    `pointerenter`, so the changed copy is only seen after the pointer leaves and
    comes back, which is the same behaviour `heading-anchor` documents.
- **Play and pause crossfade with a turn and a dip under them, and this is the
  one control on the site where a morph was considered and refused.** A triangle
  and two bars are not the same shape drawn twice: `CopyMark` can morph a square
  into a tick because both are written as one polyline of the same length, and
  there is no polyline that is honestly both a filled triangle and a pair of
  filled bars. So this stays a crossfade, and it is the right one anyway, since a
  transport glyph is read at a glance rather than watched. `sync` rather than `CodeBlock`'s `mode="wait"`, with both glyphs
  absolute, so they overlap through the swap and the button is never briefly
  empty. This control can be pressed twice in a row, where a copy control's
  confirmed state stands for two seconds. Measured across one press: 24 of 39
  frames carry both glyphs, none carries neither, and the button holds 26px
  throughout. `MotionProvider` drops the scale and the rotation under reduced
  motion and leaves the crossfade on its own.
- **Two readouts sat at the ends of the transport and both are gone**, a beat
  label reading "start", "stroke 1", "pen lift", "stroke 2", "end", and a clock
  reading elapsed against total. The timeline made both redundant: the blocks name
  the stroke you are in, the gap is the lift and the axis under them is numbered
  in seconds.
  `beatAt` and the `Beat` type went with it. Losing it also takes the last
  `setState` out of the per-frame write, so nothing in this player renders per
  frame at all now.
- **The demo wraps itself in `Demo` with `block`**, not the frame's own
  `grid place-items-center`, since it wants the whole width and a centred grid
  item is sized to its content.
- **The mark is sized by width, not by height.** The asset is 2.06:1, so a
  height alone decides how wide it paints: at `h-32` it filled 42% of the
  column and the demo read as a toolbar with a line of ink above it. `w-full`
  inside a `max-w-96` scales it with the column and caps it, which is what
  keeps it inside the column at 375px, where the cap is wider than the column.
  The stage is `h-80`.
- **The transport is one centred pill and nothing else on the row.** Play, stop,
  loop, tint and speed all live in it, `rounded-full bg-fill` at `gap-2 p-2`,
  175.9x38.4. It was a three-column grid holding a clock, the buttons and three
  speed pills, which needed two `1fr` tracks to keep the middle centred and a
  stacked layout below 420px. Five controls in one pill need neither and fit a
  phone.
  - **The row around it draws nothing.** It was a hairline panel across the whole
    width for a while, and that made the row the object rather than the
    controls.
  - **Every secondary control's background step moves up one**, since they sit on
    the pill's own `bg-fill` where a `hover:bg-fill` would be invisible.
  - **Play is the one dark element on the surface**, `bg-text-primary` with a
    `text-bg` glyph, which is what says where to press first. It cannot be another
    fill step, because the pill it sits on is already one. Its hover and press are
    alpha steps on the same token, since none of the fill tokens is a shade of it.
  - **The glyphs pass `weight="fill"`**, the one place in this codebase that sets
    an icon weight. These are player symbols rather than UI icons: a filled
    triangle and a filled square are what a transport looks like everywhere, and
    at `size-3.5` the outlines read as sketches of the controls. `ArrowsClockwise`
    barely changes, since an arrow is a stroke whatever the weight.
- **Playback is not gated on reduced motion, deliberately.** That setting is about
  motion a reader did not ask for, and this is a play button. The demo has
  nothing left to show if pressing it does nothing. **The autoplay is gated**, and it is
  the one piece of motion here nobody asked for, which is exactly the line: a
  press is a request, an autoplay is not.

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
- **A `description` is two or three lines and nothing like a write-up.** What
  the thing is, then `key insight:` and the one decision that made it work,
  then at most one more note. Identifiers in backticks, lower case, no
  paragraph that could be cut without losing a fact. The first eleven entries
  set that shape and the later ones drifted into essays, up to twelve
  paragraphs and 5.5KB on one lab, which is a page nobody reads sitting under a
  demo that already showed them the thing. All 39 were cut back to it: 66KB to
  26KB, and no entry is over three lines.
  - **`description[0]` doubles as the page's meta description**, clamped to 155
    characters by `metaDescription`, so it wants to be one sentence that ends
    inside that.
  - The long version of any of this belongs here in CLAUDE.md, which is where
    every one of those paragraphs went.
- **No preview images, and one preview clip per experiment.** The old registry
  pointed at screenshots of the dark build, wrong on a white page and wrong
  about what the components look like now. The detail page runs the real
  component, and the index plays a recording of one being used. See The hover
  preview below.
- **`bare: true` on a registry entry drops the `Demo` frame**, so that
  experiment gets the column's full width. It is for a demo that draws its own
  container: the frame's hairline then sits a padding-width outside the
  experiment's own edge, and the two nested boxes read as chrome around chrome.
  `tab-overview` and `venetian-blind` use it. The blind draws no edge at all:
  its slats run the full width, so the blind is its own edge.
- **`hint` on a registry entry is one line naming the gesture**, rendered by the
  page beside the source links rather than inside the demo. For an experiment
  whose affordance is not visible: `event-stacking` looks like a calendar and
  says nothing about the arrow keys. It shares that row because it is copy about
  the demo, the same category as where the demo came from, and because a line of
  page chrome inside a component is a line the component then has to lay out.
  Keep it short: at the column's width the links leave it 394px, so 75 characters
  wrapped and 60 does not. It is not a replacement for `document-pocket`'s
  handwritten note, which is inside the drawing and points at one part of it.
- **Below `sm` the two links are their icons alone, and that is what keeps that
  row one row.** As words they are 131px of a 352px column, so the hint could
  not fit beside them and took a line of its own, which left the links holding
  the right of the next line with 205px of empty row to their left: an orphan
  rather than a caption. As icons they are 52px, so the hint shrinks and wraps
  its own text instead. `aria-label` carries the name at both widths, so nothing
  is lost by painting the word or not, and each is a 24px target with the
  footer's own background step, off the `--spacing` scale for the footer's
  reason. No tooltip on the icon half, which is the one place the shared rule
  for an icon-only control gives way: the other half of that rule says not to
  tooltip a control that already shows its label, and this one shows it at every
  width a pointer normally sits at.
- **No `flex-wrap` on that row.** A hint that cannot fit is meant to wrap its
  own text, never to push the links onto a line where nothing balances them.
  `min-w-0` on the hint is what lets it shrink that far and `shrink-0` on the
  links is what keeps them out of it. Measured across all 39 labs at 320, 390,
  640 and 1280px: the links sit beside the hint at every one, and nothing
  overflows.
- **That row has one rule: two things on a line sit at opposite ends, and one
  thing on a line starts at the left.** `justify-between` is what says it,
  because it applies per line where `ml-auto` applied per row. On a narrow
  column the hint takes a line on its own, and `ml-auto` held the links at the
  right of the next one with 205px of empty row beside them, which read as
  something that had fallen off the end of the sentence rather than as a
  caption. Nothing here is a breakpoint, since what decides it is whether the
  two fit and not how wide the screen is. The one exception is an entry with no
  hint, which has nothing to share a line with: from `sm` up it keeps the demo's
  bottom right corner and below `sm` it goes back to the left edge, since at
  that width a lone right-aligned run is the same orphan. Measured across all 37
  labs at 320, 390 and 1280px: no orphan and no overflow at any of them.
- **`flush: true` keeps the frame and drops its padding**, so the experiment
  fills the frame edge to edge. For a demo whose whole surface is the
  interaction rather than a component sitting on a surface: the padding then
  reads as dead space inside the thing you are meant to be poking. Not `bare`,
  which removes the frame: a demo that redefines the cursor needs the hairline to
  say where the new cursor stops, and one that pushes a card off its own edge
  needs a box to clip it against. `tether-button`, `document-pocket`,
  `stamp-collection`, `book-opening`, `folder-stack`, `window-shade`,
  `rain-splatter`, `sticker-peel`, `notch-drop`, `custom-cursor`,
  `radial-menu`, `flip-clock`, `wrapped-pattern`, `book-shelf`, `shelf-drop`,
  `crack-button`, `stem-picker`, `pixel-reveal`, `ember-burst`,
  `notice-stack`, `tide-card`, `cube-orbit`, `foil-card`, `heart-flipbook`,
  `arc-menu`, `gust-flag` and `region-comment` use it. `ember-burst`, `cube-orbit` and
  `heart-flipbook` are the three entries where `flush` governs part of the
  frame rather than all of it: the stage runs to all four of its edges and the
  strip beneath carries its own padding, since a range track or a row of pills running into a hairline is not
  a control.
- Five experiments carry a local `styles.css`. That is the one place the
  one-stylesheet rule bends, they are self-contained demos whose CSS is not
  part of the design system. Four of them still take their colours from tokens
  via `var(--color-*)`. `cursor-origin-button` had one and it was folded into
  Tailwind, including its asymmetric enter/leave timing, so prefer that when
  touching the others.
- **Twenty-five experiments define their own hues**, `tab-overview` per terminal
  session, `document-pocket` per sheet of paper, `event-stacking` per event,
  `stamp-collection` per print, `folder-stack` per record, `sticker-peel` per
  sticker, `window-shade` for the sky outside it, `rain-splatter` for the ink
  it throws, `halftone-ripple` for a press that turns its button on,
  `notch-drop` for a state icon once a drop is going to happen and for each
  kind of card on its page, `custom-cursor` for the badge over each of its
  cards, drawn from the still the card shows, `radial-menu` per format on its
  wheel, `flip-clock` per card, since black hid the depth, and `wrapped-pattern`
  per column of dots on its sheet, `book-shelf` per book on it,
  `shelf-drop` per print on its ledge, `stem-picker` per flower in its
  bunch, `pixel-reveal` a palette per picture, one for each of the five it
  can resolve, and `ember-burst` a temperature ramp, which is the one set in
  the lab that is not a choice at all: an ember's colour is what its heat looks
  like, so the six stops are a measurement rather than a palette, and
  `tide-card` one green for a tide that is coming in, `cube-orbit` the six
  colours a Rubik's cube is made of, and `heart-flipbook` the ring's two hues
  and the six its confetti is thrown in. Five of
  them are the
  same case: colour is the differentiator between shapes built from the same few
  parts, so it carries meaning rather than decorating, which is the exception the
  brand marks already get. `cube-orbit` has the strongest claim in the lab and
  `stamp-collection` the next: a postage stamp is a printed object and its
  colours are the object, and a Rubik's cube is six colours before it is
  anything else, since the puzzle is stated in them. Each is scoped to its
  experiment, the values are not tokens, and nothing else may reach for them.
  `window-shade`'s claim is the same shape as `stamp-collection`'s: daylight is
  the thing its shade is for, so the blue is the subject rather than a tint on
  one. `rain-splatter`'s is the strongest of the three, since the piece is a
  painting and its six inks are what it is made of. `halftone-ripple`'s is the
  narrowest in the lab: one value, and it is a state rather than a subject,
  since the same ripple goes out in `text-muted` when a press turns the button
  off. See its own section. `tide-card`'s is the same shape and the same
  width: the site ships one status tone and it means wrong, and a tide going out
  is not wrong. `heart-flipbook`'s set is the one that had to be redrawn rather
  than chosen: its reference lightens the ring as it expands, which is right on
  black and backwards on `bg`, so what travels is the hue and not the lightness.
  Its heart is separate again and is not part of that set, being X's own like
  pink under the brand-hex exception. See its own section. `arc-menu`'s five
  are the most literal reading of the exception in the lab: they are marbles,
  and a marble's colours are what the object is made of, the same claim
  `stamp-collection` and `cube-orbit` make for a printed stamp and a puzzle
  stated in six colours. `gust-flag`'s pair is a cobalt ground and a cream ink,
  and its claim is the weakest in the lab and stated as such: a flag is made to
  be seen, and the same flag in near-black on white read as bland. See its own
  section.
  `tab-overview` keeps its values in its own stylesheet and the others in a
  `const` beside their own data, which is the better of the two: prefer it. The
  signature player's two stroke hues are the same exception outside the lab, and
  the narrowest use of it on the site, being two values behind a toggle that is
  off by default.

  **`foil-card` is the one experiment in the lab with colour all over it and no
  scoped set at all**, and it is not an omission: its colours are computed from
  a wavelength rather than chosen, so there is nothing to scope. Do not add it
  to the list above, and do not take it as licence to compute a palette
  somewhere that a token would do. See its own section.

### The hover preview

Hovering a row on the lab index plays a clip of that experiment beside the
pointer. Scrolling with the pointer held still swaps the clip for whichever row
moved under it, running the same way the page did.
`components/lab/lab-preview.tsx` is the card and the hit testing,
`lib/lab-previews.ts` says which experiments have a clip,
`scripts/record-lab-previews.mjs` records them, and each is an mp4 and a webp
still in `public/assets/labs`.

A row's title says what an experiment is called and nothing about what it does,
and every one of them answers to a gesture, so there is no still that shows one
working.

- **One `pointermove` on the list, hit tested against measured bands, never a
  `pointerenter` per row.** A scroll moves the list under a pointer that has not
  moved, so no pointer event fires at all, and per-row events cannot express
  "the row under the cursor changed because the page did". One test answers both,
  off the last pointer position the list saw.
- **The bands are page coordinates and the pointer is viewport coordinates**,
  since a scroll changes one and not the other. The rows are a static list, so
  they are measured on the first move and again on a resize, the same
  measure-once call `event-stacking` makes for its grid.
- **Each gap goes to whichever row it is nearer.** Rows sit at `gap-1`, which is
  3.2px on this scale. Left as a real gap the card blinks shut and open again on
  the way past, and a scroll can stop in one and close the card under a pointer
  that never moved.
- **The row's own mark comes from that same test, written to the node as a data
  attribute.** A browser is not required to re-run `:hover` until the pointer
  moves again, so on a scroll the marked row and the clip could disagree about
  which experiment is being read, which is the one thing this cannot do.
  `hover:bg-fill` stays alongside `data-[active=true]:bg-fill`, since `MoreLabs`
  renders the same list with no wrapper around it. Writing to the node rather
  than to state is the bar `book-opening` and the signature player set: a pointer
  crossing twenty rows renders nothing.
- **The sides come from a row's own box, not the container's.** A row is the
  whole `-mx-4` pill, so it reaches 12.8px past the column the wrapper sits in,
  and testing the wrapper left the outer edge of every row dead.
- **The card is portalled into `body`, and it is `pointer-events-none`.**
  `RevealItem` animates a transform, and an element with one is the containing
  block for a fixed descendant, so a card left inside the list could never leave
  it, which is why `portrait.tsx` portals too. Transparent to the pointer because
  it lies over the rows it is reading: taking the pointer would drop the hover
  that put it there.
- **The clip is fetched on the first hover that needs it.** Nothing is
  preloaded, so the index costs its own markup and no video at all until someone
  points at a row. The still is the clip's `poster`, so the card paints the right
  picture for the frame or two before the video can.
- **A fresh card is put where the pointer already is, and only a move springs.**
  Otherwise it flies in from the row last read, or from the corner on the first
  open.
- **Near an edge the card flips to the other side of the pointer rather than
  being clamped**, so it never sits under the cursor. Measured on a 1040px
  viewport: a pointer on a row's right edge puts the card's right edge 18px to
  its left.
- **No `initial={false}` on the `AnimatePresence` that swaps the clips.** That is
  the obvious way to stop the first clip sliding in and it stops every later one
  as well: Motion says it by putting `initial: false` on a context every motion
  component below reads, so a keyed child mounts at `animate` rather than at
  `initial`. `tab-overview` documents the same trap at length. So the first clip
  arrives the way the rest do, under the card's own fade.
- **The swap spring is critically damped.** What the card does is replace one
  clip with the next, and an overshoot on a full-height slide reads as the strip
  being thrown.
- **Not `ring-inset` on the card.** The clip is `size-full` and paints over an
  inset ring, which leaves the card with no edge at all, the trap `now-playing`
  documents for the album cover. It needs one, since half the clips are a white
  demo on a white ground.
- **Hover is gated on `pointerType`**, mouse and pen only, the call
  `folder-stack` documents: a touch has no hover to take back, so a tap would
  leave a card on screen with nothing to close it. **On a phone the index is the
  list it always was.**
- **Reduced motion gets the still and no travel.** A clip looping until the
  pointer leaves is the motion that setting is about, and nobody asked for it:
  the reader pointed at a row, they did not press play. The card still appears,
  and it appears where the pointer is rather than travelling there.
- **Which experiments have a clip is read off `public/assets/labs`, not declared
  in `labsRegistry`.** The recorder is what writes them, so the directory is the
  only thing that knows. A lab with no clip renders no preview, which is the
  trade a post with no `meta.json` makes. `/lab` is prerendered, so the directory
  is read once at build time.

### Recording the previews

`pnpm previews` records every clip and `pnpm previews <slug>` one of them. It
drives the dev server already listening on `PREVIEW_BASE`, port 3100 by default,
so `pnpm dev` has to be up. An experiment whose component changes is
re-recorded. Nothing else in the repo reproduces these files, so they are
checked in as assets.

- **It drives the real page in a real browser, and agent-browser records it.**
  `agent-browser open` launches the installed Chrome through its
  `--executable-path`, so nothing downloads a browser, and `playwright-core`
  connects to that Chrome over the daemon's own CDP socket and performs one
  scripted gesture per lab from a table keyed by slug. `agent-browser record`
  captures it, `ffmpeg` crops and encodes, `cwebp` writes the still.
  `agent-browser` is a host tool, `npm i -g agent-browser`, beside `ffmpeg` and
  `cwebp`.
- **The clips are 60 frames a second, and the capture is what decides that.**
  Playwright's own recorder hands over about 25 frames a second whatever the
  page does, and the first clips were that, encoded at 30. agent-browser's
  `record` runs Chrome's screencast into ffmpeg at the rate it is asked for and
  holds a frame only when Chrome produced none, and Chrome produces one per
  compositor frame. Measured on the custom cursor lab at `--fps 60`: 298
  distinct frames in 5.0s, and its own stop report says so, `frames` against
  `capturedFrames`. The gesture table did not change, since Playwright still
  drives it.
- **The clip is one video pixel per CSS pixel and there is no way to ask for
  more.** Chrome's screencast returns frames at the viewport's CSS size whatever
  the device scale factor, measured 1280x1000 with the page at a factor of 2,
  and Playwright's recorder before it only ever scaled a page down. So the 537px
  column is captured at 537px and upscaled to 640x400 at encode time, which is
  still 1.75x what the 307px card paints.
- **A `focus` rect per lab, in the demo's own coordinates**, corrected to the
  card's 8:5 inside the demo box and padded in white where the demo is the wrong
  shape for it. Cropping past the demo's edge pulls in the heading and the
  description, which is page chrome rather than the experiment.
- **A `prep` runs before the demo is measured and before the recording starts**,
  for a demo that has to be put into a state the clip is about. A gesture cannot
  do it: recording opens on the settled demo and the gesture runs inside it, so
  a demo that has to be opened first spends the clip's opening second in the
  wrong state, and if opening it also makes the demo taller then the crop that
  fits the open one runs past the shut one onto the page's own hint line.
  There are two callers. `heart-flipbook`'s sheet is in a disclosure and the
  demo is 100px shorter with it shut, and `arc-menu` is fanned out so the
  clip's first frame is a dial rather than the empty stage its resting state
  is, since that frame is also the card's poster. The demo is re-centred after
  it, since it may have changed size.
- **Three labs measure their crop instead of declaring one.**
  `file-tree-explorer` and `multi-step-form` both grow as they are used, so the
  rect is the demo's own ink at its largest, and `sonner-extended-toast` has its
  subject at the viewport's corner, since the toaster is mounted in the root
  layout. A gesture that returns a rect overrides its entry's `focus`.
- **Every press is a mouse click at a coordinate, never `locator.click()`**,
  which scrolls its target into view first. The crop is a fixed rect in viewport
  coordinates, so a page that moves under it lands the clip on the prose below
  the demo, which is what four of the first clips were. The scroll is pinned as
  well, since a focused control that grows the page can move it too.
- **A gesture that presses a control with a tooltip jumps on and off it rather
  than approaching.** `m.click` moves in six steps, which under the screencast's
  load can sit on the target long enough to arm a 200ms tooltip timer, and the
  label then opens over the demo for most of the clip. `ember-burst` presses in
  about fifty milliseconds and moves away in the same call, so there is never a
  hover to time. The recording captures no cursor, so an instant move costs the
  clip nothing. Its own hold and drag are safe from this for a different reason:
  that demo refuses the tooltip while a hand is down.
- **The recording opens on the settled demo and closes on the gesture's end**,
  started and stopped around the gesture rather than trimmed out of a longer
  take. Every gesture begins with a short wait on a settled demo, so the first
  frame is a still of the thing and not the page arriving.
- **`spring-image` suppresses `selectstart` for the recording.** A drag across
  the copy beside the photo selects it, and the site paints a selection in
  `#34d399` with a caret at each end, so a clip about a spring turned into a
  clip about the selection colour. The gesture itself is unchanged.
- **`data-lab-demo` in `app/lab/[slug]/page.tsx` is the box every crop is
  measured against.** A wrapper rather than an attribute on `Demo`, since a
  `bare` entry has no frame and the recorder still has to find the same box.
- Forty-four clips, 2.7MB with their stills, 3.4 to 9.1 seconds each, at 60 frames a
  second.

### `tab-overview`

One window in three stages, and the two that answer a pointer both had to be
told what kind of pointer it is.

- **Peek is a mouse gesture, gated on the event's own `pointerType`.** A touch
  tap fires `pointerenter`, `pointerleave` and `click` inside about 60ms, so one
  tap on the toggle used to open the peek, shut it and start the overview morph
  at once. That is the same `height: auto` measured under a live transform that
  `MORPH_GUARD` exists to prevent, arriving from the other direction. Reading
  the event rather than a `(hover: hover)` query is what keeps a laptop with a
  touchscreen peeking for its mouse and not for a finger: the query answers for
  the device and reports true for both. **So on a phone the toggle is the whole
  experiment**, closed to overview and back, with nothing in between.
- **The hue wash is `@media (hover: hover)` for the same reason.** A touch
  screen has no way to take a `:hover` back, so a tapped card kept its wash for
  as long as it stayed the last thing touched. Press stays unguarded, since
  `:active` ends with the touch.
- **The panel's content fade sits under a null `PresenceContext`, and without
  it the fade does not play until the overview has been opened once.** The
  panel's `AnimatePresence` carries `initial={false}`, which is meant to say
  "do not slide the panel in on first paint". Motion says it by putting
  `initial: false` on a context, and every motion component below reads it:
  `makeLatestValues` mounts a blocked child at `animate` rather than at
  `initial`, so the keyed content mounted at `opacity: 1` and switching tabs
  changed the preview with no fade at all. It comes back on its own because
  `PresenceChild` memoises that context without `initial` in its dependencies,
  so the value is stuck for the life of that child and only a remount clears
  it. Opening the overview unmounts the panel and closing it mounts a fresh
  one, past `AnimatePresence`'s own first render, which is why the fade
  appeared after the first trip through the overview and stayed. A nested
  `AnimatePresence` clears the context too and costs more than it gives:
  `sync` renders both previews at once and grows the panel, and `wait` doubles
  the swap and blanks it in between. Measured: the panel still paints at
  `opacity: 1` with no transform on first load, and still re-enters from
  `translateY(40px)`.
- **The card's content is position-locked and the card clips, and both halves
  are load-bearing.** A layout animation resizes with a transform, so a card's
  own box is already the destination while the transform is still the source.
  `layout="position"` on the label row and on the preview holds both at their
  real size through that, which is what the design wants: the content is
  identical in the strip and in the grid, so only the box is meant to move.
  `overflow-hidden` on the card then cuts whatever does not fit the box the
  card is currently painting, which on a phone is a 56px label and a 146px bar
  inside 67px of card.
- **Locking only the label is worse than locking neither**, which is how it
  shipped and what made the title look broken on a phone. The label held 12px
  while the bars rode the card's scale down to a third of theirs, so the label
  sat across the first bar for the length of the opening morph.
- **Letting the label ride the scale instead is worse still. Do not try it.**
  It reads fine opening, where the card scales up from 42% and the text is
  merely small, and it is violent closing, where the card scales down from 250%
  and every label is drawn at 30px and shrinks. There is no direction in which
  riding is right: 12px is the label's size in both stages, so the only correct
  answer is that it never scales.
- **No `layout` value resizes without a transform, so do not go looking for
  one.** The projection engine takes `true`, `"position"`, `"size"`,
  `"preserve-aspect"`, `"x"` and `"y"`, and every one of them animates with a
  scale. `"preserve-aspect"` is not an escape hatch either, it only drops to
  position-only when the aspect ratio moves by more than 0.2. Resizing a real
  box means animating `width` and `height` as values, with no `layout` at all,
  which is what `document-pocket` does and what `PREVIEW_MOTION` does for the
  card's height. Doing it here would mean measuring both arrangements and
  driving every card by hand, which is a rebuild rather than a prop.
- **Rect maths cannot verify any of this.** `getBoundingClientRect` reports
  what an element claims, not what an ancestor's clip lets through, so a probe
  that compares a label's edge to its card's says `overflow-hidden` changed
  nothing. It also scores a label that is the wrong size but inside its box as
  clean. Compare pixels, and look at the closing morph as well as the opening
  one.

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

### `event-stacking`

A four-day calendar whose events are dragged between slots. A card dropped onto
another joins it as a pile, and the pile compresses to fit the cell it is in.
`layout.ts` is the geometry, pure and DOM-free, the same split
`document-pocket` makes with `poses.ts`.

Three Motion props carry it, and all three answer the same question: what stops
a card being mangled on the way down.

- **`layout` moves a card between cells.** It measures the box before the state
  change and after it and animates the delta, so nothing here computes a path.
  The card's `left` and `width` are percentages and its `top` and `height` are
  pixels, which does not matter to it, since it measures real boxes.
- **`layout="position"` on the card's content is what keeps that from being a
  mangling.** A layout animation covers a resize with a transform, and joining a
  pile takes every member from 70px to 63px, so a plain child would squash
  vertically on the way in and spring back at the end. Measured: through a drop
  that resizes a card 70px to 63px, the locked box holds 48.0px on every frame.
  Not plain `layout`, which would animate its size too and leave it a frame
  behind. Its size is not meant to move at all.
- **`dragSnapToOrigin` covers the other half of the drop, and its spring has to
  match the layout one.** Drag writes a plain `x`/`y` offset from wherever the
  card's box currently is, and the drop moves that box to another cell, so at
  the instant of the commit the offset is measured against a box that is no
  longer there. `layout`'s own transform starts at the old cell and unwinds to
  the new one, so the two compose to the pointer's position on the first frame
  and to the target cell on the last. Both ends are right whatever the springs
  are. What the springs decide is the path between them, and two different ones
  send the card round a curve on its way into the slot. An inertia bounce is a
  spring with `stiffness` and `damping` under other names at the same default
  mass, so matching it is a matter of naming the same two numbers, and
  `dragMomentum={false}` hands it a velocity of zero so there is no decay phase
  to reconcile.
- **Resetting `x` and `y` in `onDragEnd` instead does not work, and it is the
  obvious first try.** `layout` snapshots the box with the transform backed out,
  so its animation would start at the origin cell rather than at the pointer and
  the card teleports home before setting off.

**There are two springs, and only one card is ever held to the matched one.** A
spring's duration does not depend on how far it goes, and a pile opening or
closing a slot is 7px where a drop is up to 500px. On the drop's spring that
resize measured 181ms, which reads as a card easing rather than as a pile
reacting, while the same numbers over a whole grid read as a throw. So `SNAPPY`
carries every card the drag is not holding and lands in about 96ms, close to the
140ms the target wash takes to fade in, and `TRAVEL` carries the dropped card and
the wash. Overshoot at that damping ratio is 1.3%, which on 7px is 0.09px, so it
is a fast ease in practice and a spring only so the lab has one kind of curve.

Which card is which is state rather than a guess. `landing` holds the id the drop
is carrying and every other way a card moves clears it, including the lift that
starts the next gesture. Not an animation callback, since a drop back into the
cell it came from changes no geometry and so completes no animation to hear
about.

**`dragConstraints` is a plain object of numbers and never the grid's own ref,
and that is not a preference.** Ref constraints put a `ResizeObserver` on the
*draggable element*, and every card here changes height whenever a pile it
belongs to gains or loses a member. Each of those resizes calls
`scalePositionWithinConstraints`, which stops whatever animation is running and
rewrites `x` and `y` to hold the card's old progress inside the freshly measured
box. Two things follow and both were measured. A drop that changes a card's
height loses its return to origin part way through and leaves the card sitting
at most of its drag offset, which is a card stranded a cell away from where it
was dropped. And a card at rest takes a permanent few pixels of transform every
time its height changes, because a shorter card has a larger bottom constraint
and the same progress inside it lands somewhere else. `isRefObject` gates both
the observer and the rewrite, so numeric constraints are the version that does
nothing but clamp. The cost is that they are transform offsets in pixels, so
`limits` needs the grid's measured width, which is why there is a
`ResizeObserver` of our own. It has to be in props before the gesture starts,
because Motion resolves constraints in its own `pointerdown` handler and that
runs before any React handler on the same element.

**The pile fits its cell, and the peek gives way before the height does.** A
card loses `PEEK` for every card above it, which is 70px alone, 63px in a pair
and 56px in a three. A fourth would take it under the 50px its own two lines
need, so past that the peeks share out whatever room is left instead: five cards
are five 50px cards 5px apart. Clipping the content would mean a pile whose
cards stop saying what they are, which is the one thing the pile exists to show.

**Which cell the pointer is over is computed from the pointer, not from the
DOM.** A `pointerenter` on a cell cannot fire while a card is being dragged over
it, because the card is the thing under the pointer. So the grid is measured
once per gesture and every sample is arithmetic against that. Motion reports a
gesture's point in **page** coordinates, off `pageX` and `pageY`, where
`getBoundingClientRect` is in viewport coordinates, so the scroll is added in
once at the start rather than corrected every frame. The result is clamped,
because the constraints hold the card's box inside the grid and nothing holds
the pointer there.

**Both piles answer the drag, and the card in the air does not.** The cell it is
heading for counts it before it lands, so the cards already there keep their
order, shift down and open the slot on top. The cell it left drops it as soon as
it is over another one, so that pile closes up: a pair leaves a lone card holding
the whole cell, and a three leaves its new top card relaxed and back at the top
of it. Coming home reverses both, since the two tests are the same test. The
lifted card keeps the box it had at rest through all of it, because a card that
resizes under the pointer reads as the pointer doing it. Motion would survive it
moving, it watches its own `didUpdate` and adds the layout delta back into both
the drag origin and the offset, so that is a design call and not a workaround.

**The wash marking the target cell takes the card's own corner radius**, not the
cell's square one, since what it stands for is the shape about to land in it. It
keeps the cell's footprint, which is what says the cell rather than the card is
the target.

**A long press takes the whole pile, and it travels by copying rather than by
sharing.** Drag writes to whichever motion value sits in the card the pointer
has, so a follower cannot use that same value: it needs its own for its own
transform. Each one subscribes to the leader's and mirrors it, which is also what
gives every card in the pile the same lean for nothing, since each derives that
from its own `x`.

- **The offsets are owned by the parent, not by the card.** A card cannot reach a
  sibling's, and registering them upward would have a follower subscribing on the
  same commit the leader registers on. They live in a ref keyed by id rather than
  in a hook, since there is no fixed number of them, built with `motionValue`,
  which is Motion's constructor for values made outside a component.
- **The copy has to outlive the drop.** The leader's offset is still unwinding
  under `dragSnapToOrigin` after the release, so `hold` is cleared by
  `onDragTransitionEnd` and not by the drop. A press that never became a drag has
  no snap to wait for and releases on `pointerup` instead. The subscription's
  cleanup lands at zero rather than wherever the last frame left it, so one torn
  down early cannot strand a card mid-air.
- **A release only counts from the card that took the pile, and the id check is
  what enforces that.** Once a pile has moved, the `pointerup` usually lands on a
  card *above* the one being carried: a deep card shows only its own sliver, and
  every card above it has a larger `zIndex`. That card never dragged, so
  releasing on it ended the gesture mid-flight, and because `hold` was then null
  by the time `onDragEnd` ran, `onDrop` moved the pressed card alone and left the
  rest to snap back to the origin. Measured on a pile of five: the cards broke
  about 190px apart during the drop, and 2 to 7px after the fix. Only the middle
  cards were affected, since nothing sits above the top card and nothing reaches
  as low as the bottom one's sliver, which is why holding either of those looked
  fine.
- **`hold.ids` is snapshotted when the hold engages**, never recomputed from the
  leader's cell. The drop commits the move while the offsets are still unwinding,
  so by then the leader's cell is the target, and asking it who its neighbours
  are would answer with the cards that were already there.
- **A held pile is bounded as one box.** `cellBox` is the cell inset by the gap,
  which is what a pile always fills. Constraining the leader's own box instead
  would let the cards under it leave the grid.
- **Three things say the pile has been taken, and the tightening alone was not
  enough.** `place` takes a smaller peek ceiling, which clamps the cards together
  and, because a pile always fills its cell whatever the peek, also makes each
  card taller. That is 4px of closed gap, which nobody notices while looking at
  the pointer. So the pile also lifts, and the leader carries a count badge.
  - **The lift needed its own prop.** `lifted` means in flight, and it drives the
    content dimming and the airborne label as well as the shadow. A pile that has
    just been taken has not moved and has no destination to name, so `raised`
    carries the shadow on its own.
  - **The badge is bottom right and `bg-text-primary`.** The card's own two lines
    are top left and the airborne label is centred, so that corner is the one
    nothing else uses, and a near-black pill is the loudest thing the palette has
    against a pale tint. It is the same treatment the header gives today's date.
    `aria-hidden`, since the button's label already says "card 1 of 2".
- **The click guard needs the hold as well as the drag.** A press long enough to
  take the pile and then released without moving is a change of mind, and cycling
  the pile under it would be a surprise.
- **Shift is the keyboard's long press.** A pointer-only gesture is the thing the
  hint bullet below already argues against.

**Pile order is a number on the event, not the array's order.** Landing takes
the highest order in that cell plus one plus its index in the run being moved, so
one card and a whole pile are the same operation and a pile keeps its own order
against itself. Cycling drops the front card below the lowest. The events array
never reorders. `layout` only animates an
element that stayed mounted, and reordering the array would work, but it puts a
DOM move in the middle of every drop for nothing.

**A card leans while it is carried, off the horizontal velocity of the drag.** It
was a fixed 2.5 degrees, which said the card was in the air but not that it was
being moved. `useVelocity` on the drag's own `x` is the source, because it decays
to zero on its own when the pointer stops, where a velocity read out of `onDrag`
freezes at its last value and leaves a card tilted while the hand is still.
Calibrated rather than picked: 213px/s leans 2.4 degrees and 2167px/s leans 9.5,
against a 12 degree clamp. The spring's own rise time is what holds a short flick
short of that clamp, which is correct and is also why the tilt is turned up by
lowering the velocity each degree costs rather than by raising the clamp. The
spring is the loosest in the file at a 0.57 damping ratio, so 11% of overshoot
puts a wobble on it as the hand stops, which is the part that reads as weight.

**A `grip` motion value gates it, and it has to.** `x` keeps moving after the
release, since it is what `dragSnapToOrigin` unwinds, and that unwind is the
residual of the drag offset rather than the card's own travel. A card carried
right across the grid reads a large leftward velocity on landing and would snap
the wrong way over. Zeroing `grip` at the release lets the spring level the card
out while it flies into the slot, which is what putting a card down looks like.
It is set in the gesture handlers rather than from `lifted` in an effect, since
the card already knows both moments and neither needs a render. Reduced motion
sets it to 0 and leaves it there: `useSpring` is a hook rather than a motion
component, so `MotionProvider` does not reach it.

**The two labels that say where a card is are morphed, not swapped, through
`torph`.** A card's time comes from the row it sits in and the airborne label
from the cell under the pointer, so a move rewrites both. "9:00 AM" to "10:00 AM"
and "Wed 10:00 AM" to "Thu 11:00 AM" keep most of their characters, so morphing
the few that change reads as one label being corrected where a swap reads as a
different label arriving. This is the second caller after `multi-step-form`,
and `book-opening`'s mode control is the third.

- **220ms, not its own 400ms default**, and in milliseconds unlike every other
  duration here, since `torph` is not Motion. The airborne label is rewritten
  every time the pointer crosses a cell boundary, which is far more often than
  400ms, and a morph still running when the next one starts reads as a smear.
- **`whitespace-nowrap` on the time, never `truncate`.** `torph` lays its
  characters out itself and an `overflow-hidden` box on the same element clips
  them mid-morph. The card clips instead, which it already does, and the widest
  time still has 5.69px of clearance inside the narrowest card.
- **The dot beside the time stays outside it.** `torph` takes text children only,
  never elements.
- **It reads `prefers-reduced-motion` itself** through `respectReducedMotion`,
  which defaults on, and renders no wrapper at all when it is set. So this is the
  one animation in the lab that neither `MotionProvider` nor a `useReducedMotion`
  call governs.

Smaller things, all of them things that were wrong first:

- **A drag ends with a `click` on the button it started on**, so without a flag
  set at drag start every drop would also cycle the pile. Drag start is past the
  gesture's own threshold, so a real click never sees the flag.
- **A card has no border, so its tint is the whole of its edge.** It carried a
  hairline in its own hue at 25% for a while, which read as an outlined chip
  rather than as a block of time. That hairline is also why focus was an
  `outline` for a while: a focus ring is a box-shadow and so was the hairline, so
  the ring replaced the edge of the card being moved by keyboard. With no
  hairline the project's own focus pattern goes back in unchanged.
- **`select-none` on the window.** Every gesture here is a drag across type, so
  without it a pointer that misses a card selects the day heads and the hour
  labels, and one that hits a card leaves its own two lines highlighted behind
  it. Scoped to the window rather than the whole block, so the hint under it stays
  selectable prose.
- **`cursor-grab`, which is the second place the shared "cursor-pointer on every
  clickable element" rule is off**, after `tether-button`. A card is grabbed far
  more often than it is clicked.
- **The marks are the 700 step where `document-pocket`'s are the 600.** There a
  mark sits on white paper and here it sits on the card's own tint, and
  amber-600 on amber-200 is 2.56:1. Every pairing here clears 4:1 on its own
  tint, and the tints stay in the 1.24 to 1.42 band. The card's own meta line is
  `text-secondary` rather than `text-muted` for the same reason: muted is 2.23
  on a tint.
- **The hint is a registry field, not copy inside the demo.** The cards look
  grabbable and the pile at Thu 9:00 shows what a drop does, so this does not
  need a note saying it is interactive the way `document-pocket` does. What
  neither of those says is that the arrow keys move a focused card, and a path
  reachable only by pointer is the one worth naming. Adding a second `Caveat`
  caller for it would also undo "one lab only" on that face.
- **The hour gutter is one class string used twice**, the column and the spacer
  holding the day heads off it, since they have to agree. `w-12` was the first
  pick and wraps "10 am" onto two lines.
- **The card's horizontal padding steps up with the column.** At 390px a column
  is 73.6px and "10:00 AM" was 0.72px from fitting, measured at 52.25px in a
  51.53px box. A title losing its tail is what `truncate` is for. A time losing
  one character is a bug, so the padding gives way instead.

### `stamp-collection`

Three stamps on a dark table. Hovering one lifts it, clicking one brings it to
the front and pushes the other two out behind it, and the print inside a focused
stamp slides under its own window as the pointer moves.

`poses.ts` is the geometry and the perforation holes, `motifs.tsx` the three
prints and the palette, `stamp.tsx` one stamp, `index.tsx` the stage.

- **The paper is an SVG, not a `div` with a CSS mask.** Both punch the holes.
  Only the SVG gives a `drop-shadow` that follows the scallops instead of the
  bounding box, and a stamp whose shadow is a rectangle is a rectangle.
- **The holes sit centred on the edge line**, so half of each one bites in. That
  is what leaves convex paper between them, which is the shape a torn
  perforation actually has. The pitch is recomputed from a whole number of holes
  per edge, so both corners land on one and a row cannot end mid-scallop.
- **They are deduped by position.** A corner hole belongs to two edges. The mask
  does not mind the second copy, but React keys the circles by position and warns
  about all four.
- **A stamp is staged by animating its `width` and `height`, never by scaling
  it.** A scale takes the perforated edge and the shadow blur with it, which is
  the one thing drawing the paper as vector was for. So the poses are stage
  pixels, the same as `document-pocket`.
- **The lettering is `cqw` against the stamp**, since a stamp goes from 160px
  wide to 236px. `container-type` sits on the button and nothing on that element
  may use `cqw`: an element is a query container for its descendants and never
  for itself, which is the trap `document-pocket` documents at length.
- **The print is drawn larger than its window on every side.** That bleed is what
  the parallax slides into, and it is why no edge of a print can reach the cream
  frame however far the pointer pushes.
- **A focused stamp leans toward the pointer under `transformPerspective`.**
  Toward, not away, so the near edge comes forward and you see a little further
  under the frame on that side. That also agrees with the print, which slides
  against the pointer: the two together read as a picture behind glass rather
  than as one flat thing rotating. 9 degrees at 900px, since further looks like
  a card being flipped.
  - **Positive `rotateX` takes the bottom toward the viewer and positive
    `rotateY` takes the right edge away**, so the pointer's offset works
    unchanged on one axis and negated on the other. Worth checking rather than
    guessing, the signs are not symmetric.
  - **`transformPerspective` on the stamp, not `perspective` on the stage.** An
    element carrying `perspective` becomes its own stacking context, which is
    the thing `document-pocket` had to design around.
  - **Every stamp reads the same lean and the same drift.** Only the focused one
    is ever driven and the values are zero at rest, so the two behind it lean
    invisibly and no stamp has to be told whether it is the one in focus.
- **Three springs, not one.** The stamp travelling between poses is the slowest,
  the lean is stiffer, and the print's drift is the loosest. The stamp is the
  object being moved and answers almost at once, the print lags behind glass. On
  one spring that separation is gone and the two read as a single flat thing
  rotating. The drift is a spring of its own rather than a transform of the
  lean's, or it would arrive with that lag already baked in.
**The hover lift felt laggy and took four fixes, in the order they were found.
The last one is the one that mattered, and the first three were all real.**

- **Its own curve, not the pose spring.** The pose spring is tuned for a stamp
  crossing the stage, so 14px took 235ms to settle with nothing visible in the
  first 40. A spring's duration does not depend on how far it goes, the same trap
  `event-stacking` documents.
- **A transform, not `top`.** `top` is a layout property, so every frame
  relayouts and repaints the stamp.
- **The drawing is memoised.** A stamp is 91 to 121 SVG nodes and there are
  three, so a hover handed React 309 nodes to reconcile in order to move one
  stamp 14px. Under a 4x CPU throttle that was one 37.9ms frame at the instant
  the pointer arrived. Behind a `useMemo` whose dependencies are all stable, the
  longest frame in the whole lift is 16.8ms.
- **The lift is driven from the event handler, not from parent state.**
  `pointerenter` to the first pixel of movement measured 21 to 24ms unthrottled,
  because React had to handle the event, re-render three stamps and commit before
  Motion could pick up a new target on the following frame. Setting the value in
  the handler starts it on the frame the pointer arrived, and the parent tracks no
  hover state at all now.
- **It is a tween and not a spring, and this was the actual complaint.** Opening
  a stamp felt fast while the lift felt slow, with the lift's spring the quicker
  of the two at 160ms against 277ms. Distance is why. Opening moves a stamp about
  150px and grows it about 100px, so every frame carries a lot of change. The
  lift covers 14px, which on a spring is about 1.5px a frame, and a spring spends
  most of its time on the last couple of pixels. Sub-pixel creep for a dozen
  frames reads as sluggish however short the total is. A sharp ease-out
  front-loads it: 5.7px in the first 29ms against 5px in the first 103ms before.

**None of this was visible in a settle time**, which went 235, 141, 141, 91. Two
of the four fixes did not move it at all. For a gesture this small, measure
`pointerenter` to the first pixel that moves, and measure how much of the
distance the first two frames cover. A late or creeping response to input reads
as lag whatever the total duration says.
- **Hover never changes the stacking.** A lifted stamp stays under whichever ones
  were already over it, so only part of the lift shows. Raising it to the front
  reads as picking the stamp up, which is what the click is for, and it made a
  hover on the leftmost stamp look like a selection that had not finished.
- **The sun's field is a step off the paper, and it has to be.** It was the
  paper's own colour first, which left the picture window with no visible edge on
  that stamp, so the mist bands appeared to stop in mid air where the clip cut
  them. 1.15:1 is enough to read as a print on a mount and not enough to read as
  a second colour. The bands also run off both edges of the window rather than
  stopping inside it, so the clip reads as the print continuing.
- **The third print was an iris and read as a bird.** Three leaves and three
  petals is not enough shape to say flower. A chrysanthemum is a loop of
  ellipses, and a radial flower is the one botanical form that survives being
  reduced that far, because the arrangement carries it rather than any one
  petal's outline.
**Selecting runs two beats and leaving runs three.** In: fan, pile, focus. Out:
focus, pile, fan-still-holding-the-lead, fan. One pile serves both directions,
which is why the sequence reverses without a second set of poses read backwards.

**The extra beat on the way out exists because `zIndex` is discrete.** Going in,
the selected stamp never has to give up any stacking, so there is nothing to
cover. Coming back it does, and stamp 0 is the worst case: it went from in front
of everything to behind everything in one frame while the other two were still
piled on top of it, so nearly the whole stamp vanished at once. So it travels to
its own slot while still raised, still squared up and still on top, and only the
last beat lowers it, turns it to the row's angle and gives up the `zIndex`
together. Two things buy that: the swap now has three properties moving to hide
behind, and by then the row has spread, so the overlap it has to lose is one
neighbour instead of two. Traced on stamp 0: z20 at x257 mid-travel, z10 at x243
with the rotation already turning.

- **The second beat is a timer, not an animation callback.** A callback fires per
  property and per stamp, so there is no single "that move is done" to chain off.
  `HOLD` is 220ms against a pose spring that settles in about 280, so the second
  beat starts on the tail of the first. Waiting the full settle reads as two
  animations with a gap, the same call `document-pocket` makes at 0.6 of its own
  duration.
- **The pile puts the selected stamp on top, in both directions.** It is the one
  about to grow on the way in and the one that just shrank on the way out.
  Without that it sat wherever its index put it, so a middle stamp grew out from
  behind another one and shrank back into hiding.
- **That stamp also rises and squares up, and the rise exists to cover a pop.**
  `zIndex` is a discrete value, so the selected stamp arrives in front of the
  others in a single frame however smoothly everything else is moving, and
  against a gather that reads as the stack glitching rather than as a stamp coming
  forward. Delaying the swap makes it worse, since the stamps overlap most when
  the pile is tight, and leaving a raised stamp behind in `zIndex` occludes it
  where it overlaps, which looks broken rather than early. So the swap keeps its
  frame and gets something to hide behind: the lead rises and squares up in the
  same frame, and the eye reads the movement instead of the layer order. The
  square-up is not decoration either, focus is at 0 degrees, so it is that
  rotation starting a beat early.
- **The pile has to be loose enough to read as three stamps.** At 0.012 of the
  stage it was 6px of offset behind a stamp carrying a drop shadow, which shows
  nothing but a dark sliver, so the beat the gather exists for was invisible.
  0.032 with a spread of angles reads as a stack squared up by hand. The angles
  matter as much as the offsets: three stamps at the same angle are one
  silhouette however far apart they are.
- **A click mid-sequence is ignored rather than queued.** The stamps are in
  flight and nothing under the pointer means what it looks like it means. That
  holds for the table as much as for a stamp.
- **Clicking the bare table puts the stamp back**, alongside clicking the stamp
  itself and Escape. The stamps are children of the stage so their clicks bubble
  to it, and the event's target is what tells the two apart: a stamp reports the
  button, the table reports itself, and the grain layer cannot report anything,
  being `pointer-events-none`. Nothing needs `stopPropagation`.
  - **The listener is bound to the node, not written as a JSX prop**, the same
    call `document-pocket` makes for its own stage: it is a region the pointer
    passes through and has no honest interactive role to carry. As a prop it is a
    roleless `div` with an `onClick` and no keyboard equivalent Biome can see,
    since Escape lives on the window.
  - The stage keeps no cursor change. Making the whole dark area look interactive
    costs more than the affordance is worth, and the stamp and Escape both
    already close it.
- **The unselected stamps fade where the pile left them, never unmounted**, so
  nothing travels twice and the way back has somewhere to animate out of.
- **Reduced motion skips the middle beat entirely.** The sequence is
  choreography, and there is nothing to read in it when nothing moves.
- **The lift belongs to the fan and nowhere else**, and only once the fan has
  stopped moving. A selected stamp has nowhere to rise to and one still gathering
  is in flight. Verified by the transform's own `translateY`: -14.34 in the fan,
  0 mid-gather, 0 when selected.
- **Every arrangement change disarms the lift for `TRAVEL`, which fixes a
  flicker.** Closing spreads the stamps back out under a pointer that has not
  moved, and every stamp crossing it fires its own `pointerenter` on the way
  past, so each lifted and dropped as it went. That is hover in reverse: the
  pointer moved onto nothing, the stamps moved onto the pointer, which is the same
  shape as the bug `document-pocket` solves by hit-testing neutral geometry
  instead of trusting the DOM.
  - **Disarming is the whole fix and it needs no test for whether the pointer
    moved.** A stamp that arrives under a stationary pointer has already had its
    `pointerenter`, so it stays flat until the pointer leaves and comes back,
    which is the right answer: you did not hover it, it came to you.
  - Measured with the pointer parked on the return path, across the 109 frames of
    a close: 77 frames carried a lift before, 0 after, and hovering still lifts
    14.34px once the fan has settled.
- **Escape leaves a focused stamp.** Clicking it again is the only other way out,
  and a focused stamp covers most of the stage that would otherwise be clicked
  off.
- **Hover is gated on `pointerType`**, the same as `tab-overview`. A touch tap
  fires enter and click together, and a lift that plays under the selection it
  triggered reads as a stutter.
- **The focus ring is tight, rounded and in the paper's own tone.** It is an
  `outline` on the button's box, so it is a rectangle round a scalloped object
  whatever it looks like. At `offset-4` and grey it read as a stray box beside the
  stamp rather than as a selection frame.
- **The ground is dark for the `document-pocket` reason, not for taste.** The
  paper is cream, and cream on `bg` puts every value in the piece inside a few
  percent of every other. The darkest fill token is `stroke-strong` at 86%
  lightness, so there is no light answer to reach for.

### `book-opening`

A book on a table, fourteen sheets deep. Hovering it fans every leaf off the
spine and lays the front board out to the left, and in cursor mode the same fan
answers the pointer's distance left of the shut book's fore-edge instead.
`lib/lerp.ts` is the two functions the whole experiment runs on, `sheets.ts` the
geometry, `index.tsx` the stage and the frame loop. Those two started here and
moved out when `window-shade` needed the same pair, which is the rule about
promoting a helper on its second caller rather than copying it.

- **One inherited property drives fourteen transforms.** The stage carries
  `--book-open`, a plain number from 0 to 1, and every sheet is
  `rotateY(calc(var(--book-open) * var(--sheet-angle)))` with its own angle as a
  static custom property beside it. So a frame is one `setProperty` and one
  `textContent`, and the browser applies the rotations. Nothing in the component
  renders while the book moves, the same bar the signature player sets. Measured
  under a 4x CPU throttle: 73 frames across one open, the longest 16.8ms and the
  median 16.7, so none is dropped.
- **The fan is the same lerp as the animation, run across the stack instead of
  across time.** Sheet i lands at `lerp(0, -SPREAD, i / (COUNT - 1))`, so the two
  boards take the ends, the leaves split what is left, and one number decides how
  wide the book opens. An even number of leaves is deliberate: an odd one puts a
  leaf at exactly half the spread, which at full open is the one angle that paints
  nothing, a sheet seen along its own edge.
- **The lerp is of the fore-edge and not of the angle, and this is the one thing
  in the geometry worth reading twice.** Even angles are not even paper. A
  sheet's free end sits at `cos(angle)` of the way out and cosine is flat where
  the fan is flat, so on even angles the sheet nearest the back board hid all but
  a few pixels of it while the pair either side of vertical stood 23px apart:
  half the fan was a stack of slivers and half was wide open pages. Spacing the
  fore-edges and taking the angle back out with `acos` shows the same strip of
  every sheet. Measured at full open: 18.9px of the back board, then 22.7, 24.7,
  25.8, 26.5, 26.9 going in, where perfectly even spacing would be 23.2 and
  perspective widens whichever sheet leans nearer the eye.
- **What that costs is the two ends, and it is what an even spread of paper looks
  like.** The boards finish 32 and 22 degrees clear of their neighbours against 9
  in the middle, so pages near the covers lie down and the ones at the middle
  stand up.
- **`a * (1 - t) + b * t`, and never `a + (b - a) * t`.** The two are one line of
  algebra and two different floating point expressions. This one is exact at both
  ends, where the other finishes on `a + (b - a)` and lands near b rather than on
  it: at a of 100 and b of 0.1 it returns 0.09999999999999432. **Nothing here
  depends on that exactness**, since the loop snaps inside an epsilon and the CSS
  multiply each sheet carries is the a of 0 case, and it is still the form to
  write, because the other one fails silently the first time a lerp is asked for
  its own endpoint.
- **The smoothing is a time constant, not a share of the gap per frame.** A fixed
  share is a different curve on every display, and 0.15 a frame settles in half
  the time at 120Hz that it does at 60. `approach` asks for a share per second and
  converts it with the frame's own `dt`. Opening is slower than shutting, the call
  `document-pocket` makes for the same reason. Nothing overshoots, because paper
  does not bounce and a lerp toward a target cannot pass it: **this is the one lab
  with no spring and no keyframe in it at all**, and the mode control's own state
  is a colour step rather than a sliding indicator so it stays that way.
- **The loop stops when it arrives, and the handle it holds is not a flag saying
  it is alive.** An exponential approach never lands, so it snaps inside 1e-4,
  which on the widest sheet is a hundredth of a degree, and at rest the page
  requests no frames at all. Skipping the request while a handle is set reads as
  the obvious optimisation and is a bug: a scheduled frame that never arrives
  leaves a target nothing will ever read, and every gesture after it does nothing
  but write that target again. A browser that produces frames on demand rather
  than on a clock is enough to do it, and headless Chrome is one, where the book
  rests at 0.998 between input bursts. So `aim` cancels and reschedules, and only
  restarts its clock when the loop was idle, since resetting it on every call
  would hand every frame of a drag the same assumed step and take the refresh rate
  back out of the maths.
- **The pointer's target is a plain box that grows with the fan and never shrinks
  under a pointer.** `document-pocket` documents the failure this avoids: hit test
  a box that moves because it was hovered and the hover drops, the box goes back,
  and the hover picks it up again. A sheet past vertical is well outside the shut
  book's footprint, so a reach fixed at that footprint shuts the book the moment
  the pointer follows the paper. Both edges step outward with the fan instead, and
  since the shut region is a subset of every later one there is no oscillation
  available. It carries no transform, so the browser's own hit testing is exact
  and nothing is measured in JS. Verified: a pointer walked from the middle of the
  shut book out to the far edge of the open fan in 3px steps never drops below
  1.000, and the stage sees no `pointerleave` on the way.
- **Recentring is the cover's own cosine, and it is a correction rather than part
  of the interpolation.** The spine is the container's left edge, so a shut book
  centred on the stage would open into the left half of it and finish a half
  width off centre. That half width is spent as the fan reaches left of the spine,
  which is `max(0, -cos(angle))` and is not linear in t at all: until the cover
  passes vertical the whole fan still sits inside the shut book's own box.
  Measured at half open, where the cover stands at 84 degrees, a book drifting on
  t instead is 37px right of centre, its shadow is half as wide again as the thing
  casting it, and the pointer's target has grown into a region with nothing in it.
  All three read `--fan-left` for that reason. Verified across the open: the fan's
  own middle holds 48.3% to 50.4% of the stage.
- **`cos()` in `calc` is CSS Values 4 and lives in `left`, not in a
  `translateX`.** It has been in every evergreen browser since 2023, and keeping
  it out of the transform means an unsupported one costs the book its centring
  rather than its perspective.
- **A tap is heard on `pointerup` and a key press on `click`, which is two
  handlers for what looks like one thing.** A click is the obvious place for both
  and it does not hold: the click a browser synthesizes after a tap is a
  compatibility event, it arrives after the whole pointer sequence including the
  leave, and React did not dispatch it at all on any tap after the first one here.
  A `pointerup` carrying `pointerType` is the tap itself. A keyboard activation
  has no pointer type to read and arrives only as a click, where `detail` of 0 is
  what says no pointer was involved. A mouse does nothing in either mode, since
  the pointer is already saying what it wants.
- **A touch `pointerleave` is a lift, not a departure.** A touch pointer stops
  existing when the finger comes off, so it fires `pointerleave` then rather than
  on going anywhere, and that leave lands after the `pointerup` the tap is heard
  on. Ungated, a tap opened the book and shut it again inside one gesture, and a
  pull could never leave it open, since letting go read as leaving. Measured
  before the gate: a drag to full open fell back to 0 the moment the finger came
  off.
- **Each board is two faces under `backface-visibility: hidden`.** A cover swung
  past 90 degrees shows its own back, and a title read backwards is the one thing
  a book cannot do, which is visible in the reference this came from. The board's
  outside is cloth and its inside is paper, so the two-sided build is what a bound
  book has anyway. `container-type` sits on the face rather than on the sheet,
  since a sheet has 3D children and containment would flatten them, and the `cqw`
  values inside are proportions of a cover rather than steps on the type scale.
- **Both pastedowns are grey, and that is what gives the open book its ends.** The
  two boards face away from the reader at full open, so with white paper on their
  insides the fan finished on the same white it is made of and read as loose
  sheets. Their hairline steps up to `stroke-strong`, since `stroke` and
  `fill-hover` are the same value to a pixel.
- **Each pastedown carries one end of the interpolation, printed against the
  fore-edge.** That strip is the only part of a sheet its neighbour does not
  cover, and spacing the fore-edges is what makes it wide enough to print on at
  both ends of the fan. On even angles the two strips were a few pixels and about
  eleven, so the same letter was legible on one side and not the other.
- **The table is `fill-active`, one step darker than `document-pocket`'s.** There
  the paper only had to read against a near-black pocket. Here it is the whole
  object, and on `bg-fill` the sheets, the table and the pool of light on it all
  sat inside 5% of each other and the fan read as fog.
- **A sheet's lift ramps with the fan, and that is not a flourish.** Shut, all
  fourteen sheets are in the same place, so any shadow they carry is painted
  fourteen times and the book sits in a dark halo. At 0 the leaves cast nothing
  and the boards carry the whole book's shadow, which is what a shut book has.
  The lift is an inline `boxShadow` because it interpolates a custom property, so
  every sheet's hairline is a real `outline` rather than a ring, which is a
  box-shadow too and would be overwritten by it.
- **The 0.45px of depth per sheet is not decoration.** Shut, every sheet holds the
  same rotation and the same box, so without it fourteen coplanar layers sit
  exactly on top of each other and nothing but document order decides which
  paints first. It is applied inside the rotation, so a sheet is offset along its
  own normal rather than the stage's, and the tilt turns the 5.9px of stack into a
  sliver of page block along the foot of the shut book.
- **The boards overhang the leaves**, which is a book's own square, and the hinge
  therefore sits 3.2px outside the text block's spine, which is what a real joint
  does.
- **Reduced motion takes the whole gap in one step.** The book still opens, which
  is the demo. It just does not travel, the same line `stamp-collection` draws
  between a sequence, which is choreography, and its destination, which is
  content. Verified: 60ms after a hover it is at 1.000 and 60ms after the pointer
  leaves it is back at 0.
- **Which input the book answers to is one control whose label is the current
  input, and pressing it swaps.** That is the site's own answer to a mode
  selector, and the signature player's rate pill documents it: two or three
  pressed pills each say their own state and spend a whole row doing it. This got
  there the long way, first as a white pill holding two segments with the pressed
  one filled, then as two bare words with a hairline under the live one. The first
  was worse for a reason worth keeping: the fill it marked the selection with was
  `fill-active`, which is the table the stage is painted in, so the selected
  segment was the colour of the ground behind its own container.
  - **It reads glyph then value, which is the shape the `t` readout in the
    opposite corner already has**, in the same mono for the same reason, since
    what it names is a variable rather than copy. The two corners are now the same
    kind of thing: one reports the number, one reports and sets what drives it.
  - **No tooltip, unlike the rate pill.** That one needs one because its label is
    a bare number, so nothing on it says a press changes anything. Two arrows
    against a value is what a swap looks like, and the `aria-label` carries the
    same claim for a reader with no glyph to look at.
  - **The label morphs through `torph` rather than swapping**, the same call
    `event-stacking` makes for its own two labels and on the same ease, so the lab
    has one curve for text. What a press does to a value is correct it, and
    morphing the characters is what that looks like. It also costs the lab nothing
    on the claim above: `torph` measures the two strings, sets the box to the
    target width and lets CSS transition it, so there is still no spring and no
    keyframe here, and the pill resizes with the word instead of jumping when
    "hover" becomes "cursor". Verified across a full cycle: 66.56px to 73.80px and
    back, with the inline width released to `auto` each time.
  - **Its hover goes lighter and only its press goes darker, the opposite of the
    site's own order.** The usual `bg-fill` to `fill-hover` pair assumes a white
    page, and both of those steps move toward the table here: `fill-hover` on this
    corner is a 1.03:1 step and is not there at all. So hover lifts the pill to
    `bg` and the press pushes it past its resting tone to `fill-hover`. It is the
    shared rule about hovers on an elevated surface going lighter, arriving from a
    mid-grey ground rather than a dark one.
- The stage's `touch-action` is `pan-y` in cursor mode only, so a horizontal drag
  is the demo's and a vertical one is still the page's.

### `folder-stack`

A drawer of card index folders, eight tabs deep, with alphabetical dividers cut
to three positions. Hovering a folder pulls that one folder up out of the pile.
`records.ts` is what is filed, `motifs.tsx` the traces and the hues, `stack.ts`
the geometry, `index.tsx` the pile and the case.

- **Every card is the same box in the same place and exactly one `translateY`
  moves.** A card is never resized and every card is the same height whatever it
  holds, so **the reveal is occlusion**: the hovered card comes out from behind
  the card in front of it, and there is nothing to fade, mount or measure. It is
  the same claim `book-opening` makes about its sheets, arrived at from the other
  end: there the transforms come off one inherited property, here each card
  carries its own and the browser is still the only thing interpolating.
- **The hovered card is the only thing that moves.** The card in front never
  gives way, the case never travels, and the cards behind do not move either: the
  lifted card paints over them, which is what pulling a folder out of a drawer
  does. The pile keeps its own shape, and this is also the strongest form of the
  stability argument below. It was built the other way first, splitting the lift
  between the half of the pile at and above the card and the half below it, which
  centres the object at rest and makes the whole drawer appear to open at once.
- **The room a lift needs is carried at both ends of the stage, so the pile sits
  in the middle of it.** The topmost card needs the whole `LIFT` above its own
  row, so that much table sits above the shut pile and the same below the case:
  measured, 136px either side of a 304px object. Two other arrangements were
  built and both are worse. Pinning the pile to the foot of the frame is a shorter
  stage with all of the slack above it, which reads as a pile that has slid to the
  bottom. Sliding the whole assembly down as a first beat and lifting the card as
  a second keeps the pile centred in that shorter stage, and it costs a flicker,
  since the slide takes the card out from under its own pointer, which shuts it,
  brings it back and starts again. That is fixable, by exempting the hovered card
  from the slide and splitting its lift across `translate` and `transform` so the
  two beats can hold different delays, and it is a lot of machinery for a demo
  that is about the folders.
- **The lift is a whole number of rows, and that is not tidiness.** A lifted
  card's paper edge cuts across whatever is behind it, so at any other value that
  edge lands part way through a tab and slices it, which reads as a rendering
  fault rather than as one card in front of another. At a multiple of `PEEK` the
  edge lands exactly where a card's own paper starts, so every tab behind is
  either whole or gone and the lifted card sits in the slot three rows up rather
  than between two of them. **Three is also one whole turn of the cut cycle**, so
  it lands on a row whose tab is cut to the same position as its own and covers it
  exactly: at four the two sat side by side in one band, which read as a pair of
  tabs at the same height. It is the shortest lift that clears the card in front
  and still keeps the deepest card's panel inside the clip.
- **A card is `LIFT + PEEK + TAB_H` tall, not as tall as its contents need, and
  this was a flicker.** A tab band is transparent either side of the tab in it,
  so what shows through the band of one card is the paper of the card behind it.
  Lifting a card takes the foot of its paper up by the same amount as its head:
  any shorter and it stops covering the last few pixels it was covering, the
  pointer sitting there lands on the card behind, that card lifts and leaves in
  its turn, and the pile flickers down through itself. **A lifted card has to
  keep covering everything it covered.** Measured on a slow pointer sweep at 4px
  steps: seven backward steps before, none after.
- **The pointer can be trusted to the DOM here, and being exact about why is most
  of the design.** `document-pocket` had to hit test its own neutral geometry,
  because a card that moves in response to being hovered moves out from under the
  pointer, the hover drops, the card falls back, and it picks the pointer up
  again. Three properties close that off:
  - A hovered card's region runs from its own tab top to the next card's, and
    lifting it takes that top edge up and leaves the foot where it was. **The open
    region strictly contains the resting one**, whatever the pointer is doing
    inside it.
  - Nothing else on the stage moves at all, so **nothing can arrive under a
    pointer that is not already on it**.
  - So **the state settles in at most one step and cannot cycle.** Every position
    has a resting owner, which is the card whose shut strip holds it. A pointer
    inside the lifted card's grown region keeps it, and a pointer anywhere else
    lands on its resting owner, whose own region then contains it. There is no
    second card whose region could have moved in the meantime.

  Several states are stable for one position, since a lifted card's grown region
  covers the resting strips of the cards behind it, and that is hysteresis rather
  than ambiguity: it covers them on screen as well, so what is hit is what is
  drawn. Verified the way `document-pocket` verifies its own fan, by replaying one
  gesture at two sample rates: a pointer walked down the pile in 4px steps and in
  16px steps opens the cards in order both times, with no step backwards in
  either.
- **The hit region is the drawing, not the box, and that needs three declarations
  to say.** The card is `pointer-events-none` and its paper and its tab's fill
  path are `pointer-events-auto`, so the enter still reaches the button by
  bubbling. Left on its own box a card would answer for a 17px band of the card
  behind it across everything but the tab in it, since a tab's band is the card's
  own top strip and is transparent either side of the tab: the pointer would open
  the wrong folder wherever the box and the drawing disagree. An SVG path is a
  target only where it paints, so this also makes a pointer on a shoulder's curve
  belong to the card showing under it.
- **A panel is hidden unless its own card is out, and that is not belt and
  braces.** A card is covered by the card in front of it, so lifting card k
  uncovers the panel of card k - 1, which is 26px of a second record showing under
  the one being read. The hide is deferred by exactly the length of the travel,
  since a discrete property with a delay flips at the end of it, and the panel is
  back behind the card in front by then. The show is not deferred, because a panel
  at rest is already covered: that is what `PANEL_TOP` buys, and it is why a panel
  starts at `PEEK + TAB_H` from its card's top rather than a margin below the
  card's own edge.
- **The lifted card is the only one that can carry a shadow, and the only one
  that wants one.** A card's shadow paints in its own layer and every card in
  front of it paints above that layer, so at rest a shadow reaches nothing. A
  lifted card is in front of everything it overlaps, so its shadow lands on the
  cards behind and is what says it came out of the pile rather than being a gap
  in it. At rest the pile is line art, which is what paper flush in a drawer
  looks like.
- **It is the one lab of the recent set that does not reach for the `inverse-*`
  tokens.** `document-pocket`, `stamp-collection` and `book-opening` all had to,
  because in each of them the paper was the object and nothing in the light set was
  far enough from it. This pile does not have that problem: every card carries a
  full hairline outline, so the drawing is what separates the cards from the table
  and from each other, and the tones under it can be a step apart rather than a
  world apart. The table is `fill`, the case and the dividers are grey, and every
  folder is its own colour.
- **Every record carries its own hue, and this is the exception four other
  experiments already take.** Six cards are built from the same few parts, so the
  colour is what tells them apart and carries meaning rather than decorating. The
  values live in `motifs.tsx` beside the drawings, they are not tokens, and nothing
  else on the site may reach for them.
- **The hue is the folder, not the type.** The first version put a `mark` on each
  record's tab label and a wash behind its trace and left every folder white, which
  spends the colour on two small things and asks the type to carry it. A drawer of
  coloured folders is what a real filing set looks like, it is a far bigger
  expression of the same information, and it hands the labels back to
  `text-primary` where they read at 11 to 12:1 rather than at 5. Three values each:
  `paper` is the folder, `edge` its crease and hairline, `mark` the one saturated
  thing on it, which is the trace. **A panel is white on both kinds of card**,
  since a sheet of paper inside a coloured folder is what a folder holds, and it is
  also the ground a trace reads best on.
- **The papers are bright file folder colours: green, amber, sky, aqua, violet,
  coral.** Five sets came before them and every one was too quiet, so what is worth
  keeping is what quiet was made of. A wash at chroma 0.02 was fog, nine elements
  inside 12% lightness of each other, which is what `book-opening` and
  `document-pocket` each had to design their way out of. A generated set at one
  lightness and one chroma with the hues spaced evenly round the wheel is a system
  and not a palette, and even spacing is exactly what makes six colours read as an
  assortment: tuning that chroma from 0.02 to 0.09 and back to 0.045 never fixed
  it. An archival stock of sage, manila and dust blue is a lovely palette for a
  page that is not this one, where six greyed papers on a grey table read as dust.
- **Each hue is pushed to where it is clean rather than to a shared chroma**, since
  blue runs out of gamut long before yellow does and matching them flattens the
  yellow. **Chroma rather than lightness is what separates a folder from the
  ground**: the papers sit at 1.20 to 1.62 against the `fill` table and are the
  only things in the frame carrying any hue. `text-primary` still lands at 9.8 to
  13.2 on every one of them, so nothing here trades legibility for brightness.
- **A divider is white paper.** Grey was left over from the version where every
  folder was white, and among six bright ones it read as the one card nobody had
  updated. White is the unpainted stock a real index divider is cut from, it is the
  ground the group's hue dots need to read against, and it puts the dividers in the
  same family as the sheets inside the folders rather than in the case's.
- **The case is white paper**, like the dividers and like every sheet inside a
  folder. It went grey for one round, while the ground was white and a white case
  was the largest thing in the frame holding no colour. With the ground back to
  `fill` and the folders bright, grey was the wrong way round: it made the biggest
  object in the piece the dullest thing in it, a flat slab under a row of colour.
  White puts it in the paper family and leaves the table as the only grey.
  Measured: papers 1.32 to 1.78 on white, `text-primary` on one 9.8 to 13.2, edges
  1.30 to 1.59 on their own paper, and marks 5.0 to 7.0 on the white sheet, which is
  the floor for the divider legend that prints in them.
- **The case's top corners are square, and that is what covers the cut.** The last
  card has nothing in front of it, so its paper ends on the clip line as a flat
  edge with no border on it, and the case's top edge is that same line. Rounded,
  the corners curved away from the cut and left the raw edge hanging over them:
  measured, the case is 5.4px wider than the last card either side against a 14px
  radius, so the curve started 8.6px inside the card and the cut showed. A straight
  top edge spans the whole of it, and a drawer front is square where the cards go
  in anyway.
- **A divider prints the files it heads in their own hues**, so it reads as the
  legend for its group and each name matches the tab a few rows below it.
- **The filing line is `text-secondary`, not `text-muted`.** Muted measured 2.4:1
  on the wash the panel used to be and 2.5 on the white it is now, for the line
  carrying a record's number, its place and its length. This is 5.33.
- **One tab width for both kinds of card, and that is the lift's doing.** A lifted
  card lands three rows up, one turn of the cut cycle, so its tab lands exactly on
  the tab of the card it covers. That only reads as one tab if the two are the same
  size: at 148 against a divider's 108 the wider one poked out either side and its
  label showed through, which looks like a rendering fault.
- **A record's panel holds a drawn trace of what its note says**, on a time axis
  200 units long: a hedge with a train swelling through it, mud clicks under two
  gulls, rain, ice giving way and the water settling, wind with a bell struck over
  it, two guy wires three cycles against four. Three lines of type in a box is not
  worth opening a folder for. **The viewBox stretches and the strokes do not**:
  `preserveAspectRatio="none"` lets a trace fill a panel from 166px to 345px wide,
  which is right for a time axis and wrong for a hairline, so every shape carries
  `vector-effect: non-scaling-stroke`, set in CSS since the attribute does not
  inherit. Nothing is random at runtime either, the wobble is a hash.
- **A divider's tab is grey card stock with its group's hues on it, and it used to
  be solid near-black.** That was the reference's own treatment and it inverted the
  weight of the whole piece: a 96 by 17 block of `text-primary` was the heaviest
  thing on the stage by an order of magnitude, and a divider is structure, while
  the folders are the content and were the quietest labels in the frame. So the
  fill drops to `fill-active`, which is a stiffer stock than the paper around it
  and is what an index divider is anyway, the label goes to `text-primary` at a
  tenth of the ink the fill spent, and the tab carries one dot per record in the
  group in that record's own `mark`. It reads as a heading with its contents
  previewed on it, and each dot matches the tab a row or two below it.
- **A divider opens onto a wave, like a record does.** The group's tape as one
  waveform, shared out by length and coloured by the file each stretch belongs to,
  over a line saying the range, the count and the run time, which is summed from
  its own records and derived rather than written down. Four versions of this
  panel were lists first, a comma line, one name per line, two columns of coloured
  names, then chips, and every one of them restated the three tabs sitting a row
  or two below it. **A divider's sheet is `fill` rather than white**, since a white
  sheet on a white card is a hairline round nothing. Both kinds carry the same box,
  the same hairline and the same geometry, so an open card is an open card whichever
  it is, and only the fill knows what it is sitting on.
- **Corners are 12px, which is off the radius scale on purpose** and is the one
  value in the geometry that is a taste rather than a constraint. `rounded-lg` is
  6.4px, the site's own card radius and what the frame around this demo uses, and
  on a card 400px wide by 167px tall it reads as a square with the corners taken
  off. These are drawn objects rather than surfaces, the same standing
  `document-pocket` and `stamp-collection` give their own pixel geometry.
- **The reference is all mono and this is not.** Labels are the site's own face
  and mono marks a value: the filing number, the length, the file count. Same
  split `book-opening` makes for its readout, and the lowercase is the
  stylesheet's, so nothing here is written in caps.
- **A tab is a flat top on two S-curved shoulders, and there is no corner
  anywhere in it.** Each shoulder is one cubic with both control points on the
  midway x, which puts a horizontal tangent at each end: the shoulder leaves the
  card's own top edge along that edge and arrives at the tab's top along the top.
  A trapezoid with rounded top corners was the first version and it still had two
  hard angles where the slants met the card, which was the sharpest thing in the
  demo. The feet needing no join is also what makes it work at a hairline, since
  the stroke arrives tangent to the card's border and finishes on that border's
  own centre line: the tab's outline runs into the card's edge rather than landing
  on it.
- **The tab is two paths.** The fill runs two pixels past the card's own top edge,
  so it covers the paper's border where the tab crosses it, and the hairline stops
  on that border's centre line, so no shoulder overshoots into the paper. One path
  doing both jobs has to pick.
- **The case is not a member of the pile.** Nothing opens it, nothing moves it,
  and the cards are cut off at its top edge by a static clip rather than hidden
  behind it, so it is free to be as shallow as it looks. It carries no handler
  either: arriving on it is a card's own leave. The stage's own listeners are
  bound to the node rather than written as JSX props, the same call
  `document-pocket` and `stamp-collection` make for their stages, and `focusout`
  has to be heard there anyway since it bubbles.
- **A card shuts on its own leave, one frame out, and both halves of that are
  load-bearing.** Acting on the leave at once drops the pile back for the frame
  between leaving one card and entering the next, since those arrive in that
  order. A shut that waits a frame is cancelled by the enter before it can run,
  and a pointer that has really left the pile has no enter coming. Verified by
  watching every `aria-expanded` change through a crossing: the log reads 2, 3, 4
  with nothing between them.

  Not answering the leave at all is what shipped first, and it is worse than it
  sounds: **only the stage's leave shut the pile, so a lifted card held its state
  across the whole stage**, including the band of bare table above the shut pile,
  which is a third of the frame. A pointer wandering anywhere in the demo kept a
  card up. The stage's own leave still shuts at once, since nothing is going to
  take it.
- **`text-left` on the card is load-bearing**: a `<button>` centres its own text,
  and a filing card's lines all start at its left margin.
- **One panel height for both kinds, and it is the number the stage is built
  on.** The stage carries a lift at both ends, so every pixel of panel costs two
  of frame: taking it from 100 to 76 is what dropped the lift to three rows and
  the stage by 32px, and it is why the pile went from 53% of the frame to 60%. The
  whole geometry then went up a notch, so those numbers now read 84 and 36. A
  record spends the 84 on a filing line, a 28px trace and a caption. **The place
  rides the filing line rather than the caption**, since a caption and a place on
  one row run past the panel at the narrowest column, and a note is at most 26
  characters so it stays on one line at every width.
- **A divider's legend is two columns**, which is the same panel doing a different
  job. One file to a line is a row taller than a record needs, and the panel is
  sized by the record; a comma list fits and leaves the box half empty on a wide
  column. Measured at 900, 430, 360 and 320px: nothing in a panel overflows it,
  and no panel shows a pixel of itself at rest.
- **The cards are 0.80 to 0.96 of the stage wide.** They were 0.70 to 0.94 and
  the drawer read as a small object in a big room: a stage this tall can only be
  filled by a pile this wide. 0.96 keeps the case clear of the frame's own radius
  at every width, and the extra room goes into the panels, where a caption gets
  194px at the narrowest column against 166.
- **The pile deals itself in on arrival, one card behind the next, back to front
  with the case last.** `Reveal` brings the whole demo in on the page's own
  stagger and this is the same idea one level down: a 0.4s fade, 55ms apart.
  **A fade and nothing else.** The site's own reveal variant pairs one with a rise
  and a blur, and on eight cards arriving in sequence that reads as the pile
  assembling out of focus rather than as cards being dealt. The keyframe is
  `folder-in` in `globals.css`, it touches `opacity` alone, and **it names no
  transform**, since `transform` is what carries a card's lift and an animation
  outranks a normal declaration: naming it there would swallow a hover that landed
  inside the first second. All
  of it sits behind `motion-safe:`, since `MotionProvider` governs Motion's own
  animations and never a raw keyframe, and with the animation gone every card is
  simply present, because the keyframe carries the `opacity: 0` rather than the
  element. Measured: the cascade runs 0 to 0.44s of delay, and under the setting
  `animationName` is `none` with every card at opacity 1 on the first frame.
- **A trace draws itself in from the left as its card comes out**, on a
  `clip-path` sweep rather than a dash offset, since half of these motifs are
  forty separate lines and a dash only reveals a path. Linear, because what it
  stands for is a tape running at one speed where everything else here
  front-loads, and 340ms against the card's own 200 so it is still arriving after
  the card has settled.
- **It draws once and stays drawn.** A card the pointer has already opened has
  nothing left to reveal, and replaying the sweep on every return reads as the
  panel reloading its own contents. So the clip is keyed off whether a record has
  ever been open rather than off whether it is open now, which also means nothing
  has to defer to the panel's hide: the clip no longer moves when a card drops.
  The id is added from an effect rather than from the four handlers that can open
  a card, and that extra commit is what gives the sweep a frame to start from.
  Measured: 84% clipped at 120ms, 30% at 200ms, drawn at 420ms, still drawn after
  a close, and no second sweep on the way back in.
- **The case carries a label plate rather than bare type**, so it reads as the
  front of a drawer and not as the box left over under the pile. A hairline pill
  rather than the site's filled one, since nothing there is pressable and a
  `bg-fill` pill on white paper is what a button looks like.
- **Which of the two gestures a pointer gets is a test for a hovering pointer,
  never a test against a finger.** `tab-overview` reads `pointerType` rather than a
  `(hover: hover)` query, since the query answers for the device and a laptop with a
  touchscreen reports true for both, and what neither says is what to do with a
  pointer naming itself neither: `""` is what a browser sends when it does not
  know, and `!== "touch"` hands that one the hover path on a device with no way to
  take a hover back. So `mouse` and `pen` hover and everything else taps. **On a
  phone this experiment is taps and nothing else.**
- A tap is heard on `pointerup` and a key press on `click` with `detail` of 0,
  both `book-opening`'s calls, and focus alone opens a card.
  - **A tap is `pointerup` rather than that click, and the reason is slop.** A
    finger drifts, and a tap that drifts far enough is a scroll: the browser
    cancels the pointer and sends neither a `pointerup` nor a `click`, which is
    the right answer, since what was asked for was the page to move. Inside the
    slop both arrive and `pointerup` is the one carrying the pointer's type.
    Measured on this stage: a 12px drift opens the folder, a 40px drift lands
    `pointercancel` and changes nothing.
  - **A tap on the bare table shuts whatever is open**, which is the touch half of
    the pointer's own leave, since a finger has no leave to be heard: it stops
    existing when it lifts. `stamp-collection` makes the same call for its table,
    and the same test tells a miss from a hit, the event's own target. A card's
    paper and its tab are the only things on the stage that take a pointer, so
    anything not inside a button is the table. A swipe never reaches it, being
    cancelled rather than lifted, so scrolling past the demo cannot shut a card.
    The case counts as table, which is what tapping the front of a drawer should
    do.
  - Verified on a 390px phone: tap opens, a second tap on the same card shuts it,
    a tap on another switches, a tap on the table shuts the pile, and a mouse
    moved across the stage on that same viewport still hovers, since the gate is
    the pointer and not the width.
- Reduced motion drops the travel and keeps the opening, and **all three of the
  transition's properties sit inside `motion-safe:`**: without the duration in there,
  `transition-property` keeps its initial value of `all` and reduced motion gets a
  200ms transition on everything instead of none. Verified: `0s` under the
  setting.

### `window-shade`

A cabin window with a shade drawn down by hand, and a cabin that goes dark as it
comes. `window.ts` is the geometry and the palette, `view.tsx` what is outside,
`index.tsx` the stage, the gesture and the frame loop.

- **One inherited property drives the panel and the whole palette.** The stage
  carries `--shade`, a plain number from 0 to 1, written once per frame. The
  panel's `translate` is that number times its own travel, and every tone on the
  stage is `color-mix(in oklab, <light token>, <inverse token>, that number)`.
  Same claim `book-opening` makes about its fourteen sheets, one level up: there
  one property carried the transforms, here it carries the colour as well.
  Nothing in the component renders while the shade moves.
- **So the theme is a position rather than a state.** Half way down is a place a
  reader can stop, and the whole stage reports it. That is also the only reason a
  deliberately light-only site has anything to say here: the two ends are the
  site's own `--color-*` and `--color-inverse-*` sets, so the lab invents no
  colour and the page around it never changes. See the `inverse-*` note in Colour
  tokens.
- **`oklab`, not the default `srgb`.** A straight sRGB ramp from a light grey to
  near black is already dark for most of its travel and lurches at the end.
  Measured, the wall's oklab lightness runs 0.967 at rest to 0.145 closed, and
  half travel lands at 0.556.

**The drawing: line art, with light as the one exception.** The first build was
a render of a plane window, which is what the reference is: a gradient bezel
under three stacked drop shadows, a recess made of two more, a photographic sky.
All of it is gone.

- **Structure is flat fills and a hairline where two faces meet.** The hairline
  is an `outline` rather than a ring so an inline `boxShadow` cannot overwrite
  it, and every one carries a negative offset, so it paints on the face it
  belongs to rather than on the wall. That is also why it needs no flip: on the
  bezel it is 1.30:1 open and 4.6:1 closed.
- **Four things are still soft, and they are all light**: the pool on the wall,
  the falloff away from it, the bloom under the panel's foot and the leak round a
  seated one. Light is soft, so it is drawn soft, and nothing else on the stage
  is. Same call `folder-stack` makes when it gives exactly one card in a pile a
  shadow. The pool's wide layer was 0.42 over 58% and read as a halo tight enough
  round the bezel to be the drop shadow the redraw exists to remove.
- **The wall is `fill` and not `fill-active`, and the redraw is what allows
  it.** The darker ground was `book-opening`'s call for its table and it was
  right while this was a render: the bezel is white, and separating it from the
  wall was a job only tone could do. With every face carrying a drawn hairline
  the drawing separates them, so the wall can be the quiet ground `folder-stack`
  uses and sit a step closer to the white page the frame is on, where the heavier
  grey read as a slab dropped onto it.
- **The view splits by distance: air is soft and objects are drawn.** The first
  pass over-corrected the reference's render into flat plates with hard stops
  everywhere, which reads as a chart of a sky rather than as one. So the sky's
  steps blend, the cloud has no edge anywhere on it and the sun carries a bloom,
  while the horizon is a hard line and the wing has a hairline round it, since it
  is the one thing out there near enough to have an outline. The sky keeps its
  band structure through all of that, so the panel still has values to travel
  against and only the transitions between them soften.
- **One field of sky and then a graduation, not equal stripes.** Evenly spaced
  bands at evenly spaced values is a test card, which is what an earlier pass
  was. The top fifth is one colour and the steps compress downward, which is what
  haze does.
- **The horizon is at 0.46 and the lower half is what is under it**, which is
  where a seat actually looks. It was at 0.70 with the cloud straddling it, and
  that put every cloud in the palest part of the sky, where a white shape has
  nothing to be seen against: the deck was there and invisible. Below the horizon
  the ground haze is a mid blue, so the same cloud reads without being drawn any
  harder. The haze holds to 45.4 and the ground starts at 46, about a pixel
  apart, and that is the one hard edge in the drawing, since a horizon is where
  the air stops. **The glass takes it back**, since the whole view sits behind
  the blur: what a reader sees is a hard edge through a hazy pane, which is what
  a horizon out of a cabin window is.
- **The cloud is `feTurbulence`, and it took three tries to get there.** It was
  overlapping ellipses, hard-edged and then soft-edged, and a lump is a lump:
  four white ovals in a row read as a cartoon at any falloff, which is what made
  the whole view look like clip art. Cloud is not made of ovals, it is made of
  turbulence, and there is a turbulence generator in every SVG filter. One
  `feColorMatrix` after it throws the colour away and keeps a biased slice of one
  channel as alpha, which is what turns a grey field into cloud and clear air:
  the slope is the contrast and the bias is how much sky is left between. **The
  frequency is anisotropic, lower across than down**, since a deck seen at a
  shallow angle is stretched along the line of sight and equal frequencies give a
  field of round puffs, which is the cartoon arriving by another door. The
  vertical fade lives inside the tile rather than in a CSS `mask-image`, so the
  whole deck is one rasterised image and the drift costs no filter work per
  frame.
- **The sun is a bloom with no disc in it**, for the same reason and because it
  is also what is true: the sun through two panes of acrylic at altitude is far
  too bright to hold an edge. Near-white rather than yellow, since only a low sun
  is warm.
- **A vignette and a film grain over the whole pane.** A photograph through a
  window has darker corners and noise in it, and a drawing has neither. The grain
  ties the sky, the cloud and the wing into one image rather than three layers.
- **Everything beyond the glass sits behind one blur, and that is what makes it a
  window rather than a picture.** A view drawn this precisely competes with the
  panel that is the actual demo, and it is a lie besides: the inner pane of a
  cabin window is scratched acrylic, so nothing out there is ever sharp. At twice
  the value it carries, the wing was an unreadable smudge and the horizon had
  dissolved, which is a window with nothing out of it rather than a window you
  cannot focus through. The wing then wanted a second tonal step, since a blur is
  a contrast reduction and that is the one thing in the pane which still has to
  read as solid.
  - **The blur is on the outside alone.** The sheen, the vignette and the grain
    are the glass and the lens, which are the two things in the frame that are in
    focus. Grain especially: it belongs to the film plane and not to the subject,
    so a sharp grain over a soft image is what a photograph looks like.
  - **The blurred layer overhangs the pane on every side, and that is not
    padding.** A filter samples transparent outside its own element, so without
    it the sky goes clear against the pane's border all the way round and leaves
    a soft halo of the recess showing through. Twice the radius covers it, since
    a CSS blur's visible reach is about 1.5 times the value it is given.
  - The wing's SVG sits back at the pane's own box inside that overhang, so its
    viewBox keeps the pane's aspect and it is not letterboxed, and it is
    `overflow-visible` so its own paths run out into the overhang instead.
- **The glass highlight is one soft band and low.** At 0.15 with hard edges it
  was a pair of shafts crossing the wing and it owned the view, which is what a
  highlight does when it is the sharpest thing in a frame of air.
- **The wing reads by tone, not by outline, and that was the last cartoon in the
  frame.** A flat plate with a dark line round it is clip art whatever shape the
  plate is. A wing at cruise is a ramp from a lit leading edge to a shaded
  trailing one with a hot line along the very front, so that is what it is, and
  the outline drops to a faint edge that only holds the silhouette where the
  tonal contrast runs out. The ramp then had to go a step darker once the cloud
  became a real cloud, since against a white deck a pale wing is a ghost and this
  is the one thing in the pane that has to read as solid. It is shallow and it
  tapers, and both were wrong first: at 26 degrees on a near-constant chord it
  read as a blade laid across the window.
- **The panel is a plain rectangle that starts above the pane, and both halves of
  that are one correction.** It was inset by its clearance on all four sides,
  which put a strip of sky above it, and that strip is only ever uncovered at the
  instant the panel seats: at every other position the panel's own top edge is
  above the pane. So the head of the window stayed dark through the whole travel
  and lit in a single frame at the end, which is nothing a shade does. There is
  no sky above a shade at all, since it comes down out of a slot, so the leak is
  the sides and the foot and that is the whole of it. Squaring it follows: with
  the head above the clip and the foot cut back to the pane's own curve, no
  corner of this panel is ever on screen, and a rectangle in a rounded aperture is
  what a shade is anyway. Measured seated: the head overhangs by 1.89px where the
  sides and the foot each keep 1.89px of clearance. A rounded foot was also wrong
  for its own reason, reading as a blob sliding down rather than as an edge.

**The cabin and the scale.** The window sits off centre at 0.37 of the stage and
is 0.62 of its height rather than the 0.68 it started at, and both numbers are
the wall's doing: at 0.68 there was nowhere to put a panel joint that did not
land on the frame's own edge, and centred there was nowhere for the scale to be.

- **A joint is a groove, so it is drawn as one: a shadow on one side and a lit
  lip on the other, never a tone.** This is the one line on the stage that
  escapes the flip below, and the reason generalises. A tone crossing dark to
  light has to pass through the ground crossing the other way, and it is not a
  matter of picking better endpoints: with the best pair the tokens offer,
  solving `0.689 - 0.454t = 0.967 - 0.823t` puts the meeting at t of 0.76 and the
  seam simply is not there. A groove has the shadow carrying it on the light
  wall, the lip carrying it on the dark one, and both faintly through the middle,
  which is what a groove in a half-lit surface looks like. Measured against the
  wall, shadow then lip: 1.22 and 1.01 open, 1.00 and 1.35 closed, 1.17 and 1.14
  at the flip. That is the shared rule about shading with light rather than
  palette, arriving at a case the palette cannot solve at all.
- **The scale spans the panel's exact travel**, from its foot when stowed to its
  foot when seated, both derived from the geometry rather than placed by eye, so
  the marker rides the edge it is measuring. **Its two ends name the tokens the
  wall is mixed from**, and it derives them from the wall rather than restating
  them: they said `fill-active` for one build after the wall had moved to `fill`,
  which is the drift a derived value exists to stop. It is the move
  `book-opening` makes when it prints its own lerp on the cover it is turning.
- **Every length is `cqw` and the `container-type` is on the stage alone.** So
  nothing is measured in JS and the window holds whatever the column is. An
  element is a query container for its descendants and never for itself, the trap
  `document-pocket` documents at length. Each radius is the bezel's minus the
  inset that box sits at, which is what concentric rounded rectangles are:
  scaling a radius with its box leaves the gap between two edges wider at the
  corners than along the sides.

**Text is the one thing that cannot interpolate, and it flips.**

- A colour crossing from dark to light passes through the ground it is sitting
  on, and the ground is crossing the other way at the same time, so the two meet.
  `text-secondary` and the wall are the same value at half travel to a rounding
  error, and even `text-primary` against that wall is 3.2:1. So the ink steps
  over 0.04 of travel, at the point where the two sides are least unequal.
  **That point moves with the wall**, and it did move when the light end went
  from `fill-active` to `fill`: setting the two contrasts equal solves for a wall
  luminance of 0.196, which the lighter ramp reaches at 0.47 rather than at 0.42.
  Both sides then measure 4.1:1 for the width of one drag frame, against 15.8:1
  open and 19.0:1 closed. The step is derived from `--shade` in CSS rather than
  decided in JS, so one number still drives everything.
- **How much a flipping tone keeps at the crossing is decided by how far its
  endpoints sit from mid grey and by nothing else, so a hairline may be quiet and
  a word may not.** The scale's labels had a quieter pair of their own,
  `text-secondary` to `inverse-text-secondary`, which measured 4.0 and 6.1 at the
  ends and 1.3 through the flip: a quiet tone has nowhere to be. Everything
  typographic takes the same ink as the readout now, and only the rule and its
  ticks stay quiet, since a hairline at 1.5:1 is still a line.
- **The focus ring is the same argument from accessibility, and it is why this is
  not the project's own focus pattern.** That pattern pins a colour,
  `ring-text-primary/15`, which composites to a 1.1:1 step on the open wall and
  is a near-black ring on near-black at the other end, and Tailwind's ring also
  paints a 2px offset in `--tw-ring-offset-color`, which defaults to white, so
  the closed cabin would carry a bright band round the control. It is an
  `outline` at the same width and offset in the flipped ink. The rule this bends
  says never to use a *weaker* ring than the declared one, and this is stronger
  at both ends.

**The gesture.**

- **Grab and pull, not aim and jump, which is why this is not a native `range`.**
  The signature player's scrubber is one and the shared rules would point at
  another, but a range moves its thumb to the click and a shade that leaps to
  meet your finger is not a shade. So it is `role="slider"` with the keys spelled
  out: arrows, page keys, Home and End, plus Enter and Space to throw it.
  `aria-valuenow` and `aria-valuetext` are written beside `--shade` rather than
  rendered, or a drag would be a state update per frame.
- **A release leaves the panel where it was let go**, which is what a real shade
  does and is what makes the crossing a continuum. Only a press that travelled
  less than 4px is read as a throw to the far end.
- **What holds the closed state is a gap, not an effect.** The panel is inset
  from the pane by the clearance it needs to slide at all, so a seated shade
  leaves hairlines of daylight down its sides and along its foot, and that is the
  brightest thing in the frame exactly when the frame has nothing else. The glow
  over it is only the scatter off that gap: it was 3.4cqw at 40% first, which lit
  the panel from its own perimeter and read as a screen rather than as a leak,
  and it carries a small negative vertical offset, since an inset shadow then
  reaches further at the foot than at the head, which is the shape of the gap it
  stands for.
- **`touch-action: pan-y` on the control and `none` on the grip alone.** The
  window is most of the stage on a phone, so a control that took the whole
  gesture would trap a thumb scrolling past the demo. **On touch the panel is
  therefore pulled by its grip and thrown by a tap anywhere else**, which is what
  a real shade offers too and is why the grip is drawn at all. That region is
  sized for the trade rather than for the drawing: the grip is 12px on a 390px
  viewport and its hit region is 30. A touch that becomes a scroll is cancelled
  rather than lifted, so it never reaches the release and never counts as a tap,
  which is `folder-stack`'s slop arriving from the browser instead of measured.
- `cursor-grab`, the third place the shared "cursor-pointer on every clickable
  element" rule is off, after `tether-button` and `event-stacking`.
- **A cloud deck is one tile repeated, and the element is twice the pane wide.**
  So travelling half the element is travelling exactly one tile and the loop has
  no seam, **and that holds whatever the element's width is**, which is what lets
  a deck overhang the pane for the blur: at `left: -B` and `200% + 4B` wide its
  right edge finishes the cycle a clear `B` past the pane rather than exactly on
  it, so neither edge is ever inside the filter's reach. **`stitchTiles` is what
  makes the noise itself wrap** at the tile's own edge, which replaced the
  hand-placed duplicate lumps the ellipse version needed to hide the straight
  vertical cut that slid past once per loop. The keyframe is `cloud-drift` in
  `globals.css` and carries no numbers of its own.
- **The two decks run at a 2.8 ratio, not a 1.7, and both are quick enough to
  see.** Parallax is the whole reason there are two, and closer together they
  read as one thing moving rather than as depth. At 96s and 34s the near deck
  covers about 4px a second on a wide column and the far one 1.3, which is
  measurable rather than guessed: sampled 3s apart, 4.41% of the element against
  1.56%. **Each deck names its own duration inside the same `animate-[...]`
  utility**, since that compiles to the `animation` shorthand and would reset a
  duration set beside it in `style`, which is `disc-spin`'s trap from the other
  side. `motion-safe:` sits on that utility, so under the setting no animation is
  applied at all.
- Reduced motion still opens the shade and still crosses the cabin, which is the
  demo. It just does not travel, the line `book-opening` draws. Verified: the
  first frame after End reads 1.0000 and both decks report `animation-name: none`.

### `rain-splatter`

A painting that makes itself, and the first experiment on the site with a
panel of numbers under it.

- **The stage is two canvases and that split is the whole design.** One is
  cleared every frame and holds what is moving, the other is never cleared and
  holds what has landed. A mark is drawn onto the second exactly once, at the
  moment it is made, and then it costs nothing for the rest of the demo, which
  is what lets the piece accumulate thousands of marks on one clear and a few
  hundred small fills a frame. **Do not rebuild it as one canvas redrawn from a
  list.** That version gets slower the longer it is watched, and it is also
  wrong: two overlapping opaque marks have an order, and the order is when they
  landed, which a redraw from a list has to store and replay.
- **The floor is a plane in perspective, not the bottom edge.** Every drop picks
  a depth on arrival and that one number sets four things: where it lands
  between the horizon and a little past the bottom edge, how big it is, how hard
  its own gravity pulls, and how much its splash is foreshortened. Take the
  perspective out and every splash reads as a sticker on a wall.
- **Nothing in a splash is authored.** A landing throws specks on a heavy-tailed
  speed curve, each one hops on its own gravity and drags across the floor, and
  what it leaves on landing is decided by the speed it has left: slow beads into
  a dot, flat and fast skids into a stroke pointing back at where it came from.
  Every ray in the piece is that one rule.
- **The spread on the throw height is the control that decides what the whole
  thing looks like, and both ways of getting it wrong look nothing like rain.**
  Height is airtime, airtime is how long the drag has to work, so a speck thrown
  high comes down slow and beads while the same speck thrown flat comes down
  fast and skids. Rolling it so most specks go flat makes every splash a
  dandelion with no body in it. Taking the length off the distance flown instead
  of the landing speed does the same thing, since drag is gentle here and nearly
  everything covers enough ground to earn a ray that way. It is a squared roll,
  which sits near zero most of the time, so most of a splash goes up and about
  one speck in seven comes down still moving.
- **A drop is drawn from its leading edge, stretched back along its travel.** At
  these accelerations a drop covers around 20px between two frames at 60Hz, so a
  round one paints as a dotted line however smooth the arithmetic under it is.
  Drawing from the tip rather than the centre is what keeps the splash on the
  frame the drop actually reaches the floor: from the centre it either punches
  through or fires a body length early. It also enters the frame already moving,
  since it has been falling for as long as it took to get there.
- **The fade is spent in whole steps because a canvas holds 8 bits a channel.**
  An erase at an alpha under about 1/255 rounds to nothing, so the oldest
  splatter never leaves and the layer silently stops fading. The world owes
  itself a fade and pays it in 3% steps, which is one `fillRect` every few
  frames and cannot round away. `destination-out` rather than a wash of the
  ground colour, so the layer stays transparent and the marks fade toward
  whatever the stage is painted rather than toward a second copy of that value.
- **The panel is closed by default, behind a `tune` pill in the bar.** Six
  lanes under the stage read as a form with a painting on top rather than a
  painting with a panel under it, and no amount of spacing fixes that: the
  problem is the count, not the gaps. Grouping the six under two names was
  tried and works, at the price of a strip taller than the thing it controls.
  A disclosure costs nothing at rest.

  **The bar sits above the lanes, not below them**, which is what makes the
  disclosure work. The pill does not move when the panel arrives and neither
  does the stage: the component grows from the edge nobody is looking at.

  **The collapse is a grid row going `0fr` to `1fr`** with the panel inside an
  `overflow-hidden` child. It animates to a height the browser works out, with
  no measuring, no ref and no resize handling. `max-height` needs a number
  nobody can write correctly at three column counts, and a height in JS is a
  measurement that goes stale on the next reflow. The padding lives inside the
  collapsing box, so a shut panel is genuinely zero pixels rather than zero
  plus a gap, and the transition is `motion-safe:`.

  **`inert` while shut, and it is not optional.** A `0fr` row is invisible and
  its six range inputs are still in the tab order, so without it the first Tab
  past `reset` lands on a slider nobody can see. Verified: with the panel shut
  the order is stage, running, tune, clear, reset, and then out of the demo.
  `aria-hidden` alone would not do it.

  **The trigger holds its hover while it is open**, through `aria-expanded:`
  classes on the quiet pill, which is the site's rule for anything that opens
  something. They are inert on the pills that open nothing, since the variant
  selector only matches a button carrying the attribute.
- **The affordance is a preview, not a cursor.** A crosshair says the surface
  answers a pointer, says nothing about what the answer is, and is invisible to
  a touch reader. The stage draws a reticle instead, a ring at the size of the
  splash a press would make at that depth, so moving up the stage shrinks and
  flattens it and the perspective explains itself before anyone commits. It is
  drawn on the live layer and never touches the paint.
- **The stage is a `<button>`, not a div carrying `tabIndex` and
  `role="application"`.** That pairing is what a first build reaches for, and
  biome rejects it on sight for the right reason. A button is focusable,
  focus-visible and activated by both Enter and Space natively, and it swallows
  Space because it is a button rather than because a `preventDefault` in a demo
  took the page's scroll key. Keyboard activation arrives at `onClick` with
  `detail` 0, which is what separates it from the pointer path that has already
  served its own press. The arrows aim, Shift is the fine step, and the first
  arrow places the reticle rather than moving it, since a reader who has just
  tabbed in has no idea where the aim is.
- **`block` on that button is load-bearing.** A button is inline-block, an
  inline-block sits on the text baseline, and the descender's worth of `bg-fill`
  it leaves shows up as a seam between the stage and the hairline under it.
- **The transport leads and the housekeeping follows.** `running` is the filled
  dark pill the signature player's transport uses, `clear` and `reset` are quiet
  ones. All three were the same pill, so the control that runs the piece looked
  like the one that restores six defaults. The quiet pill carries its hover on
  the text rather than on the fill: `bg-fill` to `bg-fill-hover` is 1.04:1,
  which is a step that exists in the token table and not on the screen, while
  `text-secondary` to `text-primary` is 5.28 to 15.4. The background step stays
  under it in the documented order, supporting rather than carrying.
- **The six are six numbers, and that does not reopen the mode selector rule.**
  The site's answer to a mode is one control whose label is its current value,
  which `book-opening` documents and which the transport here still follows.
  These are continuous ranges with nothing to swap between, so each gets a lane,
  its own live readout and the native `range` behind an inert track, the same
  build as the signature player's scrubber. The number takes `text-primary` and
  the label `text-secondary`, which is the way round it has to be: the label is
  a fixed word and the number is the thing under the hand. It also separates the
  two kinds of number in the strip, since what the piece reports about itself
  stays `text-muted` in the row below. The range carries `rounded-full` for the
  focus ring alone, or the ring is a hard rectangle around a fully rounded track
  and the only square corner in the piece.

  **The lane is `spray` and the readout is `specks`.** Both were `specks`, one
  row apart, one meaning how many pieces a splash throws and the other how many
  are in the air. One word cannot do both.

  **The gutters between lanes are wide on purpose.** A lane is a label, a number
  and a track, so three across the column put nine things on one line, and at
  0.8 scale, where a step is 3.2px, the gaps that look tidy are the ones that
  leave a readout closer to the next lane's label than to its own track. The
  column gutter is what says which number belongs to which word, so the strip is
  spaced like a form rather than like a toolbar.
- **Nothing in the loop re-renders.** The settings live in state because the
  sliders read them, the loop reads a ref mirroring that state, and the two
  counts under the panel are written straight to their nodes. A drag on a slider
  changes the physics from the next frame rather than after a respawn.
- **The loop stops when the stage is off screen.** This is one block on a page a
  reader scrolls past, and rain falling into a canvas nobody is looking at is a
  fan spinning for nothing. `requestAnimationFrame` covers the hidden tab on its
  own. `dt` is clamped at 50ms for the frame after a stall, which at these
  accelerations would otherwise put every drop through the floor in one step.
- **A resize copies the paint layer out and draws it back.** Writing either
  dimension of a canvas wipes its bitmap, which is what the live layer wants and
  what the paint layer cannot have.
- **The stage starts on clean paper, and `seed` has exactly one caller.** The
  piece is the filling, so a canvas that arrives already painted gives away the
  one thing anyone came to watch, and it fills on its own inside a second. An
  earlier build seeded seven splats into every first frame and it was wrong for
  that reason.

  Reduced motion is the exception, and gets the piece as a picture: paused, with
  eighteen splats behind it, since nothing is going to fall there at all. The
  seed is the same simulation with no time passing, so what is on the paper is
  what would have landed had you watched it arrive. The play control still
  works, since the preference is about what starts on its own.

  It is called from two places for one reason: the preference has to have
  resolved and the stage has to have a size, either can be last, and whichever
  arrives second does the work.
- The one thing on the stage that is not physical is that a sixth of every
  splash is thrown in another ink. A real cluster of this many colours is many
  splats layered over hours, and at any rate a demo can run at, that layering
  never happens.

### `sticker-peel`

Five die-cut stickers loose on a board. Press one and pull, and the paper under
your hand folds back over the rest of itself so what is on top of the sticker is
the back of the same sticker. Keep pulling and the last of it lets go, after
which it follows the hand with the fold trailing behind and lies down flat
wherever it is dropped. `peel.ts` is the fold, `motifs.tsx` the five stickers,
`sticker.tsx` one of them, `index.tsx` the board and the frame loop.

- **The fold is a reflection, and a gesture is one direction and one number.**
  Mirroring the sticker across a crease square to the peeling edge and half the
  peel in front of it carries that edge exactly onto the hand, which is what a
  fold is: the paper behind the crease is the same paper, seen from behind,
  standing in front of the crease. Advance the number and the crease sweeps
  across on its own. Nothing here interpolates a peel or keyframes one.
- **One polygon clips both layers, and that is the whole of the drawing.** The
  face is clipped to the half of the board the sticker still lies on, so the
  peeled part stops painting where it left. The flap is that same sticker
  reflected and clipped to that same half, because a reflection carries the
  peeled half exactly onto it, so clipping the mirrored sticker there gives back
  its image with nothing left over. Two layers, one clip, and no second clip to
  keep in step with the first.
- **Sharing that clip means a flat sticker has to be handed the whole of itself
  back, and forgetting it is a bug with a very quiet tell.** When the peel closes
  the flap is hidden and nothing looks wrong, so the polygon was left holding the
  last crease and the face stayed silently cut along it for the rest of the
  session. What it looks like is a sticker that keeps a sliver of itself missing
  where it was dragged from, which reads as a rendering fault rather than as a
  clip. `UNCUT` is written back on the same frame the fold goes away.
- **The clip, the shadow and the matrix are three nested groups rather than
  three attributes on one.** A filter and a clip on one element are applied in an
  order the engine decides, and the shadow has to be cast by the reflected
  drawing and then cut at the crease, in that order. Nesting says so.
- **The peel runs from an edge, never from the point that was pressed.**
  Anchoring it at the press is the obvious build and it is exact: it reads
  correctly for a corner and is nonsense for the middle, where the crease is the
  bisector through the sticker's own centre and half of it folds on the first
  millimetre, leaving a sliver on the board. An edge is also what actually gives,
  since a sticker dragged one way lifts from the other. `EDGE` sits a shade
  outside every silhouette in the set, so a peel of nothing has its crease clear
  of the paper.
- **That edge is picked once a gesture and then held, and this is the difference
  between a sticker and a trick.** Deriving it from the pull every frame is what
  a first version does, and it is wrong in the way that matters: a sticker
  carried across the board turns as the hand does, so the lifted corner hops from
  one side of it to another every time the drag changes direction. A corner that
  has come up has come up. Verified across two hard turns mid-carry: the crease
  normal holds at the same three decimal places it was armed with.
- **It is armed at 5 units of pull rather than at the first pixel.** The edge is
  the pull's own direction, and at a pixel of drag that direction is whichever
  way the hand jittered.
- **One vector is the whole input and it arrives from three directions.** While a
  sticker is stuck its body cannot move, so the gap between the hand and the
  press is the whole of the pull. Once it is off the board the body chases the
  hand, so the same gap becomes the body's own lag. Once it is let go the gap is
  a value decaying to zero. What reaches the crease is that gap's component along
  the frozen edge, so a drag that veers off it advances the peel more slowly and
  one that comes back does not advance it at all.
- **Which way the peel may move is three lines, because a peel is three
  situations.** Stuck under a hand it only opens, since adhesive does not
  re-stick when a hand relaxes. Off the board under a hand the paper is free to
  relax, so it eases to `CARRY` or to whatever the drag is adding, whichever is
  more. Let go, it eases shut. Without that floor the carried curl is the lag
  alone, which goes to nothing every time the hand turns a corner, and a flap
  that shuts and opens on every turn is the thing a frozen edge was for. Without
  the relax it stays at whatever pulled it off, which is most of the sticker and
  hides what is printed on it for the length of the carry.
- **A travelling sticker wants the distance it still has to cover, and only a
  stuck one is special.** That one rule covers a carry, a landing and an arrow
  key without knowing which of the three it is, and it is why holding an arrow
  down builds a real peel: the target keeps running ahead of the body, so the lag
  stops being a flick and becomes a pull. Handing the keyboard its own peel
  instead was the first build and it is two behaviours where there is one.
- **So placing one is not a drop and then an unfold.** Releasing changes nothing
  except that the hand stops being written. The body finishes arriving where it
  was already heading and the flap closes over it on the way, and the two read as
  one movement because they are one movement.
- **The pull is eased rather than set, even while the hand is on it, and that is
  the one place this stops being geometry.** Adhesive gives way, it does not
  teleport. At 45ms the crease is a frame or two behind a fast drag and exactly on
  a slow one, and it is also what keeps the moment a sticker comes free from being
  a jump, since the same value simply stops being the pull and starts being the
  lag.
- **The flap's own shadow is tight and faint, and it was neither.** A lifted
  sticker already carries a shadow, and the flap is part of that silhouette, so a
  flap given a full drop shadow of its own is shadowed twice and what lands on
  the face is a dark band along the crease rather than a fold. This is a sheet of
  vinyl a fraction of a millimetre off the paper under it: a line of contact, not
  a cast.
- **The board stays light, which is what makes this one different from its four
  neighbours.** `document-pocket`, `stamp-collection`, `book-opening` and
  `folder-stack` all had paper as the object, and paper on a white page is the fog
  those sections each document. Vinyl is not paper: the face is saturated, the
  only white on it is the die cut and that carries its own hairline, so the ground
  can be the quiet `fill` `folder-stack` uses.
- **The backing is warm rather than white for the same reason, and it is one
  material for all five.** A flap spends half its life overhanging onto the board,
  where a paper-white one is invisible, and the darkest fill token is
  `stroke-strong` at 86% lightness so there is no light answer to reach for. It
  sits at 1.31:1 on the board, inside the 1.20 to 1.62 band `folder-stack`'s
  papers hold, and like those it carries a full hairline, so the drawing separates
  it and the tone does not have to. Making it the same for every sticker is what
  lets a flap read as the back of a sticker rather than as another face, and the
  print bleeding through at 14% is the only thing on it that says which one.
- **Every sticker carries its own hue, which is the exception five other
  experiments already take**, since five shapes built from the same few parts
  need colour to tell them apart. Three values each: the vinyl, the lit end of
  its gloss and the cut edge, plus whatever is printed on it. Measured: a print
  clears 3.7 to 6.9 on its own face, which is the floor a meaningful graphic
  needs, and a cut edge clears 3.4 to 8.5 on the white die cut it draws round.
  The amber is the one that had to be deepened, since a bright yellow face is
  1.8:1 on the board and its edge was doing all the work.
- **The board carries a printed dot grid, which is texture rather than
  information.** What it buys is that every white edge on a sticker reads by
  interrupting it rather than by its own tone.
- **The face is the die cut scaled about its own middle, not a second path.**
  That is exact for shapes centred on their own centre, which every one of these
  is, so adding a sticker is one path rather than two that have to agree.
- **The hit region is the die cut and not the box round it.** The button is
  `pointer-events-none` with the cut path turned back on, the call `folder-stack`
  documents. A hexagon's bounding box claims a quarter of its own area in corners
  the shape does not have, and with five stickers loose on one board those corners
  decide which one a press reaches.
- **A press focuses the button on its own, and calling `focus()` from the
  handler paints the focus ring on every click.** A browser focuses the nearest
  focusable ancestor of whatever was hit, and the die cut has none of its own, so
  the explicit call was never doing anything but confusing the engine's
  focus-visible heuristic, which judges script focus rather than the press that
  led to it. Measured: with the call gone the button is still `document.activeElement`
  after a press and no longer matches `:focus-visible`, and a Tab still rings it.
- **Only the lifted sticker carries a shadow**, which is `folder-stack`'s claim
  arriving at a different object: a sticker stuck flat to a board is flush with
  it, so at rest the pile is line art. It outlasts the release by the length of
  the landing, since a shadow that goes out while the sticker is still travelling
  says it has arrived before it has.
- **The board keeps the pointer.** One `setPointerCapture` on the board at the
  press, so a hand that runs off the sticker, or off the frame, is still the hand
  carrying it, and the board is where the move and the release are heard.
- **The mark a sticker was peeled from sits under every sticker, so the peel is
  what uncovers it.** That is the whole reason it is a clean patch rather than a
  label: at rest it is hidden by the sticker that made it, and what opens it is
  the front face being clipped away. A dashed hairline, the same thing
  `portrait.tsx` draws for the same claim, and it keeps its last position rather
  than following, so a sticker put down elsewhere fades its old place out where it
  stood.
- **One rect read a frame, at the top, before anything is written.** The board
  scrolls with the page while a drag is running, so the offset cannot be measured
  once at the press the way `event-stacking` measures its grid, and reading it
  after the frame's writes is what turns a cheap read into a forced reflow.
- **Nothing renders while a sticker moves.** The pile order is the only state in
  the file, and it changes once per gesture. Ten attributes are written for the
  sticker being moved and a single `display` for the four that are not. The loop
  cancels and reschedules rather than skipping a request while a handle is set,
  which is `book-opening`'s call and for its reason, and it stops when everything
  has settled. Measured: 0 frames requested over 1.5s at rest, and 0 again 1.2s
  after a drop.
- **A resize rescales the arrangement rather than re-seeding it.** The bodies are
  kept in board pixels, since that is what every frame reads, and putting five
  stickers back where they started because a window was dragged wider is the one
  thing this cannot do.
- **The scatter is placed by hand.** A generator has to be rejected and re-rolled
  until nothing overlaps and nothing lines up, which is a designer's eye run in a
  loop, and the run that survives is then the layout whether it was chosen or not.
- **Reduced motion keeps the peel and drops the travel.** The peel is direct
  manipulation and it is the demo, so pulling still folds the sticker. The body
  arrives instantly instead of chasing, so there is no lag for a carried sticker
  to curl by and no landing to unfold through. Verified: the flap is drawn while
  stuck and gone while carried.
- **`touch-none` on the stickers and `pan-y` on the board.** A drag on a sticker
  is the sticker's and a thumb anywhere else still scrolls the page, which is the
  trade `window-shade` documents for its own grip.
- `cursor-grab`, the fourth place the shared "cursor-pointer on every clickable
  element" rule is off, after `tether-button`, `event-stacking` and
  `window-shade`.

### `halftone-ripple`

A pill toggle with a heart and a count. Pressing it sends a ripple of dots out
across the button from under the pointer, on a fixed grid. `ripple.ts` is the
field and the painter, pure maths on a 2D context, and `index.tsx` is the
button, the canvas and the frame loop.

- **The ripple is a field sampled on a grid, and no dot ever moves.** Every
  frame asks each grid point how far it is from each crest, and the answer is
  the size of the dot there. The grid is the whole of the pixelation: a wave
  passing through points that stay put is what a halftone screen being run looks
  like, where scaling a drawing of a ring carries its dots along and reads as a
  texture sliding.
- **A dot has six sizes.** The field is continuous and the dot steps through
  `LEVELS` rather than sliding, so a frozen frame shows rings of dots at one size
  each and the motion reads as a print rather than a blur. **The radius goes with
  the square root of the field**, since the eye reads a halftone's ink area and
  area goes with the square of the radius. On a straight line the small end of
  the field was nearly empty.
- **The crest sets out fast and slows, the band widens as it goes, and the tail
  is longer than the front.** `crest` is `1 - (1 - p)^2` over `LIFE`, so the far
  corner is reached in about a second. `BAND` runs 18 to 44px, which is
  dispersion and is what keeps the late ripple from thinning to one ring of
  dots. `TAIL` stretches the trailing half by 1.7, so a hole opens behind the
  crest a beat after it passes, which is the reference's second frame: a band at
  the far end with clean paper behind it.
- **Ripples add and a dot takes the ink of whichever lifts it most.** Two
  crests crossing lift a dot further, capped at one, so a flurry of presses
  reads as interference rather than as the last press replacing the rest.
- **The ink is the state.** `INK` is the one hue this experiment owns, and it
  paints the ripple of a press that turns the button on and the heart while it
  is on. A press that turns it off sends the same ripple in `text-muted`, so the
  dots say which way the press went. A hot pink rather than a muted crimson,
  which is where it started: the ripple is the whole show, and at 4.68:1 the
  quieter ink read as a stain. 3.79:1 on the resting pill and 3.16 on
  `fill-active`, a graphic's floor on every ground the button paints.
  - **The off ink is read off the token at mount**, through `getComputedStyle`
    on the root, since a canvas fill cannot take a `var()`. Same reason the
    signature player's nib halo goes through `style`.
  - **The heart's hue is inline `style`**, since it is not a token and no class
    can name it. Off, the span inherits the button's tone and steps with it.
  - **`INK` is exported for one reader**, the contrast demo in
    `app/blogs/_details-you-can-measure/`, which converts it and reports its
    ratio. Nothing else may paint with it.
  - **The heart fills while it is on, as a second glyph fading in over the
    outline** rather than a weight swap on one, so the fill arrives on the same
    200ms as the hue and the outline stays under it as the edge. This is the
    second place the codebase passes an icon `weight`, after the signature
    player's transport, and the Icons section names both.
- **The dots are at 0.82, not solid.** Full ink under the digits made the count
  hard to read for the frame or two the crest sat on it, and a print on grey
  paper sits a little into the paper anyway.
- **The canvas sits under the label, and tree order is what stacks them.** Both
  are positioned, so the later one paints on top, and the dots pass beneath the
  digits the way a print sits under type. `overflow-hidden` on the pill clips
  the grid to it, `isolate` keeps the canvas's stacking inside the button, and
  the focus ring survives the clip because a ring is a box-shadow.
- **The canvas is sized off the button's own rect, never the observer's
  `contentRect`.** That is the content box and leaves the padding out, where the
  canvas covers the whole pill. The pill has no border, so its box is the padding
  box. The device pixel ratio is capped at 2 and goes back on as the transform
  after every resize, since setting a canvas's size resets it.
- **A pointer's ripple leaves the point that was pressed and a keyboard's
  leaves the heart.** `detail === 0` is what tells them apart, the call
  `tether-button` and `book-opening` make. Space has no point to start from and
  the heart is what the press is about.
- **It fires on `click`, not on `pointerdown`.** The state changes on the
  click, and the ripple's ink reports which way it went, so the two have to
  happen in the same moment. A ripple on the press would have to guess.
- **Hover lifts the label a tone as well as the fill.** `bg-fill` to
  `bg-fill-hover` is 1.04:1, a step that exists in the token table more than on
  the screen, so the label goes `text-secondary` to `text-primary` with it,
  `rain-splatter`'s call for its quiet pills. On, the label holds the primary
  tone through `aria-pressed:` whatever the pointer does.
- **The press is the darker fill step, instant in and timed out.**
  `active:bg-fill-active` with `active:duration-0`, `tether-button`'s asymmetry:
  at 200ms both ways a quick click never reaches its own colour. Nothing scales,
  per the site's own override.
- **The tooltip names what a press will do**, "Like this" or "Remove like",
  since the label is the value and not the action, the signature player's rate
  pill argument. Radix closes it on click, so the changed copy is seen on the
  next hover, which `heading-anchor` documents.
- **The count morphs through `torph`** at `book-opening`'s numbers, 200ms on
  the pill's own ease. What a press does to a count is correct it. An `sr-only`
  "likes" after the digits gives the button the name "127 likes", and
  `aria-pressed` carries the state.
- **Nothing renders while a ripple runs.** A press pushes one record into a
  ref, and one frame loop paints the list until it is empty and then stops
  asking for frames. Measured: 364 dots sampled a frame, 0 frames requested at
  rest, 64 for one ripple and 0 after it, and under a 4x CPU throttle with three
  ripples in the air at once 72 frames with the longest at 16.8ms.
- **Reduced motion keeps the press and drops the travel.** The field appears as
  a soft disc around the finger, `radius` 0 with a band of 0.42 of the reach,
  and fades over `STILL_LIFE` where it is. Read with `useReducedMotion` into a
  ref, since the loop reads it outside render and `MotionProvider` governs
  motion components and never a canvas.
- **`select-none` on the button.** A flurry of presses on a control anchors a
  selection on the nearest text otherwise, the portrait's problem at a smaller
  scale.
- **Biome rejects `aria-hidden` on a canvas**, counting it focusable, and the
  attribute was not doing anything: an empty canvas contributes nothing to the
  button's name. `rain-splatter`'s canvases carry none either.
- Not `flush`: it is a component sitting on a surface, the same stage
  `cursor-origin-button` and `tether-button` use.

### `notch-drop`

A notch hanging from the top edge of a page of cards. Lift a card and the
notch opens and asks for it, hold the card over it and it asks louder while
the card shrinks, let go and a black drop leaves the card and merges into the
notch, which says `captured` and closes to `capture 1`. `items.ts` is what is
on the page, `index.tsx` the notch, the drag and the goo.

- **The notch is a liquid, which is two black shapes under one SVG filter.**
  `feGaussianBlur` at 6 bleeds the shapes into each other and an
  `feColorMatrix` alpha row of `22 -10` cuts the bleed back to an edge, so two
  shapes within a few pixels grow a neck. The notch's body and the drop that
  leaves a captured card are the two shapes. **The label is not under the
  filter**, since the threshold destroys any edge worth keeping, so the face is
  a second layer animated to the same box.
- **Four boxes, one per phase**, `NOTCH` in stage px: rest 104 by 26, open 224
  by 72, over 248 by 84, captured 200 by 64, each with its own bottom radius.
  The top corners stay square, since the notch hangs from the edge.
- **The opening spring overshoots on purpose**, stiffness 340 and damping 22.
  A box resizing on an ease is a box resizing. A box going past its size and
  coming back is something soft giving way. The ghost rides a tighter spring,
  700 and 42, since a thing in a hand should feel held.
- **The ghost shrinks to 0.55 over the notch and wears a plus**, so the notch
  reads as the bigger mouth and the plus says what letting go does. The plus is
  `inverse-bg` on `inverse-text`, the notch's own palette in reverse. It
  shrinks toward the hand, with `transformOrigin` at the grab point, rather
  than toward its own middle.
- **Three layers: goo at `z-20`, face at `z-30`, the card in your hand at
  `z-40`.** The carried card sits over the notch, the way a drag image sits
  over the thing it is about to be dropped on, and it is shrunk to 0.55 so
  the label still reads around it. A version with the card under the goo, going
  in behind the black, was tried and rejected: what you are holding has to stay
  in view until you let go.
- **The drop is tested against the notch's box with 16px of reach**, and only
  on a pointer move that crosses the edge, so the phase flips once per crossing
  rather than per frame.
- **The release is heard on the stage with the pointer captured at the lift**,
  so a hand that runs off the card or the notch still carries it. Escape and a
  window `blur` cancel, which is nib's rule for a drag that must never get
  stuck. A release away from the notch springs the ghost back to its origin and
  the notch shuts.
- **The stage wears the grabbing cursor for as long as a card is in hand, and
  the card cannot carry it.** `cursor-grab` and its `active:` pair only hold
  while the hand is still on the thing it pressed, and the first pixel of a
  drag takes it off: what is under the pointer from then on is the stage, since
  the ghost following it is `pointer-events-none`. So the cursor fell back to
  the default arrow for the whole of every drag, which is the one moment it had
  something to say. Measured before: `auto` over the stage mid-drag.
  - **The descendant rule is the half that does the work.** A card declares
    `cursor-grab`, and an inherited value loses to a declared one, so a drag
    passing back over the grid showed `grab` again in the middle of itself.
    `data-[carry=true]:cursor-grabbing` and its `[&_*]` pair are what
    `sticker-peel` and `gooey-chips` already use for the same reason.
  - **Written to the node in `lift` and cleared in `release` and `cancel`**, the
    two places that already null the grab, so a drag still renders nothing. The
    keyboard's path never sets it, since nothing is being held. Measured:
    `grab` on the card, `grabbing` from the press through bare stage, another
    card and the notch, and `grab` again after the release or an Escape.
- **Putting a card back is a crossfade, and this was a flicker.** The ghost
  used to be unmounted in one frame after 320ms while the card under it was
  still at 30% and took 200ms to fade up. Sampled per frame: ghost gone at
  313ms, card at 0.36 at 358ms and 1.0 at 509ms, so the reader saw a dim
  placeholder with nothing on top, then a fade. Now `settling` brings the
  placeholder back to full at once, the ghost fades out over it after a 160ms
  wait so the spring has it nearly home, and it is unmounted at 380ms when
  both have finished.
- **Capture is three things on two clocks.** The ghost flies to the notch's
  centre and scales to nothing, the drop forms at the ghost's centre at 0.55 of
  the card's height and merges into the notch's foot, and at 260ms the card
  leaves the list on a `layout` spring while the count goes up. The notch says
  `captured` for 900ms and closes.
- **Enter on a focused card is the same capture without the drag.** The notch
  opens first and the card leaves 180ms later, so the eye sees where it went.
  The cards are real buttons with a label saying what Enter does.
- **The label morphs through `torph`**, so `capture` becomes `drop to capture`
  by growing rather than swapping, and `capture 1` after the first drop is the
  word being corrected.
- **The notch is the one dark object on a light stage**, the narrow use of the
  `inverse-*` set that `book-opening`'s boards make: a notch is hardware and
  hardware is black. See Colour tokens.
- **Reduced motion keeps every phase and drops the travel.** The notch still
  opens, the card still leaves and the count still goes up, all in one step.
- **The page is a two by two grid of cards above `sm` and one column below**,
  since two columns at 390px truncate every title to two words. Each card
  carries real content in its preview: the note's first three lines, the
  screenshot itself, which is one of this site's own lab stills, the link's
  mark from the favicon registry and its host, and the report's three figures.
  Grey bars were tried first and rejected: a bar standing in for a thing is
  not worth carrying and says nothing about what the notch is for. One `Card`
  component draws the grid and the ghost, so the thing in your hand is the
  thing you picked up. The meta line keeps its casing, since a filename, a size
  and a host are data rather than copy, the room code argument from
  `sixtyfour`.
- **The stage carries its own `ring-1 ring-stroke ring-inset`.** It is
  `flush`, so it sits edge to edge in the `Demo` frame, and its white covers
  the frame's own inset ring, the trap the album cover documents. Without it
  the lab had no edge at all.
- **Each kind of card has a hue, `TONE` in `items.ts`**: a tinted face and a
  saturated mark for the icon and the meta line, the folder stack's split.
  Amber for the note, blue for the screenshot, violet for the link, rose for
  the report. The faces sit at 1.25 to 1.42 on white, the band the folder
  stack's papers hold, so a card gains a hue without gaining weight, and
  `text-primary` clears 12:1 on every one. The marks clear 4:1 on their own
  face. `text-secondary` measures 3.75 to 4.28 on the tints, under the text
  floor, which is why the meta line takes the mark rather than the grey. The
  preview is white paper on the face and needs no hairline there.
- **The empty page holds one icon button, an anticlockwise arrow with a
  tooltip**, per the shared rule for icon-only controls. It was a `put them
  back` pill first, which was a sentence where a glyph would do. It is centred
  in the whole stage rather than in the card area under the notch, since
  against the box the eye reads the card area's centre sits 48px low. It is
  not a grid item either: as one it sat in the row after the last card while
  that card was still leaving, then jumped to the first row when the card
  unmounted. It fades up after a 240ms wait, so the card has gone before it
  arrives. Pressing it brings the cards back with a rise, 50ms apart, so the
  page refills rather than snapping, and the button leaves in 120ms so it is
  gone before they land. `AnimatePresence` carries `initial={false}`, which is
  what keeps that entrance off the first paint.
- **`GO` is the state hue**, a green the state icon takes from the
  moment a drop can happen to the moment it did: the arrow over the notch, the
  plus on the card, the check on capture. The glyph on the disc is the notch's
  own black. The site ships no success tone and this does not add one, it is
  the scoped exception nine other experiments take. 9.9:1 on `inverse-bg`.
- **The stage is `h-148` and the grid starts at `top-28`**, which is past the
  notch's widest open height of 84px. The cards are `p-4` with a `h-24`
  preview and `gap-4` between them, since at `p-3` and `h-20` they read as
  congested. An open notch hangs over air. The first
  build started the list at `top-14`, and the notch opened over the first card
  and covered its title.

### `island-menu`

A pill of a nav bar that opens into a menu in two moves. Tall first, a black
slab rising off the bar with its three controls pinned to the foot, then wide,
and only then does the menu arrive in it. Closing runs the three moves
backwards. `index.tsx` is the whole thing, with the storyboard at the top.

- **The box is two tweens that overlap, and the order flips with the
  direction.** Opening: height over 360ms, width starting at 252ms while the
  height is in its last third. Closing: content out over 200ms, then width,
  then height on the same overlap. A menu that grew tall then wide has to
  shrink wide then short, or the shape it passes through on the way out is one
  it never had on the way in. A spring would run both axes together, which is
  a rectangle scaling, which the eye reads as a zoom.
- **Butted end to end, the two moves read as two animations.** The first
  build ran them at 260ms each with no overlap and the box stopped dead at the
  corner between them and started again. `lap` is 0.3: the second move starts
  when the first has 30% left, and the corner becomes a curve. Sampled per
  frame: six frames where both axes move, on open and on close.
- **One curve, and it arrives slowly.** `[0.4, 0, 0.2, 1]` on the box, the
  links, the picture and the panel's fade. The earlier `[0.22, 1, 0.36, 1]`
  arrived hard, which is right for a hover and wrong for a box the eye is
  following, and the panel used to appear in a 10ms step. It fades over 260ms
  now, measured 585ms to 785ms into the open. The largest single-frame step
  on the box is 31px of a 244px move.
- **The pace went up once, by about a seventh, and every duration moved
  together.** 420ms to 360ms on a move, 240 to 200 on the content's exit, 500
  to 420 on a link, 60 to 50 between links. The overlap is a share of the move
  rather than a number of its own, so it moved with them. Measured after: the
  height runs 43ms to 351ms, the width 268ms to 585ms, and the panel is in by
  785ms. On close the width runs 226ms to 543ms and the height 459ms to 809ms.
- **The bar is narrower than the menu, and the first build was not.** Both
  were 380px, the width tween had nowhere to go, and the second beat did not
  exist. Measured: 380x56 to 380x300 with no horizontal move. Now 340 opens
  to 460 wherever there is room for it.
- **Both widths derive from the stage, and the bar keeps its share.** `menuW`
  is the constant or the room, whichever is less, and `barW` is the same
  fraction of `menuW` that 340 is of 460, floored at `BAR.min` and capped at
  `menuW`. Pinning the bar at 340 while only the menu shrank squeezed the
  second beat out on a phone: at the 313px a 390px viewport leaves, both boxes
  would have been 313 and the width tween would have had nowhere to go, which
  is the first build's bug arriving from the other direction. Measured travel:
  0px at 320, 31px at 360, 61px at 390, 92px at 430, 120px at 768 and above.
  A stage narrower than the floor degrades to one move rather than
  overflowing, which is the 320px row.
- **`BAR.min` is 252 and it is measured.** Below `sm` the bar's row runs at
  `gap-2 px-3`, where its three controls come to 250.5px: the brand at 49.9,
  the toggle at 75.5, Get started at 93.1, two 6.4px gaps and 19.2px of
  padding. 252 is the narrowest bar that does not clip Get started's right
  edge. The row tightens below `sm` for exactly this reason, since at the
  full `gap-4 px-4` the floor is 276 and there is not enough left over to be
  a second beat.
- **The width is measured against the stage, and the stage carries `min-w-0`
  so that it can be measured at all.** Without it the stage is a flex item at
  `min-width: auto`, so its used width is its own min-content, and its
  min-content is the box's inline width. The box was 340px, so the stage
  became 340px, so the room read 340px, so the `Math.min` against it never
  bound and the bar stayed 340 however narrow the frame was. The ruler was
  elastic and the thing it measured was stretching it.

  This shipped. Measured on a 390px viewport: a 351.6px frame, a 340px stage
  whose right edge sat 7.6px past the frame's border, and on a 360px one the
  page scrolled 18px sideways. The earlier note claimed the `ResizeObserver`
  had solved it, and it had only moved it: clamping the menu against a stage
  that reports its child's width is clamping against nothing. `max-w-full` on
  the box does not hold it either, for the same `min-width: auto` reason.

  Below `sm` the grid drops to one column and the picture goes, since at 340px
  it ran off the menu's edge. That much was right.
- **The content arrives as the box is landing**, 60ms after the width move
  passes its own overlap point, the links 50ms apart over 420ms on a rise and a
  blur, the picture after the second link. On close the content leaves first,
  in 200ms, so the box never resizes around text that is still there.
- **Each link carries a picture, and hovering a link swaps it.** Four of this
  site's own lab stills: the sticker board, the folder drawer, the stamps and
  the book. The window shade was tried first and read as a diagram inside a
  menu. The swap is an `AnimatePresence` in `mode="sync"`, so the arriving
  picture fades in over the leaving one and the frame is never empty. Sampled
  per frame: 12 frames carry both pictures and the lowest combined opacity is
  0.99. It runs 180ms, since a hover is a pointer waiting and a longer
  crossfade reads as the menu thinking about it, and the arriving picture
  settles from a 1.04 scale, which is what says it is new rather than redrawn.
  Focus swaps it as well, so the keyboard sees the same menu. `initial={false}`
  on that presence only blocks the first picture, which the panel's own fade
  already covers: each key is its own `PresenceChild`, so later pictures still
  mount at `initial`, which is the case `tab-overview` documents from the other
  side.
- **The bar's controls never move.** Pinned to the foot with `absolute
  bottom-0`, they ride the growing box, so the hand is still on the button
  that opened it when it is time to close.
- **The stage is a fixed height, `h-114`, and it was `min-h-96`.** The box is
  anchored to the stage's foot and grows upward to 300px, and with 32px of
  padding under it that is 332px in a 307px minimum, so every open pushed the
  frame 25px taller and the page below it down with it. 365px leaves 33px above
  the open menu against the 32px under the bar. Measured: the frame holds
  403px at rest and open, on a 1280px viewport and on a 390px one.
- **The label follows the box, not the press.** `Menu` becomes `Close` as the
  height move hands over to the width move, and back half way through the
  closing height move, through a 320ms `torph` morph on the box's own curve,
  so the word describes the shape the button sits in.
- **The glyph beside it is a drawing of the box, and it moves the way the box
  does.** An SVG path rather than a bordered span, since a CSS border draws a
  pill and a rounded rectangle and nothing between them. At rest it is a
  stadium, 16 by 10 in a 22 unit box, and open it is a 20 by 20 squircle, with
  each corner a cubic whose handles sit at 0.55 of the radius for a circular
  arc and at 0.85 for the fuller curve. Two motion values carry the two axes on
  the box's own two clocks, height then width on open and width then height on
  close, lapped the same way, and every change writes one `d` to the node, so
  nothing renders while it moves. Measured against the box: the glyph's height
  starts on the same frame as the box's, and each 4 unit move registers one
  frame after the box's, which is the first frame of the curve sitting under
  the sampler's threshold.
- **It sits 0.09em below the row's centre, on purpose.** The flex row centres
  it on the line box, and the label is lowercase, so its visual centre is the
  x-height centre. For Inter at 1.5 leading the baseline is 1.113em from the
  line's top and the x-height 0.546em, which puts that centre at 0.840em
  against a line centre of 0.75em. Measured: the glyph's centre lands 0.02px
  from the label's x-height centre, at rest and open.
- **The Get started button's ring is white at 20%, not `inverse-stroke`.** The
  stroke token on `inverse-fill` is 1.13:1 and was not there at all. White at
  20% is 1.85:1, and the hover steps it to 30%.
- **The toggle carries an `aria-label`.** `torph` renders the label as
  aria-hidden character spans, so without it the button had no name at all.
  The links are buttons rather than anchors, since a menu on a stage goes
  nowhere and Biome refuses a dead `href`.
- **Escape closes from anywhere on the page.** The hidden panel's links take
  `tabIndex={-1}` so a keyboard cannot reach a menu that is not there.
- Reduced motion runs every tween at zero, so the box, the glyph, the content
  and a swapped picture all arrive in one step.

### `custom-cursor`

A gallery of four cards under a cursor of its own. Crossing into the stage
swaps the arrow for a dot that chases the hand a beat behind, and hovering a
card grows the dot into a pill naming the lab whose still the card shows.
`index.tsx` is the whole thing. **It is the one lab on GSAP**, at the user's
request, and the only file that imports it. Everything else stays on Motion,
and a component never mixes the two, since both want to own the same
transform.

- **Two positions, not one.** The hand is where the browser says it is, and
  the drawn cursor is a tween chasing it: one `gsap.quickTo` per axis, which
  keeps a single tween and retargets it on every move, so the cursor always
  heads for the latest point from wherever it is. `expo.out` over 0.6s covers
  most of the gap at once and spends the rest settling, which is what reads as
  smooth. Measured after a fast stop: 27px behind at 15ms, 8px at 115ms, 2px
  at 214ms and under a pixel by 280ms.
- **The hand is read once a frame, at the front of GSAP's tick.** A
  `pointermove` only records the client point and adds the write to the
  ticker with `once` and `prioritize`, guarded so a second event in the same
  frame does not add it twice. So however many events arrive at 120Hz the
  stage's rect is measured once per frame, before the tweens write, where a
  layout read between their writes forces a layout per event. Measured through
  a fast sweep under a 4x CPU throttle: 73 frames, the longest 19.6ms and the
  median 16.7.
- **The lean is read off the chase, not the hand, on the ticker.** Each tick
  reads the drawn cursor's own x, smooths its velocity on a 50ms time constant
  and walks the angle toward `velocity / 120` degrees, clamped at 12, on an
  80ms one, through `approach` from `lib/lerp.ts`, which is the third caller
  after `book-opening` and `window-shade`. 1/120 rather than
  `event-stacking`'s 1/180, since an `expo.out` chase moves slower than the
  hand for most of a sweep and read 4 degrees at the old rate. A sweep across
  two cards now peaks at 5.6 degrees and reads 0 a beat after the hand stops.
  **The tick is on the ticker only while the cursor is out**, so an idle page
  requests no frames: measured, 0 `requestAnimationFrame` calls in the second
  after the pointer left.
- **A fresh cursor appears under the hand.** The stage's `pointerenter` calls
  each `quickTo` with the point as both start and end, which jumps the tween
  there, or the dot flies in from wherever the last one was left, which on a
  first entry is the stage's corner.
- **The dot and the pill are one element, and nothing scales. This was a
  bug.** The first build scaled a dot out and a pill in, and every so often
  the name showed at full size beside a background the size of the dot.
  `torph` sizes its box off `getBoundingClientRect`, which reports the
  transformed size, so a label that changed while the pill was small got a
  box a fraction of its text's width, held for the length of the morph. So
  the pill is always there and a `clip-path` decides how much of it shows. A
  clip is not a transform, so the text and its background cannot disagree.
  Measured through the reported crossing: the text overflows its box by at
  most 2px, inside the pill's own padding, where it used to overflow by the
  width of the word.
- **The clip is a pill-shaped window, not a circle, and the circle read as a
  pop.** At rest the clip is a 6.4px hole, the dot. Opening grows it into the
  pill's own box as an `inset()` with fully round corners, so what shows is a
  small pill inflating into the badge and revealing its word from the middle
  out, and the window's edges reach the box exactly at the tween's end, so
  the whole duration is visible growth. The first shape was a circle run out
  to 84px: a circle covers a wide pill long before its radius reaches the
  corners, so the visible part of a 280ms open was its first 50ms, three
  frames, and a circle growing out of a pill is a wipe rather than a badge
  expanding. Measured now, `power3.out` over 220ms: the first frame shows
  45px of a 120px pill, the biggest step after it is 18px, and it is whole at
  146ms. That is the snappy end of watchable, asked for twice: 400ms on
  `power2.out` was the first pick and read as slow, 300 read as soft, and the
  280ms circle that showed for three frames read as a pop, which is the other
  side of the line. Closing runs the same window back to the hole on
  `power2.out` over 140ms, and is at the dot in about 130.
- **GSAP tweens a number for the clip, never the string, because the browser
  normalises `inset()`.** GSAP reads a tween's start value back off the
  element, and `inset(11.2px 56.8px 11.2px 56.8px round 999px)` comes back
  as `inset(11.2px 56.8px round 999px)` while an all-zero end comes back with
  one value. GSAP pairs the numbers by position, so the right inset went to
  zero on the first frame and the corner radius tweened toward an inset: the
  pill opened from its left edge in one 77px jump. So the tween is on a
  progress from 0 to 1 in a plain object, and `onUpdate` writes the window
  from that number and the pill's current box, one layout read a frame. At 0
  the clip goes back to a `circle()` hole, which is independent of the word's
  width, so a word swapped while the pill is shut cannot move or resize the
  dot.
- **The word fades with the window, and this was a glyph inside the dot.**
  The hole sits at the pill's centre, which is the middle of the word, and the
  word stays through a close so the pill never empties mid-exit. So after
  every hover the dot showed white letter strokes through its 6.4px hole,
  which read as a shape drawn on it. `paint` writes the word's opacity off the
  same progress as the window: gone below a quarter open, so the dot is solid,
  and whole by 60%, when the window is about half the pill. Traced through an
  open, width against opacity per frame: 31px at 0, 40 at 0.13, 54 at 0.49,
  67 at 0.8 and 78 at 1, so the badge inflates as a black pill for a few
  frames and its label arrives into it. The word starts at opacity 0, so a
  first hover cannot show it through the hole before the first paint.
- **The clip is driven from the pointer handlers, never through state and an
  effect, and this was the lag.** A hover that went event, render, commit,
  passive effect, tween was two to three frames before anything moved, on
  every dot-to-chip change, and the leave's one-frame deferral sat on top of
  that on the way out. `enterCard` and `closePill` start the tweens
  themselves, and React state carries only the word. Measured from the
  `pointerover` itself, warm: the window moves on the next frame with its
  word already in it, and the close is visibly shrinking on the next frame.
- **The cursor comes and goes at the stage's edge on a 150ms fade**, on the
  root rather than the clip, so entering never depends on the word's width
  and leaving mid-open does not have to close the window first. The hide
  resets the clip to the hole once it is gone.
- **There is no torph in this lab, and the second reason was the lean.**
  torph measures its box with `getBoundingClientRect`, and a leaning pill's
  rect is the bounding box of a rotated rectangle: at 5.6 degrees a 120 by
  19px word measured about 30px tall. torph wrote that height onto the word
  for the length of the morph and handed it back to `auto` at the end, so on
  every card-to-card crossing the pill grew half as tall again and then
  fitted. A crossing happens while the cursor is moving, so the pill is nearly
  always leaning when a morph would start. A word change is a GSAP width tween
  instead, from the old `offsetWidth` to the new one over 200ms with
  `clearProps` at the end, and `offsetWidth` is a layout box that no transform
  touches. The new word rises 3px into the box on a fade when the window is
  open. Through a gap the window is still reopening and its own fade owns the
  word, so the two never write the same opacity. Measured across a fast
  crossing at a 5.9 degree lean: the layout height holds at 29px on every
  frame while the rotated rect peaks at 38, the width runs 120, 112, 103, 96,
  92, 90, and no inline width is left on the box. The word is committed
  with `flushSync` so the box can be measured on the same tick and the open's
  first frame carries it: `pointerenter` is a continuous event to React, and
  without the flush the render landed a frame after the tween. A fresh open
  swaps the word with no tween at all, since the old word was never on screen
  in this hover, and the first build's morph from it stretched the background
  from the old width to the new while the chip was still arriving. The word
  stays through a close, so the pill never empties mid-exit.
- **The name changes in place while the pill is open.** Crossing straight
  from one card to the next resizes the box to the new word rather than
  popping the pill out and back in, and the window stays whole through it. A
  card's leave is answered one frame out, `folder-stack`'s call, so two cards
  that touch swap names with no dip. A crossing through the 32px gap closes
  the window part way and reopens it on the new word.
- **The name and the link come from the registry.** Each card is a real link to
  the lab whose still it shows, and the pill says that lab's title, so neither
  can drift from the page it points at. The still's `alt` is the same title,
  which is what a keyboard reader gets instead of the pill.
- **The badge takes a hue per card, and the dot stays black.** `TONE` in
  `index.tsx` maps each card to a colour drawn from its still: the stamps'
  cobalt, the lightning sticker's amber, the shade's sky and a coral for the
  pocket, each with a text colour that clears 4.5:1 on it, 6.13, 9.26, 8.92
  and 6.79. The pill tweens from the dot's `text-primary` into the hue as it
  opens and back as it closes, on the window's own durations, so the resting
  dot is always the site's black whatever was hovered last. The rest colours
  are read off the tokens at mount, since a GSAP colour tween cannot take a
  `var()`, `halftone-ripple`'s call for its off ink. This is the twelfth lab
  to scope a hue and it makes the same claim as the others: the colour says
  which card the pointer is on.
- **The pill carries a white hairline at 20%.** The stamp collection's still
  is a near-black table, and before the hues the black pill had no edge there.
  On the light stage and on the light pills the ring is invisible.
- **`cursor-none` on the whole subtree**, the call `tether-button` documents:
  the UA stylesheet sets a real `cursor` on a link, which beats an inherited
  value. So the links drop `cursor-pointer`, the fifth place that shared rule is
  off, after `tether-button`, `event-stacking`, `window-shade` and
  `sticker-peel`. Verified: the stage, a card and its image all compute
  `cursor: none`. A white shape seen inside the dot after a hover looked like
  the OS arrow over the bare stage and was not: it was the word's strokes
  through the hole, see the next bullet. The cursor rule was never the
  problem.
- **The drawn cursor is `pointer-events-none`**, or it would take the hover
  from the card under it and drop the pill that put it there.
- **Hover is gated on `pointerType`**, mouse and pen only, the call
  `folder-stack` documents. A touch has no hover to take a cursor from and no
  arrow to replace, so a finger gets the cards as plain links and nothing is
  drawn. Verified on a 390px phone with a real touch context: a finger dragged
  across the stage leaves the cursor hidden and the page where it was.
- **Reduced motion keeps the dot and the pill and drops the chase.** It is
  read with `matchMedia` in an effect, since `MotionProvider` governs Motion
  components and this file has none. Each move then jumps the tweens to the
  hand, the lean's target is 0 and the window and the fade run at zero
  duration. Verified on a frame boundary: the cursor sits 0px from the hand
  with the pill already open. Reading it before GSAP's next tick says 36px, which is
  the previous event's point, not a lag.
- **It is `flush`, white, with its own inset ring**, the notch drop's stage,
  since its white covers the frame's own ring. The stage is where the native
  cursor stops, so the hairline has to be there.
- **The cards take a third less than the column, centred in a fixed `h-140`
  stage.** The first build filled the column with them under `p-6`, and the
  dot had nowhere to be a dot: every position in the stage was a card or a
  gap. The grid is capped at `max-w-110` at `gap-10`, which leaves 93px of
  ground either side and 108px above and below on a wide column, 32px between
  the cards, and the cards are still 160 by 100. On a 390px phone the grid
  meets the stage's own padding and the stage stays 448px tall, which is room
  nothing uses, since a finger draws no cursor there.

### `radial-menu`

A file on a stage. Press it and pull, and a wheel of five formats, png, jpg,
gif, avif and pdf, opens
around the place it was, the game weapon wheel's shape: the hand carries the
file, the wedge under the hand fills in and its name reads out in the empty
slot, and letting go there converts the file. Letting go over the middle, or
anywhere off a wedge, puts it back unchanged. `index.tsx` is the wheel and
the drag, `portrait.tsx` the file, on Motion alone.

- **The wedge under the hand previews its format on the portrait, and the
  file keeps the look it was last converted to.** The art is drawn once and
  reused through `<use>` under an SVG filter, faded over the original so a
  change of look is a crossfade. jpg is pixelated into 5 unit blocks by the
  flood, tile, mask and dilate trick and then softened, which is what block
  compression does to flat colour. gif has fine noise added and each channel
  cut to six levels, which is dither and a palette: four turned the skin pink,
  honest about a small palette and the loudest tile of the five. avif is softened a touch,
  the most a good codec gives away. png is the art as drawn, and pdf sets it
  small on a white page with a hairline edge. So the wheel is not a list of
  names but a demo of what the names mean, and after a pick the tile carries
  the result until the next one.
- **The readout says what the file would weigh, from a table.** Nothing here
  converts anything, so `WEIGHT` holds one plausible figure per format for a
  portrait this size and the readout sets it under the name in `text-muted`,
  which is where mock data sits on this site.
- **The file is a drawn portrait, `portrait.svg`, and the formats are what a
  vector gets rasterised to.** A bust with no face, which is what a portrait
  reduced to a 64px tile can carry, painted in the lab's own hues so the file
  and the wheel read as one set: the ground is the amber wash and the sweater
  the sky mark, with the skin and hair the drawing's own. It is artwork rather
  than a UI icon, the standing `tether-button`'s hands have. The first build
  reused the stamp collection's still, which made the tile a photo of another
  lab and the conversion a lie, since a webp is not what anyone turns into a
  pdf.

- **A hue per format, the thirteenth lab to scope its own colours.** The first
  build was `fill` wedges with the one under the hand in `text-primary`, and
  it read as a grey dial. `HUES` in `index.tsx` gives each wedge a `tint` at
  rest, a wash in the 1.25 to 1.38 band on white that `folder-stack`'s papers
  hold, so a wedge gains a hue without gaining weight, and a `mark` under the
  hand, with an `ink` for the label that can read on it: white on the sky,
  violet and green, the site's black on amber and coral, since no white clears
  4.5:1 on those. Measured label on mark: 4.72, 9.26, 5.22, 4.69 and 6.79.
  Rest labels are `text-primary` at 12.6:1 or better on every tint. The
  readout in the empty slot takes the pick's own mark where that mark clears
  4.5:1 on white, the sky, violet and green, and stays `text-primary` for
  amber and coral, which sit at 1.9 and 2.6. The hues are inline, since they
  are not tokens, and nothing else may paint with them.
- **The wedge under the hand pops.** It scales to 1.05 about the wheel's
  centre, which is the SVG's origin, so it steps outward as well as growing,
  on a spring with a little overshoot. The wheel's arrival and the file's
  return overshoot a little too, since a wheel of sweets should bounce.
- **A magnet on the wedge under the hand.** The file's position is the hand's
  offset plus a pull, two springs, and with a wedge under the hand the pull
  is 12% of the way from the hand to that wedge's centre, so the file drifts
  into the wedge ahead of the hand. The wheel tips toward where the hand sits
  inside the wedge, 0.08 degrees per degree off the wedge's own angle, so a
  hand near a seam sees the wheel lean to meet it and a hand crossing the seam
  sees it swing the other way. Both unwind to zero in the dead zone and on
  release, which is a dial catching a detent and letting go. The hand's
  offset and the pull are separate motion values summed by a transform, so
  the drag still writes the hand directly and only the pull is sprung.
- **A pick is a beat, not a snap home.** On release over a wedge the file
  darts into that wedge's centre, takes the new look and name there, and only
  then springs home, with the wheel held open and the wedge lit until it has
  landed. The dart is a 160ms tween and not a spring: a spring aimed at a
  point the file was already on still ran its settle, which was a 330ms hold
  with nothing moving. Measured from a release near the rim: 136px out to
  105 in two frames, renamed and closed at 211ms, home by 644ms with the
  return's bounce. A release with no pick goes straight home. Under reduced
  motion the pick is instant and there is no dart.

- **The wheel is centred on where the file was, never on the hand.** So it
  holds still while the hand moves, which is what makes it a target. The
  file's centre is read once at the press, before it has moved, and every
  later sample is measured against that.
- **Which wedge is under the hand is arithmetic, not a hit test.** The file is
  what the pointer is over, so the wedges could never see it, and the wheel is
  `pointer-events-none` besides. `wedgeAt` takes the hand's offset from the
  centre, maps its angle clockwise from the top onto five 72 degree slices and
  returns null inside the inner radius, which is the dead zone that lets go
  without picking. Past the outer edge still counts: a wheel is a direction
  picker, and a hand that overshoots has still pointed. The same maths serves
  a mouse, a finger and the arrow keys.
- **A wedge is an annular sector drawn once as a path**, from the outer arc to
  the inner one, and the seam between wedges is a 4px stroke in the stage's
  own colour with round joins, so the wedges part without a border and their
  corners soften a little where the stroke rounds them. Labels sit at the
  ring's mid radius on each wedge's own angle.
- **The press opens nothing until it has moved 6px.** A click on the file is a
  click, and the wheel arrives on the first move past the slop, so the hand is
  already heading somewhere when it appears. The drag is on nib's rules: down
  on the file, move, up, cancel and blur on the window, `buttons === 0` ends a
  drag whose lift was never heard, and Escape cancels a drag in flight.
- **The selection is a ref first and state second.** The handlers read and
  write `activeRef`, and `select` only renders when the wedge actually
  changes, so a sweep across the wheel renders once per wedge crossed and not
  once per move.
- **The pick is the file's own name changing.** The extension morphs through
  `torph` under the tile as it springs home, and the readout in the empty slot
  morphs between wedge names during the sweep. Both elements only ever
  translate, which is why torph is safe here where `custom-cursor` had to drop
  it: a translate leaves `getBoundingClientRect`'s size alone, and a scale or a
  rotation does not.
- **The keyboard gets the same wheel without the drag.** Enter or Space opens
  it on the top wedge, the arrows walk round it, Enter picks and Escape puts
  the file back. The file stays put while choosing, since there is no hand to
  follow, and darts into the wedge on the pick like any other. A
  keyboard-opened wheel ignores the pointer and a pointer drag ignores the
  keys, so the two cannot fight over one selection. Losing focus closes a
  keyboard wheel without a pick.
- **The button is the thumbnail alone**, so its centre is the wheel's centre,
  and the name hangs under it absolutely and rides along. The name hides while
  the file is out, since over the dark wedge a grey name had no contrast, and
  it comes back with its new extension as the file lands, which is also when
  the morph is worth watching. `touch-none` on the button so a finger's pull is
  the file's and not the page's, and `cursor-grab`, the sixth place the shared
  `cursor-pointer` rule is off.
- **Reduced motion keeps every state and drops the travel.** The wheel
  appears in place and the file is home in one step.
- It is `flush`, white, with its own inset ring, the notch drop's stage.
- Verified in a browser: a click opens nothing, a 24px pull opens the wheel
  with nothing chosen, the hand at 0, 72, 144, 216 and 288 degrees reads png,
  jpg, gif, avif and pdf and at 36 degrees reads jpg, the middle reads
  nothing, a release on jpg renames the file and puts it back within a pixel,
  a release in the middle leaves the name alone, Enter then two rights then
  Enter picks gif, Escape leaves the name alone, a finger's pull on a 390px
  phone opens the wheel without scrolling the page and converts on the lift,
  and under reduced motion the wheel is at full opacity on the frame it opens
  and the file is home 60ms after a release.

### `flip-clock`

A flip clock in 24-hour time: three cards for hours, minutes and seconds, a
blue, a green and a terracotta with cream numerals, each a number split at a
hinge across its middle. When a number
changes, the top half falls forward through 180 degrees as a real flap,
showing its back on the way down, and lands on the stop with a small bounce.
`index.tsx` is the whole thing, on Motion alone.

- **The flap is the only thing that moves, and everything else is what makes
  that possible.** A card is two static halves and, while a number changes, a
  flap over the top one. The static top already shows the next number and the
  static bottom still shows the old one. The flap's front is the old number's
  top and its back is the new number's bottom, pre-turned 180 degrees so it
  reads upright once the flap has landed where the bottom half was. So the
  card reads right on every frame of the fall, nothing fades and nothing
  morphs, which is what a mechanical clock looks like.
- **A half is a full glyph box clipped to half a card.** Each half is a box
  half the card's height that clips a box twice its own height holding the
  whole number: the top half shows it from the top, the bottom half slides
  the same box up by its own height and shows the rest. Both halves of both
  numbers then meet at the hinge to the pixel, whatever the glyph.
- **The faces on the flap fill the flap, and this was a bug with a mirrored
  tell.** `Face` sizes itself to half its container, and the flap is already
  half the card, so the flap's faces came out a quarter of the card tall and
  showed the wrong slice of the glyph: the back read as a vertically mirrored
  number for the whole fall. A `fill` flag makes a face fill its box when the
  box is the flap.
- **The fall is gravity and the landing is a bounce, in one keyframe run.**
  Rotation goes 0 to -180 over the first half on an ease-in, since a falling
  card gathers speed, then -172, -180, -177, -180 on alternating ease-outs and
  ease-ins, which is the flap coming off the stop by eight degrees, then three,
  then resting. 720ms in all. The flap sits under `perspective: 700px` on the
  card, so it foreshortens as it turns and is edge-on at the hinge. It is run
  with `animate()` on a motion value rather than an `animate` prop, so the
  shading can read the angle, and finished on `onComplete` and not the
  promise: a stop resolves the promise too, and dev's double effect stops the
  first run.
- **A card only flips one step at a time, and it queues.** The change effect
  starts a flap when the value differs from what the halves show and no flap
  is in flight. When the flap lands, the halves take its number and the effect
  runs again, so a value that moved twice during a flap gets one more flap to
  the latest value rather than a backlog. The `key` on the flap is a counter,
  so consecutive flips remount it and start the run from zero.
- **The cards flip in from 00 on arrival**, hours first and the others 120ms
  apart, which is the site's own stagger one level down, and only the first
  flap of each card takes the delay. The seconds then keep the mechanism
  moving, so nobody waits a minute to see it work.
- **A press on a card sets it forward by one of its own unit**, an hour, a
  minute or a second, by adding to an offset the clock is read through. So the
  hour and minute flaps can be watched on demand, and the three cards stay one
  consistent clock rather than three counters. The clock is read once a
  second, aligned to the wall clock's own second boundary, so a flap starts
  when the second turns and not up to a second late.
- **The depth is light, on `document-pocket`'s rules for a dark surface.** The
  first build was flat `inverse-fill` rectangles and read as a cartoon, and the
  second greyed the numerals' lower halves under a shadow gradient a third of
  the card tall, with a hard white stripe for a hinge, and read as fake. What
  reads as a card: the numerals stay white top to bottom, the hinge is a soft
  band of shadow where the light cannot reach the fold, 45% on the line and
  gone within four pixels either side, with the upper card's shadow a narrow
  band under it, 40% at the gap and gone by 16px, laid over the paint as well
  since a shadow falls on everything. A one-pixel black hairline was tried for
  the gap first and read as a drawn line. The light comes from the upper left, a
  sheen across each face falling to a shadow at the lower right, with a lit
  pixel along the top edge and a hairline bevel. Grain twice, the pocket's
  noise at 30% in overlay for the tooth and at 9% in screen so the specks show
  on a near-black, where overlay alone has nothing to lift. The surface layers
  sit under the numeral, so the paint is clean, and the shadows sit over it.
  The table is `bg` at the top falling to `fill`, so the shadows have a ground,
  and each card is seated by a soft pool on the table and three faint shadows
  of its own, a contact line, a short cast and a wide ambient, offset
  downward. The light is white and black at alpha over the card's own hue.
- **The flap is lit as it turns, and it throws a shadow.** Its rotation is a
  motion value the card owns, so three shades read it: the flap's front
  darkens from 0 to 50% as it turns edge-on at 90 degrees, its back starts at
  50% and clears as it lands, and the lower card under it darkens by the sine
  of the angle, nothing at either end and 45% with the flap edge-on over the
  hinge, which is where a real card shades the one below. 55% each, on a
  flap under `perspective: 700px`. A face that turns from the light and a
  shadow that moves with it are most of what says the flap is a thing and not
  a wipe.
- **The axle's two tabs sit at the hinge in `inverse-stroke`** with a lit top
  edge each, and three edges under the card, each a shade further back, are
  the cards waiting on the reel.
- **A hue per card, the fourteenth lab to scope its own colours.** The cards
  were black first, the `notch-drop` claim that hardware is black, and black
  hid everything the depth pass added: a sheen and a shadow on near-black are
  the same near-black. The reference had the answer, the Zara flip clock's
  blue and green cards with cream numerals. `HUES` in `index.tsx` gives hours
  a blue, minutes a green and seconds a terracotta, all with one cream ink,
  and the fittings, the axle's tabs and the reel's edges, are each card mixed
  40% toward black in oklab. The cream clears 3:1 on every card, the
  large-text floor: 3.62, 3.54 and 3.88. The light layers did not change,
  white and black at alpha, and on a mid-tone they read. The numbers are
  `text-[4.5rem]` at `font-medium`, which is off the type scale on purpose,
  since they are the object and not copy, the standing the portrait and the
  tether hands have.
- **The flap is `pointer-events-none`**, since it never needs a pointer and a
  singular transform mid-fall is nothing to hit test against.
- **Its presses were being eaten, and the cause was the page, not the
  clock.** Every tick ran a view transition on the page boundary that held a
  snapshot over the live DOM for 300ms, and any press in that window landed
  on the root. See Page transitions: the boundary now passes `update="none"`.
  The flap, the 3D context and the hover transition were each ruled out
  first by stripping them and counting misses, which is the order to try
  again if a press ever goes missing here.
- **Reduced motion swaps the number with no flap.** The halves take the new
  value at once. The clock itself is not gated, since a clock that does not
  change is not a clock.
- **It is `flush`, on a lit table, and the card's 8:5 at every width.** The
  stage is `aspect-8/5`, 538 by 336 under the column, which is the shape of the
  index's preview card, so the recorded clip is the whole stage with nothing
  padded or cut and a hover on the index shows the lab as it is. The table is
  `bg` at the top falling to `fill`, with the frame's inset ring.
- **Every length on the stage is a share of its width**, `window-shade`'s
  call: the stage is the `@container`, and the cards are `21.4cqw` by
  `26.2cqw` at `2.4cqw` apart, with numerals at `10.7cqw` and the axle's tabs
  scaled the same way. The values reproduce the column's own 115 by 141px
  cards, and on a 390px phone, where three fixed cards and their gaps came to
  371px in a 352px stage and clipped, they measure 75 by 92 in a 352 by 220
  stage with nothing overflowing.
- Verified in a browser: three flaps in flight through the first 600ms after
  load and none after, a press on minutes flips it one forward with the halves
  agreeing afterwards, under reduced motion no flap is ever mounted and the
  cards still show the time, and no console errors.

### `wrapped-pattern`

A printed sheet that rolls into a column. Flat, it is a drawing. Press the
mode and it curls until its two edges meet behind it, and from there a drag
turns the column, it coasts when let go, and it idles on a slow turn.
`pattern.ts` is the print, `index.tsx` the sheet, the roll and the drag.

- **The print is generated in the file, not loaded**, so the page makes no
  request for it and every strip shares one decode. It is a half-drop grid of
  dots with a hairline rule every third column and a hue that cycles every
  fifth. **The paper and the rule are the site's own `fill` and
  `stroke-strong`**, written out because an SVG in a data URI cannot read a
  custom property, and the five hues are the lab's own, each at least 4:1 on
  the paper. Three richer prints were built and thrown away: a folk band of
  rosettes and stars, then a three-ink screen print whose overprints made every
  other colour on it, then a zoetrope strip with nine drawings on its reverse.
  The demo is the roll, and a print with more in it than the roll reads as the
  subject instead.
- **Everything on it repeats on a period that divides the sheet's width**, the
  dots at 20 and the colour cycle at 100, which is what lets the column close:
  the run leaving the right edge is the run arriving at the left, so the
  wrapped sheet has no seam to find and turning it walks through the five hues
  in order.
- **The sheet is seventy-two strips sharing that one image**, each 4.17px wide
  and showing its own slice through `background-position`. Half a pixel wider
  than its pitch, since the seams between strips otherwise show as hairlines
  once they turn. 72 puts a strip every 5 degrees round the column, at which
  the facets do not show at its edge.
- **The roll is a bend, and the first build was not.** Each strip turned about
  its own centre, translated to `(1 - t) * x`, turned `t * theta` and pushed
  out `t * R`, which has the right two ends and nothing right between them: the
  strips' edges left each other and the print tore into ragged verticals for
  the length of the roll. Now the sheet lies on a cylinder whose radius closes
  from infinite to `R`. At `t` the radius is `R / t`, a strip `x` along the
  sheet sits `t * x / R` radians round it, its place is that radius times the
  sine across and the cosine minus one back, and it turns by that angle. At
  every `t` the strips lie edge to edge on one curved surface.
  - **The front face never leaves the plane the flat sheet was in.** The axis
    is what moves, from infinitely far behind the sheet to one radius behind
    it, so the container's `transform-origin` carries a z of `-R` and the turn
    is about that axis. A column whose front came forward by `R` under the
    1100px perspective grew by 4.5% on arrival, which read as the sheet
    lurching at the reader.
  - **The division needs a floor.** `R / t` at a `t` of 0 is infinity, infinity
    times `sin(0)` is not a number, and a transform with a NaN in it is
    invalid, so every strip would vanish on the flat sheet. `--tt` is
    `max(var(--t), 0.0001)`, at which the radius is 477000px and the error
    against the flat position is under a thousandth of a pixel.
- **Two numbers drive everything and nothing renders.** `--t` and `--rot` are
  written to the scene by two motion values through `setProperty`, and every
  strip's transform, its shade and the shadow's width are `calc()` off them.
  `book-opening`'s claim, with seventy-two transforms instead of fourteen.
  Measured: 84 to 86 frames across the 1.4s around a roll, longest gap 33 to
  44ms.
- **The light is the cosine of the angle a strip has actually turned to**, its
  bearing plus the column's turn, both scaled by `--tt`, as a black overlay per
  strip at `(1 - cos) * SHADE / 2`. Flat, every strip is at zero and unshaded.
  On the column the sides go to 0.21, and the back, which
  `backface-visibility` hides, would go to 0.42.
- **A pixel of hand is a pixel of the column's surface**, so the drag turns
  `180 / (pi * R)` degrees a pixel, which is 1.2. Measured: 120px of drag turns
  123.5 degrees against 124.0 expected, the gap being the idle turn that ran
  during the press. On nib's rules: down on the scene, move, up, cancel and
  blur on the window, `buttons === 0` ends it, and the pointer is captured.
- **The coast aims at where it will end, and it was skipped when it aimed at
  where the column was.** `animate(rot, rot.get(), { type: "inertia",
  velocity })` finished in 2ms and moved nothing. Motion skips an animation
  whose final keyframe is the value it already holds, and it does so before the
  inertia generator, which ignores the target and works from the velocity,
  gets to run. The target is now `rot + power * velocity`, which is the number
  the generator computes for itself.
  - **`power` equals the time constant in seconds**, 0.5 and 500, because an
    inertia leaves at `power / tau` of its velocity, and at Motion's defaults
    of 0.8 and 325 the column left the hand at 2.5 times the hand's speed.
  - **The velocity is Motion's own**, which reads zero once a value has been
    still for a frame or two, so a hand that stopped before letting go throws
    nothing.
- **The idle turn is a linear repeat at 14 degrees a second**, held in a ref,
  stopped by a press and resumed 1.6s after the hand is gone, the coast
  counting as the hand. Measured: 7.0 degrees per 500ms.
- **Arrow keys turn the column from the mode control's focus**, 15 degrees a
  step on the roll's own ease, since the drag is the only other way to turn it
  and a pointer-only path is the thing `event-stacking`'s hint argues against.
  Measured: 15.0.
- **The mode control is the site's own**, one pill whose label is the current
  state, `flat` or `wrapped`, morphed through `torph`, with the `aria-label`
  naming what a press does, `book-opening`'s call.
- **The shadow under it is one ellipse whose width is a `calc()` off `--t`**,
  the sheet's width flat and the column's diameter plus a margin rolled.
- **`cursor-grab` and `touch-none` only once wrapped.** A flat sheet takes no
  drag, so a thumb on it still scrolls the page. Seventh place the shared
  "cursor-pointer on every clickable element" rule is off.
- **`shrink-0` on the scene.** It is a 300px box in a centred flex column, and
  a narrower frame would otherwise squeeze it and take every strip's `left`,
  which is measured off the sheet's own width, off centre with it.
- **Reduced motion takes the roll in one step, and neither coasts nor idles.**
  The roll is the demo and still happens, the drag is direct manipulation and
  still turns the column, and the two motions nobody asked for go. Measured:
  `--t` reads 1 within 80ms of the press and `--rot` holds 0deg two seconds
  later.
- The sheet is 300px wide and the stage `h-164`, so it sits inside the 352px
  stage a 390px phone gets with 26px either side, and the page does not scroll
  sideways. The stage was `h-140` first, which centred the sheet, the gap and
  the control in 9px of slack and left the sheet all but touching the frame.
  525px leaves 43px above it and below the control.
- Verified in a browser: the roll settles at 1.00 by 1.1s, the label swaps,
  laying it flat returns both numbers to 0, and no console errors.

### `book-shelf`

A shelf of twelve books. Press a spine and that book comes out of the row,
turns to face the reader and lands in the middle of the stage with a scrim
behind it, which is what a modal opening looks like. `books.ts` is what is on
the shelf, `index.tsx` the shelf, the turn and the scrim.

- **The thing arriving in the centre is the object that was on the shelf,
  turned.** A modal grown out of a card is two elements and a crossfade
  between them, and it reads as a card being replaced by a bigger card. A book
  is a box: the spine is one face of it and the cover another, so bringing the
  cover to the reader is a rotation, and nothing is faded into anything. The
  frame halfway through, with the spine falling away and the cover coming
  round, is the whole argument for building it this way.
- **The spine is the front face and the cover is the right face**, at
  `rotateY(90deg) translateZ(t / 2)`, so turning the box by -90 squares the
  cover to the reader and drops the spine to the left, which is where a spine
  is when a book is held. Turning +90 instead puts the spine on the right,
  which no held book does.
- **The cover lands centred on the box's own middle, and that is what makes
  the travel arithmetic.** A face at `x = t / 2` maps to `z = t / 2` under
  that rotation, so the cover's centre finishes on the box's centre line. The
  offset to the stage's centre is then `ROW_WIDTH / 2 - (left + t / 2)`, which
  the layout already knows, so nothing is measured and no ref is read.
- **It comes out of the row before it turns, and the way back is the reverse.**
  The rotation carries an 80ms delay against the travel on the way out, which
  is the order a hand does it in: a book that turns while it is still between
  its neighbours is a book passing through them. Coming back, the depth is
  what is delayed instead, by 160ms, or the book drops level with the row
  while it is still travelling and cuts through the books it is rejoining.
  That was visible on the way back long before anyone looked for it.
- **The scrim is a plane in the same 3D scene, not a layer over it.** A
  `preserve-3d` context paints by depth and ignores `z-index`, so an overlay
  stacked on top sits behind the shelf whatever order it is given. At
  `translateZ(100px)` it is in front of the row and behind the book, which is
  what a scrim is.
  - **It has to clear the board as well as the spines.** The board's front
    edge stands at half a cover's depth, 62, so a scrim at 60 left it lit
    while everything around it dimmed, which reads as a hole in the scrim
    rather than as a scrim. 100 covers both.
  - It is twice the stage in each direction, since perspective magnifies a
    plane that far forward and a scrim with a visible corner is not one.
  - **No `backdrop-filter` on it, and that is not a taste.** With one, Chrome
    cut the backdrop it captures where the book in front of it sits and left
    two seams running the whole height of the stage. Measured as one-column
    spikes 97.5px either side of the centre, which is the cover's own 158
    magnified by the perspective at the depth it comes out to. The dim does
    the work instead.
- **The picked book was drawn twice at first and does not need to be.** The
  first build rendered a second copy after the scrim in document order, on the
  assumption that being later in the tree is what puts it in front. Depth
  sorting already does that, and the duplicate cost a second identical
  animation and a third `Put the book back` in the accessibility tree.
- **The lift under a picked book is a `box-shadow`, never a `filter`.** A
  filter makes its element a containing block and flattens the 3D context, so
  `drop-shadow` on the book would lay the box flat and take the turn with it.
- **The neighbours lean into the hole.** A book stands up because the books
  either side of it do, so a row that stays perfectly upright with one book
  missing is the one thing a shelf never does. The lean falls off with
  distance and stops after three, and the two nearest do nearly all of it.
  - **It is capped, and a book that already leans takes none of it.** A lean
    pivots on the corner the book stands on, so it swings its head sideways
    by its own height times the sine: at this scale ten degrees is 43px,
    which is two neighbours away. The leaning book at the end of the row,
    tipped further into its neighbour, drew straight across it.
- **Every book carries its own cloth, ink and band**, which is the exception
  the other fifteen labs take: twelve objects built from the same three
  rectangles need colour to tell them apart. The ink is whichever of cream or
  near-black clears 4.5:1 on its own cloth, checked for all twelve, and every
  band clears 1.6 on the same cloth, which is a visible step rather than a
  second colour.
- **A spine under 18px carries no title**, which is what a thin book does.
  Thickness and height are the other two differences, and they are what make
  a row of spines read as a shelf rather than as a bar chart.
- **One book leans at rest**, since a shelf with room left in it always has
  one, and it stands up as it comes out. Its `transform-origin` is the corner
  it is standing on rather than its centre, or it pivots in mid-air.
- **That origin carries a z, and without it the hover ate the foot.** The
  corner a book stands on is at the front of the board, not through the
  middle of it, so a tip about `bottom` alone rotates around the centre plane
  and swings the foot of the spine backwards and down, where the board it is
  standing on then covers it. `bottom ${COVER / 2}px` pivots on the front
  edge and only the head comes forward.
- **It closes three ways: the book again, the scrim, or Escape**, which is
  what the shared rules ask of a modal, and the scrim is a real button rather
  than a div with a handler so the keyboard reaches it.
- **A hovered book tips its head out rather than sliding forward**, which is
  how a hand takes one off a shelf and, more to the point, is the only
  version of it that can be seen. Coming forward on its own is almost
  nothing: at this perspective 18px of z moves a spine about a pixel and a
  half, and a probe across all twelve boxes measured no box moving at all.
  A seven degree tip about the corner it stands on reads. Hover is gated on
  `pointerType`, mouse and pen only, the call `folder-stack` documents.
  - **The tip is the one thing here not on the pick's spring**, which is the
    lesson `stamp-collection` writes up at length. That spring carries a book
    across the stage, and seven degrees on it spends most of its time on the
    last fraction of a degree, which reads as the shelf being slow rather
    than as a short move being short. On a sharp ease-out over 160ms the tip
    measures 6.14 of its 7 degrees by 100ms and is done by 200.
- **The stage is a wall, not a white page.** Three of the twelve books are
  bound in cream, and on `bg` they were a hairline and a shadow: a pale cloth
  needs a ground that sits off white to read against. It is a radial from
  `bg` through `surface` to `fill`, centred above the shelf, so the row is
  the brightest thing in the frame and the corners fall away, which is
  `flip-clock`'s call for its own lit table.
- **Depth is drawn as light, not as fills.** The spine carries a gradient
  along its width for the round of the board, grain over the cloth, and blind
  rules pressed above and below its panel. The cover carries the same grain, a
  blind border pressed into the board, a pasted paper label with its own
  shadow, and a stamp at the foot. Every one of those is white and black at
  low alpha over the book's own colour, which is the rule `document-pocket`
  sets for shading a surface.
- **The label is one paper and one ink for all twelve.** A label is a label:
  the cloth under it is what tells the books apart, and a per-book ink on a
  cream paper would be twelve contrast checks for no gain. Near-black on it is
  13.6:1.
- **Nothing on the board follows the pointer.** A tilt toward the pointer was
  built and removed, and so was the version that pressed the corner being
  pointed at, with a light tracking the hand and the label drifting against
  it. The demo is a book coming off a shelf, and a cover that answers every
  pointer move competes with the one movement it is about.
- **The page block is the face opposite the spine**, at `rotateY(180deg)`,
  and it is edge on once the cover is square to the reader, so it costs
  nothing there. It is most of what the book looks like halfway through the
  turn: without it the book is two boards with nothing between them.
- **Reduced motion keeps every state and drops the travel.** Verified: 60ms
  after a press the picked book already carries its finished matrix.
- **The row is 428px wide against a 538px column, and the whole scene scales
  to whatever the frame gives it, less a margin.** A `ResizeObserver` writes
  one number and the perspective container carries `scale(var(--fit))`, so
  the shelf is sized for the column rather than for the narrowest screen it
  has to survive, and the 70px held back at each side is what keeps it off
  the frame's edges. Since the scale is about the stage's own centre, that
  margin buys height at the top and bottom as well.
  - **Everything is centred on the overhang, not on the boxes.** A lean
    pivots on the corner the book stands on, so the leaning book's head
    reaches 36px past the row the layout knows about. Centring the boxes left
    55px of frame on one side against 41 on the other. Centring on the row
    plus the overhang, and moving the picked book's target with it, makes
    both 56.
  - **A 24px nudge downward evens the frame vertically.** The scale pulls the
    shelf toward the stage's centre, and the books stand on a board near the
    foot rather than filling the box, so it ends up sitting high: measured at
    rest, 93px above against 134 below, and 113 against 114 after.
- Verified in a browser: twelve spines at rest, a press leaves eleven and one
  put-back plus the scrim's, the scrim closes it, Escape closes it, and no
  console errors.

### `crack-button`

A Save button made of glass. Every press cracks it from the point it was hit,
the cracks accumulate, and the eleventh takes the face apart. `crack.ts` is the
fracture geometry, pure and DOM-free, `index.tsx` the button and the break.

- **It invents no colour, which is rare for a lab this visual.** The face is the
  site's own primary button, `text-primary` with a `bg` label, and the shards are
  the same token. A crack is white and black at low alpha, which is the rule this
  repo already sets for shading a surface. Dark glass is also what a hairline
  fracture reads best on: the reference is a blue pill, and on one the lit half of
  every crack had nowhere to be.
- **The slab is drawn entirely in light, and nothing in it is a colour.** The body
  gathers light under its top face and pools shadow at its foot, which is what
  gives a flat fill a belly. The rim is three hairlines, a lit top edge, a
  shadowed bottom one and a faint ring all round, which is the thickness seen edge
  on. Then three shadows under it, a contact line, a short cast and a wide
  ambient, since one shadow dark enough to read at this size looks like a drop
  shadow rather than like light. `document-pocket` sets that recipe.
- **The two rounded caps are the brightest part of it.** At a curved edge the
  light crossing the glass has further to travel and leaves at a shallower angle.
  Without them the radius reads as a shape the fill happens to stop at rather than
  as glass turning a corner.
- **A press seats the slab into the table.** The travel is a pixel and a half and
  the cast shadow closes from 18px to 9px, measured. Keeping the lift while the
  button moves down reads as a sticker sliding rather than as a slab being struck.
- **Hover is optical and nothing moves.** The sheen brightens and a second one
  comes up from the foot. The site scales nothing on hover, and a slab that rises
  under a pointer is a slab that is not resting on anything.
- **A crack is two strokes, not one.** A fracture is a gap in a solid, so one face
  of it catches the light and the other is in shadow, half a pixel apart. One
  stroke of either is a scratch drawn on a button. A third, wider and much fainter,
  sits behind them for the fracture plane running down into the glass, which is
  what a crack in a slab shows and a crack in a sheet of paper does not.
- **Every crack scales with the damage already done.** Eleven identical stars is
  eleven of the same event, and the face is an unreadable web by the fourth. A
  pane under repeated blows gives a little at first and a lot at the end, as each
  press finds the flaws the last one left, so an early press is two short arms and
  a late one is five long ones that fork. The label gives way on the same ramp:
  two steps was enough over five presses and over eleven it sat at one value for
  six of them, which left the thing that is supposed to be failing as the one
  thing on the face not changing.
- **A crack stops where it meets an older crack, and this is the one that makes it
  read as glass.** A fracture cannot cross a free surface: the stress driving it
  has nothing to pull against once it reaches an opening, so real broken glass is
  one connected web of T-junctions and never a pile of independent stars laid over
  each other, which is what this was until the eighth press made it obvious. Every
  walk is truncated at its first intersection with anything already open,
  including the branches of its own press, with the first segment exempt so a fork
  does not terminate on its own parent.
- **A crack is a walk, not a curve.** It leaves the impact in a direction, wanders
  either side of it as it follows whatever flaw is in front of it, and throws off
  branches that do the same: a step, a small turn, a step, and a chance at each
  joint of spawning a child that leaves at an angle and dies sooner.
- **It draws on from the point pressed, in 140ms, linear.** A fracture front is
  the fastest thing in this demo and it does not ease. `pathLength="1"` keeps the
  dash a plain number rather than something `getTotalLength` has to measure, the
  trick the signature player documents.
- **The break is a partition of the face, not a pile of shapes.** Every shard is
  the wedge between two walks out of the last impact, so each edge is one walk
  shared by the two shards either side of it: nothing is drawn twice and no gap
  can open between neighbours. The walk is jagged for the first 90px and straight
  after, since only the first 90 is ever on screen.
- **The clip is inside the thing that moves, and this was the bug worth
  keeping.** A shard is the pill's own glass, so it is cut to the pill before it
  goes anywhere. With the clip on the moving group the pill became a window the
  pieces slid out of and vanished at, which reads as the button being wiped rather
  than broken: measured at 680ms into the break, four of the nine shards were
  painting nothing at all.
- **A pane comes apart, it does not blow up.** What separates two pieces is the
  width of the crack between them and nothing else, so the sideways travel is a
  few pixels and gravity does the rest. The first build threw them 44 to 102 with
  up to 55 degrees of spin, which is a cartoon of breaking rather than breaking.
  They do not all let go together either: a crack runs through the pane and one
  piece drops before the one beside it, which is most of what separates a pane
  failing from a sheet being deleted.
- **The pieces fall out of frame rather than fading where they are.** A fade is the
  pane being deleted, and what happened is that it fell. The stage clips, so
  leaving is something the geometry can do on its own.
- **One light across the pane, not one per piece.** The shard gradient is
  `userSpaceOnUse`, since the default resolves against each shape's own box: on
  nine pieces of one pane that is nine separate lights, and a small shard was lit
  top to bottom across four pixels while its neighbour was lit across forty.
- **Each shard carries its own side wall**, the same piece offset by the glass's
  thickness and drawn under the face, so what shows is the edge nearest the reader.
- **There is no separate shadow under the button.** It had one, and once the slab
  carried its own three-layer stack that was a second shadow under one object.
- **Nothing is switched off on the frame the glass breaks.** The label is printed
  on the glass, so every piece carries it whole and clipped to its own wedge, and
  every crack the pane already had is drawn on the piece it was on. Without
  either, five presses of damage and the word on the button were wiped in one
  frame and the pane broke into clean wedges it had never had. `lowercase` is
  spelled out on that text, since SVG text does not pick up the `text-transform`
  the stylesheet puts on `body`, and the label came back capitalised on the one
  frame nothing about it is allowed to change.
- **The shards fly on two curves.** A thrown piece keeps whatever sideways speed
  it left with, which is linear, while gravity accelerates, which is a quadratic
  ease-in. `shelf-drop` documents the same split.
- **The recoil is driven from the press, not declared.** An `animate` prop holding
  `[0, 1.5, 0]` is the same array on every render, so Motion sees no change and
  the knock plays once and never again. A motion value animated from the handler
  replays on every press and renders nothing.
- **A repaired pane is set down rather than switched on**, fading up and rising
  the last seven pixels into place. It gets its own element, wrapping the one the
  knock moves: both want `y`, and a motion value handed to `style` owns that
  transform outright, so animating the same value from the reset handler set it
  and never moved it again, measured at 7px on every frame of a 420ms rise. Two
  elements is the whole fix, the same split the hover takes in `shelf-drop`.
  Nothing arrives on the first paint, since `Reveal` already brings the demo in,
  and the exit stays instant: the shards are what the reader follows out, and a
  button fading under them is a second answer to one press.
- **Putting it back is two different things.** A cracked pane is mended, the
  cracks running back into the points they came out of, newest first, which is the
  draw-on played in reverse and the only chance anyone gets to watch a fracture
  move: on the way out it is over in 140ms and this takes 340. A broken one cannot
  be mended, since it is on the floor, so that gets a new pane set down. Saying so
  is most of why the repair is worth watching at all.
- **The glass is synthesised, not recorded.** `poke-sound.ts` decodes one mp3 and
  plays a source node per press, which is right for a click, and this is eleven
  sounds that have to get sharper as the pane gives plus a shatter that is a
  scatter of them. So a crack is a filtered noise burst with a fast decay, the
  filter climbs and the decay shortens with the damage, and a shatter is the same
  burst twelve times on a falling curve over a low body. The page fetches nothing.
  The clock is unlocked on `pointerdown` and played on the release, the two-step
  `poke-sound.ts` documents: a context made outside a gesture starts suspended and
  queues what is started on it, so resuming later fires the lot at once.
- **The cracks are masked by the sheen.** They were painting at one brightness
  through a face that has a highlight running across it, which is the tell that
  they are drawn on rather than in. The mask bottoms out well short of black,
  since a crack in the dark part of a pane is dimmer and not absent.
- **Each impact leaves a crush zone.** A struck pane goes opaque in a small halo
  before any crack leaves it, which is the glass powdering rather than parting. It
  is the one part of the drawing that is not a line, and it retreats with the
  cracks when the pane is mended.
- **The repair arrives with the first crack, not with the break.** A reader who
  cracked the glass and stopped is exactly the reader who wants it. It sits under
  the button, where a press cannot land on it by accident.
- **`select-none` on the whole stage, not on the label alone.** The gesture is
  eleven presses in a flurry, and a rapid multi-click anchors a selection on the
  nearest text it can find. On the label that is the word on the button, and once
  the glass has gone the presses land on bare stage, which is the case
  `portrait.tsx` documents: with nothing selectable under the pointer the
  selection reaches into the prose below and the page grows a highlight and a pair
  of `SelectionPins` carets for a gesture aimed at a button. Measured on sixteen
  rapid presses, a triple click and a drag right across the stage: no ranges at
  all, and the description under the demo still selects.
- A keyboard activation reports no coordinates, which arrives as a `detail` of 0,
  the call `book-opening` and `halftone-ripple` both make, and lands in the middle.
- **Reduced motion keeps every crack and every break and drops the travel.** The
  cracks appear whole rather than propagating and the shards fade where they are.
  Verified: `strokeDashoffset` reads 0 on the frame a crack appears.

### `stem-picker`

A quantity stepper where the thing being counted is the thing you see. Press the
plus and a stem arrives: it starts under the knot, small and invisible, swings up
on an arc and settles into the fan. Press the minus and the newest one is lifted back out. `stems.ts` is the varieties and the fan geometry, `stem.tsx` one
flower drawn upright, `stem-sound.ts` what a stem sounds like, `index.tsx` the
bunch, the pull and the controls.

- **The arrival and the resting place are the same geometry, and that is the
  whole design.** Every stem is pinned at the knot and differs from its
  neighbours by one number, the angle it leans at, so a stem arriving is that
  angle changing. Arc an item into a straight row instead and the arc is
  decoration laid over the top: the item swings in, then stops somewhere the
  swing does not explain. That is the reason the subject is a bunch and not a
  shelf, a row or a stack.
- **Depth is scale about the knot, never a z translate.** A stem enters at 0.62
  and grows to 1 with its origin at the tie, so its bloom starts close to the
  knot and travels outward as it rises, which is what reads as coming forward.
  It costs no `perspective`, no `preserve-3d` and no stacking order, which is
  what a real z would have dragged in behind it. `shelf-drop` needed all three
  because its cards genuinely pass a plane. Nothing here passes anything.
- **Two springs, because two things happen on one press.** The stem that arrives
  is being placed and the ones already there shuffle over to make room. On one
  spring the whole bunch bounces every time, which reads as the table being
  knocked rather than a flower being added. So `rotate` takes the quieter spring
  and `scale` the livelier one, and since only the arriving stem ever animates
  its scale, the bounce lands on that stem alone. No branch on which stem is new
  is needed, which is the point: the property each is already animating decides
  it.
- **The drawing is rotated by the box it sits in, not by itself.** A rotation in
  SVG resolves against the viewBox origin unless told otherwise, and setting
  `transformOrigin` in `style` on a Motion SVG element gets overridden. The stem
  is drawn upright in its own viewBox and the HTML box around it carries
  `origin-bottom`, where a transform origin is simply the corner you name.
- **The bunch is the control, and the tie is the handle.** Two grey circles
  beside a picture is a button demo. Gripping the tie and pulling draws stems in,
  pushing down takes them out, and the stepper stays for the keyboard and for
  anyone who wants it. That is what every other experiment here does and what
  this one was missing: the object answering the hand rather than sitting beside
  the controls that change it.
  - **The pull tracks the hand and the count commits on the detents it
    crosses**, so every stem still arrives as its own event with its own sound
    and its own knock. One step per move event, which rate limits a flick with no
    timer and reads better than four landing in one frame. 30px of hand per stem,
    so the whole range is 240px, which is about the length of a comfortable pull.
  - **Past either end the bunch gives and springs back.** A hard stop feels like
    hitting a wall where resistance says there is nothing further, which is the
    rule every gesture on this site follows. It strains by a third of whatever
    the pull asked for past the limit, capped at 15px. Measured at the ceiling:
    count 9, strain -15px, and the transform back to `none` after the release.
  - **`touch-action: none` is on the grip alone**, `window-shade`'s trade: a
    vertical drag there is the gesture and a vertical drag anywhere else on the
    stage is still the page scrolling past. The stage keeps the browser default
    rather than `pan-y`, since nothing here wants the horizontal axis either.
  - **It is a `slider` with arrow keys**, since that is what it is, rather than a
    bare div carrying pointer handlers with no keyboard path.
  - **The grip carries a minimum size in px against the `cqw` that sizes it.**
    On a 390px phone 12 by 9 works out at 36 by 27, under the floor for something
    a thumb has to find. `min-w-14 min-h-14` holds it at 45 square there and lets
    it grow to 58 on the column.
- **The bunch leans toward a nearby pointer and never while it is held.** A
  degree or two, under the threshold for reading as an animation and over the
  threshold for reading as alive. Mouse and pen only, `folder-stack`'s gate.
- **The bloom opens as its stem settles, and again when a shuffle changes it.**
  It is a nested group of its own, because a CSS `transform` replaces an SVG
  `transform` attribute outright rather than composing with it, and the group
  above it already carries the lean, the tilt and the variety's size as an
  attribute. `transform-box: fill-box` is what makes `transform-origin` resolve
  against the bloom's own box rather than the viewBox origin, which is the same
  trap this file avoids for rotation. The keyframe is `stem-bloom` in
  `globals.css` behind `motion-safe:`, `folder-stack`'s call.
- **The shuffle refuses to return the order it was handed.** With nine varieties
  a Fisher-Yates lands on the same arrangement often enough to notice, and a
  control that visibly does nothing is worse than not offering one. It is also
  the only thing giving a reader a reason to press twice, and the only way to see
  the whole palette below nine stems.
- **The stems touch.** A landing stem knocks the two beside it and they swing
  back, hardest on the nearest: the impulse falls off with the square of the
  distance, so the stem next to the slot takes 2.8 degrees and the one past it
  0.7. Without it the arrival and the re-spread are two independent animations
  that happen to overlap, which is what every stepper demo looks like. The knock
  is delayed to where the stem actually lands rather than fired on the press.
- **The knock lives on its own element.** The box above owns the fan angle
  declaratively and a motion value handed to `style` owns that transform
  outright, so the two cannot share one `rotate`. `crack-button`'s repair makes
  the same split for the same reason. Measured mid-knock: -2.09 degrees on the
  nearest neighbour, -0.52 on the next, 0 on the stem that just arrived.
- **A bloom at the edge of the fan is seen turned away, so it is narrower.** The
  bloom faces along its own stem, so the foreshortening is the cosine of the
  lean applied as a plain `scaleX`. Measured across a full bunch: 1.000 at the
  centre, then 0.988, 0.953, 0.895 and 0.816 at the outermost. Doing it as a
  `rotateY` would have been a perspective and a stacking context per stem to
  squash a shape, which is what the depth note above already refuses.
- **Leaving is a lift, not the arrival reversed.** A hand taking a stem out
  pulls it clear and turns it further out on the way. Playing the entry
  backwards is the lazy default and reads as an undo rather than as a stem being
  taken.
- **Hold either control and the count runs**, 380ms before the first repeat and
  165ms between them, the way every real stepper behaves. A press that ran the
  count still ends in a `click`, which would add one more on top of everything
  the hold already did, so a flag set by the repeat is what tells a plain press
  from the tail of a held one. Verified: a single click moves the count by one,
  and a 1.25s hold runs it to the ceiling and stops there.
- **Atmospheric perspective across the fan.** A bunch has a front and a back and
  this was nine equals on one plane, so a stem's opacity and scale step with its
  own index. Keyed off the index rather than the current count, or a stem's
  depth would change under it as the bunch fills.
- **One shadow, under the tie, widening with the count.** The bunch is the only
  thing in the frame casting anything and it spreads as the fan does.
- **The sound is synthesised, not recorded.** `crack-sound.ts` sets the shape:
  one context, one noise buffer, a filtered burst per event, nothing fetched. A
  stem is a quieter problem than a pane of glass, so adding one is a broadband
  rustle with a fast decay and no pitch in it at all, plus a soft low knock 180ms
  later where the cut end meets the others at the knot. Taking one out is the
  same rustle run shorter and drier with no knock, since nothing lands. The clock
  is unlocked on `pointerdown` and played on the change, the two-step
  `poke-sound.ts` documents.
- **The fan opens on a curve, not per gap.** Eleven degrees a gap put the second
  stem five and a half degrees off the first, which is two blooms sitting on top
  of each other, and it then ran past anything a hand could hold before the
  ninth. `SPREAD_MAX * (1 - exp(-(count - 1) / 3))` opens decisively and fills in
  after: 21 degrees at two stems, 37 at three, 56 at five, 71 at nine. Every
  press changes the shape, so the count is legible before the number is read.
- **Nine varieties in three forms, because colour alone is not enough.** Nine
  blooms built from one ring of ellipses is nine of the same flower in different
  colours, which reads as clip art however the colours are chosen, and the first
  build was exactly that. An open bloom, a pompom and a cup carry most of the
  variety and the palette does the rest. The hues are the fourteenth scoped set
  in the lab and the narrow form of that exception: a market bunch is mixed by
  definition, so they are the product rather than a tint on one. The first
  palette was evenly spaced round the wheel and read as a generated set, the trap
  `folder-stack` writes up. A cream anemone is what broke it.
- **The per-stem wobble is an integer hash, and the usual one does not work.**
  `sin(x) * 43758.5453` is a GLSL trick that degenerates on small integer inputs:
  measured across the nine stems it gave five of them the same tilt, 2.0 to 2.2
  degrees, and put a leaf on none of the first two. Whether a hash is good enough
  is something to check by printing it. The salt matters too, and the first one
  picked put seven leaves of nine on the same side of the stem.
- **It is a hash rather than `Math.random` because a stem is re-rendered every
  time the count changes.** A fresh roll would make the whole bunch twitch when
  one stem arrives.
- **Not every stem carries a leaf.** Nine leaves at one height gather into a
  single green mass above the knot, which reads as a hedge. Two in three, at
  varied heights, is enough to say the bunch has leaves in it.
- **The twine is not there at one stem.** It holds a bunch together and there is
  nothing to hold together yet, so a band around a lone stem reads as a pot. It
  arrives with the second stem on that stem's own spring, so the two land
  together.
- **Both readouts are `torph`,** `book-opening`'s 200ms on the same ease, since
  what a press does to either is correct it. The number is off the type scale on
  purpose, the standing `flip-clock`'s numerals have: it is the object the two
  controls act on rather than copy. The line under it is a second readout on the
  same count, so it morphs too when the ninth stem turns "hand tied, market
  bunch" into "the whole bucket". It carries `whitespace-nowrap` and never
  `truncate`, which is `event-stacking`'s note: torph lays its characters out
  itself and an `overflow-hidden` box on the same element clips them mid-morph.
  Measured across that change: 138px wide with 8 items, both strings co-present
  at 13 items 40ms in, settling at 97px.
- **The stepper is a real `fieldset`,** which is what a group of related controls
  is, with `min-w-0` because a fieldset's default `min-width: min-content` is one
  of the few boxes that does not start at zero. Both buttons carry the
  `disabled:opacity-50 disabled:cursor-not-allowed` pair, and the floor is one
  stem rather than none.
- **`select-none` on the whole stage.** The gesture is a flurry of presses on two
  small controls, which is `crack-button`'s case exactly: a rapid multi-click
  anchors a selection on the nearest text it can find.
- **Reduced motion keeps every stem and drops the travel.** A stem appears on
  its angle rather than swinging to it, and the fan re-spreads in one step. The
  fade is kept, since that is the half of the arrival carrying no movement.
  Verified 70ms after a press: the arriving stem is already on its final
  rotation and only its opacity is still moving.

### `pixel-reveal`

One flat tile. Pick one of five pictures from the strip under the board, press
generate, and that tile splits into four, then sixteen, and keeps halving until
the tiles are small enough to stop being tiles, at which point the picture
arrives over the top. One icon beside the press saves what resolved as a PNG
and the other opens the three numbers driving it.
`artwork.ts` generates the five pictures, `mosaic.ts` is the mip pyramid and the
painter, `controls.tsx` the knobs and the strip, `index.tsx` the canvas, the run
and the disclosure.

- **Nothing fades in, and that is the whole idea.** Every level is a box filter
  over the one below it, so the picture is complete from the first frame and the
  filter is what throws it away. At one cell it is its own mean colour, at four
  it has its largest areas, at sixty-four it has its crystals. A reveal built as
  an opacity ramp over a finished image says nothing about why detail arrives in
  the order it does. This says it by construction.
- **The pyramid is built by halving, not by averaging each level out of the
  source.** The arithmetic is identical either way and this is one pass over each
  level rather than one pass over the source per level.
- **There are no levels, and that is the change that mattered most.** An earlier
  build stepped the whole canvas from one grid to the next. Even with the tiles
  staggered it read as a set of layers arriving rather than as detail growing,
  because at every boundary the timing re-randomised: a region that had resolved
  early had no reason to stay early. It is a quadtree now. Every tile splits on
  its own schedule and that schedule is inherited from its parent, so a tile that
  went early has children that go early, detail spreads out of the places it
  already reached, and at any moment the canvas holds four or five tile sizes at
  once.
- **A tile's children come out of that tile, not out of a fresh grid.** Four
  children sitting on their parent's box in its colour are that parent pixel for
  pixel, and over the flight each shrinks to a quarter of it and slides to its
  corner.
- **`WAIT` has to be at least `FLIGHT`.** A tile that split while still
  travelling would hand its children a box that is itself moving, and they would
  come out of the wrong place.
- **The motion is continuous, and getting there took two fixes that a still frame
  cannot show.** Measured as frame-to-frame difference across the run, the
  first build spiked at every level boundary and then sat near zero for eight
  frames behind it, six times: a bang and a lull, which is exactly what reads as
  stepping.
  - **The seam belongs to the tile's size, never to the transition.** Tied to the
    flight it collapsed to nothing at every boundary, since the tiles that had
    just arrived at their seams became parents with none. A tile's size is the
    same on both sides of a boundary, so a seam derived from it cannot jump.
    That was the spike.
  - **Departures are biased toward the start of a transition.** Spread evenly, a
    twentieth of the way in only a twentieth of the tiles had gone, so every
    level opened with the field almost still. Squaring the roll puts a quarter of
    them in the air in the same window and leaves a thin tail behind, which is
    what the ragged middle wanted anyway. That was the lull.
  - **A tile leaves at speed and arrives gently, and never eases in.** Smoothstep
    meant each level accelerated from rest and settled back to it, so the run was
    six accelerate-and-stop cycles rather than one refinement.
  - Measured after: 6 frames of 224 below the still threshold, 2.7%, and the
    longest unbroken still run is 3 frames, 50ms.
- **Each tile leaves on its own beat.** That is what gives a transition its
  ragged middle: some cells have already split while their neighbours are still
  one block, so the tiling is irregular the whole way through and only squares up
  at the end. The order is hashed off the cell rather than rolled, or a run would
  shimmer. All of them arrive on time, since the delay is divided back out of the
  remaining time.
- **A tile that has not left yet paints over the siblings that have**, since it
  is still holding the whole parent box and document order puts it under them.
  That is not a defect to design around, it is most of what makes the middle of a
  transition read as blocks of different sizes rather than as a grid with some
  cells missing.
- **The ground under the seams is the picture's own mean colour, never the
  page.** Cleared to transparent the gaps let the white stage through, and at
  sixteen cells across that reads as a dotted screen laid over the picture rather
  than as tiles with a little air between them.
- **The run is linear in the level, not in the cell count.** Each step doubles
  the grid, so even time per level is even time per doubling, which is what reads
  as steady. Timed in the resolution instead, the first half would be over before
  anything had happened.
- **It stops at sixty-four and the picture arrives over the top.** That is where
  the tiles stop being the subject and start being a screen door over it, so the
  last beat is a crossfade to the sharp image rather than the run carrying on to
  two hundred and fifty-six.
- **Every subject is nested areas, which is not decorative.** What survives a box
  filter is whatever the picture's largest areas are, so a subject built of
  nested areas at every scale has something to give at every level. A photograph
  of a face would be a grey square until halfway through. The agate's nucleus is
  off centre for that reason, since a slice cut through the middle carries
  nothing at four cells across, and it has crystals in its core because without
  them the run has nothing left to give after thirty-two.
- **Five, and each is a different family of shapes.** `agate` is rings inside
  rings, `strata` beds under beds, `nebula` clouds inside clouds with a scatter
  of stars, `canopy` a branch that is two smaller branches six times over, and
  `lichen` a patch beside a patch. Five variations on one family would resolve
  the same way and there would be nothing to choose between them, so the
  geometry differs rather than the palette: `strata` at two cells across is a
  pale half over a dark one where the agate is four of about the same thing, and
  `canopy` is the one drawn dark on light.
  - **`canopy` lost its banded sky for that reason.** It was three flat bands, a
    sun and a ground, and its coarse levels were a row of horizontal stripes,
    which is what `strata` already is. One sky and one disc instead.
  - **A tree is the only one that is self-similar by construction**, and a strict
    binary tree is a thin Y at every scale, so its two lowest forks carry a third
    limb. What makes a crown read as mass at four cells across is the odd limb.
  - **`nebula`'s dust lane is a ragged chain of clouds, not a stroke.** Drawn as
    a stroke along a curve it was a band of even width, which over the bright end
    read as a ring round a planet, and thinning it turned the ring into a
    scratch. The chain is one `<g>` at one opacity rather than fifteen shapes
    each at its own, since overlapping translucent blobs compound where they
    meet and drew it as a row of beads. It crosses the chain rather than running
    along it, since along it swallowed the bright end, which is what the last two
    levels are for.
- **The palettes are chosen for range rather than for hue.** A box filter
  averages, so a set sitting in one narrow band of lightness resolves into
  porridge at every level. Measured in relative luminance, the five run 0.014 to
  1.000, 0.013 to 0.822, 0.003 to 1.000, 0.012 to 0.964 and 0.053 to 0.791. The
  picture also finds its colour over the first half of the run, desaturated
  toward its own luminance, so the early levels read as a thing developing rather
  than as a finished picture seen badly.
- **Every outline is a sum of three harmonics rather than a noise walk**, which
  is what guarantees the path closes on itself exactly. One harmonic gives an egg
  and two give a peanut. `strata`'s beds are the same sum run across the picture
  rather than around a centre, and each is filled to the foot of the frame with
  the next painted over it, so only the band between two edges ever shows.
- **Nothing rolls at runtime.** Every wobble is a hash of its own index, so the
  same slice is cut and the same field scattered on every load, and the swatch a
  reader picks is the picture they get. It is an integer hash rather than
  `Math.sin(x) * 43758.5453`, which `stem-picker` documents measuring and
  finding degenerate on small integer inputs.
- **The canvas rests on one flat tile, never on nothing.** An empty white box on
  a white stage is what a failed image looks like, and it threw the premise away
  besides: one cell is the picture's own mean colour, so level zero is a real
  frame of the run rather than the absence of one. Pressing generate now splits a
  pixel instead of filling a hole, and the reader meets the argument before the
  demonstration.
  - **Picking a pattern at rest changes that tile**, since no two of the five
    average to the same thing. It is a grey rather than a colour, because the
    bleach is at zero until the run starts, so what a pick moves is the value:
    measured off the board, 105, 116, 43, 189 and 163. The strip is where the
    colour is.
- **The strip belongs to the board, not to the knobs.** What it changes is the
  picture and the three lanes are the run's own numbers, so it sits under the
  board and takes the board's width. The swatch size is derived from that like
  everything else here, 46.1px on a column and 35.7px at 390, and the 16px
  between them is what makes the two read as one object: a picture and the five
  it could be.
- **A swatch is the picture, not a name for it.** The site's answer to a discrete
  choice is one control whose label is its current value, which `book-opening`
  documents, and that answer is for a value a word can carry. "strata" says
  nothing about what a reader is about to watch resolve, and cycling five of them
  to find out is four presses of guessing. It does not give the run away either:
  what the demo is about is the order detail arrives in, and a reader who has
  seen a 42px thumbnail knows the subject and none of that.
- **Real radios, visually hidden inside their labels**, which is the build
  `the-submenu-closes-before-you-get-there` uses for its own single choice. The
  arrow keys walk the group, the checked state is the browser's, and the strip is
  one tab stop rather than five. A row of buttons carrying `aria-pressed` would
  say five toggles where there is one setting. Verified: the group is entered at
  the selected swatch, the arrows move the selection and repaint the board, and
  Tab leaves for the three lanes.
- **The focus mark is an `outline` and the selection mark is a ring**, so the two
  compose rather than one replacing the other. Both as rings, focusing the picked
  swatch swapped its black ring for the pale focus one and the strip lost its
  selection for as long as the keyboard was in it. Same width, colour and offset
  as the project's focus pattern, on the other property, which is the call
  `window-shade` makes.
- **The unpicked swatches are dimmed as well as unringed.** A hairline against a
  2px ring is a difference a reader has to go looking for when the thing inside
  each box is a different picture with its own edge. Hover takes a swatch back to
  full, so the strip is legible under the pointer and marked without it.
- **The readout sits on the board, not beside it.** In the control row it
  reserved 77px whether or not it had anything to say, which pushed the button
  44px off the board's own centre line for the whole of the resting state, and
  left its left edge 4px from the board's, which is the worst distance there is.
  On the board the row is the button alone and it centres on 640 with the board
  and the stage. The chip is black at alpha rather than a token, since it sits
  over a picture running from near black to white across the run and no surface
  token survives both ends. That is the scrim exception the shared rules carry.
- **Both stages size their subject off a custom property rather than a number.**
  At one share the board came to 147px on a 390px phone, smaller than the button
  under it, and the bunch in `stem-picker` came to 93px against a 75px stepper. A
  wide stage has width to spare and a narrow one does not, so the narrow one
  spends far more of it: 68cqw against 50 here, 52 against 31 there.
  - **The property is set on the container and read by its children, which is
    the only arrangement that works.** An element is a query container for its
    descendants and never for itself, the trap `document-pocket` documents at
    length, and a custom property is not resolved until it is used. So
    `--board: 68cqw` on the stage is meaningless to the stage and correct for
    everything inside it.
  - **`stem-picker` keeps a ratio at both widths and this stage has none.** A
    panel that unrolls changes the demo's height by definition, so there is no
    ratio to hold. Two ratios were tried and both failed for the same reason,
    which is that the board is a share of the stage's width and the controls
    under it are not: at `3/4` the stacked layout was 24px short of its own
    content at 390 and left 145px of empty stage under the button at 600, and at
    `4/3` there was no height left for a strip under a board worth looking at.
    Measured now, the stage is 538 by 440 from a 500px window up and 352 by 378
    on a 390px phone, with nothing overflowing at any width from 320.
  - **A content-driven height is also what keeps the board still.** With nothing
    to centre against, the column starts at the top padding and everything new
    appears below it, so opening the knobs does not move the picture: measured,
    the board's top holds at 38.4px through an open at 1280 and at 390, while
    the stage goes 442 to 517 and 378 to 569. That is `rain-splatter`'s rule
    about a disclosure growing from the edge nobody is looking at, arriving at a
    centred column rather than a full-bleed one.
  - **The board's size is one expression rather than a share per breakpoint.**
    `min(68cqw, 16rem)` spends most of a narrow stage and stops growing on a
    wide one, where two shares stepped the board 331 to 256 across `sm` for no
    reason a reader could see, since the layout either side of it is the same
    centred column. The cap binds at a 456px stage, which is a 494px window.
  - **The `cqw` is read by the children and never by the stage.** A custom
    property is not resolved until it is used, and every use is inside, which is
    what makes a share of the container legal on the container. The panel's
    `@md:` columns are the same rule from the other side: it is a descendant, so
    the query reads the stage.
- **`shrink-0` on anything with an explicit height inside these stages.**
  `stem-picker`'s bunch box carries its height in `cqw` and was a flex item in a
  column, so on a short stage the column simply squashed it: measured 71px
  against the 101px it asked for, which made the drawing smaller than the
  controls beneath it. A declared height is not a floor unless the item is told
  not to shrink.
- **The gutters are the composition, and the board gives way to them.** At 58cqw
  the board stood 7px off the stage's top and bottom and the gap to the controls
  was the same 19px as the padding, so nothing in the frame had room. It is 256px
  in a `p-12` frame now: 38px of clear stage above the board and below the
  button row, 141px either side of the board, 16px from the board to its strip,
  and 32px from the strip to the buttons. The rhythm is what the grouping is
  made of, since nothing here is boxed: the board and the strip are one object
  at 16, the press is a step away at 32, and the knobs are a section away at 40.
- **One centred column, and the knobs are behind `tune`.** The picture, the five
  it could be and the press that resolves it are the demo, and three lanes
  standing beside them read as a form with a painting in it. A disclosure costs
  nothing at rest and the column then has one axis: board, strip, buttons, each
  narrower than the last.
  - **It was two columns before, board on the left and the lanes on the
    right.** That fit the knobs in for free and it spent the stage's whole width
    on them, which capped the board at 237px and left the demo reading as a
    control panel with a preview attached.
  - **The trigger is a quiet pill beside a filled one**, with the same icon
    `rain-splatter` uses for the same job. Two filled pills in one row is two
    answers to which control the demo is about, and it is the one that runs it.
- **The panel is `rain-splatter`'s disclosure, not a new one.** A grid whose
  single row goes from `0fr` to `1fr` with the content in an `overflow-hidden`
  child, which is the one way to animate to a height the browser works out for
  itself. The gap lives inside the collapsing box, so a closed panel is
  genuinely zero pixels rather than zero plus a gap, and that is why the row
  above it is a group of its own rather than a third item in a gapped column.
  `inert` while closed takes the three ranges out of the tab order: verified, Tab
  runs strip, generate, tune and then leaves, and the ranges appear in between
  once it is open.
- **Three lanes across a wide stage and one column on a narrow one, never two.**
  Two leaves the third alone beside an empty cell, and spanning the odd one
  across both makes a full-width track under two half ones, which is the same
  raggedness drawn differently. Three needs the room, so it is a container query:
  at the column's width a lane gets 136.5px against the 106 that "detail" and
  "64 across" measure, and on a 390px phone the same three would be 104px cells,
  so the panel stacks and caps itself at 179px, since a track as wide as the
  stage is a progress bar rather than a control. `rain-splatter` makes the same
  call for its six.
- **`save` writes the picture, not the board, so the file is the same on every
  screen.** The board is sized in `cqw` and backed at the device's pixel ratio,
  so saving it would hand a 512px file to one reader and a 256px one to another
  for the same press. The two agree pixel for pixel at the one moment the
  control is live, since a finished run composites the sharp image over the
  mosaic whatever the depth was, and the source is 512 wherever it is opened.
  `toBlob` rather than `toDataURL`, which builds a base64 string of the whole
  image to throw away, and the object URL is revoked on the same tick because
  the click has already taken it.
  - **It is there from the first paint and disabled until a run has finished**,
    rather than arriving when one ends. The row is centred, so a pill that turns
    up mid-demo slides the two beside it, and a control that says what the demo
    can do before it can do it is the shared rule about keeping an action
    disabled until it is actionable. It stays live across a pattern swap, since
    the board repaints the new picture at the progress it was already at.
  - The file is named for the pattern it holds.
- **Nothing that changes the run answers while it is running.** The strip, both
  pills and all three knobs go disabled for the length of a press, which is the
  honest state: the knobs cannot take effect mid-run, since the repaint they
  drive is skipped while the loop owns the canvas, and a pattern swapped in the
  middle is a picture nobody asked to see resolve. The strip is a real
  `<fieldset disabled>`, so the browser takes all five radios out of the tab
  order and `group-disabled:` carries it to the swatches. Verified: a press on a
  swatch mid-run leaves the selection where it was, and everything is back on the
  frame the run ends.
  - **The board is the one thing that does not dim.** It is what the press was
    for, and at 50% the five swatches stop saying which picture is resolving,
    which the board itself says better.
- **Not every constant is a control.** `FLIGHT` and `WAIT` are bound to each
  other, since a tile that split while still travelling would hand its children
  a box that is itself moving, and a reader who broke that would only see a
  glitch. `detail`, `run` and `drift` change the character and cannot break it.
- **`drift` reaches zero, and that is the point of offering it.** At zero every
  tile splits on the beat and the picture resolves as a grid stepping through
  its levels, which is the build this lab replaced. Leaving it reachable makes
  the difference visible rather than asserted.
- **A knob regrows the tree and repaints where the board already was.** The
  board holds its progress from 0 to 1 rather than an absolute detail, because a
  change of depth or drift moves the tree's span and an absolute number would
  jump the picture somewhere else the moment a slider moved.
- **The depth stops at six, and seven was offered and taken away.** 16,384 tiles
  is 16,384 fills a frame: measured under a 4x CPU throttle it put the 95th
  percentile frame at 33ms even after the small tiles were dropped to plain
  rects. Six holds 16.7 with nothing dropped at all. So the knob only goes
  coarser than the default, which is the honest direction anyway: it is for
  choosing how chunky the picture stays, not how fine it gets.
- **Below a few pixels a tile is drawn as a plain rect.** Its seam would be a
  twentieth of two pixels and its corner a ninth, so neither can show, and a
  path plus a radius per tile is the whole cost at that size. Taking them off
  moved 64 across from a 33.4ms worst frame to 16.8.
- **The strip lives in `controls.tsx` beside the knob table**, since it is a
  control, and the pictures it shows live in `artwork.ts` beside the drawings.
  `PATTERNS` is the registry the strip renders and the board reads: a slug, the
  name both the swatch's label and the board's own use, and the data URI. Adding
  a pattern is a drawing and a row, and nothing else knows there are five.
- **One word and two glyphs in the control row.** The press the demo is about
  carries its own label, and the two beside it are a save and a drawer, which is
  what their icons already say: spelled out, the row was three words where one
  is the action and the other two are chrome. Both icon controls take a tooltip,
  which is the shared rule, under one `TooltipProvider` round the row rather
  than one per button.
  - **A tooltip and an accessible name are the same claim, so each is one
    string.** Two copies drift, and the drawer's flips with its state: a
    toggle's tooltip names what a press will do rather than what is true, which
    is the signature player's call for its loop, and `aria-expanded` is what
    carries the state.
- **`Pill` grew a square `icon` variant and a props spread.** A pill's
  horizontal padding round an 11px glyph draws a lozenge with a dot in the
  middle of it, which is the same split the signature player's transport makes
  between a control sized for a glyph and one sized for a word. The spread is
  what lets a `Tooltip` wrap one: Radix's trigger is `asChild`, so it clones the
  child and hands it the ref and the handlers that open the tooltip, and a
  component that drops them is a trigger that never fires.
- **`Lane` takes a `disabled`**, which is the shared rule's
  `disabled:opacity-50 disabled:cursor-not-allowed` arriving at the primitive
  that was missing it. `rain-splatter` never passes it and is unchanged.
- **`Lane`, `Panel` and `Pill` live in `components/lab/controls.tsx`.** `Lane`
  and `Pill` were `rain-splatter`'s and moved when this became the second
  caller, and `Panel`, the three-or-one column layout, was this lab's and moved
  when `ember-burst` became its second. That is the rule the rest of the project
  follows. They are in `components/lab/` rather
  than `components/ui/` because they are lab chrome and nothing outside an
  experiment has a use for them. Each lab keeps its own knob table.
- **There is no readout, and the count went with it.** It was the honest number
  and it was still one more thing on a stage that already carries a picture,
  three lanes and a button. `paint` returns nothing now and the tile counter came
  out of the walk with it, rather than being left computed for a caller that no
  longer exists.
- **The button carries an `aria-label`.** `torph` renders its text as aria-hidden
  character spans, so a button whose only child is one has no accessible name at
  all. `island-menu` documents the same trap, and the preview recorder is what
  found it here: `getByRole("button", { name })` timed out.
- **Nothing renders per frame.** One rAF loop writes to the canvas, and no state
  moves during a run at all. A pattern and the picture that landed are two more
  pieces of state and both change on a press.
- **Each picture is decoded once and its pyramid outlives every run.** A second
  press re-reads the same arrays rather than decoding an image again, and so does
  going back to a pattern already seen. The five are only paid for if the five
  are asked for. Measured per picture: 2 to 3ms to rasterise the SVG at 512 and
  3 to 8ms to build the pyramid, and 12 to 23ms for the pyramid under a 4x CPU
  throttle. That is at most one frame, and it is spent on a press rather than
  during a run.
  - **What the repaint waits on is which pattern has landed, not a flag.** A
    picture that has not decoded yet has not landed, and a switch back to one
    already decoded lands in the same tick. It is null until the first is in,
    which is also what says the demo cannot be run yet.
  - **Switching pattern never disables the button or blanks the board** for the
    frame or two a decode takes. The board keeps painting whatever it last had,
    which is the picture the reader has just looked away from.
- **Reduced motion keeps the run and drops the travel.** A press is a request, so
  generate still generates, it simply lands on the finished picture in one step.

### `ember-burst`

A wick on a dark stage. Tapping it strikes, and a shower of embers leaves the
flame's rim, rises, cools and goes out. Tapping it again snuffs it, and what
comes off then is smoke. Holding it blazes and dragging it draws. `burst.ts` is
the model and the painter, pure and DOM-free, the split `halftone-ripple` makes
with `ripple.ts`, and `index.tsx` is the stage, the wick, the frame loop and the
six knobs.

- **An ember's colour is its age, which is the claim the whole build exists to
  make.** The ramp runs near-white through yellow and orange into a deep red the
  ground swallows, so the shower is gone before its alpha has finished and what
  the eye reads is the heat leaving rather than an opacity being taken away. The
  reference is a like button that tweens a ring of copies of its own icon out to
  a fixed radius and fades them, and a fade says nothing about why a spark
  disappears.
- **Nothing is on a rail.** Each ember is a body with a launch speed off a
  squared roll, drag, buoyancy scaled by its own heat and a little turbulence,
  so the burst is a ring for about two hundred milliseconds and a drifting plume
  after that and no two presses agree. A press while the last one is still in
  the air adds to it rather than replacing it.

#### The six things that separate a spark from a particle

The first build threw uniform teardrops in one frame at one instant, every one
the same size with the same drag and the same life, and it read as a wheel of
equals expanding. Each of these is a property real sparks have that a ring of
tweened glyphs does not, **and each is a knob, so the reader can take it back
out**. Run `spray`, `drag`, `lift`, `pops` and `trail` down to their floors
together and what comes back is that wheel. `pixel-reveal` makes the same
argument about its own `drift` reaching zero: leaving the floor reachable is
what makes the difference visible rather than asserted.

- **A spark is a streak, not a dot.** One covers several pixels between two
  frames and both the eye and a camera read that as a smear, so each body keeps
  the last `trail` milliseconds of its own positions and the streak is drawn
  through them. It is pruned by age and never by count, so a trail is the same
  length in pixels at 60Hz and at 120Hz.
- **The streak is a chain of glows and not a shape.** It was a tapering polygon
  first, and a flat fill with a hard boundary is a drawn spoke: at launch every
  ember travels radially, so the first build's trails were a starburst of
  hard-edged spikes round the wick. A row of overlapping glow sprites under
  `lighter` is what a smear of light actually composites to, it comes out soft
  at the edges for nothing, and it reuses the sprite sheet the heads already
  need. Each point is drawn a step cooler as well as a step smaller, so the
  smear cools along its own length.
- **It sputters rather than dimming smoothly.** A real ember tumbles and its
  fuel is not even, so the light jitters at a few tens of hertz. Two sines with
  no common period, offset by the body's own seed, so nothing in a shower of
  them beats in time. It multiplies the light and never the colour, since what
  varies is how hard it is burning and not how hot it is.
- **A small one drags to a stop and a big one carries.** Drag goes with area and
  momentum with mass, so every body stores its own share of the rate rather than
  a rate of its own: at the default the reach runs from about 65px for a slow
  speck to 368px for the biggest and fastest, which is off the stage. A share
  rather than a rate is also what lets the `drag` knob reach what is already in
  the air. This is most of what turned a ring expanding into a shower thinning
  out.
- **A small one also burns out sooner.** Life comes off the same roll that sizes
  it, since a bigger ember is a bigger piece of burning material. Rolled
  independently it puts long-lived specks and short-lived lumps in one shower,
  which reads as noise rather than as a spread.
- **A strike sprays rather than emitting at once**, longest for the slowest, so
  the fast ones lead and the shower fills in behind them. A burst that emits on
  one frame holds every ember on one expanding circle for as long as it lives.
- **Some of them pop.** A spark is a fragment of burning material and about a
  fifth come apart on the way, throwing two or three pieces of their own. What a
  break exposes is fresh surface, so the pieces start at full heat rather than
  carrying the parent's, which is why a pop reads as a white flash in the middle
  of a cooling shower. They carry no `pop` of their own, or one ember could fill
  the stage.

#### Holding and dragging

- **A tap is a state change and a hold is the flame being fed.** Without the
  second this is a button you press and watch, where every other lab on this
  site gives you something to hold. A hold catches a cold wick first, then emits
  continuously at a rate that ramps from 26 to 92 embers a second over 900ms,
  into a wide cone around north rather than a ring: what is emitted continuously
  has no ring to be part of, and a flame throws upward.
- **A hold never snuffs**, so putting it out is always a deliberate tap. That is
  a flag of its own rather than the blazing flag, because under reduced motion
  there is no continuous emission running and the release would otherwise fall
  through to the tap that puts it out.
- **Dragging it draws, because the sparks leave carrying the wick's own
  velocity.** That is the whole of it: nothing about the launch changes, the
  emitter's speed is added to it, which is why a waved sparkler streaks behind
  the hand rather than throwing a ring at every point along the way. It is 62%
  of the hand's speed and not all of it, since a spark is thrown off a flame
  rather than welded to it, and at 1 the shower reads as a rigid comet.
- **The wick springs home when it is let go**, and it used to stay where it was
  dropped. That is right for `sticker-peel`, where the thing being moved is a
  sticker, and wrong here: this is the demo's one control, and a button that
  permanently relocates itself reads as a loose object rather than as the thing
  you press. A drag is a gesture, not a move. The spring is critically damped,
  since what is arriving is a control and not something thrown, and an arrow key
  has the same shape: held, it walks the wick out on the browser's own repeat,
  and letting go brings it back.
- **The velocity is Motion's own, off the wick's position value**, which is
  `portrait`'s call for the same question: `getVelocity` returns 0 once a value
  has not changed for 30ms, so a hand that stopped before letting go throws
  nothing, where a velocity kept by hand freezes at whatever it last was.
- **A tap shakes the wick rather than shoving it.** It was a 5px displacement
  on a spring, and at this size that is the control sliding across the stage and
  back rather than reacting to anything: what a struck match does is jolt, not
  travel. It is a keyframed oscillation now, 2.4px at its widest and decaying to
  nothing inside 240ms, along the press where there is a direction and sideways
  where there is not, because a shake is sideways. A keyframe array rather than
  a value to spring toward, since this is a jolt with a direction and not a
  displacement to recover from. Measured on a press 24px off centre: 1.18, 1.50,
  -0.38, -0.82, -0.23, 0.37 and home.
- **The drag and the tap's shake sit on two elements.** A motion value handed to
  `style` owns that transform outright, which `crack-button` and `stem-picker`
  both document running into.
- **A drag past 6px of slop is a drag, and anything shorter that outlives 180ms
  is a hold.** The gesture ends on the window, so a hand that runs off the wick
  or off the frame is still the hand that was holding it, which is nib's rule.
  The listeners are bound once and gated on a ref, and the release goes through
  a ref of its own, so a listener bound on mount is never calling a stale one.
- **The keyboard gets both gestures and the move.** `keydown` arms and `keyup`
  releases, so Enter and Space tap or hold exactly as the pointer does, and the
  arrow keys move the wick, since a path reachable only by pointer is what
  `event-stacking`'s hint argues against. The keydown prevents its own default,
  which is the click a button synthesises, or a toggle would fire underneath
  every hold. `onClick` is kept for the one click nothing else produces, which
  is what an assistive technology sends.
- **The wick's tooltip is controlled, and refuses to open while a hand is
  down.** A label that arrives on the 200ms delay and then sits over the demo
  for the length of a hold is covering the thing it describes. `components/ui/`
  gained an optional `open` and `onOpenChange` for it, so Radix still decides
  when a tooltip wants to be open and this only vetoes.
- The button's accessible name stays the action alone, since a name is read on
  every focus, and the two gestures are an `aria-describedby`, which is
  announced once.

#### The light

- **The stage is dark because light needs something to be light against**, and
  the room is lit by what the press threw. The wall's brightness is the heat
  still in the air, eased toward it on `approach` so it does not cut out when
  the last ember dies.
- **It is cast from where the heat is, not from the wick.** `step` returns the
  heat-weighted centroid of everything burning, and the wall's bright spot leans
  55% of the way toward it. Lighting the middle whatever the sparks did was the
  one thing left in the picture a reader could catch being false. The pool is
  moved with a `translate3d` on a box twice the stage in each direction, so the
  light travelling is a compositor move and never a repaint of the wall, and a
  gradient centred in a box the size of the stage would show its own edge the
  moment it moved.
- **The wick has no fill at all, and that is the whole fix for the worst thing
  in the piece.** It was `inverse-fill`, a fixed near-black, so the moment the
  room lit up the one object that did not was the one throwing the sparks: a
  black puck sitting in the middle of a fire, which is exactly what it was taken
  for, a placeholder. Two rounds of lighting it did not help, because the
  problem was never the shade, it was that the disc was opaque. Transparent, the
  room light and the burst behind it show straight through and it lights with
  everything else. A hairline is what says there is a control there, hover and
  press are light at alpha over it rather than a darker fill, and a warm radial
  under the glyph is the flame's own light on the wick.
- **So there is no disc face for the light to fall on.** A pass that clipped a
  warm wash to the disc and cast it from the heat's direction went with the
  fill: on an opaque puck it was a lit crescent against a dark one, which read
  as two overlapping spheres, and on a transparent one it is a warm circle with
  a hard edge. What lights the wick now is the room behind it.
- **So does the smoke**, which is the one thing out there big enough to show a
  light. A strike through a plume left by the last snuff lights that plume, in a
  second warm sprite added over the grey one.
- **Bright light blooms**, in a lens and in an eye. It is a downsample to an
  eighth and an upsample back, which is a box blur the browser's own bilinear
  filter does on the GPU: two `drawImage` calls a frame, where a real gaussian
  would cost a filter pass over the whole canvas. Without it the white-hot end
  of the ramp is paint rather than light, since the sparks were the brightest
  thing on the stage and the only thing on it with a hard edge. **It is 0.34 and
  was 0.62**, which is fine for one strike and is fog at a blaze: a hundred
  overlapping glows already clip to white under `lighter`, and a bloom that
  strong takes the clipped patch and smears it over a third of the stage. A
  bloom is for the edge of a bright thing, not a second light source. The glow
  and the streak each give up a little alpha for the same reason.
- **The lit flame wavers**, which was the last thing holding still once the
  sparks became streaks that sputter. `flame-waver` in `globals.css` leans and
  breathes it on a 1.35s period against the halo's 1.7s, so the two never come
  back into step, anchored at `origin-bottom` because a flame is fixed at its
  base and the top is what the air moves. Both are behind `motion-safe:` and
  neither costs a frame.

#### The rest

- **The snuff throws smoke, not grey embers.** Lighting something and putting it
  out are different events, and the first build made one emission serve both: a
  ring of eleven puffs at even angles is an ember burst drawn in grey, and it
  stayed eleven puffs rather than becoming a cloud. Smoke takes a free angle, a
  free start radius, a strong upward lean, a slower and wider wander than the
  embers' and a billow to 2.4 times its launch radius, so what leaves the wick
  is one plume rising. **Seven puffs and not eleven**, at two thirds the radius
  and two thirds the alpha, and the pass that lights them is well under half
  what it was: once smoke caught the embers' light, a snuff followed by a blaze
  filled a third of the stage with a lit fog bank. A snuff is a wisp.
- **A fire crackles because things in it are breaking**, and the burst already
  knows when one does: `step` returns the number that popped on the frame and
  each is a short, high, quiet noise burst. Capped at two a frame, since a
  flurry can break several at once. The strike and the snuff are synthesised the
  same way, `crack-sound.ts`'s shape: one context, one noise buffer, a filtered
  burst per event, nothing fetched. A strike is two bursts a few hundredths
  apart, a bandpass sweeping up that is the head dragging across the grit and a
  lowpass body under it that is the flame taking, because running them together
  is a hiss. The clock is unlocked on `pointerdown` and played on the release,
  the two-step `poke-sound.ts` documents.
- **Tapping off centre pushes the burst the way the hand went and shakes the
  wick the same way**, and it is measured at the press and carried to the
  release, since only a release that never became a hold is a tap. A keyboard
  press reports no coordinates, so it gets a burst with no lean at all and a
  sideways shake.
- **Everything scales with the stage, and both halves of that are separate.**
  The burst multiplies every length and every speed by the stage's share of the
  538px column, or a 390px phone gets a burst that is out through the top and
  both sides before it has cooled. The wick is `clamp(3rem, 15.7cqw, 4.8rem)`,
  so the disc is the same fraction of the frame too. **`@container` sits on the
  stage and again on the wrapper**, since a container governs its descendants
  and never its siblings: the panel is outside the stage, and without the second
  one its `@md:` columns never match and six lanes stack on a wide column.
- **A flurry feeds the strike**, up to 1.9 times a cold one, the way a struck
  match catches harder the second time. `pressedAt` starts at negative infinity
  rather than zero, and that was a bug: `performance.now()` is the time since
  the document loaded, so a first press inside the streak window of the page
  arriving read as a continuation. Measured, 23 embers on a first press against
  the 18 a cold one is meant to throw.
- **The wick's hover goes lighter and only its press goes darker**, the opposite
  of the site's own order and `book-opening`'s call: the usual `fill` steps
  assume a white page and both of them move toward the ground here. Rest is
  `inverse-fill`, hover `inverse-stroke` and the press `inverse-bg`. The edge is
  `inverse-text` at 12%, light on a dark ground rather than `inverse-stroke`,
  which `island-menu` documents measuring at 1.13:1 on this fill.
- **The focus ring is the dark-ground variant, and that is stronger rather than
  weaker.** The project's own pattern pins `ring-text-primary/15`, which is a
  near-black ring on a near-black disc, and Tailwind's ring paints its 2px
  offset in `--tw-ring-offset-color`, which defaults to white and would put a
  bright band round the wick. It is `inverse-text` at 30% over an `inverse-bg`
  offset, the same substitution `window-shade` and `island-menu` make. The rule
  that bends here says never to use a *weaker* ring than the declared one.
- **`cursor-grab`, which is the ninth place the shared `cursor-pointer` rule is
  off**, after `tether-button`, `event-stacking`, `window-shade`,
  `sticker-peel`, `notch-drop`, `custom-cursor`, `radial-menu` and
  `wrapped-pattern`, and before `cube-orbit`. The wick is dragged as often as it
  is tapped.
- **`touch-none` is on the wick alone and never on the stage**, so a thumb
  scrolling past the demo is not trapped by the dark box, which on a phone is
  most of what is on screen. That is the trade `window-shade` documents for its
  own grip.
- **`select-none` on the stage.** The gesture is a flurry of presses and drags
  on one small control, and a rapid multi-click anchors a selection on the
  nearest text it can find, which is `crack-button`'s case exactly.
- **Nothing renders while a burst is in the air.** The bodies live in a ref, one
  loop paints them, and the wall's brightness and the `aloft` readout go
  straight to their nodes. The knobs and the lit flag are mirrored into refs,
  since the loop reads both outside a render and a lane being dragged has to
  reach what is already flying. The loop stops once the air is empty, the wall
  has finished dimming and nothing is being held. Measured: 0 frames requested
  across a second at rest, 3s after a tap and 3.5s after a drag, and under a 4x
  CPU throttle through a one-second blazing drag at 105 to 117 bodies, four
  passes of about 130 frames each with a median gap of 16.7ms, a 95th percentile
  of 16.7 to 16.8 and a worst frame of 17ms in three of the four.
- **Reduced motion keeps every state and drops the travel.** A tap still throws
  its burst, as a ring at 96px of the stage's own scale that fades where it
  stands. A hold still catches a cold wick and still leaves it lit, and simply
  does not feed it, since a blaze is continuous travel. The wick still drags and
  still comes home, in one step rather than on the spring. There are no streaks, no
  pops and no spray, each of those being a fact about a flight that is not
  happening, and the shake and both keyframes are off. Verified:
  `animation-name` reads `none` on the halo and the flame, the wick's transform
  stays `none` through a press, and a 0.7s hold leaves it lit with nothing in
  the air.
- **It is `flush`, so the stage runs to all four edges of the frame**, and only
  the knob strip under it carries padding. The stage is `aspect-8/5`, which is
  the shape of the index's preview card, so the recorded clip is that stage with
  nothing padded or cut.
- Verified in a browser at 1280px and at 390px: the frame measures 538 by 390
  with the panel shut, the stage 538 by 336 flush to its edges, the wick 77px
  and 49px, a cold tap throws 18 and a 1.6s hold reaches 107 aloft, the panel is
  three columns and one, it is `inert` while shut, Enter taps and holds, the
  arrows move the wick and it comes back, and no console errors.

### `gooey-chips`

Filter chips that merge into the tray they are dropped in. Pick one and it flies
out of the row, grows a neck as it reaches the tray and fuses into the slab.
Pick it again and it tears back out. Or carry one there by hand and hold it in
the neck. `layout.ts` is the geometry, pure,
`lenses.ts` is what the chips filter, and `index.tsx` is the goo and the
flights.

- **The trick is smaller than it looks.** A hidden layer holds one plain rounded
  rect per shape under `feGaussianBlur` into an `feColorMatrix` alpha crush, so
  two rects near each other bleed together and the crush turns the overlap into
  a neck. `feComposite atop` puts the sharp source back inside that silhouette,
  so only the join is soft. The labels ride above the layer, outside the filter,
  which is why they stay crisp. Nothing else about it is special.
- **`sRGB` on the filter is load-bearing.** The default is linearRGB, where the
  same crush lands somewhere else entirely and the neck comes out thin and grey.

#### The goo is a function of the gap, not of the clock

- **The reference schedules the blur on its timeline**: up over half the flight,
  hold, down at the end. Every one of those numbers has to be kept in step with
  the flight it is describing, and a second chip moving at the same time gets
  the schedule of the first.
- **This reads the distance between the flying chip and the tray on every frame
  and takes a bump off it.** Zero when they are far apart, widest when they are
  about to touch, and **zero again once they overlap, because two shapes that
  have merged have no neck left to form**. Nothing has to be kept in step with
  anything, one press and six at once behave the same, and the tear falls out
  for free: a chip leaving starts at full overlap, so its goo ramps up as it
  separates and back down as it clears.
- **The gap is rect to rect, which is what made the first build wrong.** A chip
  resting in the row sits directly under the tray, so at the original 14px of
  field gap every chip in the top row was already inside the band where a neck
  forms. The goo went to full on the frame of the click, with no approach to
  watch, and stayed there after a chip landed back in the row. Measured: 6.17
  on the first sample of a select and 5.81 still standing after one had
  finished. **`FIELD_GAP` has to be wider than `NECK.reach`**, which is the only
  reason the row sits 48px under the tray. Measured after: a select reads 0.8,
  2.14, 6.79, 1.86, 0.8, and a deselect 0.8, 1.6, 5.4, 4.5, 3.0, 0.8.
- **The blur never sits at zero while the filter is on, and the filter comes off
  at rest.** The crush has nothing to work on but the shapes' own antialiasing
  at zero, so every rounded corner comes back hard and stepped. A floor of 0.8
  gives it a gradient to find an edge in, and taking the filter off entirely
  when nothing is moving is both the honest resting state and the frame the
  rasterising costs.

#### Nothing is in flow

- **The obvious Motion answer is `layout`, and it cannot work.** A merge needs
  the blob under a chip to agree with that chip on every frame, not only at the
  ends, and a layout animation's intermediate position is a transform the engine
  owns: reading it back means a `getBoundingClientRect` per element per frame,
  which is the cost `event-stacking` and `sticker-peel` are both built to avoid.
  If the blob and the chip can ever disagree, the goo tears.
- So every rect is computed in `layout.ts`, the split `document-pocket` makes
  with `poses.ts`, and **one set of motion values per shape is read by both the
  chip and its blob**. The reference tweens the two as a pair, which holds until
  a gesture interrupts one of them: two springs handed the same target still
  diverge if they were not in the same place when it arrived. One value with two
  readers cannot.
- **The goo layer draws every dark shape and the elements over it are text.**
  The reference keeps a background on each chip and strips it with a class once
  the chip has landed, so that background's hard edge sits over its own softened
  blob for the whole flight. Here a chip that is in the goo has no background at
  all, so the silhouette is always the filter's.
- **What flies is what changed sides, and nothing else.** Deriving it from
  "this rect differs from the last one" counts every chip closing the gap behind
  the one that left, which puts the whole row in the goo, and on the first paint
  it counts all of them, so every chip had a blob before anything had been
  pressed. Measured: one blob at rest and two through a flight, against seven
  and a churn of three to seven to two.
- **The first arrangement is where everything already is**, not somewhere to
  travel to, or the whole set flies in from the stage's corner on load.
- **And a re-measure is not a gesture either, so it is set rather than
  animated.** `read` runs on mount, on the observer and again on
  `document.fonts.ready`, and the metrics differ between those runs: a first
  paint in the fallback face measures a chip at 108px where Inter measures the
  same chip at 57. Every run past the first was animating to its new numbers, so
  a page whose font arrived late sprang the whole arrangement out of a stale
  layout and back into the real one, which reads as the demo sliding in from the
  right. Measured on a load with the font held back 1.2s: the row went 57, 84,
  108 and back to 57 across 340ms and eleven distinct layouts, against one
  layout over 288 frames after. A window being resized took the same spring and
  now snaps too. Nothing about a corrected measurement is a thing to watch.
  **The test is whether any chip changed sides**, which is the set that flies
  anyway, plus nothing being in flight or in a hand when the new numbers land.

#### The chips are dark, and that is the only reason the goo is visible

- **`bg-fill` on `bg` is 1.02:1.** The site's own pill is a 96% grey on white,
  and a neck between two shapes that close to the page is not an effect, it is
  nothing. The reference gets away with a soft fill because its stage is dark
  and saturated.
- So a chip in the goo takes `text-primary`, which is 15.4:1 and is **the site's
  existing answer to a selected state**: the emphatic filled neutral that
  `the-submenu-closes-before-you-get-there` reaches for when it has no green,
  and the fill `Pill`'s `lead` and the signature player's play button already
  use. The lab invents no colour and scopes no hue.
- **A chip on the slab takes an edge back, and without it the tray stops being a
  tray.** In flight a chip has no background of its own, so nothing hard-edged
  sits over the neck. On the slab it wears a plate, light at a tenth over it.
  With five of six picked and no plates the tray was one black bar carrying six
  words spaced across it, which is a navigation bar, and each chip stopped being
  an object the moment it arrived. So it dissolves into the goo and then
  resolves out of it.
- **That edge is `seatAt(gap)` and never a flag saying the flight is over.** It
  used to be a boolean off "picked, and no longer in flight, and not in a hand",
  which meant a chip pushed into the tray by hand sat on the slab wearing
  nothing until the release and the flight after it had both finished, and the
  chip that had just landed was the one plate missing from an otherwise full
  tray. What the edge means is that the chip is on the slab, which is a fact
  about where it is. Measured: the plate reads 1 while a chip is held inside the
  tray with the button still down, and 1 on every chip 200ms into a run of four
  picks.

#### The hand owns the gap

- **The claim was that the goo is a function of the gap, and until the drag the
  only thing that ever set that gap was a spring.** A reader was told the idea
  rather than handed it. A chip is carried now: take one to the tray's mouth and
  hold it and the neck sits open for as long as you like, pull a seated one and
  the neck stretches until it breaks. It is also the thing every strong lab here
  has and this one did not, something to hold.
- **It cost the model nothing.** A drag writes the same motion values the blob
  already reads and `neckAt` was always measuring live rects, so the goo follows
  a hand exactly as it followed a spring. Measured, walking a chip in: blur 1.93
  at a 30px gap, 4.75 at 20, 7.00 at the peak, 3.38 at 5 and the floor at 0.
- **Both commits are the gap, so the gesture and the goo cannot disagree.** A
  chip dropped while it is still drawing a neck merges, and a seated one pulled
  past `NECK.reach` has broken that neck and leaves. Anything between is a
  change of mind and springs home, measured landing within 0px of where it
  started. `DRAG.merge` is 12 because that is where the neck goes, measured
  rather than picked: `NECK.peak` is where the blur is widest and not where it
  stops bridging, so it is the wrong end of the same curve to commit on, and at
  8 it asked for a precision the gesture does not need.
- **A carried chip is held inside the stage.** The chip keeps the pointer, so
  without a bound a hand walks it off the demo and across the page, which is a
  filter chip lying on the prose. The stage and the field are read once at the
  press, since neither moves while a hand is down, and the stage is stored in
  the chip's own coordinates so the clamp is two comparisons a frame rather than
  two rects. Measured, hauling a chip 900px out in six directions: 0px past the
  stage's edge in every one.
- **The clamp is what sets the stage's height**, since a bound that cannot reach
  past `NECK.reach` is a drag that cannot take a chip out. See `STAGE_H`.
  Measured with all six picked, the furthest a chip can be carried from the
  tray: 48.5px at 320, 65 at 360 and 81.5 from 390 up, against the 34 a tear
  needs, so it tears out at every width.
- **A drag ends in a click on the chip it started on**, so a flag set once the
  press passes its slop is what stops every drop also toggling what it dropped.
  `touch-none` on the chip alone so a thumb is only ever trapped on a 30px
  target.
- **The chip keeps `cursor-pointer`, and the grab cursor waits for a drag that
  really started.** This is the first of the two labs with a drag that do not
  take the shared rule off, `arc-menu`'s plus being the other, and the reason
  is that a chip is a toggle first: a grab
  cursor sitting on it before anything is held says the click it is about to
  get will not work, and a click is what most readers give it.
  `active:cursor-grabbing` is the same claim one frame shorter, since it fires
  on the press that never becomes a drag. What the reader wants the hand to say
  is not "this can be grabbed" but "this is grabbed".
  - **It is written on the stage, not on the chip, and the descendant rule is
    the half that does the work.** The chip declares `cursor-pointer` and the
    label spans under the pointer inherit it, so an inherited `grabbing` from
    the stage loses to that declaration, which is the same order
    `tether-button` documents for the UA's own `cursor` on a button. So the
    stage carries `data-[carry=true]:cursor-grabbing` and
    `data-[carry=true]:[&_*]:cursor-grabbing`, which is `sticker-peel`'s pair.
  - **`carried` is already the state the goo renders on**, so the attribute
    costs no render a drag was not paying: it is set once when the press passes
    `DRAG.slop` and cleared once on the release, never per frame.
  - Measured on a chip: `pointer` at rest, `pointer` through a 150ms press that
    never moved, `grabbing` on the chip and on the span under the hand once the
    drag is live, and `pointer` again after the release.

#### The neck did not exist, and the drag is what exposed it

- **Measured across the whole approach, the goo bridged only the last two
  pixels.** Sampling the midpoint between the tray's foot and a carried chip:
  solid at a 2px gap and pure white at 4, 6, 8, 10, 12, 16 and 20, at every blur
  the ramp produced. The widest blur was being spent at a distance it could not
  reach, so what looked like a merge was two shapes overlapping and nothing
  else. A spring swept through that band in a frame or two, which is why nobody
  saw it. A hand can stop anywhere in it.
- **The arithmetic says why.** Two edges blurred by a gaussian bridge a gap `g`
  under the `20 -10` crush only when each contributes half the threshold at the
  midpoint, which is `erfc(g / (2 sigma sqrt 2)) >= 0.5`, so `sigma >= g / 1.35`.
  The ramp peaked at `sigma` 7 for a gap of 12, where it needed 8.9, and was
  short by that ratio at every other gap too.
- **So `GOO` is 9 and `NECK.peak` is 8.** The peak now sits at a gap the blur
  can bridge with room over, and the neck is drawn from 0 out to about 11px.
  Measured after: solid at 2, 4, 6, 8 and 10, breaking at 12. Bigger than that
  is not free, since the same blur has to leave a 30px chip standing once the
  crush has run.
- **It costs no frames.** Measured under a 4x CPU throttle with the gesture
  driven from inside the page so nothing the harness does lands in the window:
  clearing six at once is 86 frames at a median of 16.6ms and a 95th percentile
  of 18.3, against 17.9 at the old blur. The spikes in a run of six separate
  picks belong to the six state commits and measure the same either way.

#### The three springs

- **To change the pace, raise every stiffness together and take each damping
  with it by the square root of the same factor.** A spring's character is its
  damping ratio and its speed is its frequency, so scaling both that way moves
  one and leaves the other. Raising stiffness alone is the tempting edit and is
  a different animation, since it stiffens and un-damps at once: `RETURN` is the
  one spring here with a deliberate bounce and it would gain a wobble nobody
  asked for.
- They were last taken up by half, a frequency of 1.225 on all three. Measured
  over three runs each, press to the last frame the loop runs: a pick 597ms to
  449, a deselect 801 to 653, a clear of six 799 to 649. `GLIDE` gains the most
  because it is the one sitting near critical damping, where a hundredth off the
  ratio also shortens the crawl into Motion's own rest threshold.
- The ratios held to about a hundredth, so `RETURN`'s overshoot went from 9.09%
  of its own travel to 9.16% and the other two stayed under a fifth of one
  percent. That is the check that the pace moved and the character did not.
- **`TINT` rides them rather than sitting at its own number.** A chip that
  arrives before it has finished giving up its pill wears that pill on the slab
  for the difference.

#### Chips neck to each other

- **The loop only ever measured chip against tray**, so two chips crossing
  passed straight through one another. It measures the pairs as well now, which
  on a clear of six is the difference between six shapes leaving and one sheet
  of liquid tearing apart.
- **A pair has its own two numbers, `PAIR`, and running it on the tray's was a
  bug with a very visible tell.** A chip meets the tray's mouth from a long way
  out and it meets another chip by nearly touching one, so `NECK.reach` at 34 is
  the wrong scale for two pills. On it, the row's own resting gap, `GAP.row` at
  8, is exactly `NECK.peak`: six chips sitting still in the row claimed the
  widest neck there is. Both of `PAIR`'s ends are the layout's own numbers so
  neither can drift, widest at `GAP.tray` and gone before `GAP.row`.
- **Each chip's share of a pair is how far out of the slab it is, `1 - melt`,
  and that replaced a flag saying whether it was in flight.** Two chips inside
  the tray are not two shapes with a neck between them, they are one body, and
  `melt` says exactly that as a function of the gap. The flag it replaces was
  read off the `flying` list, which outlives the motion by however long the
  spring takes to be declared finished, so the last frame of every flight was
  still counting chips that had already arrived.
- **Both of those only showed up at the moment the filter comes off, as the
  tray's corner radius changing.** One `stdDeviation` rounds every corner in the
  layer, so a blur left wide at rest rounds the tray into a lozenge, and taking
  the filter off in the next step snaps it back to the radius it is drawn with.
  Nothing about the radius was ever moving. Measured on the settled blur, out of
  a possible 9.8: a pick used to finish at 4.18 and a clear at 9.80, and both
  finish at the 0.80 floor now. Measured on the painted corner, dark pixels in a
  46 by 46 crop: 1585 with the filter off, 1581 at the floor, 1349 at the peak.
  So the step the reader saw was 236 pixels of corner arriving and leaving in
  one frame, and what is left is 4.
- **The loop stops on there being no animation attached, never on nothing
  moving, and those differ for exactly one frame.** `move` creates four springs
  and none of them writes a value until the frame after that, so every velocity
  on a box about to glide across the stage reads zero. The loop believed it,
  which let it shut down in the middle of a gesture: measured on a chip released
  at the tray's mouth, the last frame ran with the chip 8px out, which is
  `NECK.peak`, so it took the filter off on the widest blur there is and drew
  the glide that followed with no goo on it at all. `busy` asks
  `MotionValue.isAnimating()` instead, which is the fact the loop wants.
- **A dragged value is `set` rather than animated, so `busy` is false for the
  whole of a drag, and what covers that has to be the gesture's own answer and
  not a rendered one.** Leaning on `carried` for it was the first try and is a
  commit too late: `run` is called from the `pointermove` that passes the slop
  and schedules the next frame itself, so that frame can arrive before React
  has rendered the drag, and the loop then declares the gesture over on its
  first frame. Measured on a chip dragged to the tray: one frame, then
  `filter: none` until the release, so the demo's whole argument was missing
  from the one gesture it is most about, and it looked like the goo only
  working on chips that had been picked before. `handRef` is written by the
  gesture, `carried` still drives what is rendered, and the loop takes whichever
  is further ahead.
- **The rule all three land on: whatever the geometry is doing, the blur has to
  be at its floor before the filter is taken off.** That is what makes the
  removal a no-op rather than a frame of animation nobody wrote. It also fixes
  the same step at the other end, since a stale peak left on the node was what
  the next gesture's first frame painted with. Measured at every resting state,
  out of a possible 9.8: a pick, a hand-merge, six picked and a clear all finish
  at 0.80 now, against 4.18, 9.80, 4.18 and 9.80 before.
- Seven shapes is twenty-one pairs, so the pass is arithmetic and not a cost.

#### How much a chip is wearing is the gap too

- **A chip going back to the row used to change colour after it had parked**,
  because what it wore was a boolean that flipped when the flight completed. The
  chip flew out of the tray in the tray's own clothes, stopped, and then turned
  grey in place, which reads as the pill correcting itself rather than as a drop
  separating. This was the one thing about the lab that looked broken.
- **So `meltAt` is `neckAt`'s sibling and shares its reach.** One motion value
  per chip says how much of itself it has given up to the goo, 1 while it is
  touching the tray and 0 once the neck has broken, and `paint` writes it off
  the same gap on the same frame. A chip takes its own pill back over exactly
  the distance the goo is still drawing a neck over, so the two cannot disagree
  about whether it is still part of the tray. Measured on a return: the pill
  comes up 0, 0.09, 0.56, 0.92, 1 while the chip is travelling the last 35px,
  where it used to be 0 for the whole flight and 1 a frame after it stopped.
- **Every chip's clothes are written every frame, not only the ones the goo is
  drawing, and that is what keeps a chip from being left half dressed.**
  `setFlying` replaces the set rather than adding to it, so a chip still in the
  air when the next press lands drops out of `flying`, out of `inGoo`, and used
  to drop out of the melt write with them: its melt froze wherever the flight
  had got to and nothing ever corrected it. A chip then sits in the row at a
  third of its own opacity, or wears the slab's white ink on a white page,
  which is a chip that has all but vanished. Measured by clicking every chip in
  and out at 70ms: five of six left stale, at 0.33 to 0.87, and none at 120
  clicks after. Clothes are a fact about where a chip is and every chip is
  somewhere, so the goo has no business gating them, and `paint` writes them
  before it decides whether to run again, so the one frame `run` always gets is
  enough to settle them.
- **The gap owns a chip's clothes and the clock owns exactly one case.** A chip
  that has been picked up gives its pill away at once, since what carries it the
  rest of the way is the blob already under it. Everything else, a chip tearing
  out, a chip in the hand, a chip springing back from a drag that committed to
  nothing, resolves at the distance it actually is. At rest both ends fall out
  of the same rule rather than being set: a seated chip overlaps the tray, so
  its gap is 0 and its melt 1, and one in the row is a field gap away, which is
  past the reach.
- **One body per chip, never a pill over a blob.** A chip in the goo wears its
  blob and a chip out of it wears its pill, and the pill stands down the moment
  a blob exists rather than fading out on the melt. Both are the same box with
  the same radius, so where they overlapped the pill's antialiased edge was
  partly transparent over a near-black blob and the chip drew a dark outline
  round itself. Measured on a chip springing home: the darkest pixel on its edge
  was 26 against 107 once it had landed and the blob had gone, so the outline
  was there for the length of every flight and left in one frame, which is what
  it read as.
- **So the blob carries the body's colour, and the tray is simply the one that
  is always fully melted.** `color-mix` in sRGB from `fill` to `text-primary` on
  the melt, which is the composite a pill at `1 - melt` over a near-black blob
  already produced, so nothing about a chip's own appearance moves. `srgb` and
  not `oklab` for that reason: the step point in `INK` was solved against the
  sRGB composite.
  - The one thing that does move is the neck, which now shades toward whichever
    body it is leaving rather than being uniformly black. Measured at the peak
    neck: 1.6% of the frame differs, confined to the ten rows of the gap itself,
    by at most 13% grey. Two light chips webbing on a clear now web in their own
    tone, where a black web between two light pills was the older answer.
- **The label steps between two tones and never crosses, which is
  `window-shade`'s lesson arriving at a chip.** The ground under the word is
  going from the slab's near-black to the chip's own fill while the ink has to
  go the other way, so the two meet: half way through, the pill is a mid grey
  and neither tone reads on it. Crossfading there is the worst of both, since
  the word is then two half-inks over the one ground that defeats each of them,
  measured at about 1.5:1 for three frames. Solving `white on the ground ==
  grey on the ground` puts the least unequal point at 0.55 of the melt, where
  both sides measure 2.3:1, and the band around it is under one frame of the
  return spring. Measured after: zero frames of a two-tone label.

#### The count is real

- **The reference reports a number from a hardcoded table of weights**, which a
  reader can only believe. These chips filter an actual list and the count is
  `matches().length`.
- **The matched rows were rendered under the chips and are not any more.**
  Showing them is the strongest form of the claim, since the number can then be
  counted rather than taken. What it cost was twenty lens names in grey under
  the demo, a wall of type heavier than the thing the demo is about, and the
  heaviest element on the stage was the filter state while the lightest was the
  answer. The data stays in `lenses.ts`, where the rules make it checkable.
- **Every tag is derivable from the row it sits on**, which is the stronger half
  of it. The rules are stated once in `lenses.ts`: `wide` is 35mm or shorter,
  `tele` is 85mm or longer, `fast` is f/2.8 or wider, `macro` says macro, and
  the name says prime or zoom. So nothing here is a claim a reader has to take
  on trust. Verified by re-deriving all twenty from their own names: one
  disagreed, `24-70mm f/2.8` carrying `tele` at 70mm, and it was the data that
  was wrong.
- **All of the chosen tags and not any of them.** A filter that widens as you
  add to it teaches the opposite of what a filter does, and the count going down
  is most of what makes the tray worth watching. Picking every chip is a real
  answer: no lens carries all of those.
- **The readout says `results` and never names what is being filtered.** It
  read `20 lenses` for a while, and the rows it counts are not on screen, so the
  only thing a reader had to go on was a noun appearing nowhere else in the
  demo: the chips say `prime` and `tele`, and what a lens has to do with either
  is camera knowledge this has no business assuming. `results` is what a filter
  produces whatever it is filtering. **The subject is named once, in the
  registry's `hint`**, which is the field for exactly this: "Pick a tag to
  filter 20 camera lenses. It fuses into the tray." at 62 characters, inside the
  75 that wraps at the column's width.
- **The count morphs through `torph`** rather than rolling an odometer the way
  the reference does. What a press does to a count is correct it, which is the
  call `halftone-ripple` and `stem-picker` already make, and a second answer for
  numbers on this site is a second answer to drift. It morphs the whole phrase
  rather than a number with a fixed word beside it, or the tray says "1 results".
- **Nothing under the chips restates the selection.** A line spelling it out was
  a chain of five "and"s in selection order rather than in the order the chips
  sit in, and the tray was already showing all of it. It went with the rows.

#### The rest

- **The measuring copy sits in a box with no size, no overflow and its own
  positioning, and all three are load-bearing.** Every chip is absolutely
  positioned with a width handed to it, so its natural size has to be measured
  from a copy in flow. Absolutely positioned on its own that copy still counts
  toward an ancestor's scroll width, and the row is wider than a phone: on a
  390px viewport it pushed the document to 450 and the whole page scrolled
  sideways. `relative` on the wrapper is what makes it the containing block,
  since `overflow: hidden` does not clip an absolute child whose containing
  block is above it. Clipping is paint only, so the measurement is unaffected.
- **And the copy carries `w-max`, which the wrapper is what makes necessary.**
  An absolutely positioned box shrinks to fit its containing block, and that one
  is zero wide, so every measurement taken inside it collapses to the longest
  word it holds. The single-word chips came out right and "20 lenses" measured
  as "lenses", which left the tray too narrow to hold its own readout: it
  clipped at rest and the first chip landed on top of the count.
- **The stage holds one height and the field is centred in it.** What the chips
  do changes how tall the field is, and a demo that grows and shrinks with it
  shoves the page underneath up and down while a reader is pressing things.
  Measured: 336px at every width and in every state, which is also the 8:5 the
  index's preview card is, so the recorded clip is the whole demo with nothing
  padded or cut. **The height is the deepest arrangement plus the room a hand
  needs, not plus a margin**: at 200 the widest tray there is left under
  `NECK.reach` of stage beneath it, so a chip could not be carried far enough to
  break its own neck. The tallest the ink ever gets is 186 of the stage's 298,
  at 320px with four picked.
- **The clear control is inside the tray, at its own end.** It was the word
  `clear` in the margin to the left of it, and it was the worst element on the
  stage: bare grey text with no edge, floating with nothing to belong to, and
  sliding every time the tray's width changed, since its position came off the
  tray's own left edge. Clearing what you picked belongs to the thing holding
  what you picked. Measured in every state at 1280 and 390: 12px inside the
  tray's right edge, centred on it, 9px of lip either side on one row and 25.5
  on a phone's two.
- **The tray is centred on the stage and nothing outside it moves it.** With the
  button in the margin the pair had to be centred together or the tray was
  visibly off the middle, and centring the pair moved the one object the eye
  tracks every time the button appeared or went. With the button inside, there
  is one object to centre.
- **It is a square glyph, and being square is what makes its width a stated
  constant.** The word's width had to be read out of the browser before the tray
  could be laid out at all, so a measurement nothing else needed was in the
  critical path of the geometry. `CLEAR` is 24 and `layout.ts` simply says so.
- **Its focus ring is an outline in the flipped ink, and its colour is named.**
  The site's pattern pins `text-primary` and paints a white offset band, and this
  sits on a near-black slab, so that ring would be invisible and its offset the
  brightest thing in the frame, which is `window-shade`'s case. An outline with a
  width and a style but no colour of its own is worse still: it keeps whatever
  the UA put on `:focus-visible`, measured `rgb(0, 95, 204)` on this button
  before the token went back in.
- **The tray is as wide as what is in it, and a pick grows it.** It is centred,
  so growing it moves its left edge left and the chips already seated ride along
  as it recentres: measured across four picks, `prime` lands at x 266 and walks
  to 185 without being touched again, and the tray's own left edge goes 220,
  169, 139, 112, 88.
- **That was built the other way once and it was worse.** One open width, 0.72
  of the stage, held from the first pick so nothing inside ever moved again:
  measured, the tray went 97 to 359 on the first pick and held, and `prime`
  landed at 186 and stayed. It fixes the drift and costs the thing the demo is
  about. The slab is the object the eye is on, and a fixed one is a bar sitting
  there with space nobody has filled, where a tray that grows to fit is what a
  thing collecting what you hand it does. **Do not reintroduce the fixed
  width.** The drift is the price of a centred object that grows, it is
  spring-eased, and it reads as the tray making room.
- **The tray wraps inside itself rather than running past the stage.** Six chips
  want 428px, which a 352px phone does not have, and clamping the tray to the
  left edge only moved the overflow. Past its room it grows in height instead,
  which is also the better shape: a slab two rows deep still reads as a
  container where one row of six reads as a bar.
- **That room is the stage less `TRAY_GUTTER` on each side, never the stage
  itself.** Wrapping at the full width means the tray grows until it *is* the
  stage, and the demo is then a slab running edge to edge with no ground round
  it. Measured at six picked before: 313px of a 313px stage at a 390 viewport,
  0 clear on the left and 0.3 on the right, so the only breathing room left was
  the frame's own padding, and 360 kept 6px and 320 kept 12. At 16 every width
  keeps 20 to 32px of stage either side. It is not a cap on the tray's width,
  which is the fixed width above: the tray still grows to fit, it just runs out
  of room a little sooner and drops the next chip onto a new row.
- **The tray's corner is half a row and never half the tray, which
  `rounded-full` cannot say.** That keyword resolves to half the shorter side,
  so a tray wrapped to three rows on a 320px screen was 200 by 141 with a 70px
  corner: a lozenge rather than a slab, and since the readout sits on the first
  row, 21px down, where a corner that size has not finished curving, the count
  was drawn outside its own tray. `TRAY_R` holds it at 21, so the shape is a
  stadium while it is one row deep and a rounded rectangle once it wraps.
  Measured: 21px at every width and count, against the 38 and 71
  `rounded-full` gave. The chips keep `rounded-full`, being always one row tall.
- **The readout is pinned to the tray's first row, at `TRAY_H` and never the
  tray's own height.** Centred on the whole slab it drifts downward as the tray
  wraps, and every row after the first starts at the tray's own padding, which
  is under the count: at two rows the first wrapped chip was drawn straight
  through the word. A field's count sits on its first line and the tokens wrap
  beneath it.
- **Stacked, not side by side.** The reference puts the row of chips beside the
  tray above 560px and stacks under it, and this column is 538, so there is no
  wide branch to maintain for a width the page never has.
- **The wrap is greedy and keeps the given order.** What a reader is looking for
  after a press is where a chip went, and a wrap that reshuffles loses it.
- **`select-none` on the whole component, not on the stage alone.** Every
  gesture here is a press on a small pill, and a drag that starts on the stage
  and leaves it anchors a selection on the nearest text, which is the readout
  and every chip label. A chip carries its label twice, once in each of the two
  tones it steps between, so what that selection painted was
  `20 resultsprimeprimezoomzoomwidewideteletele`, in the site's own emerald with
  a pair of `SelectionPins` carets, and a select-all copied
  `primezoomwidetelemacrofast` out of the demo. It covers the measuring copy as
  well as the stage, since that is a second set of the same words sitting in the
  tree. Everything in here is a control or a readout about one, so there is
  nothing a reader would want to copy, which is the signature player's call.
  Measured after: no range from a triple click on the readout, a double click on
  a label, a drag along the chip row or a drag out of the stage into the prose,
  a select-all paints nothing over the demo, and the description under it still
  selects.
- **Reduced motion keeps every state and drops the travel.** Chips change place
  in one step, the filter never comes on and the loop never starts, since a goo
  is a thing a flight makes.
- **Nothing renders per frame.** The shapes are motion values, one loop writes
  `stdDeviation`, and it stops when nothing is moving. Measured under a 4x CPU
  throttle across five picks with the filter live: 177 frames, a median gap of
  16.7ms, a 95th percentile of 16.8 and one frame at 33.3.
- Verified in a browser at 320, 360, 390, 430, 640 and 1280px, at every count
  from none to all six: the demo holds 336px throughout with no sideways scroll
  and nothing leaving the stage, the tallest the ink gets is 176 of the stage's
  298 at 320px and four picked, the count reads 20, 3 and 0 results as chips are
  added, a carried chip merges on release inside the neck and tears out past its reach, a drag
  that commits to nothing lands within 0px of where it began, clear sends six
  back at once and they web together, Tab reaches the clear button and rings it
  in `#fafafa` at 16.5:1, Enter toggles a focused chip, nothing is requested at
  rest and the filter is off there, and no console errors.

### `notice-stack`

A pile of notices in a tray. Point at it and the one behind rises into a
thicker edge, move onto that edge and it rises again to read its title, and
press to advance: the front notice lifts toward the reader and dissolves while
the one that was peeking comes forward into its place. `notices.ts` is what is
in the tray, `stack.ts` the poses and the hit test, pure and DOM-free, the split
`document-pocket` makes with `poses.ts`, and `index.tsx` the pile and the
gestures.

- **Nothing here crossfades content.** Every card owns its own copy for the
  whole session and what changes is which depth it is at, so a notice arriving
  at the front is not being filled in, it is being uncovered: the body and the
  button it lands with were drawn the whole time, behind the card that was
  covering them. That is `folder-stack`'s claim about occlusion arriving at a
  pile that stacks up rather than a drawer that stacks back, and it is why the
  list never reorders either. The notices sit in a fixed array and a `front`
  index walks it, so a press is one number changing and the DOM never moves,
  which is `event-stacking`'s call for the same reason.
- **`peek` is one number, and that is what scaling about the top edge buys.**
  A card's `transform-origin` is `50% 0`, so its scale never moves the edge the
  peek is measured from and the two are independent. About the centre they are
  not: a card at 0.85 drags its own top down by 7.5% of a height nothing here
  knows, so every peek would carry a correction and the geometry would want a
  `ResizeObserver` before it could say anything at all. The other half of the
  choice is free, since scaling from the top lifts a card's foot as well, and
  the foot is the end already hidden behind the card in front. A card can shrink
  as far as it likes and never poke out from under the pile.
- **Only the second card ever moves, and the third is what it moves over.**
  Shut the pile is 0/8/14 at 1/0.92/0.85, which is three edges saying how many
  there are. Every stance after that lifts the second card and leaves the third
  exactly where it is: `lift` is 0/17/14, `title` is 0/38/14, and both of them
  cover it. **One card behind, whatever is being asked of the pile.** Raising
  both was the first build and it says the same thing twice, once in a strip too
  thin to read.
- **`lift` clears the third card by 3px and stops inside the second card's own
  top padding.** A title's line box starts 19.2px down and 17.95 after the
  card's scale, so at 17 it is still covered by 0.94px, which is the most this
  stage can show and still be saying nothing. A card with its heading sliced off
  is the one thing the first hover must not draw. `title` at 38 is that padding,
  the title's own 17.2px line and 2.5px under it: measured, the peeked title's
  box sits 19.7px above the front card's top edge.
  - **That padding is the floor under every number here, which is why the strip
    was shortened at the other end.** The strip a reveal opens runs from the
    card's top edge to the front card's, so the space above the title in it is
    the padding and nothing can be done about that. Cutting the padding cuts the
    cascade with it, since `lift` has to fit inside the padding and the resting
    pile has to fit under `lift`: at `p-4` the pile is two 4px seams. So the
    title takes `leading-tight` instead of the token's prose 1.6, since a
    heading that truncates rather than wrapping has no use for the leading and
    5px of it was being spent on nothing. 44px of strip to 38.
- **The scales are deeper than they look like they need to be, and that is what
  carries the arrival.** A press moves the second card 17px, which is nothing to
  watch, so what says it came from the back is that it grows 7% on the way,
  0.935 of the front card's width to all of it. At 0.955, which was the first
  build, the same press read as a card fading out over a card that was already
  where it ended up.
- **The hit testing is one line that never moves.** The front card is the only
  card with the same pose in every stance, so its top edge is a constant: below
  it is the card, which is `lift`, and above it is whatever the card behind is
  currently reaching into, which is `title`. One `pointermove` on the region
  measures against that line and nothing else is read.
  - **The band above the line comes off the stance the pile is already in, and
    every stance the pointer can move into has a band at least as tall as the
    one it left**, 8 then 17 then 38. So the region only ever grows under a
    pointer and a hover cannot take itself back, which is the loop
    `document-pocket` has to hit test its own neutral geometry to avoid, closed
    off by arithmetic instead. Approaching the pile from above opens it late
    rather than early, which is correct: the band is where the peeked card
    actually is, and above that is bare stage.
  - Mouse and pen hover and everything else taps, `folder-stack`'s gate and not
    a test against a finger.
  - **On a phone a tap on the front card opens the pile, and that is the only
    thing a finger does to it.** With the cycle target on the second card's
    strip and no hover to raise it, a phone would be left aiming at the 8px the
    resting pile shows, so a tap opens it to the stance a pointer would have
    reached and a second tap shuts it again. A tap that landed on a button is
    that button's, which is what keeps a tap on the strip a cycle rather than a
    cycle and then a close.
  - **The region's `pointerleave` is gated on the pointer type too, and without
    that the tap could not work at all.** A touch `pointerleave` is a lift
    rather than a departure and it lands after the `pointerup` the tap is heard
    on, so ungated it shut the pile inside the same gesture that opened it,
    which is `book-opening`'s trap arriving at a tray. Measured on a 390px
    phone: the pile rests at 0/8/14, a tap on the card takes it to 0/38/14, two
    taps on the strip walk it and leave it open, and a tap on the card shuts
    it.
- **One spring, and everything the pile does is on it.** The peek, the pass, the
  collapse and the promotion after a drop are all answers to something the
  pointer just did, and a preview that eases while a press snaps reads as two
  demos in one frame. Stiffness 720 and damping 40 settles in about 200ms with
  6% of overshoot, which is what keeps quick from reading as abrupt. It replaced
  a pair, a slow spring for the hover and a fast one for the press, plus the
  state and the timer that chose between them, and nothing about the pile was
  better for having two.
- **A cycled notice leaves toward the reader and a cleared tray leaves
  downward, and the two directions are the whole difference between them.**
  Cycling lifts the front card off the top of the pile, `y` 0 to 12 and scale 1
  to 1.05 over a 180ms tween, and it is gone: nearer for the moment it is in the
  air, which is what a card taken off a deck does. Leaving the tray is two beats
  on one 340ms tween, a shrink to 0.95 over the first fifth and a 110px fall
  over the rest. Neither of them is the back of the pile. A cycled card does go
  there, but it is invisible by then, so where it travels after the fade is
  bookkeeping rather than motion.
  - **The exit sets no `zIndex`, and that was a bug.** Pinning every exiting
    card to one layer hands the top of the pile to whichever is last in the DOM,
    so clearing the tray put the third notice over the one being read. A card on
    its way out keeps the `zIndex` it was rendered with, which is already higher
    than anything left behind it, since the list it was counted against is one
    longer.
  - **The fade is held back for two thirds of the drop**, which is about 60px
    of travel a reader sees before anything starts going. At 56px over a tween
    that faded from a third, the card was gone before it had been anywhere: what
    that read as was a notice dissolving in place with a little downward drift
    rather than one leaving the tray. The stage clips, so 110px carries it past
    its own bottom edge and the drop has somewhere to go.
  - **The fall accelerates on `[0.4, 0, 0.9, 1]` rather than a plain ease-in.**
    A card falling should gather speed, and the plain curve crawls for its first
    third, which here is the third the held-back fade exists to make visible.
  - **The keyframes open on `null`**, which is Motion's "whatever it is now", so
    a card deeper in the pile does not jump to the front card's scale on the
    frame it is asked to leave.
- **The blur belongs to the exit, not to the pile.** A notice leaving softens as
  it goes and nothing that is staying ever does, at any depth, which is why the
  peeked cards are sharp at rest and why there is nothing to schedule: each exit
  already has a tween and the blur rides it, at zero where the card is still in
  the pile and widest where it is gone.
  - **Only the card leaving carries it, and that was the fix.** Blurring the one
    arriving as well is what the reference does, and both soft at once is 160ms
    of mush with nothing in it to read: the pass stops being a notice being
    replaced and becomes a smear. Sharp underneath, the arriving notice is
    legible from the first frame and the one dissolving off it is the only thing
    moving.
  - **The drop carries it too, for the other reason.** Without it the leaving
    card and the one promoting are both sharp and both legible on top of each
    other, which is worse than either: two notices' worth of type in one box
    reads as a rendering fault rather than as one of them leaving.
  - `gooey-chips` derives its own softening from the gap between two shapes
    rather than from a timeline, and **the same move fails on a pile**: at rest
    the front card and the one behind it are already 9px apart, so a distance
    cannot tell a pile sitting still from a pile mid-pass. Riding each exit's
    own tween is the same idea reached from the other end, since an exit is the
    only thing here that ever moves a card out of the pile.
- **Pointing at the close control collapses the pile into one card, and that
  control clears the whole tray.** So the collapse is a preview of what is about
  to leave rather than a flourish: by the time it is pressed the pile is one
  card, and one card is what drops. Acting on a notice through its own button
  retires that one alone, which is the other exit and the same motion at a
  smaller scale.
  - **The control unmounts under the pointer on a press, so no `pointerleave` is
    coming to release the stance it was holding.** `clear` releases the lock
    itself, or the pile would stay collapsed with nothing on screen saying why.
- **The card you are reading is not a button, and the one behind it is.** What
  advances the pile is the strip the second card is showing, so a press lands on
  the notice it brings forward rather than on the one it takes away, and that
  strip is also the only part of that card a pointer can reach, since the rest
  of it is under the front card. The front card's own face does nothing, and its
  copy is `pointer-events-none` with only its two real controls turned back on.
  Measured: a press on the front card's body changes nothing, and three on the
  strip walk the pile.
  - **Nothing is nested.** A notice carries two controls of its own, so a card
    that was itself a button would have to hold them inside it. The cycle face
    belongs to the peeked card and the action and the close control to the front
    one, which is three buttons on two cards rather than two inside a third. The
    face sits last in the DOM and under the copy in paint order, so a screen
    reader hears a notice before what to do with it.
  - **Pressing that face unmounts it**, since the card it belongs to is now the
    front and the next one back grows a face instead, so focus is handed along
    or a keyboard user is left on `body` after one press. That is the same trap
    `inert` on the cards behind would have been, and it is why they are not
    inert: making a focused element inert blurs it.
  - **Only when the press was a keyboard one**, which is the active element
    matching `:focus-visible`. Moving focus on a mouse press paints a ring on
    every click, since Chrome judges a scripted focus rather than the press that
    led to it, which is what `sticker-peel` documents running into from the
    other direction. Measured: three presses by Enter walk the pile with the
    ring following, and three by mouse walk it with focus on `body` and no ring
    anywhere.
  - Measured: three tab stops, the face, the close control and the action, since
    every card that is neither the front nor the one behind it takes
    `tabIndex={-1}` and carries no face at all.
- **The pile is a grid stack, not a set of absolute boxes.** Every card lands in
  the same cell, so the pile is as tall as the tallest card in it and each one
  is stretched to that, with no measuring anywhere. The copy is written to wrap
  to two lines at both widths for the same reason, since a pile of four
  different heights would need a peek per card.
- **Every card carries the lift, unlike `folder-stack`**, where a shadow at rest
  reaches nothing because the card in front paints over it. Here the pile stacks
  upward, so a card's own top edge is the part nobody is covering and the halo
  above it is what separates one peeked edge from the next. Three layers, a
  contact line, a short cast and a wide ambient, which is `document-pocket`'s
  recipe. It is inline, so the hairline is an `outline` rather than a ring: a
  ring is a box-shadow too and an inline value replaces it outright, which is
  `book-opening`'s swap.
- **The corners are 12px and the action's 10, off the radius scale on purpose.**
  `rounded-lg` is 6.4px, which is the site's card radius and what the frame
  around this demo uses, and on a drawn object 280px wide it reads as a square
  with the corners taken off. This is the standing `folder-stack` and
  `document-pocket` give their own pixel geometry, and the two numbers live in
  `stack.ts` so the card, the button lying under it and that button's focus ring
  cannot drift apart.
- **It invents no colour**, which is rare for a lab this visual and is
  `crack-button`'s standing. The cards are `bg` on a `fill` stage with one
  `text-primary` action each, and the only thing separating the notice being
  read from the one behind it is tone, stepping while the card travels and under
  the blur. **The peeked title is `text-secondary` rather than `text-muted`**,
  since muted is 2.86:1 and that is the site's tone for a caption, where this
  line is the whole of what the second hover stage exists to show.
- **Neither exit confirms**, which is the shared rule's own exception for an
  action that is cheap to reverse: the empty tray carries a reset,
  `notch-drop`'s icon button and tooltip centred in the stage, waiting out the
  drop before it arrives.
- **Only the front notice can be retired, and the index check is what enforces
  it.** A card already on its way out has left the list, so its index comes back
  -1 and never matches, which is what stops a press landing on a dropping card
  and retiring the one that replaced it.
- **The stage is a fixed `h-105` rather than `aspect-8/5`.** 336px at every
  width is the 8:5 of the index's preview card at the lab column's 538, and on a
  390px phone 8:5 would leave 220px for a pile that wants 215 of them. Measured:
  538 by 336 and 352 by 336, with the card at 280 by 153.7 and 253 by 160.8,
  since prose leading is looser below `sm`, and no sideways scroll at either.
- **Reduced motion keeps every state and drops the travel.** The pile still
  opens, still advances and still clears, all in one step, and nothing blurs on
  the way since a blur here is a fact about a flight that is not happening.
- Verified in a browser at 1280px and 390px: the stances measure 0/8/14,
  0/17/14, 0/38/14 and 0/0/0, the card's corner is 12px and its action's 10, a
  press leaves the front notice at `y` 12 and scale 1.05 fully faded, hovering
  the close control collapses all three peeks to 0 and pressing it empties the
  tray, the reset brings all four back, the live region reads the front notice
  and its place, a tap on a phone advances the pile without hovering it, and no
  console errors.

### `tide-card`

A pill that becomes a card. Press `Check the tide` and the button opens into a
live tide: the station, the height now, and one cycle of water drawn in under a
marker that creeps along it while the card is held open. `card.ts` is the two
boxes and what happens between them, `wave.ts` the curve and where now sits on
it, `tide.ts` the tide itself, and `index.tsx` the box and its two controls.

- **The button is not replaced by the card, it is the card cropped to its
  title.** One box, one ground, one label, and the whole of the morph is that
  box's `overflow-hidden` opening. A button that opens a card is usually two
  elements and a crossfade, and what a reader sees then is one thing being
  swapped for another. Here the rows, the chart and the close control are laid
  out at the card's full size and mounted the entire time the button is a pill,
  so nothing mounts, nothing reflows and nothing can pop.
- **So the label needs no animation, no second copy and no position of its
  own.** It sits at `PAD` from the content's top left, and a box exactly `PAD`
  bigger than it on every side is a pill with that label centred in it. Centred
  in the button and top left in the card are the same one rule seen through two
  crops. Measured: a title of 86.8 by 19.2 gives a pill of 122.8 by 55.2, and
  the label's box does not move by a pixel from one end of the morph to the
  other.
- **The corner is never animated, because it never changes.** `rounded-full` on
  a pill is half its height, so a box one padding taller than a 19.2px line box
  carries a 27.6px corner, and giving the card that same corner is what lets one
  `border-radius` serve both ends. The pill reads as a pill because it is 55px
  tall, not because its radius is doing anything.
  - It is a constraint rather than a saving, and it is worth knowing which way
    round it works. A card that wanted a tighter corner would have to ease a
    radius under an edge that is already moving, which reads as the shape
    wobbling rather than growing. 27.6px on a 404 by 244 card is 11% of its
    height, which is generous and is what the reference draws, so the constraint
    cost nothing here. It would cost something on a card that wanted a 6px
    corner.
- **The content is laid out at the card's size whatever size the box is**, which
  is what makes the crop honest: the pill is a 123px window onto a 404 by 244
  drawing rather than a small version of it.
- **The close control needs no entrance for the same reason.** At one padding
  from the card's right edge it is simply outside the crop until the box is
  nearly the card, so there is nothing to fade and nothing to schedule.
- **It is also the one thing on the card that never blurs**, since it is a
  control and not content.
- **Both axes are on one clock, which is this piece's whole difference from
  `island-menu`.** There a nav bar grows tall and then wide, because what is
  being watched is a shape changing and two moves are what make it read as one.
  Here the shape never changes: the card is already the card and the box is a
  window onto it, so two clocks would be a window that opens in an L. Measured
  off the reference's own frames, its two axes track each other to within four
  points of progress the whole way, which is one clock within the error of
  reading a still.
- **So what is staged is the content instead.** The box is one move of 520ms and
  the card arrives inside it: the rows slide into place and come into focus one
  after another while the box is still opening, and then the water comes in.
- **There are three curves, because the box, a row's position and a row's focus
  are three different questions.** What decides an easing here is the slope it
  leaves at, which is `y1 / x1`.
  - **The box takes the drawer curve, `[0.32, 0.72, 0, 1]`, which leaves at 2.25
    times its own average speed.** A press is answered in the first few frames
    or it is not answered, and that is the one moment a reader is watching
    closely. `island-menu`'s `[0.4, 0, 0.2, 1]` leaves at zero, which is an
    ease-in start on an element responding to input: measured on this box, 4.6%
    of the move in the first 80ms, so it sat still for five frames after the
    press. `[0.22, 1, 0.36, 1]` leaves at 4.55, which is the lurch that lab
    rejected as arriving hard, and it was right to. Measured in the page after
    the change, timed from the press itself rather than through the harness: the
    box has moved one frame later and is 33 to 44% of the way there at 80ms.
  - **A row's slide takes `[0.23, 1, 0.32, 1]`, the strongest ease-out in the
    piece, and it is the one place a lurch is the point.** The box crosses 280px
    of stage and a row crosses 12, so front-loading 12px is what snappy means
    and there is no distance for the eye to be thrown across.
  - **A row's focus takes `ease`.** On the box's own curve a row went from 14px
    of blur to none in 117ms of a 365ms window, because a curve that front-loads
    spends a reveal before the eye has found it. A rack of focus is a barrel
    turned at a near constant rate with a soft landing.
- **So the content's clock is linear and every curve on it is a function applied
  to that one number.** A global ease plus a windowed mapping does not compose:
  the later a row's window sits, the flatter the part of the global curve it
  lands on, so the last row would slide slower than the first for no reason
  anyone chose. `bezier` in `card.ts` is eleven lines of bisection and it is
  what lets one entrance carry two curves, which it has to, because a row is
  doing two things at once.
- **The rows do not arrive together, they arrive down the card, and each lands
  before it sharpens.** A row slides its last 12px into place over the first 42%
  of its own band, 198ms, and comes into focus over all of it, 471ms. The fast
  half is the half the eye tracks, which is what makes a sequence read as snappy
  rather than as three things fading. Traced per frame: the meta row is in place
  at 262ms with 8.6px of blur still on it, the readout row at 362ms and the
  chart at 412ms, and the focus is still racking down the card at 462ms at 1.1,
  2.7 and 5.6px.
  - **The layout never moves.** Every row sits where it will end up for the
    whole morph and a transform carries it the last 12px, so nothing reflows and
    the
    claim that the card is laid out once survives the slide. The transform is
    written as a string rather than through Motion's `y` shorthand, which is not
    hardware accelerated.
  - **It is a mapping rather than six tweens.** Each row reads a window of the
    same two numbers, 76% of one wide and starting 12% apart, so the stagger
    costs no animation of its own and nothing has to be kept in step with
    anything. At a
    620ms content beat that is 74ms between rows, inside the 30 to 80ms a
    stagger has to stay in to read as one movement rather than as a queue.
  - **The focus reverses for free and the position must not.** Running the one
    number back down takes the last row out first, which is the order a hand
    would put them away in and which nothing anywhere has to say. That is right
    for the focus, since the card really is going out of focus.
  - **It is wrong for the slide, and that shipped.** A row that rose into place
    sank back out of it, 12px crammed into a 260ms exit, and did it while it
    could still be read: traced through a close, the status row was already
    dropping at 0.29 opacity and the meta row at 0.63. An entrance that rises
    should not exit by sinking back into the same spot, and the exit is the one
    place you want less motion rather than more. So position is a second value.
    It is held at its place for the whole close and put back only once every row
    is at zero opacity, which measures 49ms later with the box already a 125px
    pill, so nothing can see it happen. An interrupted close reopens with the
    rows where they are and no slide at all, which is the right answer rather
    than a shortcoming: they never left.
  - **The title is not one of the bands.** It is the anchor the whole morph
    hangs on, and it is never faded, blurred, slid or moved.
- **The rows start while the box is still forming, and being cropped on the way
  in is the point.** The first row is on screen 70ms in, when the box is a third
  of the way there, so it arrives into a box still growing round it and is cut
  off at both ends while it does. A card that finishes growing and then fills
  itself is two events. A row arriving into a box that is still opening is the
  box uncovering it, which is the thing this whole piece claims.
  - A row's opacity is the first 35% of its own focus rather than the first 60%,
    which is what puts it on screen early and soft instead of late and sharp.
  - **Both the filter and the transform come off entirely at rest**, never
    sitting at `blur(0px)` and `translateY(0px)`, since each makes its element a
    compositing layer whatever its value and there are three rows here rather
    than one wrapper. Verified: all three read `none / none` once the card has
    settled. Measured under a 4x CPU throttle with all three live, 96 frames
    opening and 72 closing, both at a 16.7ms median and a 16.8ms worst, so
    nothing is dropped.
- **The content arrives by coming into focus, not by fading, and the difference
  is a claim rather than a look.** A blur is distance where an opacity is
  existence, so a card that resolves was behind the button the whole time and
  too near to read, and a card that fades in was not there. `notice-stack` gives
  its blur to the exit for the same reason from the other end: there a notice
  leaving softens because it is going away, and nothing that is staying is ever
  soft.
- **Closing leads with the blur and lets the opacity follow it**, which falls
  out of reading that same number backwards. By the time the box has moved a
  fifth the card is unreadable, so the box never shrinks around type anyone is
  still trying to read. The first build took the content away in a flat 180ms
  and left the box shrinking around an empty ground with a label in the corner
  of it, which is a different and worse thing to watch.
- **The lift is derived from the box's height rather than animated**, the same
  call the corner makes: a bigger object casts a bigger shadow, so the card's
  lift is the pill's with one number changed and there is no second tween to
  keep in step with the first. Three layers on `document-pocket`'s recipe, a
  contact line, a short cast and a wide ambient one.

- **Everything the card says is one function evaluated somewhere.** `heightAt`
  is the tide, and the curve is that function drawn, the big readout is it at
  now, the state is its sign and the countdown is the distance to its next turn.
  There is no second copy of the tide anywhere, so the marker sits on the curve
  because both are the same function rather than because two drawings were made
  to agree.
- **One number carries the tide and one carries the reveal, and the chart reads
  their product.** Where the water's edge is, how much of the curve is solid and
  where the marker sits are the same value, so they cannot drift apart.
- **Placing the marker needs arc length and not width.** The solid half of the
  curve is offset with `pathLength="1"`, which is length, and a curve climbing a
  third of its box covers more length per unit of width where it is steep. On
  this curve the two differ by up to 4.6% around the middle of the rise, which
  is 13 units, so a marker placed by width would sit visibly off the end of its
  own trail exactly where the tide is moving fastest.
- **The cosine is sampled rather than approximated**, since it has no exact
  Bézier, and sampling is also what makes the arc-length table exact: the
  browser measures the same 120 segments the table sums, so the two cannot
  differ by more than the float arithmetic.
- **A tide is a cycle, and that is the one thing that lets a live demo be honest
  at every opening.** A journey lands, so a demo of one either ends dead or
  restarts something that was already half over, which is a thing a real tracker
  never does. Here the phase is left wherever it got to when the card shuts, and
  the chart is exactly one cycle, so water running off its right edge is the
  same water arriving at its left and the drawing does not move. A window of any
  other width would have to scroll.
- **The phase runs at a minute a second**, so the countdown ticks about once a
  second, the height moves about every six and the water is visibly coming in.
  At the real rate the marker would cover a fiftieth of a pixel a second and
  nothing on the card would change inside a session. Measured over 26 seconds
  held open: 3.3m and 2h 28m to 3.7m and 2h 00m.
- **Where the card opens is picked for the drawing, not for the number.** A
  cosine is flat at both ends, so a phase near either turn puts the marker where
  it has nowhere visible to go. 0.301 is two thirds up the rise, where the curve
  is steepest.
- **The water is a gradient rather than a flat fill, and it is clipped rather
  than rebuilt.** At one alpha the area is a dark slab with a hard foot, where
  what it stands for is depth. The edge is a clip rect whose width is driven, so
  a path of 120 points is not restrung every frame.
  - **A gradient stop resolves `currentColor` against the gradient element and
    not against whatever references it**, so a Tailwind class on the path
    painted nothing at all and the water was invisible. The stops name the
    token directly.
  - **The marker carries a drop line to the floor**, which is what explains
    that clipped edge: a filled area cut off at a vertical with nothing on it
    reads as a wall, and the same vertical with a marker sitting on top of it
    reads as now.
  - The marker's halo is the card's own ground, so it reads wherever it sits on
    the curve, which is the trick the signature player's nib uses.
- **Nothing renders while the tide runs.** The marker's transform, its drop and
  the curve's dash offset are written straight to their nodes off one motion
  value, and the only thing that commits is the readout, since text is not an
  attribute. The height changes about every six seconds and the countdown about
  every one.
- **Neither number morphs, and both carry tabular figures.** `torph` carries the
  two words on that row, `rising` against `falling` and `High water in` against
  `Low water in`, because a tide turning is one state replacing another and the
  characters they share stay put. The height and the countdown are a clock
  rather than a value being corrected: the countdown rewrites about once a
  second, which is far more often than the morph's own 200ms, so a morph still
  running when the next one started read as a smear. That is
  `event-stacking`'s note about its airborne label, arriving at a readout that
  ticks on its own rather than when a hand moves. Tabular is what the morph's
  width transition had been covering for, since a `1` arriving in the height
  shortens the string and shoves the unit and the state pill sideways.
- **The axis times are derived from one low water and the period**, never
  written down three times, so the labels cannot drift from the curve above
  them: move the period and they move with it.
- **The card scales with the stage and its type stops at a floor.** Everything
  inside is `cqw` against the card, so a card on a phone is a miniature of the
  same drawing, and at some width that stops being true: the meta row is 3cqw,
  which is 12.1px on a lab column and 7.4px at 320. Every size carries a px
  floor, and `CARD_MIN_H` is the other half of the same decision, since rows
  that have stopped shrinking run out of the bottom of a card that has not.
  Measured, 404 by 244 on a 538px column, 309 by 187 at 390 and 248 by 184 at
  320, where the height floor is what is holding it.
- **The stage is `aspect-8/5` with a floor under it.** The ratio is what the
  index's preview card is, so on a lab column the clip is the whole stage with
  nothing padded or cut, and `min-h-78` is what stops a phone's stage being
  220px tall with a card that wants 184 of them. `notice-stack` makes the same
  trade with a fixed height, and the floor keeps the 8:5 wherever there is room
  for it. Measured: 537.6 by 336.0 on a column, 1.6001, and 351.6 by 249.6 at
  390.
- **The card is `text-primary`, which is the site's own primary button at card
  size.** That is most of what says nothing was replaced: a card that opened in
  white would be a different object that happened to appear where the button
  was. It is the narrow use of a dark object on a light page that `notch-drop`'s
  notch and `book-opening`'s boards take, and the page under it stays white.
  - **The ink on it is the `inverse-*` text pair**, which is what reads on a
    near-black whatever the token is named for: `inverse-text` is 16.68:1 on
    `text-primary` and `inverse-text-secondary` is 5.38.
  - **Its hover and press are white at low alpha**, never a fill step, which is
    the rule this project already sets for shading a dark surface. The step in
    is instant and only the step back is timed, `tether-button`'s asymmetry: at
    200ms both ways a quick press never reaches its own colour.
- **The one hue is a state rather than a subject**, and it is the narrowest
  scoped exception in the lab beside `halftone-ripple`'s. The site ships one
  status tone and it means wrong, and a tide going out is not wrong, so the
  other state takes the quiet tone rather than a second hue, exactly as that
  lab's ripple goes out in `text-muted` when a press turns its button off.
  7.64:1 on the card's ground, scoped to this experiment, not a token, and
  nothing else may reach for it.
- **The station, the zone and the axis times keep their casing**, through
  `[text-transform:none]`, since a station name and a clock time are data rather
  than copy. That is `notch-drop`'s call for its meta line. The height is also
  off the type scale and carries a weight, the standing `flip-clock`'s numerals
  and `island-menu`'s wordmark have, since it is the thing the card exists to
  say.
- **The face and the close control are siblings, and neither is the box.** A
  card carrying a close control cannot also be a button, which is the split
  `notice-stack` documents. The face is an absolutely positioned button filling
  the box while it is a pill, and each is `inert` in the stance the other owns,
  so a screen reader is never handed a whole tide table out of a button that
  says three words.
- **The control that was pressed is the one that goes away, so focus is handed
  across**, or a keyboard reader is left on `body` after one press. Only when
  the press was a keyboard one: moving focus on a mouse press paints a ring on
  every click, because Chrome judges a scripted focus rather than the press that
  led to it, which `notice-stack` and `sticker-peel` both document running into.
  Measured: Enter on the pill lands focus on the close control with its ring,
  Escape lands it back on the pill with its ring, and a mouse press leaves
  `document.activeElement` on `body` with no ring anywhere.
- **The focus ring is the dark-ground variant, and it is stronger rather than
  weaker.** The project's own pattern pins `ring-text-primary/15`, a near-black
  ring on near-black, and Tailwind's ring paints its offset in
  `--tw-ring-offset-color`, which defaults to white and would put a bright band
  round the control. Same substitution `window-shade`, `island-menu` and
  `ember-burst` make.
- Escape closes the card, which is the courtesy the shared rules ask of anything
  that opens over a page, and `select-none` sits on the stage, since every
  gesture here is a press on one control and the card is a readout rather than
  prose.
- **Reduced motion keeps every state and drops the travel.** The card still
  opens, arrives sharp and runs its tide, all in one step. Verified: 60ms after
  a press the box already measures 404 by 244 with `filter: none` and the
  content at full opacity.
- Verified in a browser at 320, 390, 430 and 1280px: the pill holds 122.8 by
  55.2 at every one, the corner is 27.59px at both ends of the morph, nothing
  inside the card overflows it, the page never scrolls sideways, the tide
  advances and turns, and no console errors.

### `cube-orbit`

A Rubik's cube walked round its own cycle. Repeat a sequence of turns and the
cube comes back to solved. The dial is one ring per cycle of that sequence, each
turning one notch per repetition, and the cube is home on the repetition every
ring is home on at once. `cube.ts` is the permutation model and `layout.ts` the
geometry, both pure and DOM-free, which is the split `document-pocket` makes
with `poses.ts`.

- **The number is a fact about the sequence rather than about Rubik's cubes.**
  Every permutation splits into disjoint cycles, a cycle of length L is home
  every L repetitions, so the whole cube is home at the least common multiple of
  its cycles' lengths. That is the one thing the dial has to draw, and it is why
  a ring is the right shape for it.
- **A ring's rotation is the permutation rather than a picture of one.** A
  cycle's stickers sit on their ring in the order the sequence sends them, so
  turning the ring by one notch puts every one of them exactly where the
  sequence would have. The dial and the net cannot drift apart, because they are
  the same arithmetic evaluated twice rather than a drawing checked against an
  answer. Slot 0 sits at the index line, so a ring's marked dot is back under
  the caret exactly when that cycle is home.
- **Nothing here is a table of turns copied out of somewhere.** All six faces
  come from one rotation of one cubie, so they cannot disagree with each other
  and a sign error shows up as a cube that never comes home rather than as a
  drawing that is quietly wrong. Each face carries its own frame, an `up` and a
  `right`, and `right` cross `up` is that face's outward normal for all six,
  which is the one check that says a frame is not mirrored: get one wrong and
  the cube still turns, it just turns into its own reflection. Verified against
  the known answers: a quarter turn is 4, `R U` is 105, `R U R' U'` is 6, and
  `R U2 D' B D'` is 1260, which is the largest order in the cube group.
- **The two objects are sized against each other and measured, not eyeballed.**
  The cube is the subject and the dial is the readout, so the readout must not
  dominate. Three passes:
  - At the cube's first size the folded state measured 159 units of ink against
    the dial's 232, with margins of 52, 59 and 34 across the stage, which is an
    object pushed into a corner beside one filling its half.
  - Growing the cube to match fixed the balance and left the stage crowded: 192
    and 232 side by side in a 536 box is 79% of the width in ink, at margins of
    36, 43 and 34, and two heavy objects that close together read as congested
    however even the gaps are.
  - Both were taken down about a tenth, to 172 and 210, which leaves the
    margins at 47, 53 and 54 folded and 41, 47 and 54 flat. The rule is that a
    frame this size wants its margins wider than the gap between what is in it,
    not equal to it.
- **The rings are spread between a fixed outside and a fixed inside, never on a
  fixed step.** The four sequences carry four, four, four and six cycles, and
  1260 is the only one needing six: no sequence of turns reaches the largest
  order in the cube group with fewer, which a search over every sequence up to
  four turns confirms, where the best four-ring one manages 420. A fixed step
  made all four dials as dense as that one. Spread between two radii instead, a
  four-ring dial gets 18.7 units a ring against the six-ring dial's 11.2, and
  a dot takes a third of whatever its ring was given, so a crowded dial has
  small nodes and a roomy one has full-size ones. The hole in the middle is the
  same size either way, so the count always has room whatever surrounds it.
- **The four sequences are picked for the range of their answers**, 4, 6, 105
  and 1260, and the opener is the trivial one on purpose. A reader who is shown
  that one quarter turn comes home in four believes the claim before it gets
  strange, and the escalation is then the reward rather than the premise. They
  are also all under seven cycles, which is what keeps the dial to six rings and
  every ring far enough from its neighbour to read.
- **Only the cube's plastic inverts and the stage stays light.** A cube is a
  black plastic thing with its stickers stuck on it, and a white sticker is the
  page's own colour, so without a ground under it a sixth of the cube is not
  there at all. That is the narrow use of the `inverse-*` set `book-opening`'s
  boards make. On the dial, where there is no plastic, every dot takes the same
  `text-muted` rim instead: a rim tinted per hue would leave white as the one
  dot drawn differently, where one rim for all six is a drawing convention.
- **Nothing on the dial is drawn in `text-primary`, and the stage is quieter
  for it.** The lap arc, the caret and the mark on each ring's home dot were all
  near-black to start with, and together they put a heavy black arc round a
  drawing whose subject is six colours, with four to six dark-rimmed dots
  stacked on the index line at rest reading as a column of ink down the middle
  of it. The caret and the home mark take `text-secondary` now, which is a clear
  step above the other dots' `text-muted` without becoming ink, and the arc goes
  quieter still. The near-black is left to the plastic, the type and the lead
  pill.
- **The viewBox is exactly 8:5 and not the column's own 538 by 336.** Those are
  1.60119 and 1.6, so a viewBox of the measured column letterboxes the drawing
  by a quarter of a pixel and puts an offset between a pointer's place on the
  box and its place in the drawing. 536 by 335 is the same size to within a
  pixel and divides exactly. Measured in a browser: the stage renders 537.59 by
  335.98 and the dial's own grab region is a circle 230 square.

#### What the reader has to decode

The first build reported `cycles 4, 4, 4, 4, 4`, `order 4` and `home` in a strip
under the stage, and put the live count at 30px in the middle of the dial. That
is three pieces of jargon for a reader who was never told the premise, with the
answer set at 12px inside one of them and the least interesting number on the
stage set as the largest thing on it. Everything below is that pass.

- **One sentence carries the claim, and the control that changes it sits inside
  the sentence.** `repeat [R U] 105 times and the cube solves itself` states the
  premise, names the sequence, gives the scale of a press and sets the
  expectation, in the slot the three readouts used to have. The sequence picker
  lives in that line rather than in the row below, so the thing being repeated
  is named once and is visibly the thing the sentence is about.
  - It is a flex row and not prose with an inline pill. A control inside a real
    line box is what `InlineLink` spends `leading-none` and `em` padding on, and
    a row of three flex items wraps on a narrow column for free.
  - `text-body` rather than `text-meta`, since it is a sentence and the site's
    scale says so. The order takes `text-primary` and `tabular-nums` against the
    line's `text-secondary`, so the number is the one thing in the strip with
    full contrast.
- **The lap arc is the scale the count has no other way to get.** A number
  running to 1260 says nothing about how far along it is, and what a reader
  mid-run wants is how much longer rather than what the total was. It is a
  `pathLength="1"` circle with a dash of 1 and a gap of 1, so the whole of it is
  one dash offset written per frame. `butt` caps rather than round, or a lap at
  zero paints a dot at the top where there is nothing to report. **It is drawn
  in `text-muted` on a `stroke-strong` track**, which is the quietest pair that
  still reads as a filled arc: it went near-black first and then
  `text-secondary`, and both made a readout the loudest thing in a drawing whose
  subject is six colours. Measured at 40 of 105, the filled third is plainly
  darker than the rest of the ring, and nothing in the frame competes with the
  cube. It sits 12
  units outside the outermost ring at nearly three times their width, so seven
  concentric circles still read as one arc around six tracks.
- **The count and the word `solved` are two elements that trade places, never
  one label that changes.** A `0` with `solved` under it reads as "zero solved",
  which is the opposite of what has happened, and at rest the count is zero and
  carries nothing anyway. So arriving is the number being replaced by the word,
  on a 200ms crossfade, and that is also the only thing marking the arrival.
- **Pointing at a ring says what it is, in words, where its stickers are already
  lit.** `these 7 stickers come back every 7 repeats` replaced the permanent
  `cycles 15, 7, 7, 3`: a ring is twelve dots on a circle until you can see
  which twelve squares of the cube they are, and a count is worth nothing until
  it is attached to the thing it counts. The ring's own dots stay lit and every
  other ring's drop to 26%, so what the pointer picks out is one loop and the
  squares it holds rather than a loop on its own. The hovered track steps to 80%
  of the muted tone rather than to the whole of it, which reads beside its
  neighbours at 42% without darkening the ring a reader is looking straight at.
  - **It is a caption under the cube and not a footnote on the stage.** It sat
    in the stage's bottom left corner at first, which put it 68 units below the
    thing it describes and aligned to the stage rather than to it. Under the
    cube, centred on it and the same width, it reads as a label. It is
    absolutely positioned, so nothing in the strip moves when it arrives, and
    its box is a little wider than the cube it sits under, which is what keeps
    it to one line. A caption may be wider than its figure. What it may not be
    is two lines with one word alone on the second, which is what
    `these 7 stickers come back every 7 repeats` wrapped to before the copy was
    cut to `7 stickers, back every 7 repeats`.
  - **Only the flat cube is ever under it**, since the thing that shows the
    caption is the thing that unfolds the cube. That is what lets the folded
    cube overrun the net's own box without ever colliding with it.
- **It plays itself once when it scrolls into view**, which is the signature
  player's call and for its reason: without it the demo is two diagrams sitting
  still, and a reader has no way to know that either of them moves or what
  pressing anything would do. One lap on the opening sequence is four
  repetitions and about a second and a half, so what a reader is shown is the
  whole claim rather than a sample of it. **The autoplay is gated on reduced
  motion and the controls are not**, which is exactly the line: a press is a
  request and an autoplay is not. It waits for the preference to resolve rather
  than reading `null` as "no", since the hook returns null until it has an
  answer. Measured on load: the count steps 1, 2, 3 and home between 1.3s and
  1.8s, and under the setting it never moves at all.

#### The cube is its own net

A drawing of a cube can only ever show three faces, and the whole question this
demo asks is whether all six are home. The first build answered that by drawing
the net and giving the cube up. This is both, and it costs one number.

- **`--fold` runs 0 to 1 and drives everything**: the five hinges, the angle the
  whole thing is seen from, how much bigger it gets on the way up, and the light
  on each face. So a cross of six faces and a cube are two readings of the same
  markup rather than two drawings that have to agree. That is `book-opening`'s
  `--book-open` and `window-shade`'s `--shade` one level up, where one property
  carried fourteen transforms and here it carries eight and the camera.
- **The faces hang off each other the way the paper does.** Everything is a
  child of the front except the back, which is a child of the right, so a hinge
  is one rotation about the edge two faces already share and nothing computes a
  position. The net's own layout is the geometry: `bottom: 100%` with the origin
  on that edge and `rotateX(90deg)` is the top face, and the same three lines
  with different values are the other four.
- **A turn of a single face was built on top of this and taken out again.** A
  layer carries nine cubies' facelets from five different faces, and no
  arrangement of parents can rotate a set that crosses them, so it needed all 54
  as siblings with the hinge chain composed into each one's own transform. That
  worked, and the trigger never did: a single step played its turns, a run or a
  drag could not, and the only way to ask for a single step was to tab focus
  onto the dial and press an arrow. A gesture nobody finds is not a feature, and
  the demo is about a repetition rather than about a quarter turn.
- **It is HTML and not part of the SVG.** CSS is the only thing on this page
  that folds paper, and `transform-style: preserve-3d` has no meaning inside an
  `<svg>`. Everything in it is sized as a share of the stage through one
  `--block` in `cqw`, so it scales with the drawing beside it and nothing is
  measured in JS.
- **`backface-visibility: hidden` is what leaves exactly three faces showing.**
  CSS sorts planes by depth rather than by pixel, so without it the inside of
  the far faces paints through the near ones and the cube is a box of ghosts.
  That is `book-opening`'s call for its two boards.
- **The scene is pushed half a face forward along the front's own normal, and
  only once it is folded.** A cube grows backward from its front face, so
  centring the face is not centring the cube: measured, the folded box sat 27px
  right and 17 up of where the net's middle had been. The correction rides
  `--fold` like everything else, so the flat net is unaffected.
- **The light fades out with the fold.** Six faces lying flat all point the same
  way and there is nothing for one of them to catch, so the shading is
  `opacity: var(--fold)` over white and black at low alpha on each face's own
  colour, which is this project's rule for anything on an `inverse-*` ground.
  A cube whose three visible faces are lit identically reads as a diagram of a
  cube rather than a cube.
- **The faces touch, where the blocks of the first build had a gap between
  them.** A fold needs a shared edge, and two plates a few units apart hinge
  into a cube with a slot down every edge. What separates them flat is that the
  seam between two faces is a double gutter against the single one inside a
  face, which is enough at this size.
- **Pressing the cube is the only thing that folds it, and that was a
  correction.** Pointing at a ring used to unfold it too, on the grounds that a
  ring's stickers are spread over all six faces and that is the moment they are
  worth having. What it missed is that the dial is also the drag surface and the
  only keyboard target on the stage, so reaching it with a mouse at all, which
  is what focusing it takes, unfolded the cube, and any twitch of the hand
  afterwards unfolded it again. The rings' hit bands meet, so there was no part
  of the dial that was not also a trigger. **A control's own job has to survive
  being approached.** The highlight and the caption still answer a hover and now
  light whichever of a cycle's stickers are facing you, which is the reason to
  press the cube rather than an accident that replaces it.
  - **The cube is a real `<button>` carrying `aria-pressed`**, which is also the
    whole of the touch path, since a finger has no hover to open it with. The
    attribute carries the pin rather than the peek, because the peek is the
    pointer's and not a state anyone chose.
- **Opening takes longer than closing**, 520ms against 400ms, on the drawer
  curve that leaves at more than twice its own average speed. What starts the
  fold is a pointer arriving on a ring, and an ease that begins flat reads as
  the cube thinking about it. Closing is the demo tidying up rather than
  answering, so it is quicker.

#### The lap, and what it sounds like

- **A tick stands at every repetition that puts part of the cube back**, in the
  band between the rings and the arc, as long as the part is big. A cycle of
  length L returns its own stickers every L repetitions, so the count at step k
  is the total length of the cycles whose length divides k. Under `R U` the cube
  is a third of the way back together at 21 and at 42. Under a single quarter
  turn nothing comes back until the end and the band is empty, which is what
  makes the marks read as data rather than as a scale: they are there on three
  presets and absent on the fourth.
  - Capped at 170, keeping the highest. A lap of 1260 with a two-cycle in it
    returns something on every second step, and 630 hairlines round a 600 unit
    circle is a grey band rather than a reading.
- **The label under the count is how far is left, not the unit.** Both ways home
  are then on screen at once: the count is how far back solved is behind you and
  `43 to go` is how far on it is ahead, which is the whole of the shortest path
  on a cycle. `repeats` was a word that said nothing the sentence under the
  stage had not already said.
- **A click a notch, and nothing above a walking pace.** `dial-sound.ts` follows
  `crack-sound.ts`: one context, one noise buffer, a filtered burst per event,
  nothing fetched. A run crosses two hundred notches a second and a click each
  is a machine gun, so the ticks are gated on speed, which gives the right
  result for free: a hand turning the dial clicks, a run spins silently through
  its middle, and the clicks come back one at a time as it decelerates onto the
  last few notches. The band climbs as the lap closes, so a dial coming home
  sounds like it is tightening. The one arrival worth a tone rather than a click
  gets two sine partials a fifth apart.

#### The dial

- **It is turned by its rim, one repetition per notch of the outer ring.** So a
  hand that grabs a dot on the outermost ring and drags it to the next slot has
  applied the sequence once, and every inner ring is visibly turning faster than
  the hand, which is the whole picture: they come home more often, and the cube
  only comes home when they all do at once.
- **An HTML box over the drawing rather than an SVG circle**, since the
  project's focus ring is a box-shadow and a box-shadow does not paint on an SVG
  element. It is positioned as a percentage of the stage, and the stage and the
  viewBox are both exactly 8:5, so it lands on the drawing at every width.
- **`role="slider"`, because a dial with detents is one**, with the arrow keys,
  the page keys and Home spelled out. `aria-valuenow` and `aria-valuetext` are
  written to the node beside the rest of the frame rather than rendered, or a
  drag would be a state update per frame.
- **Letting go coasts to a notch and stops on it.** The flick's target is
  rounded before it is animated to, never snapped to afterwards: two animations
  in a row is a coast and then a correction, and the correction is the part a
  reader sees.
- **A move with nothing held ends a turn whose lift was never heard**, which is
  nib's rule: a window that loses focus mid-drag sends no `pointerup`, and a
  dial that keeps turning under a hand that is no longer down is worse than one
  that lets go early.
- **A hand on the dial is turning it rather than reading it, so the highlight is
  off for as long as one is down.** It dims five sixths of the cube, and a drag
  is the one moment the whole cube is worth watching: left on, the net goes dark
  for the length of every turn and the churn the gesture exists for happens
  behind it. This was visible in the recorded preview before it was visible
  anywhere else. It comes back on the next move rather than on the release, and
  that falls out of there being no move event to answer, which is
  `stamp-collection`'s call for a stamp arriving under a hand that never moved.
- **A sequence swap has to clear the highlight rather than forget it.** A ring's
  stickers belong to the sequence that drew them, so a `lit` left at its old
  index refuses the very call that puts the net back, and the cube keeps two
  thirds of itself dimmed under a set of rings that no longer holds it.
- `cursor-grab`, the tenth place the shared "cursor-pointer on every clickable
  element" rule is off, and `touch-none` on the grip alone, so a thumb scrolling
  past the demo is never trapped by the stage.

#### The run, and what it costs

- **A lap is one tween however far it has to go.** The distance is 4 repetitions
  on one sequence and 1260 on another, so a fixed rate is either a demo that is
  over before it starts or one that runs for two minutes. A fixed duration with
  a hard landing reads the same at both. Traced per frame on the 1260 sequence:
  0, 16, 87, 289, 680, 936, 1074, 1158, 1209, 1239, 1255 and home, over 422
  frames with a median gap of 16.7ms and a worst of 19.
- **The drawing smears by its own speed, and that is what makes a fast run
  watchable rather than a strobe.** 1260 repetitions in five seconds repaints
  all 54 stickers on every frame, and a full-field colour change at 60Hz is both
  unreadable and the kind of flashing nobody asked to look at. Blurring by speed
  turns it into the wash a spinning thing actually looks like, and it costs one
  filter. Measured on that run: the blur reaches its 4.4px cap through the middle
  and is back under a pixel for the last second, so the notches that matter are
  the sharp ones.
  - **The smear goes on a wrapper and never on the element carrying the cube,
    and that was a bug with a very plain tell.** A `filter` makes its own
    element a grouping element, which forces `transform-style` to compute to
    `flat`, so a blur written onto the scene collapsed all six faces onto one
    plane: a run showed a single 3x3 square and the cube came back on the frame
    the blur cleared. One wrapper between the two is the whole fix, since the
    flattening applies to the element that has the filter and not to its
    descendants. Measured through a 1260 run: `transform-style` holds
    `preserve-3d` at every blur from 1.17px to the 4.39px cap, and the cube's
    ink holds 141px where a flattened one is 101.
  - **The speed is this frame against the last one, never the motion value's own
    velocity, and that was a bug worth keeping.** Motion works a velocity out
    from the frame before, so a `set` landing after a long idle divides a real
    change by a 30ms floor and reports a value that never happened: swapping the
    sequence sets the dial back to zero from wherever it was left, which read as
    400 repetitions a second and pinned the blur at its maximum for as long as
    the drawing sat still. Measured before the fix, `blur(4.4px)` on a settled
    stage, and `none` after.
- **Nothing renders while the dial moves.** A ring is one `transform` write, the
  arc is one dash offset, a sticker is one `fill` and only when its colour moved,
  and the count goes straight to its node. The one piece of React state the
  drawing feeds is where the dial came to rest, written by `settle` alone, so a
  drag across seventy repetitions is one render rather than seventy. It exists
  for the one question a per-frame DOM write cannot answer, which is whether the
  control that goes back to solved has anything left to do, and that is only ever
  asked of a dial standing still.
- **The whole orbit is walked once when the sequence changes**, so scrubbing the
  dial is a lookup. The longest orbit any sequence of turns has is 1260 states of
  54 bytes, which is 68KB.
- **The sequence label keeps its casing and takes the mono face.** Lowercase is
  a different turn in cube notation, so this is data rather than copy, which is
  `notch-drop`'s call for its meta line. `R'` is written with a real prime and
  never a typewriter apostrophe. The control is the site's own mode selector,
  one pill whose label is the current value with two arrows saying a press swaps
  it, and the label morphs through `torph`, which is `book-opening`'s call. It
  carries an `aria-label`, since `torph` renders its text as aria-hidden
  character spans and a button whose only child is one has no name at all.
- **The lengths are listed with commas and never middots.** The shared rule bans
  a `·` between items, and here it would also be a lie: what the lengths give is
  their least common multiple and not their product, which on `R U` are 105 and
  315.
- **Reduced motion keeps every state, drops the travel, and changes what the
  lead control does.** A lap that arrives in one step is a lap from solved back
  to solved, which is a control that visibly does nothing, and a demo whose one
  control does nothing is not a demo: that is `flip-clock`'s line about a clock
  that does not change. So the pill reads `Repeat once` and applies the sequence
  once a press, which is the same claim with no travel in it and the better half
  of it anyway, since what a press then shows is every ring stepping one notch
  at once. The drag is direct manipulation and is unchanged. Verified: three
  presses walk the dial 0, 1, 2, 3 with the outer ring reading exactly
  `rotate(90)`, `rotate(180)` and `rotate(270)`, and no blur is ever written.
- Verified in a browser at 320, 390, 430, 768 and 1280px: the stage holds an
  exact 8:5 at every one with nothing overflowing it and no sideways scroll, the
  four sequences report orders 4, 6, 105 and 1260 against cycles `4, 4, 4, 4, 4`,
  `6, 6, 3, 3`, `15, 7, 7, 3` and `15, 14, 9, 4, 2, 2`, the arrow keys and Home
  step and reset the dial, pointing at a ring dims 50 of the 54 stickers and
  writes its line, swapping the sequence leaves none of them dimmed and no filter
  on the stage, a run ends solved with the arc full, and no console errors.

### `foil-card`

A profile card stamped with a dot-matrix hologram. Point at it and the card
tips toward the pointer, weighted, while the foil under the print picks up
colour. Press it and a wave crosses the foil, redder as it goes. `foil.ts` is
the grating field and the painter, pure and DOM-free, the split
`halftone-ripple` makes with `ripple.ts`, `card.ts` is the layout and where the
card balances, and `index.tsx` is the stage, the gestures and the frame loop.

- **None of the colour on this card is an ink, and that is the whole
  experiment.** A dot-matrix hologram is a grid of microscopic diffraction
  gratings stamped into foil, one per dot, each with its own groove pitch and
  groove direction, and what leaves a dot is whichever wavelength its own
  grating sends to the eye at the angle the card is being held at. So the
  pointer is the light, every colour on the card is an angle, and tipping it
  sweeps the spectrum across the grid. The reference is a card whose pixels
  light up in random colours on hover, and this is the same picture with the
  randomness taken out of it.
- **The grating equation lands as one dot product, and it is the one specular
  shading already computes.** The zeroth order leaves along the mirror
  direction, where the in-plane part of the half vector between the light and
  the eye is nothing, and the first order needs that part to equal one
  wavelength over the pitch. So a frame is: rotate the eye and the light into
  the card's own frame once, then per dot take `a + v`, dot it against the
  dot's groove normal and multiply by the pitch. Nothing per dot is a matrix.
- **The half vector is why the card has a quiet disc under the pointer.**
  Straight beneath the light that in-plane part is zero, so no dot there can
  answer with a visible wavelength and the colour rings it instead. That is
  what a foil does, and it is not a bug to design out. Measured with the light
  at the card's middle, the nearest lit dot is 15px away.
- **The pitch is spread across its range in the log, and that is what keeps
  the coverage even.** The answer is the pitch times the angle, so a linear
  spread hands a small angle a different share of the dots than a large one
  and the card comes out bright at one radius and washed at another. A log
  spread makes that share one number: the visible octave over the range's own,
  0.719 over 2.110, which is 34%.
- **A dot's pitch is two thirds its own and one third its neighbourhood's.**
  Pure noise is television static and a pure field lights in solid patches,
  which reads as a stain. Two thirds of the way over, neighbouring dots span
  most of the range while a slow drift still biases whole regions, which is
  the scatter with structure under it that a stamped foil has.
- **Three diffraction orders, not one, because a grating sends the series.**
  The answer divided by one, by two and by three, each weaker in turn, which
  widens the window a dot can answer in from 380 to 780 nanometres to 380 to
  2340. Measured with the light at the card's middle: 2011 of 6300 dots carry
  colour on the first order alone and 3156 with three. The quiet disc is
  unchanged, since the innermost order is the first one either way.
- **A press sends a ridge, and a ridge does three things to a sheet.** It
  stretches it over the crest, and a wider groove sends a longer wavelength, so
  the wave is a redshift travelling outward. It tips the sheet on its flanks,
  so the dots the slope runs through are turned and answer somewhere else
  again. And a tipped flank faces the light differently, so it catches more of
  it on the side turned toward the lamp and less on the side turned away. All
  three come off one gaussian: the stretch is its height and the other two are
  its slope. Nothing about it is a brightness ramp on a timeline.
  - **The third one is what lets the wave be seen at all past the bloom.**
    Without it the only thing a ridge changes is which wavelength a dot
    answers with, and a dot with no light on it answers with nothing, so the
    far half of the card never showed a wave go past. The light term is the
    incidence cosine with the ridge's slope taken out of it, which is what a
    tipped facet does.
  - **The slope is accumulated as a vector rather than projected per ripple**,
    since the two things it drives want two different projections: against the
    dot's grooves it decides the wavelength, and against the direction of the
    light it decides how much of that light the dot catches.
  - **The crest is 84 card pixels wide, which is about a third of the card's
    height.** At 34 it was a ripple in water: a band that narrow disturbs a
    couple of rows of dots at a time, so it crossed the card and almost nothing
    saw it go. A card is stiff, and a bending wave in a stiff plate has a long
    wavelength, so the wide one is also the honest one. It runs at 520 card
    pixels a second for a second, which crosses the whole card, and its
    amplitude decays linearly rather than as a square, or the crest is spent
    before it is halfway across.
- **The card is weighted rather than hinged through its middle.** Its balance
  point is the ink-weighted centroid of everything printed on it, measured off
  the rendered card through `data-ink` rather than declared, so moving a line
  moves the balance with it. The portrait is the only solid block of ink there,
  so the point lands at 0.631 across and 0.261 down, and the card turns about
  it: `transform-origin` is that point too. Measured at the four edge midpoints:
  the left edge tips it 8.94 degrees against the right's 5.21, and the bottom
  8.95 against the top's 3.12. A pointer on the balance point itself reads 0.00
  on both axes. Shortening the location line from two words to one moved that
  point from 0.616 and 0.286, which is the bullet above proving itself.
  - **A disc inks π/4 of its box and a lowercase line of type about a fifth of
    its line box**, which is the whole of `COVER`. Every text node takes the
    same figure, so the only thing it decides is how the type weighs against
    the portrait, which is the one comparison the balance point turns on.
  - The lumps are measured with `offsetLeft` and `offsetWidth` rather than
    rects, since the card carries a 3D transform and a rect of a rotated box is
    its bounding box rather than its own.
- **This is the one place in the codebase where a press scales something, and
  it is a deliberate override rather than an oversight.** The site's own rule
  is that nothing scales on press and that there is no `active:scale-[0.98]`
  anywhere, and the reason it gives is specific: an inline target sits wherever
  text layout puts it, so 2% of it is a fraction of a pixel of edge, under the
  threshold for reading as motion and over the threshold for changing
  antialiasing, and what a reader sees is fine detail smearing sideways rather
  than anything shrinking. None of that holds here. The card is 420px, so 2% is
  9px of edge and reads plainly as movement, and it is already under a
  perspective and already resampled on every frame of the tilt, so there is no
  crisp resting raster for the transform to smear. **Do not read this as the
  rule loosening.** It stands everywhere else, and the test it turns on is
  whether the thing being scaled is small enough for 2% to be sub-pixel.
  - The press is `1 - press * 0.018` on a spring at a 0.44 damping ratio, which
    overshoots its own target in both directions: measured across one press,
    the card bottoms out at 0.9781, which is 9.2px of edge, and comes back past
    its own size to 1.0045 before settling. That overshoot is what makes it
    read as a press on something rather than as a box being resized.
  - It is a second spring off the same target the shadow reads, since a shadow
    closing is not a thing that bounces and a card being pressed is.
  - The scale sits last in the transform, so it happens in the card's own plane
    rather than moving it in z, and it is about the balance point like the tilt,
    so the card shrinks toward where it is being held.
- **The shadow is a sibling of the card and not a `box-shadow` on it.** A
  shadow lies on the table and does not tip with the thing casting it: this one
  slides out from under whichever end has lifted and closes on a press. Three
  layers on `document-pocket`'s recipe, at `notice-stack`'s own values.
- **The stage is `bg-fill` and the card is the only object on it.** The card is
  white paper, so a white stage leaves it a hairline and a lift and nothing
  else, which is the fog `document-pocket`, `folder-stack` and `sticker-peel`
  each document and each answer with the same quiet grey ground.
  - **A pill inside the card is a different thing and stays gone.** The foot
    carried a `bg-fill` pill for a while, and a filled box behind a run of type
    reads as a tray that type is sitting on, where nothing on a printed card
    sits on a tray. The foot is two quiet runs of print now.
- **The card's type is off the scale on purpose**, sized as a share of the card
  like everything else on it, which is the standing `flip-clock`'s numerals and
  `tide-card`'s height have: it is printing on a drawn object rather than copy
  on a surface. The name and the role are the same size and separate by tone
  alone, which is the site's own rule for a title and its sub-line, and the
  stylesheet lowercases both, so the card reads as the rest of the site does.
- **The pointer is measured against the card's untransformed box, never its
  rotated one.** Reading the rotated box would let the tilt move the coordinate
  that produced it, which is the loop `document-pocket` has to hit test neutral
  geometry to avoid. The cost is a few pixels of disagreement at the edges,
  where a tilted card overhangs its layout box, and the reading is clamped for
  that.
- **The card is a drawing and the button over it is the control**, which is the
  split `notice-stack` and `tide-card` make: a card carrying its own content
  cannot also be a button, or its accessible name is everything printed on it.
  The gesture is an `aria-describedby` rather than part of the name, since a
  name is read on every focus.
- **That button is a sibling of the card and never a child of it, and this
  shipped wrong.** As a child it carries the tilt, so its hit area is the
  rotated card, and a face that turns away from the eye under a perspective
  also shrinks: the painted edge nearest the pointer pulls about 8.5px inward
  and the pointer that caused the tilt is left standing off its own target. The
  leave fires, the card levels, the edge comes back under the pointer, and it
  tilts away again. That is `document-pocket`'s loop exactly, and measuring the
  pointer against the untransformed slot closed only half of it: the coordinate
  was stable and the hit test was not.
  - **With a genuinely still pointer it does not oscillate, it latches off.** A
    browser is not required to re-evaluate hover under a pointer that has not
    moved, so nothing fires when the edge comes back and the card sits dead
    until the hand moves. A real hand is never still, so what a reader sees is
    a flicker. Traced with the pointer parked 2px inside the left edge: the
    card reached -7.14 degrees with a `div` under the pointer rather than the
    button, one leave, and then 0.00 degrees for the rest of the trace.
  - Untransformed at `inset-0` of the slot the region is the card's layout box
    and cannot move, so no loop is available. Same trace after: one enter, no
    leaves, the button under the pointer on every frame and the tilt holding
    -8.93 degrees.
  - It is safe in the direction that matters. The tilt only ever pulls the edge
    *nearest* the pointer inward, and the edge that overhangs the layout box is
    the far one, where the pointer is not.
  - The cost is that the focus ring no longer tips with the card, and the gain
    is that there is a focus ring at all: inside the card it was drawn outside
    the button's box and clipped away by the card's own `overflow-hidden`.
- **No tooltip on that button, which is the one place the shared rule for an
  ambiguous control gives way.** The control is the card and the card is the
  stage, so a label opening over it covers the whole of the thing it describes,
  which is the reason `ember-burst` refuses its own tooltip while a hand is
  down, taken one step further. The registry's `hint` names the gesture beside
  the demo and the `aria-describedby` names it for a reader with no pointer.
- **No transition on the focus ring either**, which is `book-shelf`'s and
  `document-pocket`'s call for a drawn object: the shared rule that makes one
  non-negotiable is written for inputs, selects and textareas, and nothing here
  is one.
- **Focus only lights the card when the browser calls that focus visible.** A
  press focuses the button through its own compatibility mouse event, which
  lands after the release has already put the card down, so an ungated handler
  picked it straight back up: on a phone that was a card which answered one tap
  and then never let go. `sticker-peel` documents the same heuristic from the
  other side.
- **A touch `pointerleave` is a lift and not a departure**, `book-opening`'s
  trap, and here it cost the whole touch path. The pointer stops existing when
  the finger comes off, so the leave lands right after the release with nothing
  having gone anywhere, and ungated it put the light out on the frame of the
  tap. The wave is drawn in diffracted light, so a tap sent one and then
  cancelled the light that would have shown it: measured, zero coloured dots at
  every sample through a tap. Gated, and with the light held for the length of
  the wave rather than cut on the release, a tap lights the card, shows its
  wave and goes out.
- **Reduced motion keeps every state and drops the travel**, and it is handled
  in the component: `MotionProvider` governs motion components and never a
  `useSpring`, which `event-stacking` documents. Both the target and the sprung
  value are live and the render picks which one is shown. The wave becomes a
  disc that fades where it stands, `halftone-ripple`'s call. Verified: 60ms
  after a move the card is already on its angle.
- **It invents no colour token and scopes no hue.** The card is `bg` on a `bg`
  stage with the site's own three text tones on it, the tooth of the
  paper is `text-muted` read off the token at mount, since a canvas fill cannot
  take a `var()`, and everything else is a wavelength. This is the strongest
  form of the exception the lab's other scoped palettes take, and also the one
  case where there is nothing to scope.
- **A foil is pastel, and landing there took three numbers rather than one.**
  The tooth runs 0.05 to 0.14 alpha, which is a grain you can see and not one
  you read: at twice that it was the loudest thing on a resting card. A lit dot
  then gives half of itself to its wavelength and half to the paper under it,
  where at 0.92 every dot near the pointer was a pixel of pure spectrum and a
  card full of them was painful to look at, which is not what a foil does
  either: a dot is small and diffracts a fraction of the light landing on it,
  so what comes back is a tint. And the irradiance falls off as the cube of the
  cosine rather than the square, so the colour is a bloom around the pointer
  instead of a wash carrying real colour into all four corners. A press drives
  the light to 1.35 and not 1.8.
- **The grid is one blit and one punch.** The painter writes one pixel a dot
  into a buffer, the buffer is drawn up to the card with smoothing off, and the
  gaps between the dots are punched with a `destination-in` pattern rather than
  baked in, so what shows through a gap is the card's own paper. A whole number
  of device pixels a dot, or the blit blurs the grid.
- **Nothing renders while any of it moves.** Four motion values carry the card,
  one frame loop paints the foil, and it stops asking for frames once the light
  is off and the last wave has crossed. Measured: 0 frames requested over 1.5s
  at rest, and under a 4x CPU throttle with a press held and the pointer
  dragging, 120 frames at a 16.7ms median, a 16.7ms 95th percentile and a
  16.8ms worst.
- **The card is sized by a custom property and never by `cqw` on itself**,
  which is `document-pocket`'s trap: an element is a query container for its
  descendants and never for itself, so the card's own radius in `cqw` would
  resolve against the stage and come out a third too large. `--card` is
  declared on the box that is the card's size and everything, including that
  box, reads it. The cap is what the share already comes to at the lab column's
  width, so it binds on every wider stage and the share only ever decides a
  narrow one.
- Its clip is 156KB against a 64KB average, and the subject is why rather than
  the recording: a field of per-dot colour that changes every frame is the
  worst thing there is to hand an inter-frame codec. It was 366KB before the
  colour was toned down, so most of that was the intensity rather than the
  idea.
- Verified in a browser at 320, 360, 390, 430, 768 and 1280px: the stage holds
  538 by 336 from a 640px window up and 352 by 262 on a 390px phone, the card
  420 by 240 and 295 by 169, nothing inside the card overflows it at any width,
  the page never scrolls sideways, the arrow keys move the light and Enter
  presses without the page taking the space key, a tap on a phone lights the
  card and puts it out again, and no console errors.

### `heart-flipbook`

A like button, and the strip it is played from. Press the heart and a ring goes
out, confetti scatters and the heart lands in the middle of it. `burst.ts` is
the model and the painter, pure apart from the context it is handed, the split
`halftone-ripple` makes with `ripple.ts`, and `index.tsx` is the stage, the
gestures and the frame loop.

- **Twitter's own heart is not an animation, and that is the whole reason this
  sits beside `halftone-ripple` rather than repeating it.** It is a sprite
  sheet: one PNG of 29 frames played with `background-position` and `steps(28)`.
  The most copied micro-interaction on the web is a flipbook, and it gets away
  with that because 29 frames over 800ms is one image every 28.6ms, which is
  under two display frames. So the burst is built properly, baked into a strip
  from the same painter, and one control swaps between them. In the button they
  are one thing.
- **One painter, two deliveries, and everything is drawn about (0, 0).** The
  live canvas translates to the heart and paints a frame, and the sheet
  translates to each tile's centre and paints the same frame from the same call.
  A flipbook baked by different code would look like the live version rather
  than being it, and the comparison would say nothing. Sampled at eight points
  across the run, the two are the same picture and the strip is the only thing
  on the stage that differs.
- **The strip is what makes the finding visible, since the button cannot.** It
  is the frames themselves, with the tile currently on screen boxed as it plays.
  In live mode that box gives way to a continuous playhead, which is the same
  timeline with nothing quantised. Without it a reader swaps the mode, sees no
  change and learns nothing.
  - **The sheet is a `fill` lane with one hairline between each pair of frames,
    and it lives in a disclosure under the stage with the two knobs.** Shut, the
    demo is a like button and nothing else, which is the honest resting state:
    the whole claim is that this looks like an ordinary like button. Five builds
    got the sheet's own treatment here and each was wrong in a way worth naming.
    No separators reads as a band of texture, and a band of texture under a
    button reads as a progress bar. Hairlines inside a bordered white box on the
    white stage reads as a table, or as an empty input. White cells on a
    `fill-active` rail reads as a toolbar, because `fill-active` is the pressed
    state of a pill and not a surface, and nothing on this site is a filled grey
    slab. **This site separates things with line, not with tone**, which is what
    `folder-stack` says when it gives every card a full hairline outline so the
    tones underneath can be a step apart rather than a world apart. So the lane
    is the same `fill` as every pill on the page, the rules are `stroke-strong`
    at 1.21:1 on it, where `stroke` is 1.03 and is not there at all, and nothing
    on it is near-black.
  - **The disclosure is `rain-splatter`'s, down to the grid row.** A single row
    going `0fr` to `1fr` with the panel in an `overflow-hidden` child, which is
    the one way to animate to a height the browser works out for itself, the
    padding inside the collapsing box so a shut panel is genuinely zero pixels,
    `inert` while shut, and the trigger above what it opens so neither the stage
    nor the pill moves when it arrives. Measured: 3 focusable elements shut and
    5 open, and the demo goes 390px to 491.
  - **The pill says `sheet` rather than `tune`**, since the sheet is what a
    reader came for and the two knobs are what they can do to it once it is
    open. It holds its hover while open through `aria-expanded:`, the site's
    rule for any trigger.
  - **Out of the stage it is a lane rather than the full-bleed band it was.** In
    the panel it is one item beside two others, so it takes the shape they take,
    and a rounded lane has no edge to collide with the frame's own inset ring.
    The band did collide: at `inset-x-0 bottom-0` it painted over the stage's
    own `ring-inset` and the left and right rules stopped dead where it began.
    **Any full-bleed child of a ringed stage has that trap waiting**, and the
    fix is to inset it by exactly the ring's width.
  - **The frame playing is lifted onto white and ringed in `stroke-strong`, and
    the lift is what marks it.** The ring is the same tone as the rules either
    side, 1.21:1 on the band, so what separates the marked cell is that its box
    closes on four sides and its interior is the white the frame was drawn for.
    Two heavier passes came first and both read as a selected spreadsheet cell:
    `text-primary` at 2px, which took a quarter of an 18px frame, then
    `text-muted` at 1px, which was still the darkest thing on a band of pastel.
    The live playhead keeps `text-muted`, since a 1px line needs more contrast
    to read than a box does. The lift is a second element under the canvas
    rather than a fill on the ring's own, since the rules either side are drawn
    on the canvas and would otherwise paint over the ring's vertical edges and
    wash them out. A positioned element paints above a static sibling whatever
    the DOM order, so the canvas is `relative` for this.
  - **The mode sits in the stage's top right corner, not under the sheet.** A
    corner reads as placed where a lone item on a line reads as dropped, and
    under a full-width band it had 400px of nothing beside it. Right rather than
    left, so it comes after the subject in the reading order. `book-opening`
    puts its own mode control in a corner for the same reason. Three builds got
    here: below the stage beside two knobs it has nothing to do with, then at
    the left end of a row under the strip, then this.
  - **A readout sat beside that pill and is gone**, `29 frames · 28.6ms each ·
    steps(28)`. Three pieces of jargon on a stage that already answers two of
    them: the strip shows how many frames there are and the knobs say the
    numbers, and `steps(28)` is CSS syntax that means nothing to a reader who
    has not already been told what a sprite sheet is. It belongs in the post,
    where there is room to explain it. The frame counter that fed live mode's
    half of it went with it, since nothing else read it.
- **The ring is one stroked circle and never a disc with a smaller disc masked
  out of it.** `r` grows while `lineWidth` shrinks, so the inner edge at `r -
  w/2` and the outer at `r + w/2` travel at different rates from one shape,
  which is the seed dot, the solid disc, the hole punching through and the
  annulus thinning away in that order. The hole is a share of the outer edge, so
  at the end of the ring's life the two meet exactly, the width is zero and the
  ring is gone without anything having to say so.
- **The heart is one path string and two renderers.** The button's resting heart
  is an SVG `path`, so CSS owns the hover and the fill and nothing runs a loop
  for them, and the burst's heart is that same data in a `Path2D`. They have to
  be one shape, because the canvas heart lands at scale 1 and the DOM heart
  takes over from underneath it.
  - **The canvas heart is stroked as well as filled, and that is what makes the
    handover exact.** The DOM heart carries `stroke-width: 2` in the same 24
    unit box, so its ink runs one unit past the path on every side: a fill alone
    measures 32.67px at a 40px heart against the DOM's 36, so the heart grew
    3.33px in the frame the canvas let go of it. Measured after, against the DOM
    heart at the same size: PSNR 29.8dB, and magnified six times the two shapes
    coincide with the difference confined to a one pixel edge ramp, which is
    Chrome's canvas rasterizer against its SVG one and is invisible at size.
  - **Two further passes at that difference were tried and reverted**, rounding
    the canvas's CSS box to its backing store and blitting the tile on whole
    device pixels. Both produced byte-identical screenshots, so neither is in
    the file and neither is worth trying again on this stage.
- **The confetti leaves the ring's rim rather than the centre.** Seven pairs, an
  inner dot and an outer one at slightly different angles, which is the
  reference's own count and is what makes it read as two loose clusters rather
  than a starburst. Launched from zero they spend the first third of their life
  inside the annulus, drawn as specks caught in a donut: the ring's outer edge
  is already past 33 when the first dot is born, so anything under that is
  behind it.
  - **Its reach and its size are both the reference's proportion, and the first
    build was wrong on both.** Measured off the stills, the furthest dot sits
    about 1.35 ring diameters out and a dot is about 0.147 of the heart's width.
    The reach was 1.69, which threw the confetti clear of the picture and made
    the burst's envelope 28px taller than it had to be. The size was worse: at a
    5.6 base against a 46px heart the dots ran 0.21 to 0.36 of it, roughly
    double, and that is most of why the shower read as heavy discs rather than
    as a light scatter. They run 0.12 to 0.21 now.
  - **Deepening a decoration to clear a contrast floor is the mistake to avoid
    here, and this lab made it twice.** The first pass pushed every confetti hue
    until it cleared 3:1 and drew a shower of hard saturated discs where the
    reference throws pastel. The floor exists for a graphic a reader has to
    read. Check what the thing is before spending contrast on it.
- **Two knobs, and neither can break the burst.** `frames` and `run` change how
  the animation is delivered and never what it is. The ring's life, the heart's
  entrance and the confetti's reach are bound to each other, and a reader who
  moved one would see a shape rather than a finding, which is `pixel-reveal`'s
  call for `FLIGHT` and `WAIT`.
  - **`run` is what breaks the flipbook, and that is the finding from the other
    side.** The same 29 frames over 2.4s are 85.7ms apart and it stutters
    plainly.
- **The heart's ink is X's own like pink, which is the brand-hex exception
  arriving at an interaction rather than a logo.** A recreation of one company's
  button in a different pink is a recreation of nothing. 3.84:1 on `bg`, and it
  is deliberately not `halftone-ripple`'s `INK`, which that section documents as
  being nothing else's.
- **The ring and the confetti are a scoped set, and it is light.** The reference
  lightens its ring as it expands, which is right on black and backwards on
  `bg`, so what travels here is the hue and not the lightness: `#ef4f9a` at 3.36
  into `#ae6fe0` at 3.41. The ring is the burst's whole form, so it carries the
  meaning and clears a graphic's 3:1 floor, and it only just does. **The six
  confetti hues sit under that floor on purpose, at 2.29 to 2.99, because
  confetti is not a graphic that carries anything.** The heart says the state
  and the ring is the shape, and those two clear it.
- **An unlike throws no burst**, which is what the real button does: the burst
  belongs to the press that turns it on, and an unlike is the fill leaving. The
  recorded clip presses three times for that reason, since a clip that only ever
  likes never shows the other half.
- **The button and the sheet are shares of the stage**, `--heart` and `--tile`
  declared on it and read by its descendants, the arrangement `document-pocket`
  documents at length. The painter's scale is the rendered heart's width over
  the one the sheet was baked at, so whatever CSS decides a heart is, the burst
  is that size too and the sheet is blitted smaller rather than re-baked.
  Measured: the heart is 46px on the lab column, 30px at 390 and 24px at 320.
  - **`--heart` is 8.6cqw and was 7.44, which is 46px against 40.** The two knob
    lanes under the stage are 24px black numerals on 500px tracks, so at 40 the
    loudest thing in the frame was a setting and the quietest was the subject.
  - **The button centres in the whole stage, since the sheet left it.** It hung
    off the top for a while, at 88% of the stage, with the sheet pinned to the
    foot so the tile size the `frames` knob sets grew into the gap between them
    and moved neither: centred in the remaining space that slid the heart under
    the reader's pointer, and bottom-anchored alone it moved the stage's foot
    instead. With the sheet in a panel there is nothing under the button to make
    room for. The tile ceiling is still read off the row's `max-height`, since
    an unregistered custom property computes to its own text and
    `getPropertyValue("--tile")` hands back the literal `clamp(...)`.
  - **Two lanes rather than `Panel`'s three cells**, since the mode control is
    in the stage. Two in two columns balance, where `Panel` refuses two because
    its odd third lane would sit beside an empty cell.
- **The count is off the type scale**, the standing `flip-clock`'s numerals and
  `tide-card`'s height have: the button is a drawn object sized in shares of the
  stage, and a token size would not scale with it.
- **Nothing renders while a burst runs.** One frame loop writes to the canvas
  and the strip's marks go straight to their nodes. Measured: 0 frames requested
  over 1.5s at rest and 0 over 1.5s after a burst has settled.
- **Reduced motion keeps the press and drops the travel.** The heart fills at
  once and the confetti appears at its widest and fades where it stands over
  320ms, `halftone-ripple`'s call. There is no ring, since a ring is a fact
  about a flight that is not happening.
- It is `flush`, white, with its own inset ring, `notch-drop`'s stage, and
  `aspect-8/5`, which is the shape of the index's preview card, so the recorded
  clip is the stage with nothing padded or cut.
- Verified in a browser at 320, 390, 430 and 1280px: the stage measures 282 by
  176, 352 by 220, 392 by 245 and 538 by 336 and never moves when the panel
  opens, the strip measures correctly while the panel is shut so there is no
  glitch on the first open, there is no sideways scroll at any width, the count
  goes 1284 to 1285 and back, the flipbook and the live drawing are the same
  picture at eight sampled points, and no console errors.

### `arc-menu`

A launcher whose items ride an arc. Press the plus and five marbles file out
from under it, one after another, and swing round a circle to where they rest.
Press it again and they retract the way they came. `track.ts` is the geometry
and the strand, pure and DOM-free, the split `document-pocket` makes with
`poses.ts`, `marbles.tsx` draws what rides it, `marble-sound.ts` is what one
clearing the neck sounds like, and `index.tsx` is the stage, the gestures and
the loop.

- **One scalar carries it.** `advance` is how far the leader has travelled from
  the mouth in radians, and every other ball's travel comes off that. A ball's
  angle, its scale and whether it is on screen at all come off its travel, so a
  press, an arrow key and a hand cranking the plus round the arc are that one
  number moving at different speeds. It is `book-opening`'s claim about its
  fourteen sheets with a strand in place of a stack.
- **The scalar runs between two ends and nothing else, and everything reads
  those same two.** Zero is the whole strand inside the mouth and `OPEN` is the
  strand spread. A press animates between them, the crank is clamped to them,
  and a release resolves to one of them.
- **Shutting is the opening run backwards.** A ball retracts along the arc it
  came out on and the tail is home first, which is the mirror of the order they
  left in. The first build ran the track as a one-way loop instead, carrying
  them on round the rest of the lap, which is what the reference does: the wrap
  back to zero is free, because both ends of a lap paint the same empty
  picture, and it reads as a second opening rather than as the menu closing. Do
  not put it back.

**Why the two directions cannot share a curve.**

- **Whichever ball is last through the mouth spends its whole passage in
  whatever part of the curve the end of the move lands on.** That falls out of
  one scalar carrying five items: their passages are five samples of the same
  curve taken at five different points along it, so the curve decides not just
  how long the move takes but which ball dawdles. Measured per frame on a rigid
  strand, the five passages in ms:

  | closing curve | corkscrew | oxblood | clearie | cat's eye | aggie |
  |---|---|---|---|---|---|
  | `drawer` | **408** | 33 | 33 | 33 | 33 |
  | `burst` | 100 | 49 | 33 | 33 | 33 |
  | `ramp` | 66 | 50 | 48 | 66 | 66 |

- **`drawer` is the open's own curve, and it is the one that cannot be used to
  close.** Its flat tail is right on the way out, since five balls are coming
  to rest on screen and the last one out is the tail, the smallest ball. On the
  way in the last one through is the leader, the biggest ball on the stage, and
  it takes 408ms to shrink into the button against 33 for every one of the
  others. That is the last ball visibly dawdling, and it is what shipped before
  anyone measured it.
- **`burst` is the default and the answer.** It matches the open's launch, so
  the two read as one gesture and its reverse, and it lands while still moving,
  which costs nothing because at that instant the only thing on screen is the
  leader going behind the button. Measured in the page, open against close: 50%
  of the travel at 145 and 124ms, 90% at 295 and 324.
- **Matching them is not the same as matching their durations.** A curve with
  the open's launch and a steady run after it covered 90% at 591ms against the
  open's 295 even though the two left at the same speed, and what that reads as
  is an exit slower than the entry. What a reader clocks is when the movement
  is over, not when the tween is. It is also why the open runs 800ms to the
  close's 420 and the two still finish together.
- **`ramp` accelerates, and it fixes the wrong half.** It puts the slow part at
  the start, where the strand is still spread and nothing is in the mouth at
  all, so the passages come out even and the press has no answer in it: the
  tail does not start shrinking until 224ms against 40ms on `burst`.
- **All three curves and a rigid strand were a panel under the stage once**,
  two mode pills and a live readout of the five passages, so a reader could
  press close and watch the leader dawdle or not. It is gone. It is a good
  experiment and it is not this demo: a strip of controls and five numbers
  under a menu makes the menu a specimen, and everything it proved is written
  down here with the numbers it produced. The measurements below are that
  panel's own.

**The strand is a chain rather than a rail.**

- Every ball follows the one ahead through its own exponential instead of
  sitting a fixed arc behind the leader, so the strand pays out under a fast
  hand and gathers when the hand stops, which is what a string of beads does
  and what makes the crank feel like one. `LINK_TAU` is 12ms, which at the
  open's peak is about 14 degrees of lag a link and 56 across the strand, so it
  stretches by a quarter of its own length and comes back.
- **A chain evens the passages out on its own, which is the second thing the
  panel found.** The lag per link swamps the curve's own tail for everything
  except the leader, which the scalar drives directly. Measured on `burst`: 99,
  75, 80, 81 and 66ms against the rigid strand's 100, 49, 33, 33 and 33. The
  curve still decides the leader and no longer decides anybody else.
- **The loop lands the chain by hand on its last frame.** An exponential only
  ever approaches, so without it a ball sits a ten thousandth of a radian out
  of the mouth forever and never reads as gone. It cost the readout four of its
  five numbers while there was a readout, and it still costs the click, which
  reads the same crossing.
- Reduced motion takes the rigid strand, since a lag is nothing but travel.

**The geometry.**

- **The spacing between two neighbours is a share of the two radii it
  separates**, so a big ball is given more room than a small one and the spread
  is a fact about the sizes rather than a number picked by eye. It carries the
  spread as well, since the strand covers 218 degrees whatever the balls are
  sized at: taking them down leaves more ground between them rather than
  bunching them into a shorter chain. Measured, the four gaps at rest are 36.6,
  28.0, 37.0 and 35.0px of clear ground between the rims.
- **The scale ramps over the arc a ball's own centre spends inside the
  button**, which is the chord equal to the button's radius and comes to 19.6
  degrees. A ball is at full size exactly when it stops being something the
  mouth is hiding, so the ramp is derived from the two radii rather than being
  a duration, and it is also what the stopwatch and the click read.
- **The size sequence is irregular**, big then tiny then middling, which makes
  a row of circles an assortment rather than a carousel of equal dots. It runs
  2.5 to 1 where the reference's runs 4.4: at that spread the biggest ball is
  wider than the track it rides, and five of them fill the dial rather than
  sitting on it.
- **The composition is 70% of the stage's height and the rest is ground.** The
  dial is the subject and the stage is the room it stands in. The first build
  divided the whole height between the biggest ball's overhang, two radii of
  track and the button's, which fills the frame edge to edge and reads as a
  poster of itself. `FILL` is the one number that takes it down, and the
  composition is centred in what is left. Measured: 537.6 by 336 on the lab
  column, the track at radius 85.8, the balls 68.7, 54.9, 42.9, 36.0 and 27.5px
  across, the button 58.4, and 50px of clear stage above and below.
- **Every length is a share of the track's radius**, so nothing carries a pixel
  and the whole arrangement scales with the stage. Measured on a 390px phone,
  the stage is 351.6 by 249.6 and nothing overflows.
- **The settled pose is the leader ten degrees past the far side**, which
  leaves the strand running from the lower left, up and over the top, and down
  to the right. It is bounded below by the strand's own 218 degrees plus the
  mouth and above by the lap, and 0.78 of a lap sits in the middle of what is
  left. The tail rests at 62.6 degrees against a 19.6 degree mouth, so both
  ends are clear.

**The crank.** The plus is the handle, and pressing it and turning about the
track's centre is what pulls the marbles out by hand.

- **What the hand writes is the angle it turns through, never its travel in
  pixels.** The same hand movement is a different amount of arc at the top of
  the dial than at its side, so a bearing is the only reading that makes a
  degree of hand a degree of strand. Measured: 120 degrees of hand turns the
  strand 119.9.
- **It is the turn and not the bearing, so the strand keeps whatever it already
  had.** A hand that presses the plus while the peek is showing has the leader
  a peek ahead of it rather than exactly under it, which is the same thing a
  second crank from a strand left part way out does. Absolute would put the
  leader under the hand always and would jump the strand to the hand's bearing
  on every press, which is a flinch on a control whose whole job is to be
  pressed.
- **The turn is accumulated from the press rather than from the moment the
  crank engages**, so the slop costs the leader no ground. Discarding it left
  the strand trailing the hand by the slop's own 3.3 degrees for the rest of
  the gesture.
- **A hand passing near the centre turns nothing.** A bearing taken within a
  quarter of the radius of the centre is noise, and acting on it spins the
  strand through half a lap for a few pixels of hand.
- **A release resolves to one of the two ends rather than parking where it was
  let go.** A menu a third of the way out is not a state anyone asked for. The
  throw decides it when there is one, off Motion's own velocity, which reads
  zero once a value has been still for a frame or two, so a hand that stopped
  before letting go is a placement and the halfway line decides. A free coast
  came first and it is the wrong idea here: it is right for a dial that has no
  poses, and this has exactly two.
- **A move's duration is scaled by how far it actually goes.** A tween's
  duration is fixed however short the move, so a resolve from most of the way
  open would take as long as the whole thing. The floor is a third, since a
  very short move still needs to be seen.
- **A drag ends in a click on the button it started on**, so a flag set once
  the press passes its slop is what stops every crank also toggling. On nib's
  rules otherwise: down on the plus, move, up, cancel and blur on the window,
  and `buttons === 0` ends a crank whose lift was never heard.
- **A ball in flight is a target moving under the pointer**, so the layer is
  transparent to it for as long as anything is travelling, written to the node
  rather than held in state. A crank would otherwise render twice a gesture for
  something no pixel depends on.
- **The plus keeps `cursor-pointer` and the grab cursor waits for a crank that
  really started**, which is `gooey-chips`'s pair and its reason: the plus is a
  toggle first, and a grab cursor sitting on it before anything is held says
  the click it is about to get will not work. The stage carries
  `data-[crank]:cursor-grabbing` and the same on its descendants, since the
  button declares its own and an inherited value loses to a declared one.

**The rest.**

- **The marbles are drawn, and they were five of this site's own lab stills.**
  Cropped hard enough to carry a colour, three of the five were screenshots of
  other experiments reduced to abstraction, and two other labs already put lab
  stills in a frame. A demo about a strand of objects passing a gate should own
  its objects. A marble is also a solved drawing problem: a handful of flat
  shapes behind glass, legible at 27px and at 69px, with the kind saying as
  much as the colour. Five kinds and no two built from the same parts, which is
  what makes them an assortment.
  - The hues are the twenty-fourth scoped set in the lab and make the same
    claim as the others. They are not tokens and nothing else may reach for
    them.
  - Each draws its interior only. The light on them is one shared pass in
    `index.tsx`, since there is one lamp over the stage and not five: a soft
    light off the upper left and the far edge falling away, both in percentages
    so one string serves every size. It was a full glass treatment first, a
    hard specular and a heavy rim, and five of those read as a bag of toys.
- **Picking one is what the menu is for.** The marble is held, the strand goes
  home, and the plus wears a ring in that marble's own colour, which is the
  only thing a resting stage has to say it with. The balls were links to other
  labs before the marbles, which was honest and put the payoff on another page.
  - **A line in the strip read out what was held and it is gone.** Two rings
    already say it, one on the marble and one on the plus, and a sentence
    restating them is the demo narrating itself. It also left the disclosure's
    trigger sharing a row with a caption, where a trigger belongs on its own
    above the thing it opens.
- **A ball clearing the neck clicks, pitched by its size.** The same crossing
  the scale ramp and the stopwatch read, so the sound is derived from the
  geometry rather than scheduled: five clicks out and five in, and a crank
  pulls them one at a time. `crack-sound.ts` sets the shape and
  `cube-orbit`'s `dial-sound.ts` the size, and it needs no speed gate, since
  the fastest thing it can produce is five clicks over the length of an open.
- **Hovering the trigger peeks the strand, and the peek is a sliver.** `PEEK`
  is three fifths of the mouth, where the leader is two thirds grown and its
  centre is still inside the button, so what stands past the rim is the top of
  a ball behind the plus rather than a ball beside it. Measured: 10.6px of it,
  and nothing else has left the mouth at all.
  - Two earlier values were both far too much. Reaching the second ball takes a
    whole strand gap, which carries the leader 84px out of the mouth, and
    clearing it takes a gap and a mouth, which is 108px. Either is the menu
    opening rather than a hint that it can.
  - Mouse and pen only, the gate `folder-stack` documents, and off under
    reduced motion, which is the line `book-opening` draws between a state and
    the travel to it. A peek is nothing but travel and it answers a hover
    rather than a press.
  - **`PEEK` is the floor the trigger reports against, not zero.** A press
    shuts the menu when the strand is showing, and if that test were `advance >
    0` then hovering the plus would arm it to shut something it has not opened.
    `spread` in `track.ts` is the one test, and `aria-expanded`, the cross and
    the `inert` on the layer all read it.
  - A press disarms the peek until the pointer has been away, or shutting the
    menu would peek it straight back out under the hand that just shut it.
- **The trigger sits before the marbles in the tree and over them by `z-10`,
  because the two orders are not the same question.** What paints last is the
  thing hiding the mouth, and what a reader tabs into first is the trigger.
  With the button last in the tree, which is what the paint order alone asks
  for, Tab went from the plus straight out of the demo and the menu's own items
  were only reachable backwards.
- **Each ball carries its own tooltip, which is the site's answer to a control
  with no text on it.** It was a readout in the dial's hole first, on
  `radial-menu`'s reasoning that a dial's middle is the one place nothing else
  wants, and that is right for a value the dial is set to and wrong for the
  name of the thing under the pointer: the label floated in the middle of the
  ring a whole dial's width from the ball it named.
  - **`skipDelayDuration` is 0 on the provider.** Radix's default opens the
    next tooltip instantly for 300ms after the last one closed, which is right
    for a toolbar and wrong for six triggers inside a dial's width: a pointer
    crossing the stage trails labels behind it. Every one waits its own 200ms.
  - **The trigger's own label sits under the button**, because the peek comes
    out up and to the left, which is exactly where a tooltip on top would sit,
    and a label covering the thing it describes is `ember-burst`'s note. It is
    refused outright while a hand is down.
- **Escape shuts it**, which is the courtesy anything that opens over a page
  owes, and the arrow keys nudge the strand a twelfth of a lap from the
  trigger's focus, since a path reachable only by pointer is the thing
  `event-stacking`'s hint argues against.
- **The plus is drawn rather than imported.** It is part of a face sized by the
  stage, so its weight is a share of the button and not an icon's stroke, which
  is the standing `flip-clock`'s numerals have. Turning it 45 degrees is the
  cross for free, and **that turn is the one departure from the reference**,
  which keeps a plus throughout: a control that takes everything away has to
  say which way a press goes, and `aria-expanded` cannot be seen.
- **The button's hover and press are white at alpha over a dark face**, never a
  fill token, which is this project's rule for shading one, and the step in is
  instant where only the step back is timed, `tether-button`'s asymmetry.
- **Reduced motion keeps every state and drops the travel.** A press lands the
  strand on its pose in one step, the chain is off, since a lag is nothing but
  travel, the peek does not happen, and the crank is direct manipulation and is
  unchanged.
- **No `will-change-transform` on a ball, and it was there.** The hint pins a
  compositing layer whose raster is taken at whatever scale the element is
  currently at, and every ball starts at zero, so the layer is allocated empty
  and a later scale-up paints nothing: the ball is a white disc with a hairline
  round it for the rest of the session, which is exactly what it looked like.
  The drawing is in the DOM the whole time, which is what says it is a paint
  problem rather than a React one. Removing it costs nothing measurable, since
  the transform is written every frame anyway: under a 4x CPU throttle across
  an open and a close, 130 frames at a 16.6ms median and a 17.9ms 95th.
- **Nothing renders while any of it moves.** One loop writes five transforms
  and stops when the chain has landed and the scalar is still. The only state
  in the file is what is held, whether the strand is showing, and whether a
  hand is on the dial.
- **`select-none` on the stage**, since every gesture there is a press or a
  drag on one control, and `touch-none` on the plus alone, so a thumb scrolling
  past the demo is never trapped by the stage.
- It is `flush` on `bg-fill` with its own inset ring, and `aspect-8/5` with a
  `min-h-78` floor: the ratio is the index preview card's, so the clip is the
  whole stage, and the floor is what stops a 390px phone giving a 220px stage
  to a composition that wants 250.
- **Its clip is recorded with a `prep` that fans the strand out first**, which
  is the second caller of that hook. The first frame is what the card paints as
  a poster and what a reduced-motion reader is left with, and this demo's
  resting state is an empty stage with a plus on it. The gesture then names a
  marble by its tooltip, picks it, and cranks the strand back out by hand,
  which runs to its own stop and lands on the settled pose, so the last frame
  is the first one apart from the ring the pick left.
- Verified in a browser at 320, 390 and 1280px: the balls rest at the five
  angles the geometry asks for, a press opens and shuts it with `aria-expanded`
  and the label following, Escape shuts it, a crank keeps a degree of hand to a
  degree of strand, a pick rings the plus, Tab runs the plus and then the five
  marbles, a tap on a phone opens it without scrolling the page, and no console
  errors.

### `venetian-blind`

A venetian blind over a page, tilted by its two cords. Pull the left cord down
and the slats turn open, pull the right one and they shut. `blind.ts` is the
geometry, pure and DOM-free, and `index.tsx` is the stage, the pull and the
frame loop.

- **The page behind never moves.** Every line on it is uncovered by the slats
  turning, never faded in, which is `folder-stack`'s claim about occlusion.
- **The tilt runs down the blind rather than landing on every slat at once.**
  Each slat follows the one above it through its own exponential, `arc-menu`'s
  chain turned on its side, the way a ladder tape carries the drum's turn down
  one rung at a time. Measured on a hard tug: 280ms after the pull the head
  slat is at 0.99 and the foot at 0.76. A slow pull shows no lag.
- **A slat is taller than its pitch, 1.12 times**, so a shut blind overlaps
  itself and no gap opens until `cos(angle)` falls under `PITCH / SLAT_H`, which
  is 27 degrees. That dead band at the start of a pull is what a real blind
  does. The most a slat turns is 80 degrees, since a slat seen edge on paints
  nothing.
- **No two slats hold the same angle.** A hashed error of up to 2.4 degrees,
  scaled by `t * (1 - t)`, so it is zero when the blind is shut flat and when
  the tapes pull it level, and widest in between. An integer hash, for
  `stem-picker`'s reason.
- **No `preserve-3d` on the slat layer.** Each slat is flattened in document
  order under one `perspective`, so a lower slat always paints over the one
  above it. That is correct because the slats turn top toward the room.
- **It invents no colour and scopes no hue.** Slats are `fill-hover` at 98%, so
  a shut blind shows a faint ghost of the page, the way thin aluminium lets
  light through. The page is `bg`, so a gap reads as light coming through.
  Shading is white and black at low alpha: a lit lip on each slat, a crown, a
  dark line where the next slat tucks under, a face that darkens as it turns
  down, and a faint cast on the page under each tilted slat.
- **The two cords are one loop**, so pulling one lifts the other by the same
  length. The open cord hangs short on a shut blind and the shut cord long,
  which tells a reader which one to pull.
- **The acorn under the hand is exact and the slats lag it.** While held, the
  cord's value is the hand's. Released, it eases to its target on `CORD_TAU`.
  A press that travels under 4px is a tug all the way to that cord's end.
- **Pulling past a stop stretches the cord** by a third of the overshoot, up to
  1.6cqw, and it springs back. Pushing a cord up past its stop does nothing,
  since a cord cannot be pushed.
- **A cord is a pendulum.** A spring on its angle about the rail, at a damping
  ratio of 0.3, aimed at the hand's sideways offset while held and at zero
  after. At 0.2 it rang for four seconds after every release.
- **The hit regions grow outward from the midline between the two cords**, so
  they never overlap, and they are never narrower than 1.4rem. On a 390px phone
  the cords hang 10px apart and each region is 22px wide.
- **The grabbing cursor is on the stage while a cord is held**, through
  `data-carry` and its descendant pair, since the hand leaves the acorn's box in
  the first pixels of a pull. `notch-drop`'s call. `cursor-grab` on the acorns
  is one more place the shared `cursor-pointer` rule is off.
- **`role="slider"` over the column the cords hang in**, since a half-open blind
  is a real place to stop. The arrows step the tilt, Home and End go to the
  ends, and Enter or Space tug it to the other end. `aria-valuenow` is written
  from the frame loop, only when the rounded value changes.
- **The page's type is `max(0.625rem, 2.68cqw)`, off the scale on purpose.** It
  is 14.4px on the lab column and shrinks with a phone's stage, where
  `text-body` wrapped into the line below. `foil-card`'s standing for printed
  type on a drawn object.
- **Nothing renders while any of it moves**, and the loop stops when the cords,
  the strain, the swing and every slat have landed. Measured: 0 frames
  requested over 1.5s after a pull has settled.
- **Reduced motion takes every gap in one step and never swings.** The slats
  still open.
- **It is `bare` and draws no border.** It was `flush` with an inset ring of its
  own, since the slats paint over the frame's. With no frame and no ring the
  slats and the rail mark the edge of the blind, and the demo reads as a blind
  on the page rather than a blind in a box.
- Verified in a browser at 1280 and 390px: a pull and a tap on each cord, the
  arrow keys, a touch tap on a phone, no sideways scroll, and no console
  errors.

### `gust-flag`

A flag toggle, after a bookmark animation whose motion was moved onto a flag.
Press it and the flag runs up the pole, a gust rolls along the cloth from the
pole to the tails with a halftone fill behind it, the tails whip out and three
splashes come off them with a snap. Press again and it goes back down, empty.
While it is up it never stops fluttering, and a pointer moving past it is wind.
`flag.ts` is the geometry, pure and DOM-free, `flag-sound.ts` the snap, and
`index.tsx` is the button, the wind and the frame loop.

- **The bookmark's motion needs a swallowtail flag and not any flag.** The
  reference's travelling swell ends on the bookmark's two bottom corners and
  throws its three splashes off those corners and the notch. Turned 90 degrees,
  a swallowtail has the same three points, so every beat maps one to one. On a
  flag the swell also gets a cause: it is a gust entering at the pole and
  snapping off the tails.
- **The cloth is described once in its own coordinates, and everything drawn
  goes through one `warp`.** `u` runs along the cloth from the pole and `v`
  across it from the top edge. The outline, the solid fill, the halftone dots
  and the points the splashes leave from are all `(u, v)` pairs pushed through
  the same function, so they bend by the same rule and cannot disagree. The
  dots ride the swell with the cloth they are printed on.
- **The swell is a vertical stretch about the cloth, not a displacement of the
  outline.** The top edge moves up and the bottom edge down by one amount at
  each `u`, an asymmetric gaussian around the gust's front. The trailing half
  is longer, so the cloth closes a beat after the gust has passed. The tails
  also stretch along the cloth while the swell is on them.
- **The pole holds the hoist edge, and that is the one change from the
  reference.** There the top edge swelled the most. Here that edge is tied to
  the pole, so `hold(u)` is zero at the pole, climbs over the first few units,
  grows toward the free end, and gives the tails extra. Without it the edge on
  the pole stretches away from the pole.
- **The outline is sampled densely, which is the whole trick.** A swell can
  only bend an edge that has points along it. The reference's own path repeats
  `10 35.428 10 30.743` down each straight side for this reason. The rest shape
  is built once in real units with its rounded corners, one sample a unit,
  then divided into `(u, v)`.
- **The fill is a solid run and a halftone band ahead of it.** Behind the fill
  position the cloth is solid. Ahead of it, columns of dots shrink through five
  sizes over 0.34 of the cloth. The first column's dots are wider than half the
  pitch, so they merge with each other and with the solid into the scalloped
  edge the reference has. Both are clipped to the outline, so the solid can be
  a loose quad that overhangs the cloth.
- **The fill runs 0.03 behind the gust's front.** The two are one number, so
  the halftone edge and the swell arrive at the tails together. A fill that was
  already there when the gust began is a floor the gust cannot take back.
- **The hop is the hoist.** The reference icon goes up a little and comes back.
  Here the cloth sits 4 units down the pole at rest and a press runs it to the
  top on an underdamped spring, a ratio of 0.36, which carries it about 1.3
  units past the top before it settles. Lowering uses the same spring.
- **The splashes are round-capped segments whose tail chases the head.** At
  birth both ends sit on one point and a round cap paints it as a dot. The
  head runs out on an ease-out and the tail follows it a third of the life
  later, so each splash is a drop coming off a corner, then a dash, then a dot
  again as the tail catches up. That is the reference's last two frames. They
  leave when the front passes 1.04, from wherever the tips are on that frame.
  The notch sits 8 units behind the tips, so its drop starts further out and
  travels further, and all three finish level.
- **Lowering drains the fill back to the pole through the same halftone band**,
  in 380ms with no gust and no splash. A press that undoes a gust in flight
  fades the swell out over 200ms instead of cutting it.
- **It scopes one pair, a cobalt ground and a cream ink.** It first shipped as
  the site's own near-black on white and read as bland: a flag is a thing meant
  to be seen, and the swell and the splashes are colour arriving on a field.
  The reference's tomato was the second pass and was taken off for being the
  reference's. The cream is 6.1:1 on the cobalt. At rest the flag is at 70%
  opacity, and the hover and a raised flag take it to full. `GROUND` and `INK`
  are consts in `index.tsx`, not tokens, and nothing else may reach for them.
- **The stage carries no inset ring**, since the tomato is its own edge on the
  white page.
- **The ground carries a film grain**, `document-pocket`'s `feTurbulence` tile
  at 18% in `overlay`. A flat cobalt read as a vector fill. Overlay does most to
  a mid tone, so the grain shows on the cobalt and stays out of the way. The
  layer sits under the button, which is `relative` for that, so the flag stays
  clean.
- **There is no fill step behind the button**, which is the site's usual press
  feedback. The flag runs up the pole on the frame of the click, so it is its
  own feedback, and a square behind the drawing reads as a selection box.
- **No tooltip, which is the one place the shared rule for an icon-only control
  gives way.** It sat under the pole and covered the stage the gust plays on,
  and the flag says what it does by moving. The `aria-label` names the action,
  "Raise the flag" or "Lower the flag".
- **The focus ring is an outline in the cream ink**, `window-shade`'s
  substitution. The project's ring pins `text-primary` at 15%, which is nothing
  on tomato, and paints a white offset band.
- **The drawing is `clamp(7rem, 36cqw, 12rem)` wide**, 194px on the lab column
  in a 538 by 336 stage. At 50cqw it filled the stage and left the splashes
  nowhere to go.
- **A raised flag never stops fluttering, and that is the change that matters
  most.** A raised flag sitting dead still is the least flag-like thing it can
  do. `flutter` in `flag.ts` is a wave running from the pole to the tails, 1.15
  waves long, moving the whole cross-section so both edges go the same way,
  where the gust's swell moves them apart. The pole holds it too, so its height
  grows along the cloth. The press gust rides on top of it rather than starting
  from a dead stop.
  - The phase is integrated per frame rather than read off the clock, so wind
    speeding the wave up never makes it jump.
  - A lowered flag in still air hangs, with no flutter at all, so the loop can
    stop there.
- **The halftone stays after the fill and becomes the light on the folds.**
  Where the flutter tilts the cloth down and away from a light above, the solid
  part is punched with dots of the ground colour, sized by the tilt. So the
  screen that ran the fill in is still there on a raised flag, as the shadow in
  each trough, and the folds read as folds rather than as an outline wobbling.
  - The tilt is read off `flutter` itself, so the shading cannot drift from the
    shape.
  - The dots sit on the fill's grid and stay under half the pitch, so a shadow
    is a denser screen and never a hole.
  - The smallest of the four sizes is dropped. At that step the tilt near the
    pole left a column of specks that read as dust.
- **The pointer is wind.** Its speed near the cloth raises the flutter, up to
  2.8 times still air's, and its vertical travel pushes the tails across. Both
  fall off as a gaussian with distance from the cloth's middle and die over
  0.7s once the pointer stops. It is measured in the SVG's own units, so the
  wind is the same strength at every size the drawing renders at. Mouse and pen
  only, `folder-stack`'s gate, since a finger dragging past is a scroll.
  - **The loop has to count live wind as motion, and not counting it was a
    bug.** A swipe past a lowered flag starts the loop, and its first frame has
    a `dt` of 0, so the flutter has not grown yet. With only the flutter in the
    test, that frame reported nothing moving and the loop stopped. A raised
    flag hid it, since the hoist kept the loop alive.
- **The splashes land with a snap**, synthesised in `flag-sound.ts` on
  `crack-sound.ts`'s shape: one context, one noise buffer, nothing fetched. A
  snap is two wide, low bursts 35ms apart, one per tail. It plays when the gust
  reaches the tails, from inside the frame loop, so the clock is unlocked on
  `pointerdown` and on Enter or Space, `poke-sound.ts`'s two-step.
- **The viewBox runs from -3**, so the top splash has room above the pole. At
  the first size it left through the top of the stage.
- **Nothing renders while any of it moves.** One loop writes six path strings
  and the splashes' opacity. It cancels and reschedules rather than skipping a
  request, `book-opening`'s call.
- **A raised flag keeps the loop running, which is the cost of the flutter,
  so the loop also stops off screen.** An `IntersectionObserver` marks the
  stage seen or not, the loop ends on its next frame once it is not, and the
  observer starts it again on the way back. Measured: 0 frames a second with
  the flag lowered in still air, 0 once the wind from a swipe has died, 60
  while raised, 0 while raised and scrolled off screen, and running again on
  return. Under a 4x CPU throttle a raised flag holds a 16.7ms median and a
  16.8ms worst frame.
- **Reduced motion keeps both states and drops the travel.** The flag is up and
  full, or down and empty, in one step. There is no swell, no splash, no
  flutter and no wind, since all four are nothing but travel.
- It is `flush` and `aspect-8/5`, the shape of the index's preview card, so the
  recorded clip is the whole stage.
- Verified in a browser at 1100 and 390px: the gust, the fill and the splashes
  stay inside the stage at both, Enter and Space toggle without scrolling the
  page, an unsave mid-gust settles empty, and no console errors.

### `region-comment`

A flat poster of geometric shapes, marked up the way a design review is. Drag
across it and a dashed box follows the hand, and letting go brings a composer
up under the box. Posting leaves the box in its colour with the comment on a
pill under it. `scene.tsx` is the poster, `place.ts` the placement, pure and
DOM-free, and `index.tsx` the drawing, the composer and the pills.

- **The composer answers the box, not the page.** It sits under the box's left
  edge, then above the box, then over the box's foot on a stage too short for
  either. It never leaves the stage, since a composer hanging past the frame
  lands on the prose below.
- **It fades in over 200ms on `[0.23, 1, 0.32, 1]` and travels 6px away from
  the box**, down when it is below and up when it is above, so it reads as
  coming out of the box. The exit is 120ms and shorter than the entrance.
- **The composer and the pill are fixed heights in rem, which is what makes
  the placement arithmetic.** The side decides the entrance direction, and
  Motion needs that at mount. Measuring the composer first would land a frame
  after the animation started.
- **A composer holding unsaved words does not close on a stray press.** The
  press refocuses the field. A clean composer closes, and a plain click that
  only dismissed it drops no new box.
- **The poster is abstract, and it was a coast at dusk.** Scenery asks the
  reader to judge a picture, and a review tool is about pointing at parts of
  one. Separate flat shapes (a disc, a block, a half sun, a ring, stripes, a
  dot grid) give every box one obvious thing to be about.
- **Bright, light colours at full strength, with room between every shape.**
  The first abstract pass was dark and overlapping, and it crowded the boxes
  and pills drawn over it. A pastel pass after it read as faded rather than
  light. Every shape is a clean, high-lightness hue, and none of them overlap.
- **The poster opens with no comments on it.** Two seeded ones showed the posted
  state, and they also said the review was already done. The registry's `hint`
  says what to do instead.
- **A plain click with no drag drops a 22% by 30% box around the point**, and a
  drag under 14px on either side is a slip and makes nothing.
- **The dashes are an SVG rect with no viewBox**, so a dash is 6px on every box.
  A dashed CSS border spaces its dashes per side and no two boxes match. The
  box being written for marches, through the `ants` keyframe in `globals.css`
  behind `motion-safe:`.
- **The draft box is written to the node during a drag**, so drawing renders
  nothing, and the stage's listeners are bound to the node, `document-pocket`'s
  call for a surface with no honest role.
- **A pill is no wider than its box, with a floor of 9rem or 28% of the stage.**
  At 12rem the pills ran into each other on a phone, and at a 6rem floor they
  cut every comment to two words on the lab column.
- **A saved comment takes two presses to delete, and a draft takes one.** The
  first press turns the trash control `danger`, typing disarms it. A draft has
  nothing to lose, so it is discarded at once. This is the inline form of the
  confirm rule, since a dialog over a demo is heavier than the thing it guards.
- **Enter posts and Escape closes, and after either the focus goes to the
  pill.** Only on a keyboard close, for `notice-stack`'s reason: a scripted
  focus after a mouse press paints a ring on every click.
- **A pill's focus mark is an outline in its own hue with a clear 2px gap**,
  never the site's ring. That ring paints its offset in white, which over the
  poster read as a white border on every new pill, since a keyboard post hands
  focus to the pill it made.
- **A keyboard post hands focus to the new pill with the mark switched off.**
  Even in the pill's own hue, the mark read as a stray border on every post,
  and the pill arriving already says where the comment went. `data-quiet` is
  set with the focus and cleared on blur, so Tab away and back shows the mark.
- **A hidden `Mark a region` button is the keyboard path.** It appears at the
  top left on focus and drops a box in the middle with its composer open.
- **The hues are scoped, one per comment, cycling**, and they are the only thing
  tying a box to its pill and its post button. Each clears 4.5:1 under white:
  5.31, 5.11, 5.31, 6.39 and 5.66. The poster's inks are a second scoped set in
  `scene.tsx`. Neither is a token.
- **The field draws no ring of its own.** It has focus for as long as the
  composer is open, so the card's outline steps from `stroke` to
  `stroke-strong` instead.
- `cursor-crosshair` on the stage, one more place the shared `cursor-pointer`
  rule is off, since the stage is drawn on. `touch-none` covers the whole
  stage, which traps a thumb scrolling past it on a phone. That is the price of
  drawing with a finger.
- Reduced motion keeps every state. `MotionProvider` drops the travel and the
  ants stop.
- Verified in a browser at 1280 and 390px: a drag opens the composer, a stray
  press keeps typed text, Enter posts and focuses the pill, a pill reopens its
  comment, no sideways scroll, and no console errors.

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
// fade + rise. No blur: it read as the page resolving out of focus rather
// than appearing, and a filter is also the most expensive part of it, since it
// makes its element a containing block for fixed descendants and forces a
// compositing layer, which is what `portrait.tsx` has to portal out of.
initial={{ opacity: 0, y: 4 }}
animate={{ opacity: 1, y: 0 }}
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
- **`app/blogs/turning-a-signature-into-two-pen-strokes/` is the post about this
  file**, and its demo plays the same asset on a transport, restating these
  durations to do it. See The signature player above.

## Toolchain notes

- **TypeScript 7.** The compiler is the native port, which dropped the JS
  compiler API Next reads by default. `experimental.useTypeScriptCli` in
  `next.config.ts` routes Next's typecheck through the `tsc` CLI instead.
  Removing that flag breaks `next dev` with an unhandled rejection.
- **Biome 2.5.** `css.parser.tailwindDirectives` must stay on or Biome fails to
  parse `@theme` in `app/globals.css`.
- **`.next/types/validator.ts` is written by `next build`, not by `next dev`.**
  The dev server writes its own types under `.next/dev/types`, and
  `tsconfig.json` includes both. So after a route directory is renamed or
  removed, `pnpm tc` fails on the build's copy, which still imports the old
  path, until the next `pnpm build` rewrites it. Restarting `next dev` does not
  help. Run the build, which is the gate anyway, and it is safe beside a running
  dev server: Next 16 gave the two separate output directories for that, see
  `node_modules/next/dist/docs/01-app/02-guides/upgrading/version-16.md`.
- **`playwright-core` is a devDependency and downloads nothing.** It is only for
  `scripts/record-lab-previews.mjs`, where it connects over CDP to the Chrome
  that `agent-browser` launched rather than launching one of its own. That
  script wants `agent-browser`, `ffmpeg` and `cwebp` on the path, which are
  host tools rather than packages: `agent-browser` is `npm i -g agent-browser`
  and records the clips, see Recording the previews. The ffmpeg on this
  machine is built without libwebp, which is why the still goes through
  `cwebp` instead of straight out of ffmpeg.

## The portrait

Poking the photo at the top of the home page wobbles it. Poking it eight times in
one flurry knocks the avatar's whole stack out of the page, and from there each
piece is thrown around, falls where it is let go, and is caught by its own slot's
magnet on the way back.

`components/home/use-falling.ts` is one falling body: its flight, its drag, its
magnet home. `components/home/portrait.tsx` is what the bodies are and when they
go, and calls the hook twice, once for the photo and once for the album cover.
`components/home/avatar.tsx` stays a server component and hands the disc down as
`behind`.

- **Both pieces of the stack drop, and they are two bodies rather than one.**
  Hiding the cover while the photo was out was the first version and it was a
  cheat: a stack with no front is not a stack, and the cover sat at 30% of the
  avatar's width, so it covered 70% of the empty slot. Falling glued together
  would be the other cheat, since what is on the page is two circles and not one
  shape. So the machinery is per body, which is why it is a hook, and the drop is
  the only thing they share.
  - **Opposite nudges and a beat between them**, or matched velocities read as one
    shape splitting in half. 80ms is enough to see the front one go first without
    the second reading as an afterthought. The speeds were 26 and -34 first and
    the two landed 36px apart with 40px boxes, so they came to rest touching and
    read as one having landed on the other. 44 and -58 leaves a real gap.
  - **The loose cover is a plain circle of the art, not the disc itself.** That
    one is a link with a tooltip, a reveal keyed off its own hover and a record
    spin, none of which belongs on something lying on the floor: a fallen object
    is not a control, and a cover that kept turning as it fell would read as still
    playing. Keeping it mounted and merely hidden is also what keeps its fetch and
    its poll alive, so putting the cover back is instant rather than a refetch and
    a replayed reveal.
  - **Its art is read off the rendered disc**, since the now-playing state belongs
    to the component in `behind` and lifting it up here to answer one question
    would put Spotify inside the portrait. `PostRail` makes the same call for the
    same reason. It is a snapshot, so a track change while the cover is on the
    floor leaves the old art lying there, which is what a fallen object does.
  - **The cover's place is measured off its anchor and its art off the image
    inside it, and reading both off the image was a bug.** The image is the part
    that turns, so a hovered disc's own rect is the bounding box of a rotated
    square: 56.4px across at 45 degrees, sitting 8.2px above and left of where the
    disc actually is. The anchor never turns, so its box is the disc's box.
    Measured after: `{x: 12, y: 0}` against the `{x: 3.8, y: -8.2}` it was.
- **A cover put back on its own takes the photo's place, and putting the photo
  back on top sends it home, in that order.** It is the only thing in the slot, so
  sitting 12px right of nothing would read as a misplaced disc. The photo landing
  slides it right into its usual offset, on the disc's own reveal curve so the
  slide and the slide it already does on hover are one movement. Traced from the
  release: the snap finishes, then 0, 6.5, 9.8, 11.4, 11.8, 12.
  - **Nothing turns while the stack is in pieces, and every handover is at one
    frozen angle.** What looked like the cover jumping to a rotated angle was the
    handover: the loose copy is this file's own markup and held no angle at all,
    so a swap in either direction jumped by whatever the real one had reached.
    `spinAngle` reads that angle at the drop, the copy holds it, and `data-loose`
    on the slot freezes the real one at the same place until the stack is whole
    again. A record off the turntable does not turn, so a spinning copy in mid-air
    or on the floor was the wrong way to close the same gap: nothing turning is
    also nothing to disagree about. Measured: real paused at 221.2 with the copy at
    220.5 through the fall and the landing, a 0.7 degree step at the swap, which is
    one frame of the turn between reading the angle and the pause landing, and
    `running` again from 263 to 304 once the stack is whole.
  - **What slides is the box the cover resolves against, not the cover.** Its own
    position is markup this file does not own, so the wrapper holding it is a real
    box of the slot's size rather than `display: contents`, which has no box to
    transform.
  - **A cover that turns up while the photo is out stays out of the layout until
    the photo is home.** A song starting mid-drop put a cover in a slot whose
    front is empty, painting at its own indented offset with nothing to be
    indented from. That one was never part of the drop, so there is nothing to
    hand over to: `display: none` keeps it out, and when the photo lands the
    display returns and its own `cover-reveal` plays, which is the introduction it
    would have had on a normal load. Traced from the release: nine samples hidden
    while the photo snaps home, then 1.9/0.16, 6.5/0.54, 8.5/0.71, 10.3/0.86,
    11.6/0.96, 12/1 as offset over opacity.
  - **`art` is what tells that case from the other one**, being the snapshot the
    drop takes: a cover that came loose has one and a cover that turned up
    afterwards does not.
  - **That wrapper is `invisible` while the loose copy is out, never `hidden`, and
    this was a bug with a very visible tell.** `display: none` cancels a CSS
    animation and restoring display replays it from the start, so putting the cover
    back ran its own `cover-reveal` again, and that keyframe begins at
    `translate: 0` and `opacity: 0`: the cover appeared 12px left of home,
    invisible, and crawled back to the right. `visibility: hidden` leaves the
    animation alone and takes the copy out of hit testing just the same. Measured
    through the swap, offset from home over opacity: on `hidden` it was -12/0,
    -5.5/0.54, -2.8/0.77, -1/0.92, -0.1/0.99, 0/1, and on `invisible` it is 0/1 on
    every frame.
  - **The cover's home follows the photo, and is re-measured on the crossing.** A
    cover still loose when the photo lands would otherwise keep homing to the spot
    the photo just took. `remeasure` corrects a loose body's offsets by however
    far its dock moved, so nothing jumps when the front is given back.
  - **One value serves the dock and what paints, and having two was a bug.** The
    loose copy was drawn from the cover's own offset while the magnet measured
    against the front, so it came to rest 12px right of where it was aiming and
    then jumped left as the real one took over: placing the cover moved it right
    and then into place. Whatever the magnet calls zero has to be what zero paints
    at. Traced through the handover, offset from home: `-0.6, -0.2, -1.2, -0.8,
    -0.2, 0` on the loose copy, then `0` on the real one, where it used to end
    `loose:12` then `real:0`.
  - **A body leaves its slot at once and falls a beat later**, which is what the
    `delay` on the hook is. Leaving late means the slot is still painting
    something whose place has already moved: the cover's home becomes the front
    the moment the photo goes, so a cover still in the slot for 80ms after that is
    12px from where its own slot now claims it is. It also leaves from where it
    actually is rather than from its new home, since the loose copy is started at
    the offset it had. Measured 105ms after the drop, with the hang at 80: 10.9,
    which is the 12 it was sitting at minus 25ms of drift.
- **There is one ring and it is the photo's.** The cover has none and does not
  need one: put back on its own it goes to the front, which is this ring, and put
  back behind a photo that is already home it has the photo itself as its
  landmark. It had its own for a while and two overlapping dashed circles 12px
  apart at 40px said one thing twice.
- **The ring is `absolute`, never in flow, and this was a bug.** As a block it took
  the slot's one 40px row, so with the cover loose and the photo home the two
  shared the flow and the photo sat 40px below where it belongs. The slot is a
  fixed `size-12.5` box, so nothing inside it needs to hold it open.
- **The ring steps outside the cover once the cover is home.** On its own box it
  draws on the cover's own edge, which at 40px reads as a perforated disc rather
  than as a place for something: the dashes look like they belong to the album art.
  Four pixels out it is a halo around the cover, which is what "the photo goes on
  this" looks like.
- **Arming moves the ring's tone, and fills it only when the ring is empty.** The
  dashes stay dashed either way: a dashed ring going solid changes what the thing
  is rather than what state it is in. They step from `stroke-strong` to
  `text-secondary`, 1.2:1 on white against 5.3:1.
  - The fill is conditional because the ring paints above whatever is in the slot.
    Over an empty slot an opaque `bg-fill` is the clearest thing there is. Over a
    cover that has been put back it wiped the album art out the moment the magnet
    caught, so the halo case gets the tone alone.
  - **And the cover under it dims to `opacity-45`**, which is a step of light
    rather than a curtain: it is still what is playing, and what the moment means
    is that something is going on top of it.
  - **So the armed flag is written to the slot, not to the ring**, since the cover
    has to read it too, and both bodies arm that one node. It is still a data
    attribute straight to the DOM, so a drag renders nothing.
  - The dim and the slide are two properties on two clocks, 200ms against 460ms,
    so the wrapper spells the `transition` shorthand out: Tailwind's
    `transition-*` utilities carry one duration between them.

- **It is not a button and it is not in the tab order.** The photo is `alt=""`
  decorative, so a control here has no honest label, and "wobble the portrait"
  puts a stop at the top of every page load forever in exchange for a joke. The
  listeners are bound to the node rather than written as JSX props, the same call
  `document-pocket` and `stamp-collection` make for their stages, and a keyboard
  gets the one thing it actually needs: **Escape puts the photo back.** The poke
  is heard on `pointerup`, which keeps it a poke rather than an activation, the
  same call `book-opening` makes for its tap.
- **No selection ever starts anywhere in the slot, and guarding the photo alone
  was not enough.** `select-none` stops the photo's own box being selected and
  does not stop a press anchoring a selection that runs into the prose, which puts
  a highlight and a pair of `SelectionPins` carets on the page for a gesture aimed
  at a picture. Preventing the pointerdown is what stops it, since the selection
  is the mousedown's own default action.
  - **The clicks that do it are the ones after the drop.** A flurry does not stop
    when the stack leaves: the eighth poke takes the photo out from under the
    pointer and the rest of the flurry lands on the empty slot, where a rapid
    multi-click anchors on the nearest text it can find, which up here is the
    page's `sr-only` heading. So the listener is on the slot, which is the whole
    region the gesture happens in, and `pointerdown` bubbles, so it covers the
    photo, the ring, the loose cover and the empty box between them. The loose
    photo is portaled out of the slot and denies its own, in the hook.
  - Measured with 26 rapid clicks at a rising `clickCount`, half of them after the
    drop: no ranges and no carets, against one uncollapsed range without it. **Touch is exempt**, since a finger's press on the photo is also
  the start of a page scroll, and `select-none` already covers the long press that
  would select there. It is also a second reason the poke is heard on `pointerup`:
  preventing a pointerdown suppresses the compatibility mouse events it would have
  produced, `click` among them.
- **The streak window is what keeps this an easter egg rather than a hazard.** A
  cumulative count drops the photo on someone who clicked it eight times across a
  visit and never asked for anything. Two seconds is long enough that a
  deliberate flurry never resets and short enough that a curious single poke leads
  nowhere. Verified: four pokes, a pause, then five more leaves the photo in
  place.
- **A poke clicks, through `poke-sound.ts` and `public/assets/poke.mp3`.** 4.8KB,
  0.216s, from freesound. Web Audio rather than an `<audio>` element, and the
  flurry is why: a poke lands every 90ms or so, and one element replayed that fast
  has to be rewound and restarted, which either swallows the play or cuts the
  previous one off. One decoded buffer with a fresh source node per poke overlaps
  them properly and starts on the tick of the press.
  - **Fetched when the pointer arrives on the photo, not on mount**, so a visitor
    who never goes near it pays nothing and the first poke is not the silent one.
    Verified: nothing is requested until the pointer is over the photo.
  - **The clock is unlocked on the press and the sound plays on the release, and
    that is the whole reason there are two functions.** A context created outside a
    user activation starts suspended, only a gesture may resume it, `resume` is a
    promise, and a suspended context's clock does not advance: a source started on
    one is queued rather than dropped, so resuming later fires every queued click
    at once. Arming on `pointerdown` gives the resume the length of the press, and
    the play refuses to start anything until the clock is running. Measured under
    Chrome's default policy: a 0ms press loses the first click and nothing queues,
    a 60ms press loses nothing.
  - **The pitch climbs with the streak** the way the wobble's amplitude does, 1.0
    to 1.12, and **the poke that knocks the stack loose drops to 0.82**: the pitch
    has been rising and the thing coming off is a release rather than another
    press. Gain is 0.32, since a click at full scale on a portfolio is a
    jump-scare.
  - Not gated on reduced motion, which is about movement nobody asked for where
    this is the sound of a press. Same line the signature player draws for its
    play button.
- **The wobble ramps, and that is the only thing saying the pokes are counted**,
  4.2 degrees on the first and 9 on the last. A counter would give the joke away.
  A circle turning shows nothing, so this only reads at all because what turns is
  the portrait inside it.
- **The loose cover stays in the slot and only the photo is portaled, and that is
  what fixes the stacking between them.** A portal appends to `body`, so a loose
  cover painted above the whole page including a photo already home: carrying it
  in showed it on top of the photo, and landing it snapped 70% of it behind the
  photo in one frame. Left in the slot and before the photo in document order it
  is behind the photo the entire time it is carried, which is where it is going,
  so the landing changes no layer at all. Verified with `elementFromPoint` at the
  photo's centre: the photo is topmost while the cover is carried over it and on
  every frame through the landing.
  - It costs nothing else. `absolute` there resolves against the slot rather than
    the page, so its `left` and `top` are the offset it already had rather than
    page coordinates, and everything the hook measures is offsets from the dock
    either way. Nothing in the column clips, so it still travels the whole
    viewport, and it still scrolls with the page.
  - **What it does cost is that the avatar's `RevealItem` has to be raised**, and
    that is why `app/page.tsx` gives it `relative z-30`. A loose piece inside the
    block inherits the block's place in the column, and at `z-index: auto` the
    prose and the footer are later siblings: the footer's rule drew straight over
    a cover lying near it. `RevealItem` animates a filter, which makes it a
    stacking context, so nothing inside it can be raised past it and the item
    itself is what has to be. Verified with `elementFromPoint`: the loose cover is
    topmost over both the prose and the footer rule, and the docked photo is still
    topmost over the cover.
  - Raising the docked photo instead cannot work: it is inside `RevealItem`, whose
    filter makes it a stacking context, and no `z-index` on a descendant escapes
    that. Dropping the loose cover to a negative `z-index` would work and puts it
    under the page's own text for the length of the flight.
- **The photo is portaled into `body`, and that is not a preference.**
  `RevealItem` animates `filter` and finishes at `blur(0px)`, which is still a
  filter, and a filter makes its element the containing block for any fixed
  descendant. A photo positioned inside the reveal could never leave it. In `body`
  with no positioned ancestor, `absolute` resolves against the initial containing
  block, which is page coordinates: the photo lies on the page and scrolls with
  it rather than sticking to the glass, and the magnet needs no scroll listener to
  stay honest. One element in two places, so moving it between the slot and the
  portal remounts it, which costs nothing since the file is already fetched.
- **`(0, 0)` is the dock, which is what makes the magnet arithmetic and not
  geometry.** The photo is positioned at the slot and everything it does is an
  offset from there, so the distance home is `hypot(x, y)` and docking is
  animating both to zero.
- **The drag is hand-rolled, where `spring-image` uses Motion's `drag` for the
  same gesture, and the magnet is the whole reason.** `drag` writes the pointer's
  own offset and there is no seam in it to bias. This blends the raw offset toward
  the slot before writing it, by nothing at the rim and by `PULL` of what is left
  at the middle, so the photo leads the pointer and you feel it caught before you
  let go. Arming the slot is the same test, so what lights up and what will catch
  cannot disagree.
- **Armed is written to the node as a data attribute, never held in state.** A
  drag renders nothing at all, the bar the signature player and `book-opening`
  both set.
- **Let go anywhere outside the magnet and it falls from there, carrying the
  throw.** Which is why **the fall is integrated rather than keyframed.** A tween
  has to know its destination and its duration before it starts, so every drop
  from a different height and every throw with a different velocity would want
  its own, and a bounce would want its own keyframes on top. Gravity does not
  need to be told where the floor is: it accelerates, the floor is a test, and
  the same handful of lines serve the first drop, a lob across the page and a
  photo nudged an inch. One rAF loop, three motion values written per frame, and
  it stops asking for frames once the photo has stopped sliding.
  - `G` is 2600 px/s², set so a full-height drop still takes the 0.72s the
    keyframed version did. Measured on the drop, sampled every 120ms: 51, 101,
    126, 162 and 221px, then a 32px bounce and rest.
  - **One velocity, Motion's own, serving both the throw and the lean.** It was a
    hand-rolled pair of smoothed pointer samples with an 80ms staleness test
    bolted on, and `useVelocity` on the photo's own `x` and `y` gives both for
    nothing. It is measured off where the photo actually went rather than off the
    pointer, so the magnet's pull is in it and a photo let go on the way in is
    already travelling toward the slot. And it decays on its own:
    `getVelocity` returns 0 once a value has not changed for 30ms
    (`MAX_VELOCITY_DELTA`), which is what stops a hand that held position and let
    go from throwing anything, where a velocity kept by hand freezes at whatever
    it last was. Verified: released stationary at mid-screen it falls straight
    down, under 6px sideways.
  - **`maxY` is the floor and the drag's lower bound at once**, one function
    rather than two numbers that have to agree, so a photo dragged to the bottom
    of the screen is already resting where gravity would have put it.
- **Every number in that world was cut for subtlety once it worked, and the
  tilt needed a hard cap.** Spin is honest about the throw that caused it and
  honest ends up sideways: a hard flick came to rest 92 degrees over even after
  the spin rate was cut, because it kept turning through the wall bounce and the
  slide. Past about 40 a photo reads as tumbling rather than as having fallen
  askew, so `TILT_MAX` stops it at 42 and takes the spin with it. A design cap
  rather than physics, the same call `document-pocket` makes for its bow.
  `MAX_SPEED` came down from 3200 to 2000 for the same reason: at 3200 a flick
  put the photo into the far wall and most of the way back across the page.
  Measured after: an ordinary drop rests at 17.6 degrees and the hardest flick
  the harness can throw rests at exactly 42.
- **A pointer that arrives mid-flight stops it rather than fighting it**, which is
  also what lets a thrown photo be caught in mid-air. Measured: pressed 250px
  above the floor, it stops 3.3px later, which is one frame, and holds there.
  Stopping rather than letting the snap finish is also why an interrupted return
  cannot fire the `onComplete` that puts the photo back in the layout.
- **The drop out of the slot is the one flight that cannot be caught.** The
  pointer that dropped the photo is sitting exactly where the photo launches
  from, so a flurry that has not stopped yet catches it within a frame or two of
  letting go: the photo appears to stick to the cursor and the fall never
  happens. So that flight is sealed until it has landed and stopped sliding. A
  throw is not sealed and stays catchable, since the hand that threw it has to go
  back for it. Any hard stop clears the seal as well, or an Escape mid-drop would
  strand it, since a cancelled flight never reaches the rest test that clears it.
  Measured on fourteen clicks at 95ms with no pause: the eighth drops it, the
  remaining six land on the falling photo and none of them holds it, and it
  lands.
- **Everything that keeps the photo on screen allows for its tilt, off the live
  angle rather than a constant.** A rotated square covers more ground than a
  square: at 16 degrees a 40px box spans 49.5, grown about its centre, so bounds
  written in the untilted box's own offsets keep 4.7px less margin than they
  think at every edge, and at 42 degrees it is 8.2px. Measured: dragged into both
  corners of a 1000x900 viewport the photo lands on 12.0 and 12.0, and on 988.0
  and 888.0.
- **A carried photo leans off its own horizontal velocity, and swings back when
  the hand stops.** The numbers are `event-stacking`'s unchanged, since it is the
  same claim about the same gesture and that lab calibrated them against real
  drags: 213px/s leans 2.4 degrees and 2167px/s leans 9.5, against a 12 degree
  clamp, on the loosest spring either file has, whose 11% of overshoot is the
  wobble that reads as weight. Horizontal only: a carried object swings about the
  axis it is being moved along.
  - **What the photo paints is two values, not one.** `turn` is the angle it fell
    to, written by the loop and unwound by the snap, and `lean` is a spring on the
    hand's speed that belongs to nobody once the hand is gone. Everything that
    keeps the photo on screen reads their sum, so the tilt allowance covers the
    sway too.
  - **`grip` gates it, and it has to.** `x` keeps moving after the release, being
    what the fall is written to, so an ungated lean would answer the fall as
    though a hand were still carrying it. Zeroing the grip at the release lets the
    spring level the photo out while it flies, which is what putting something
    down looks like. Set in the gesture handlers, since they already know both
    moments and neither needs a render.
  - Measured, carrying at about 1200px/s: the resting tilt of 18.1 degrees leans
    to 8 going right and to 28 going left, levels back to exactly 18.1 when the
    hand stops, and a slow reposition at 89px/s moves it 0.8 degrees.
- **The snap home is the one spring left**, at a 0.58 damping ratio, so 11% of
  overshoot reads as a magnet closing. The wobble is a tween because its shape is
  its keyframes rather than any physics. **Docking winds the angle back inside one
  turn first**, since the spin accumulates across throws and a photo that has
  rolled twice would otherwise unwind two full revolutions into the slot. The jump
  is invisible: what it lands on is the angle it is already painting.
- **What is behind the photo is hidden while the photo is out.** A stack with no
  front is not a stack, and the album cover sits at 30% of the avatar's width, so
  it would cover 70% of the empty slot, which is the one thing on the page that
  has to stay visible while there is something to drop into it. `contents`
  normally, `display: none` while out, so the disc keeps the avatar box as its
  offset parent either way and nothing is unmounted.
- **The placeholder keeps the photo's exact box**, so nothing in the column moves
  when one swaps for the other, the same call `spring-image` makes. `border-2` and
  not a ring: a dashed ring is not a thing, and a hairline dash at this diameter
  reads as a smudge.
- **Reduced motion still drops the photo, it just does not travel.** The line
  `book-opening` draws: the drop is what happened, the fall is how it looked. The
  loop never starts and the photo is put on the floor, and a release outside the
  magnet does the same. The wobble goes entirely, being decoration with nothing to
  report, and the resting drift and tilt stay, since where a thing came to rest is
  a state rather than a movement. It is read with
  `useReducedMotion` in the component, since `MotionProvider` governs motion
  components and never a value animation driven by hand, the same reason
  `tether-button` reads it.

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
- **The disc turns by toggling its play state, not by adding the animation on
  hover.** `disc-spin` is always attached and only the play state moves, so
  leaving the pill holds the disc at whatever angle it reached. Gating the
  animation itself would restart it at `0deg` and snap on every unhover. It is
  `motion-safe:`, since `MotionProvider` does not govern raw CSS keyframes.
- **The animation is four longhands and not `animate-[…]`, and this was a bug:
  the disc spun the whole time.** `animate-[…]` compiles to the `animation`
  shorthand, which resets `animation-play-state` to `running`, and Tailwind emits
  `animation` after `animation-play-state` in the same layer whatever spelling the
  pause uses, `paused` and `[animation-play-state:paused]` alike. So the pause
  could never land. Chrome's own matched rules are how to see this, and they said
  it plainly: the pause, then the shorthand, both in `layer(utilities)`. Longhands
  do not reset each other, so with the shorthand gone the order stops mattering.
  Verified: `animationPlayState` reads `paused` with nothing hovered, where it
  read `running`.
- **The spin runs whenever the avatar is whole, and the hover gate is gone.** What
  the cover says is that something is playing, and a record that only turns when it
  is pointed at says it only then. Turning constantly is also what the site had
  always done, by accident: the hover gate never worked, since `animate-[…]`
  compiles to the `animation` shorthand, which resets `animation-play-state` to
  `running`, and Tailwind emits `animation` after `animation-play-state` in the
  same layer whatever spelling the pause uses. `DISC_SPIN` is four longhands for
  that reason, since longhands do not reset each other, and it is exported for the
  slot to freeze.
- **`data-loose` on the slot stops it while any piece of the stack is out.** A
  record off the turntable does not turn, and freezing it is also what keeps the
  loose copy's held angle honest. See The portrait above.
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
indexes, `BlogPosting` per post, `SoftwareSourceCode` per experiment,
`AboutPage`, `ContactPage` and `WebPage` on the three prose pages.

- **`Person` carries a description, and the omission was the bug.** The node had
  a name and a job title and nothing saying what the person does, so a parser
  that found the identity still could not read it. It takes `DESCRIPTION` from
  `lib/site.ts`, which is the sentence the page's own `<meta>` carries, and
  `WebSite` takes the same one. `image` is the portrait the home page renders,
  and `worksFor` and `knowsAbout` are the two claims that were only in prose.
- **`EMPLOYER` and `SUBJECTS` are literals in `lib/schema.ts`, beside `ROLE`.**
  Nothing exported from `lib/work.ts` carries a company on its own, since
  `workSections` is flattened into rows, and expertise is a claim about a person
  rather than something the code can check.
- **`WebSite.about` points at the `Person`.** A personal site is about its
  person, and saying so is what makes the primary entity unambiguous to a parser
  that finds two nodes in one graph and has to pick.
- **One builder for the three prose pages**, `staticPageSchema`, since the only
  thing that differs is the `WebPage` subtype. `AboutPage` gets `mainEntity:
  person()`, the other two get `about` by reference, because only the about page
  is about the person. Privacy has no subtype of its own in schema.org, so it
  stays `WebPage`.

- **Everything is derived, never restated.** Titles, dates and lists come from
  `meta.json`, `labsRegistry` and `getAllBlogs`, the same data the page renders.
  The shared rules ban marking up what a page does not visibly show, and a
  hand-copied title is how that happens by accident.
- **`dateModified` is deliberately absent.** Nothing records when a post was
  last edited, so stamping `datePublished` there would assert "never edited
  since" as fact.
- **The email is deliberately absent.** It is already public on the page, and it
  is the content of `/contact`, but machine-readable markup hands it to scrapers
  for no ranking benefit. So `ContactPage` describes the page and points at the
  person rather than carrying the address.
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

## Markdown variants

Every page is also served as markdown, for anything reading the site rather than
looking at it. Three ways in:

- **`.md` on the page's own path.** `/blogs/a-post.md`, `/lab/event-stacking.md`,
  `/work.md`, and `/index.md` for the home page.
- **`Accept: text/markdown` at the page's own path.** `proxy.ts` rewrites it.
- **`/llms.txt`**, the index, and **`/llms-full.txt`**, every document in one
  file, both per the llmstxt.org convention.
- **`/agents.md`**, the agent instruction file. See Agent readiness below.

`lib/markdown.ts` builds the documents, `app/md/[...path]/route.ts` serves them,
`proxy.ts` does the header half, and `next.config.ts` holds the rewrites.

**`/llms.txt` replaced a hand-written `public/llms.txt`, and that file is the
argument for generating it.** By the time it was found it knew none of the four
newest experiments, neither of the two newest packages and none of the recent
posts. Everything in it the site already holds is derived now. What is left is
`lib/profile.ts`, the writing that had no other home: the work highlights, the
package descriptions, the usage policy. Three of its sections were dropped rather
than moved, since social links are `lib/site.ts` and the site structure is
`markdownRoutes`, and a block of `User-agent`/`Allow` rules had been pasted in as
well, which does nothing in that file. Crawler rules belong in `robots.ts`, which
already says the same thing where a crawler reads it.

- **`llms-full.txt` is `noindex` and `llms.txt` is not.** The full file really is
  every indexable page's body at one URL. The index is not a second copy of
  anything, it is the one surface listing them all.
- **A directory named `llms.txt` is how the App Router serves a dotted path.**
  The proxy never sees either file, since its matcher excludes anything
  containing a dot. `app/agents.md/` is the same shape, and it survives the
  `.md` rewrite for a second reason: `next.config.ts` returns its rewrites as a
  plain array, which Next treats as `afterFiles`, so a real route wins and
  `/agents.md` is not turned into `/md/agents`. Verified on a production build.

- **Nothing in `lib/markdown.ts` restates a page's copy.** Every document is
  built from the same source its page renders from: `meta.json` and `page.mdx`
  for a post, `labsRegistry` for an experiment, `workSections` for `/work`,
  `lib/site.ts` for the home page. A second hand-written copy of a title or a
  date is how the markdown ends up describing a page the site no longer has.
  Extracting the root description into `lib/site.ts` was part of this, and it
  was already written out twice inside `app/layout.tsx` before anything else
  needed it.
- **The three prose pages are transcripts too**, off `lib/pages.ts`, through the
  same `inline` call the home page's paragraphs go through. `inline` is typed on
  `segments` alone rather than on `Paragraph`, since the home page's carry a
  tone and those do not.
- **The home page's four paragraphs live in `lib/site.ts` as segments**, which
  is what lets `/index.md` be the page rather than a summary of it. A segment is
  a plain string, a `{ text, href }` link, or `{ name }` for the one slot
  `DiaText` sweeps. It carries no presentation beyond a paragraph's tone, which
  is the only thing separating them on screen.
  - **A segment string carries its own spaces.** JSX collapses whitespace and a
    JS string does not, and the page renders the segments back to back with
    nothing between them.
  - **Whether a link sweeps an underline is now derived, not numbered.**
    `app/page.tsx` walks the same segments once at module scope and counts only
    the links whose host has no mark, since a pill has no rule to sweep. That is
    exactly what the hand-written `drawAt(0)`, `drawAt(1)` and `drawAt(2)`
    encoded, except adding a link to the copy now shifts the ones after it on its
    own. Verified after the move: the same three delays, 1030, 1170 and 1310, on
    the same three links.
  - **`external` is derived from the href too**, so an outbound link cannot be
    added without the `rel` guard.
- **The handler cannot live at the root as `[...path]`.** A dynamic page beats a
  catch-all in Next's matching order, so `/lab/tab-overview.md` would reach
  `app/lab/[slug]` and 404 there as an experiment whose slug ends in `.md`. A
  literal `md` segment beats both.
- **Two rewrite depths rather than one wildcard.** A literal suffix after a
  repeated parameter is the pattern path matching does not reliably support, so
  `/:path*.md` matches nothing. The site is two segments deep at most. `/index.md`
  falls out of the one-segment rule and needs no rule of its own, since
  `lib/markdown.ts` maps that segment back to the home page.
- **Middleware is called Proxy from Next 16 on.** Same file convention, one per
  project, at the same level as `app`. See
  `node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md`.
- **The proxy's matcher excludes anything containing a dot**, which is what keeps
  it off both static files and the `.md` requests `next.config.ts` already
  rewrites, since a proxy runs before those rewrites.
- **A browser never triggers the negotiation.** It asks for
  `text/html,application/xhtml+xml,...` and `curl` asks for `*/*`, so the test is
  for `text/markdown` appearing in `Accept` rather than for html being absent.
- **The markdown responses are `noindex` and carry `Vary: Accept`.** Every one is
  the same content as an already-indexable page, and two URLs competing for one
  body is what canonicals exist to prevent, so `sitemap.ts` lists none of them
  and the HTML page announces the file with `rel="alternate"` instead. The `Vary`
  is what stops a cache handing markdown to a browser.
- **`Vary` deliberately does not go on the page responses.** Setting it on
  `NextResponse.next()` is the obvious move and does not work: Next writes its
  own `Vary` for the router further down the stack and replaces the header
  outright, measured on a production build. The failure that has a visible cost
  is covered by the markdown response's own `Vary`, and the reverse degrades to
  an agent using the `.md` path. Forcing it through `next.config.ts` would
  overwrite the header the router relies on.
- **A stripped demo leaves a note.** A post's MDX is already markdown apart from
  its import line and the demo element mounted in the prose. Two posts put that
  demo under a heading of its own, so dropping the line outright left a
  "## Live Demo" with nothing under it.
- **Reading `page.mdx` is a fold with a fence flag, not a regex over the file.**
  Plenty of the code inside a fence starts with `<` or the word `import`, and a
  pass that could not see where a fence began stripped lines out of the middle
  of the examples the posts exist to show.

## Agent readiness

What the site tells an agent, and how a wrong guess recovers. It came out of an
Is Agentic audit that scored 90 and named four gaps: a 404 with no recovery
body, no when-to-use guidance, no trust pages, and identity markup missing a
description. The trust pages are their own section above, the markup is under
Structured data, and the other two are here.

`scripts/agent-readiness.test.mjs` is the check, `pnpm test:agents`. It is the
one test suite in the repo, and it asserts every claim in this section against a
running server, including the paths that already worked, so a change to the
markdown pipeline cannot quietly break them.

- **When-to-use guidance is one constant, `AGENT_WHEN_TO_USE` in
  `lib/profile.ts`, read by both `/llms.txt` and `/agents.md`.** A second copy
  would drift, and an agent that read both would get two answers.
  - **It names topics rather than post titles.** A title copied there is a
    second copy of a title, which is the drift `lib/profile.ts` exists to
    document. The current titles sit beside it in the same file, off
    `getAllBlogs`.
  - **It says when not to use the site as well.** Library documentation, other
    people, an API that does not exist, and current availability. Without those,
    a caller has to infer the boundary from what is listed.
  - **In `/llms.txt` it comes before the link lists.** A client that reads the
    top and stops should already know whether a second request is worth making.
- **`/agents.md` is the same guidance with the counts and the paths.** What is
  here, in pages, posts and experiments, all derived, then every
  machine-readable path with what it answers. It is indexable, unlike the
  per-page markdown documents, since it is not a second copy of a page.
- **A 404 answers with somewhere to go.** The status was already right and the
  body was the word "Not found", which is a dead end: a client that guessed a
  path has spent a request and has no way to learn that an index exists.
  - `notFoundMarkdown` in `lib/markdown.ts` is the markdown half, served with a
    real 404 by `app/md/[...path]/route.ts`, so it answers both `<path>.md` and
    any unknown path with `Accept: text/markdown`. It names `/llms.txt`,
    `/agents.md`, the sitemap and every page.
  - **The path is echoed back, sanitised.** It comes from the route's own params
    and the response is markdown rather than HTML, so nothing there can execute.
    It is narrowed to `[\w./-]` and capped at 120 characters anyway, since a body
    that quotes a request is a body that can be made to say anything.
  - `not-found.tsx` is the HTML half, and its second paragraph names `llms.txt`
    and `sitemap.xml` for the same reason. That took the page from two
    `RevealItem`s to three, so `revealSettled` moved from 630 to 710.
  - The markdown 404 carries the same three headers a document that exists does,
    `x-robots-tag: noindex` and `Vary: Accept` included, since it is reachable
    the same two ways.

## SEO routes

`robots.ts`, `sitemap.ts` and `not-found.tsx`, all reading `SITE_URL`.

- **`sitemap.ts` lists only routes that resolve.** Lab pages are gated on
  `IMPLEMENTED_LABS`, so a registry entry without a component 404s and must not
  be advertised. Every entry is implemented today, which is exactly why the
  filter belongs in the code rather than in someone's memory.
- **No invented timestamps.** The old sitemap stamped `new Date()` on the four
  static routes, so every crawl saw them claim they had changed that second.
  `lastModified` is omitted where nothing real backs it, and `/blogs` and
  `/lab` borrow the newest date from the content they list. `/about`, `/contact`
  and `/privacy` are mapped off `staticPages` and get none for the same reason:
  their copy is in `lib/pages.ts` and nothing records when it last changed.
- **`robots.ts` allows `/` rather than enumerating routes.** The old version
  listed every blog and lab path into `allow`, which `allow: "/"` already
  covers and which went stale on every new post. `/api/` is the one real
  exclusion, because `/api/spotify/login` redirects to Spotify's authorize
  screen.
- **`not-found.tsx` sets `robots: { index: false }`.** An indexed 404 competes
  with the real pages for the same terms. It centres rather than aligning top,
  since there is no content to scroll, and it carries no `BackLink` because the
  copy already names every route worth reaching. Its second paragraph is for a
  reader that is not a person, see Agent readiness above.

## Analytics

One `<Script>` in the root layout, pointing at OneDollarStats. There is no
package, no provider component and no per-route call.

- **The tracker counts App Router navigations on its own.** It hooks
  `history.pushState` and `popstate`, which is how the App Router moves between
  routes, so nothing has to be wired into a page or a layout below the root.
- **`afterInteractive`, which is `next/script`'s default.**
  `beforeInteractive` is fetched ahead of first-party code, and the installed
  Next docs reserve it for critical scripts. A page-view counter is not one.
- **No `data-hostname`.** The script reports `location.hostname` instead, so a
  preview deploy sends its events under a `*.vercel.app` host, which is not
  registered and is dropped. Setting the attribute would count preview traffic
  as production traffic.
- **No `data-devmode`.** That attribute is what makes localhost report, and
  nothing on this site needs local page views in the dashboard.
- **A domain only counts once it is added in the dashboard.** The script is
  live either way, so an empty dashboard is a registration problem and not a
  code one.

## Directories

- `app/` routes. `components/ui/` shared primitives, `components/home/` and
  `components/work/` are per-surface, `components/icons/` holds brand marks.
  `components/home/avatar.tsx` is the first block on the home page: the photo,
  with the now-playing cover stacked behind it. `portrait.tsx` beside it is the
  stack and everything it does, `use-falling.ts` is one falling body and
  `poke-sound.ts` is the click a poke makes. See The portrait above.
  A per-surface component moves to `components/ui/` the moment a second
  surface needs it, which is how `reveal.tsx` got there, and why
  `static-page.tsx` and `page-nav.tsx` were written there: three pages render
  through the first and two surfaces use the second.
- `app/api/` route handlers. Only Spotify lives here, see below. Everything
  under it is `Disallow`ed in `robots.ts`.
- `app/md/` the markdown variant of every page, reached through the rewrites in
  `next.config.ts` and through `proxy.ts`. Not linked from anywhere a reader
  goes, and every response is `noindex`. `app/llms.txt/`, `app/llms-full.txt/`
  and `app/agents.md/` sit beside it. See Markdown variants above.
- `app/about/`, `app/contact/` and `app/privacy/` the three prose pages. Each is
  metadata and a schema type over `components/ui/static-page.tsx`, and the copy
  is `lib/pages.ts`. See About, contact and privacy above.
- `lib/` no React. `constants.ts` layout tokens, `site.ts` copy and URLs,
  `pages.ts` the three prose pages and `siteRoutes`, `work.ts` work data,
  `favicons.ts` the host-to-mark registry,
  `spotify.ts` the now-playing provider, `schema.ts` the JSON-LD builders,
  `markdown.ts` the markdown variant of every page, `profile.ts` the two blocks
  of copy in the whole site that no page renders, the profile and the agent
  guidance, `lerp.ts` the interpolation
  three labs drive their own frame loops with, `lab-previews.ts` which
  experiments have a recorded preview, `utils.ts`.
- `proxy.ts` at the root, the only file there that runs per request. It exists
  for one thing, content negotiation for the markdown variants.
- `types/` ambient declarations only. Currently just the React canary
  reference. Anything untyped from npm gets its `.d.ts` here.
- `components/lab/` the lab index and detail chrome: the dynamic import map, the
  hover preview, the index list, and `controls.tsx`, the parameter lane and the
  pill that three experiments now share. Lab chrome rather than site primitives,
  which is why it is not in `components/ui/`.
- `scripts/` tooling that is not part of the app and never imported by it. Plain
  `.mjs` run with `node`, one file per job, each documenting what it produces and
  what has to be running for it to work. `record-lab-previews.mjs` writes the lab
  index's hover clips into `public/assets/labs`, see Recording the previews
  above, and `agent-readiness.test.mjs` is the `node --test` suite behind
  `pnpm test:agents`, see Agent readiness above. Both drive a server that is
  already listening rather than starting one.

## Keeping this current

Any new top-level directory gets documented here before the task is done. Any
new colour token gets a row in the token table. Any new type-scale entry gets a
line in the type scale section.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
