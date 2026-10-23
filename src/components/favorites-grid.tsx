import { Children, useLayoutEffect, useRef, useState, type ReactNode, type CSSProperties } from "react";
import { favoritesCapacity } from "../lib/favorites-layout";

/** Measure the card interior, not viewport breakpoints. All slot children stay mounted. */
export function FavoritesGrid({ children, heading }: { children: ReactNode; heading: ReactNode }) {
  const slots = Children.toArray(children);
  const root = useRef<HTMLDivElement>(null);
  const header = useRef<HTMLDivElement>(null);
  const [capacity, setCapacity] = useState({ columns: 1, perPage: 1, tileHeight: 72 });
  const [anchor, setAnchor] = useState(0);
  useLayoutEffect(() => {
    const node = root.current;
    if (!node) return;
    const measure = () => {
      if (!node.clientWidth || !node.clientHeight) return;
      const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
      const next = favoritesCapacity(node.clientWidth, node.clientHeight - (header.current?.getBoundingClientRect().height ?? 0) - parseFloat(getComputedStyle(node).rowGap), slots.length, rem);
      setCapacity(old => old.columns === next.columns && old.perPage === next.perPage && old.tileHeight === next.tileHeight ? old : next);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    if (header.current) observer.observe(header.current);
    return () => observer.disconnect();
  }, [slots.length]);
  const pages = Math.max(1, Math.ceil(slots.length / capacity.perPage));
  const page = Math.min(pages - 1, Math.floor(anchor / capacity.perPage));
  const start = page * capacity.perPage, end = Math.min(slots.length, start + capacity.perPage);
  return <div ref={root} className="favorites-layout" data-wide={capacity.columns === 10 || undefined} style={{ "--favorite-columns": capacity.columns, "--favorite-height": `${capacity.tileHeight}px` } as CSSProperties}>
    <div ref={header} className="favorites-heading">{heading}{pages > 1 && <nav className="favorites-pagination" aria-label="Favorite pages"><button type="button" aria-label="Previous favorite slots" disabled={page === 0} onClick={() => setAnchor((page - 1) * capacity.perPage)}>‹</button><span aria-live="polite">{start + 1}–{end} / {slots.length}</span><button type="button" aria-label="Next favorite slots" disabled={page === pages - 1} onClick={() => setAnchor((page + 1) * capacity.perPage)}>›</button></nav>}</div>
    <div className="favorites-paged-grid" aria-label="Favorite slots">
      {slots.map((child, index) => <div key={index} className="favorites-slot" data-slot-index={index} hidden={index < start || index >= end}>{child}</div>)}
    </div>
  </div>;
}
