import type { ReactNode } from "react";
import { joinClassNames } from "@/lib/joinClassNames";

type PageShellProps = {
  children: ReactNode;
  className?: string;
};

/** Content column: the sheet's shell width with generous side padding. */
export function PageShell({ children, className }: PageShellProps) {
  return (
    <div
      className={joinClassNames(
        "mx-auto w-full max-w-shell px-4 pb-18 pt-5 sm:px-8",
        className,
      )}
    >
      {children}
    </div>
  );
}
