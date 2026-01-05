---
description: "Scaffolding rules for creating new lab components with proper structure, registry entries, and dynamic imports"
alwaysApply: false
globs:
  - "components/labs/**/*"
  - "app/lab/**/*"
  - "lib/labs.registry.ts"
---

# Lab Scaffolding Rules

When creating a new lab component, follow this exact structure and patterns.

## Directory Structure

Each lab component lives in `components/labs/[slug]/`:

```
components/labs/[slug]/
  ├── index.tsx       # Main lab component (required)
  └── styles.css      # Optional: component-specific styles
```

## File Templates

### 1. `components/labs/[slug]/index.tsx`

```typescript
"use client";

// Component implementation here

export default function Page() {
  return <YourLabComponent />;
}
```

**Rules:**

- Must be a client component (`"use client"`)
- Export default function named `Page` that returns the lab component
- Component should be centered and styled to match dark lab theme
- Use theme colors: `bg-[#0b0b0b]`, `border-[#131313]`, `text-text-primary`, etc.

### 2. Lab Component Styling

Lab components should match the dark theme:

```typescript
<div className="flex min-h-48 sm:min-h-64 w-full items-center justify-center border border-[#131313] rounded-sm bg-[#0b0b0b] px-4 py-6 overflow-hidden">
  {/* Lab content */}
</div>
```

**Theme Colors:**

- Background: `bg-[#0b0b0b]` or `bg-primary-bg`
- Border: `border-[#131313]` or `border-[#1e1e1e]`
- Text primary: `text-text-primary`
- Text secondary: `text-text-secondary`
- Text muted: `text-text-muted`
- Rounded: `rounded-sm`

## Registry Entry

Add entry to `lib/labs.registry.ts`:

```typescript
{
  slug: "your-lab-slug",
  title: "Your Lab Title",
  description: [
    "first paragraph describing the lab",
    "key insight: technical detail or implementation note",
    "additional context or usage notes",
  ],
  image: "/lab/your-lab-slug.webp",
  createdAt: "MMM DD, YYYY",
  source: "https://github.com/...", // optional
},
```

**Rules:**

- `slug`: kebab-case, matches directory name
- `title`: Title Case
- `description`: Array of strings, first is main description
- `image`: Path to image in `public/lab/`
- `createdAt`: Format like "dec 27, 2025" (lowercase month)
- `source`: Optional GitHub/twitter link

## Dynamic Import

Add to `app/lab/[slug]/page.tsx`:

```typescript
const dynamicComponents: Record<string, LabComponent> = {
  // ... existing labs
  "your-lab-slug": dynamic(
    () => import("@/components/labs/your-lab-slug/index"),
    { ssr: false }
  ),
};
```

**Rules:**

- Add entry to `dynamicComponents` object
- Use `dynamic()` from `next/dynamic`
- Set `{ ssr: false }` for all labs
- Slug must match registry entry exactly

## Image Asset

Create placeholder image in `public/lab/[slug].webp`:

```bash
# Copy from existing lab or create new
cp public/lab/existing-lab.webp public/lab/your-lab-slug.webp
```

**Rules:**

- Image must exist at `public/lab/[slug].webp`
- Use `.webp` format
- Update with actual screenshot later

## Lab Component Patterns

### Animation

Use Framer Motion for animations:

```typescript
import { motion, AnimatePresence } from "framer-motion";

<motion.div
  initial={{ opacity: 0, y: 4, filter: "blur(6px)" }}
  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
  transition={{ duration: 0.4, ease: "easeOut" }}
>
```

### Form Elements

If creating form components, match existing patterns:

```typescript
// Input
<input className="w-full h-9 px-3 rounded-sm text-sm bg-neutral-900/30 border border-[#1e1e1e] text-text-primary placeholder:text-text-muted outline-none focus:border-[#2a2a2a] transition-colors" />

// Button
<button className="cursor-pointer h-9 px-3 rounded-sm text-xs font-medium border border-[#1e1e1e] bg-neutral-900/60 text-text-primary hover:bg-neutral-800/60 transition-colors" />
```

## Checklist

When scaffolding a new lab:

- [ ] Create directory: `components/labs/[slug]/`
- [ ] Create `index.tsx` with `Page` default export
- [ ] Add registry entry to `lib/labs.registry.ts`
- [ ] Add dynamic import to `app/lab/[slug]/page.tsx`
- [ ] Create placeholder image: `public/lab/[slug].webp`
- [ ] Style component to match dark lab theme
- [ ] Test lab renders at `/lab/[slug]`
- [ ] Verify lab appears in `/lab` listing

## Common Patterns

### Height Transitions

For dynamic height animations:

```typescript
const [height, setHeight] = useState(0);
const contentRef = useRef<HTMLDivElement>(null);

useEffect(() => {
  if (contentRef.current) {
    const resizeObserver = new ResizeObserver(() => {
      if (contentRef.current) {
        setHeight(contentRef.current.offsetHeight);
      }
    });
    resizeObserver.observe(contentRef.current);
    setHeight(contentRef.current.offsetHeight);
    return () => resizeObserver.disconnect();
  }
}, []);

<motion.div
  animate={{ height }}
  transition={{ type: "spring", damping: 30, stiffness: 300 }}
>
  <div ref={contentRef}>{/* content */}</div>
</motion.div>;
```

### AnimatePresence Transitions

```typescript
<AnimatePresence mode="wait">
  {condition && (
    <motion.div
      key="unique-key"
      initial={{ opacity: 0, y: 2, filter: "blur(2px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      exit={{ opacity: 0, y: -2, filter: "blur(2px)" }}
      transition={{ duration: 0.3 }}
    >
      {/* content */}
    </motion.div>
  )}
</AnimatePresence>
```
