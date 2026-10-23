import type { ReactNode } from "react";

/** Only the entries scroll; the surrounding card and tabs keep their fixed bounds. */
export function HistoryList({ children }: { children: ReactNode }) {
  return <div className="history-scroll divide-y divide-border/20" data-history-scroll="true" role="region" aria-label="History entries" tabIndex={0}>{children}</div>;
}
