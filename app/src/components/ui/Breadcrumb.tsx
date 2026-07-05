import Link from "next/link";
import { Fragment } from "react";
import { MascotDribble } from "@/components/ui/MascotDribble";

export type BreadcrumbSegment = {
  label: string;
  /** Present on intermediate segments; the current page has none. */
  href?: string;
};

type BreadcrumbProps = {
  segments: BreadcrumbSegment[];
  /** Section pages carry the mascot mark; the match page stays plain. */
  withMascot?: boolean;
  /** Right-aligned eyebrow, e.g. the product tagline. */
  tagline?: string;
  /** Right-aligned controls, e.g. the wallet button on chain screens. */
  actions?: React.ReactNode;
};

/** Top-of-page trail: the TrueBook mark, then the path to this screen. */
export function Breadcrumb({
  segments,
  withMascot = false,
  tagline,
  actions,
}: BreadcrumbProps) {
  return (
    <nav
      aria-label="Breadcrumb"
      className="flex items-center justify-between gap-4 pb-5 pt-1"
    >
      <div className="flex items-center gap-2.5">
        {withMascot ? <MascotDribble scale={0.4} /> : null}
        <Link
          href="/"
          className="focus-ring rounded-sm border border-transparent text-base font-semibold tracking-wide text-ink no-underline"
        >
          TrueBook
        </Link>
        {segments.map((segment) => (
          <Fragment key={segment.label}>
            <span aria-hidden="true" className="text-ink-faint">
              /
            </span>
            {segment.href ? (
              <Link
                href={segment.href}
                className="focus-ring rounded-sm border border-transparent px-1 py-3 text-sm text-accent no-underline hover:underline"
              >
                {segment.label}
              </Link>
            ) : (
              <span aria-current="page" className="text-sm text-ink-muted">
                {segment.label}
              </span>
            )}
          </Fragment>
        ))}
      </div>
      <div className="flex items-center gap-4">
        {tagline ? (
          <span className="eyebrow hidden text-ink-faint md:inline">
            {tagline}
          </span>
        ) : null}
        {actions ?? null}
      </div>
    </nav>
  );
}
