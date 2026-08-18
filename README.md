# www

my personal site. next.js app router, tailwind v4, mdx posts, one light theme.
live at [sanyam.sh](https://sanyam.sh).

## setup

```bash
pnpm install
pnpm dev        # http://localhost:3000
```

needs node 20.9 or newer and pnpm 10.

## env

all optional. with nothing set the site boots and the only thing missing is the
now-playing cover behind the avatar on the home page.

```bash
cp .env.example .env.local
```

| variable | what it is |
| --- | --- |
| `SPOTIFY_CLIENT_ID` | from the spotify developer dashboard |
| `SPOTIFY_CLIENT_SECRET` | same |
| `SPOTIFY_REFRESH_TOKEN` | minted once, see below |
| `NEXT_PUBLIC_BASE_URL` | only needed while minting, `http://localhost:3000` |

to mint the refresh token: set the client id, secret and `NEXT_PUBLIC_BASE_URL`, add
`http://localhost:3000/api/spotify/callback` to the app's redirect allow list in
the dashboard, open `/api/spotify/login`, approve, and the callback returns the
token as json. paste it in as `SPOTIFY_REFRESH_TOKEN` and drop
`NEXT_PUBLIC_BASE_URL`.

## commands

| command | what it does |
| --- | --- |
| `pnpm dev` | dev server on turbopack |
| `pnpm build` | production build |
| `pnpm start` | serve the build |
| `pnpm lint` | biome check |
| `pnpm format` | biome format, writes |
| `pnpm tc` | typecheck only |
| `pnpm check` | lint, typecheck and build together |

`pnpm check` has to pass before a push. build catches what the other two miss.

## layout

```
app/          routes. posts under app/blogs/<slug>/, experiments under app/lab/
components/   ui/ is shared, home/ work/ blogs/ labs/ are per surface
lib/          no react. constants, site copy, work data, spotify, json-ld
public/       assets and favicons
```

## adding a post

one directory under `app/blogs/`, three files:

- `meta.json` with `title`, `description`, `date` as iso `YYYY-MM-DD`, `readTime`
- `page.mdx`, content only, no layout, headings start at h2
- `page.tsx`, exports `metadata` from the json and renders `<BlogPost>`

copy the newest post and edit. a directory with no `meta.json` stays off the
index, so a draft can sit in the tree unpublished.

## notes

`CLAUDE.md` carries the conventions this codebase follows and the reason behind
each one: the colour tokens, the type scale, the motion defaults, and the traps
worth knowing before changing any of them.

happy to have you use this. please strip my details first (`lib/site.ts`,
`lib/constants.ts`, `lib/work.ts`, `app/blogs/`, `public/assets/`) and a credit
back is appreciated if you can.
