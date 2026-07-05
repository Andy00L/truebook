import type { ReactNode } from "react";

/** Responsive board grid: full-width cards on phones, 380px tracks above. */
export function MarketGrid({ children }: { children: ReactNode }) {
  return (
    <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-[repeat(auto-fit,minmax(380px,1fr))]">
      {children}
    </div>
  );
}
