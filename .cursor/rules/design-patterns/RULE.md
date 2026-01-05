---
description: "Design system patterns, Tailwind conventions, and UI consistency rules for the webapp"
alwaysApply: true
---

# Design Patterns & Conventions

This rule defines the design system patterns, Tailwind conventions, and UI consistency rules used throughout the webapp.

## Tailwind CSS Conventions

### Size Utilities

**Always use `size-*` instead of separate `w-*` and `h-*` when dimensions are equal:**

```typescript
// ✅ Correct
<Icon className="size-7" />
<div className="size-32" />
<span className="size-2.5" />

// ❌ Wrong
<Icon className="w-7 h-7" />
<div className="w-32 h-32" />
```

**Exception:** Use separate `w-*` and `h-*` when dimensions differ:

```typescript
// ✅ Correct - different dimensions
<div className="w-full h-9" />
<input className="w-64 h-8" />
```

### Text Colors

Use semantic text color tokens:

```typescript
// Primary text
className = "text-text-primary";

// Secondary/muted text
className = "text-text-secondary";

// Placeholder/muted text
className = "text-text-muted";
```

### Background Colors

```typescript
// Main background
className = "bg-primary-bg";

// Card/surface background
className = "bg-neutral-900/30";
className = "bg-neutral-900/20";
className = "bg-neutral-900/60";

// Dark backgrounds
className = "bg-[#0b0b0b]";
className = "bg-[#131313]";
```

### Borders

```typescript
// Main borders
className = "border border-[#121212]";
className = "border border-[#131313]";
className = "border border-[#1e1e1e]";

// Focus borders
className = "focus:border-[#2a2a2a]";
```

### Border Radius

```typescript
// Standard rounded corners
className = "rounded-sm"; // Most common
className = "rounded-md"; // For cards/panels
className = "rounded-lg"; // For buttons/icons
className = "rounded-xl"; // For large cards
className = "rounded-full"; // For circles
```

### Typography

**Text sizing:**

```typescript
className = "text-xs"; // 12px - labels, metadata
className = "text-sm"; // 14px - body text, paragraphs
className = "text-base"; // 16px - headings (rare)
```

**Text styling:**

```typescript
// Lowercase styling (common pattern)
className = "lowercase";

// Font weights
className = "font-medium"; // Most common
className = "font-semibold"; // Headings
className = "font-bold"; // Rare
```

**Line height:**

```typescript
className = "leading-5"; // Tight (common)
className = "leading-relaxed"; // Loose (rare)
```

### Code Styling

Inline code elements use this pattern:

```typescript
<code className="text-xs px-1.5 py-0.5 rounded-sm bg-neutral-900 text-neutral-200">
  {content}
</code>
```

**Rules:**

- `text-xs` for size
- `px-1.5 py-0.5` for padding
- `rounded-sm` for corners
- `bg-neutral-900` for background
- `text-neutral-200` for text color

## Animation Patterns

### Framer Motion Variants

Standard animation variants:

```typescript
// Fade + blur + slide
initial={{ opacity: 0, y: 4, filter: "blur(6px)" }}
animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
exit={{ opacity: 0, y: 4, filter: "blur(6px)" }}
transition={{ duration: 0.4, ease: "easeOut" }}

// Subtle transitions
initial={{ opacity: 0, y: 2, filter: "blur(2px)" }}
animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
exit={{ opacity: 0, y: -2, filter: "blur(2px)" }}
transition={{ duration: 0.3 }}
```

### Staggered Children

```typescript
variants={{
  hidden: {},
  show: {
    transition: { staggerChildren: 0.08, delayChildren: 0.35 },
  },
}}
```

### Spring Animations

```typescript
transition={{ type: "spring", damping: 30, stiffness: 300 }}
```

## Component Patterns

### Buttons

**Default button:**

```typescript
className =
  "cursor-pointer h-9 px-3 rounded-sm text-xs font-medium border border-[#1e1e1e] bg-neutral-900/60 text-text-primary hover:bg-neutral-800/60 transition-colors";
```

