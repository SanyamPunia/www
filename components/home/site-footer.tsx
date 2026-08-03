import { FileTextIcon, MediumLogoIcon } from "@phosphor-icons/react/dist/ssr";
import { Signature } from "@/components/home/signature";
import { GitHub } from "@/components/icons/github";
import { Gmail } from "@/components/icons/gmail";
import { LinkedIn } from "@/components/icons/linkedin";
import { Pageo } from "@/components/icons/pageo";
import { X } from "@/components/icons/x";
import { Tooltip, TooltipProvider } from "@/components/ui/tooltip";
import { EMAIL, socials } from "@/lib/site";

// Same set and order the old site carried. GitHub, X and LinkedIn are svgl.app
// marks, Gmail and Pageo are the site's own copies since svgl has neither, and
// Medium falls back to Phosphor for the same reason.
const accounts = [
  { href: socials.pageo, label: "Pageo", icon: Pageo },
  { href: socials.github, label: "GitHub", icon: GitHub },
  { href: socials.linkedin, label: "LinkedIn", icon: LinkedIn },
  { href: socials.x, label: "X", icon: X },
  { href: socials.medium, label: "Medium", icon: MediumLogoIcon },
  { href: `mailto:${EMAIL}`, label: "Email", icon: Gmail },
  // /cv is a redirect to the pdf, so it sits with the icons rather than the
  // page nav, and it anchors the row on the right
  { href: "/cv", label: "CV", icon: FileTextIcon },
];

/*
 * Nothing on this page scales on press. A 2% scale shifts an edge by a
 * fraction of a pixel, which is under the threshold for reading as motion and
 * over the threshold for changing antialiasing, so fine detail smears rather
 * than shrinks. Layer promotion and whole-pixel boxes were both tried and
 * neither helps, an inline target sits wherever text layout puts it and the
 * transform is sub-pixel by definition. Press is a background step instead.
 */
const PRESS = "hover:bg-fill active:bg-fill-hover";

/** 24px and 12px exactly, kept off the `--spacing` steps, which land on 25.6px
 *  and 12.8px and put the marks on fractional pixels. */
const ICON_BUTTON = "size-[1.5rem]";
const ICON_GLYPH = "size-[0.75rem]";

export function SiteFooter() {
  return (
    <footer className="flex items-center justify-between gap-4 text-meta">
      {/* the signature anchors the left of the row where the page nav used to */}
      {/* translate, not margin: the row is items-center, so a margin would be
          split by the centring and only shift it half as far */}
      <Signature className="h-10 shrink-0 translate-y-1.5" />

      <TooltipProvider delayDuration={200}>
        {/* 4px, not gap-1's 3.2px, so each button's left edge lands on a whole
            pixel instead of accumulating a fractional offset along the row */}
        <div className="flex items-center gap-1.25">
          {accounts.map(({ href, label, icon: Icon }) => (
            <Tooltip key={href} label={label}>
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={label}
                className={`inline-flex ${ICON_BUTTON} items-center justify-center rounded-md text-text-muted cursor-pointer transition-all duration-200 hover:text-text-primary ${PRESS} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary/15`}
              >
                <Icon aria-hidden="true" className={`${ICON_GLYPH} shrink-0`} />
              </a>
            </Tooltip>
          ))}
        </div>
      </TooltipProvider>
    </footer>
  );
}
