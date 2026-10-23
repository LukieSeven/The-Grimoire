import { useLayoutEffect, useRef, type ReactNode } from "react";

/** Both tabs reserve exactly the Stats bank's height; controls never size the LCD. */
export function DiceToolLayout({ children }: { children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const node = root.current;
    if (!node) return;
    const measure = () => {
      if (!node.clientWidth) return;
      const bank = document.querySelector<HTMLElement>('[data-tool="stats"] .stat-inputs');
      if (!bank) return;
      // Hidden tabs have no measurable box. A transient inert copy measures the same
      // Stats content at this card's width, including its current font and theme.
      const sample = bank.cloneNode(true) as HTMLElement;
      sample.setAttribute("aria-hidden", "true"); sample.inert = true;
      Object.assign(sample.style, { position: "absolute", visibility: "hidden", pointerEvents: "none", width: `${node.clientWidth}px`, height: "auto", minHeight: "0", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", left: "0", top: "0" });
      node.appendChild(sample);
      const height = sample.offsetHeight;
      sample.remove();
      if (height && node.style.getPropertyValue("--dice-controls-height") !== `${height}px`) node.style.setProperty("--dice-controls-height", `${height}px`);
    };
    measure();
    const observer = new ResizeObserver(measure); observer.observe(node);
    const theme = new MutationObserver(measure); theme.observe(document.documentElement, { attributes: true });
    document.fonts.addEventListener("loadingdone", measure);
    return () => { observer.disconnect(); theme.disconnect(); document.fonts.removeEventListener("loadingdone", measure); };
  }, []);
  return <div ref={root} className="dice-tool-layout">{children}</div>;
}