**Outline button:**

```typescript
className =
  "cursor-pointer h-9 px-3 rounded-sm text-xs font-medium border border-[#1e1e1e] bg-transparent text-text-secondary hover:bg-neutral-800/30 hover:text-text-primary transition-colors";
```

### Inputs

```typescript
className =
  "w-full h-9 px-3 rounded-sm text-sm bg-neutral-900/30 border border-[#1e1e1e] text-text-primary placeholder:text-text-muted outline-none focus:border-[#2a2a2a] transition-colors";
```

### Icons

```typescript
// Standard icon sizing
className = "size-3"; // Small icons (arrows, etc.)
className = "size-4"; // Medium icons
className = "size-7"; // Large icons (social links, etc.)

// With padding for clickable areas
className = "p-2 size-7";
```

### Links

```typescript
// Standard link
className =
  "underline underline-offset-4 transition-all hover:text-text-primary group";

// Emerald accent link
className =
  "underline underline-offset-2 transition-all text-emerald-400 hover:text-emerald-300";
```

## Layout Patterns

### MaxWidthWrapper

```typescript
<MaxWidthWrapper
  size="screen-md"
  className="bg-primary-bg border border-[#121212] rounded-sm overflow-hidden"
  animated={true}
>
```

### Responsive Padding

```typescript
// Standard pattern
className = "sm:px-8 px-0";
className = "sm:py-20 py-12";
className = "sm:px-6 px-4";
```

### Flex Patterns

```typescript
// Centered content
className = "flex items-center justify-center";

// Full width flex
className = "flex w-full items-center justify-center";

// Gap spacing
className = "flex gap-3";
className = "flex gap-1.5";
```

## Color Palette

### Primary Colors

- Background: `bg-primary-bg` or `bg-[#0b0b0b]`
- Borders: `border-[#121212]`, `border-[#131313]`, `border-[#1e1e1e]`
- Text: `text-text-primary`, `text-text-secondary`, `text-text-muted`

### Accent Colors

- Emerald: `text-emerald-400`, `hover:text-emerald-300`
- Green (success): `bg-green-500/20`, `text-green-400`
- Red (error): `bg-red-500/10`, `text-red-400`

### Neutral Shades

- `bg-neutral-900/30` - Light overlay
- `bg-neutral-900/20` - Very light overlay
- `bg-neutral-900/60` - Medium overlay
- `bg-neutral-800/30` - Hover states
- `bg-neutral-800/50` - Hover backgrounds

## Spacing Patterns

### Common Margins

```typescript
className = "mb-6"; // Paragraph spacing
className = "mb-4"; // Section spacing
className = "mt-2"; // Small spacing
className = "mt-4"; // Medium spacing
```

### Common Padding

```typescript
className = "px-3 py-2"; // Input padding
className = "px-4 py-3"; // Card padding
className = "p-2"; // Icon padding
className = "p-3"; // Small card padding
```

## Loading States

### Skeleton Pattern

```typescript
<span className="inline-block h-4 w-8 rounded bg-neutral-800 animate-pulse relative top-1" />
```

**Rules:**

- Use `bg-neutral-800` for skeleton background
- Add `animate-pulse` for animation
- Use `relative top-1` for vertical alignment if needed
- Match dimensions to content

## Accessibility

### ARIA Labels

```typescript
aria-label="Descriptive label"
aria-hidden="true"  // For decorative elements
```

### Focus States

Always include focus styles:

```typescript
className = "outline-none focus:border-[#2a2a2a]";
```

## Common Class Combinations

### Card Container

```typescript
className = "border border-[#1e1e1e] rounded-sm bg-neutral-900/20 p-3";
```

### Text Block

```typescript
className = "text-sm text-text-secondary lowercase leading-5 mb-6";
```

### Icon Button

```typescript
className = "transition-all rounded-lg hover:bg-neutral-800/50 p-2 size-7";
```

### Code Inline

```typescript
className = "text-xs px-1.5 py-0.5 rounded-sm bg-neutral-900 text-neutral-200";
```
