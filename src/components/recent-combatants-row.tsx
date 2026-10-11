import { useLayoutEffect, useRef, useState } from "react";

interface Entry { name: string; initiative: number }
const chip = "shrink-0 whitespace-nowrap border border-border/40 px-2 py-1 text-xs";

export function RecentCombatantsRow({ entries, onSelect }: { entries: Entry[]; onSelect: (entry: Entry) => void }) {
  const row = useRef<HTMLDivElement>(null);
  const measurement = useRef<HTMLDivElement>(null);
  const [count, setCount] = useState(0);
  useLayoutEffect(() => {
    const container = row.current;
    const sizes = measurement.current;
    if (!container || !sizes) return;
    const measure = () => {
      const available = container.clientWidth;
      if (!available) return;
      const gap = parseFloat(getComputedStyle(container).columnGap) || 0;
      let used = 0;
      let fits = 0;
      for (const child of Array.from(sizes.children)) {
        const width = child.getBoundingClientRect().width;
        const next = used + (fits ? gap : 0) + width;
        if (next > available) break;
        used = next;
        fits++;
      }
      setCount(fits);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    observer.observe(sizes);
    measure();
    return () => observer.disconnect();
  }, [entries]);
  return <div className="relative min-w-0">
    <div ref={measurement} aria-hidden="true" className="absolute invisible pointer-events-none flex gap-1 w-max">{entries.map((entry, index) => <span key={index} className={chip}>{entry.name}</span>)}</div>
    <div ref={row} aria-label="Recent combatants" className="flex flex-nowrap gap-1 min-w-0">{entries.slice(0, count).map((entry, index) => <button key={`${entry.name}:${index}`} type="button" className={chip} onClick={() => onSelect(entry)}>{entry.name}</button>)}</div>
  </div>;
}
