---
description: "Scaffolding rules for creating new blog posts with proper structure, metadata, and MDX content"
alwaysApply: false
globs:
  - "app/blogs/**/*"
  - "lib/blogs.ts"
---

# Blog Scaffolding Rules

When creating a new blog post, follow this exact structure and patterns.

## Directory Structure

Each blog post lives in `app/blogs/[slug]/` with the following files:

```
app/blogs/[slug]/
  ├── meta.json      # Blog metadata
  ├── page.mdx       # MDX content (main blog content)
  └── page.tsx       # Next.js page wrapper with metadata
```

## File Templates

### 1. `meta.json`

```json
{
  "title": "blog post title",
  "description": "brief description for SEO and previews",
  "date": "MMM DD, YYYY",
  "readTime": "X min read"
}
```

**Rules:**

- `title`: lowercase, descriptive
- `description`: single sentence, no period at end
- `date`: format like "Nov 1, 2025" (MMM DD, YYYY)
- `readTime`: estimate like "7 min read"

### 2. `page.tsx`

```typescript
import type { Metadata } from "next";
import meta from "./meta.json";

export const metadata: Metadata = {
  title: meta.title,
  description: meta.description,
  alternates: {
    canonical: `/blogs/${slug}`,
  },
  openGraph: {
    title: meta.title,
    description: meta.description,
    url: `/blogs/${slug}`,
    type: "article",
    publishedTime: meta.date,
  },
};

export { default } from "./page.mdx";
```

**Rules:**

- Import metadata from `./meta.json`
- Export Next.js `Metadata` with title, description, canonical, and OpenGraph
- Re-export the MDX component as default

### 3. `page.mdx`

```mdx
import MaxWidthWrapper from "@/components/ui/max-width-wrapper";
import BackButton from "@/components/ui/back-button";

<main className="min-h-screen flex items-center justify-center p-4">
  <MaxWidthWrapper
    size="screen-md"
    className="bg-primary-bg border border-[#121212] rounded-sm overflow-hidden max-h-[90vh] flex flex-col"
    showTerminalHeader={false}
  >
    <div className="sticky top-0 z-10 bg-primary-bg/70 backdrop-blur-xl border-b border-[#121212] sm:px-6 px-4 py-4 flex items-center justify-between">
      <BackButton href="/blogs">back to blogs</BackButton>
      <BlogLikeButton />
    </div>
    <div className="flex-1 overflow-y-auto sm:px-6 px-0 py-6">
      {/* MDX content here */}
    </div>
  </MaxWidthWrapper>
</main>
```

**Rules:**

- Always wrap in `MaxWidthWrapper` with `size="screen-md"`
- Use sticky header with `BackButton` and `BlogLikeButton`
- Content area should be scrollable (`overflow-y-auto`)
- Use responsive padding: `sm:px-6 px-0`

## Slug Convention

- Use kebab-case: `my-blog-post-title`
- Keep it descriptive but concise
- Match the directory name exactly

## Content Guidelines

- Write in lowercase for headings and body text (unless technical terms require capitalization)
- Use MDX syntax for code blocks, links, etc.
- Include a brief intro/tl;dr section at the top
- Use proper markdown formatting

## Checklist

When scaffolding a new blog:

- [ ] Create directory: `app/blogs/[slug]/`
- [ ] Create `meta.json` with all required fields
- [ ] Create `page.tsx` with metadata export
- [ ] Create `page.mdx` with wrapper structure
- [ ] Verify slug matches directory name
- [ ] Test that blog appears in `/blogs` listing
- [ ] Verify metadata appears correctly in page source
