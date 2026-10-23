import { useId, useState } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { resourceDisplay } from "../lib/resource-display";
export interface CompactResource { name: string; current: number; max: number; barMax: number; color: string; temporary?: number; bonus?: number; add: (value: string) => void; remove: (value: string) => void; temp: (value: string) => void }
export function CompactResources({ resources, stacked = false }: { resources: CompactResource[]; stacked?: boolean }) {
  const [selected, setSelected] = useState(1);
  const [value, setValue] = useState("");
  const valueInputId = useId();
  const resource = resources[selected];
  const apply = (action: "add" | "remove" | "temp") => { if (!value.trim() || !Number.isFinite(Number(value)) || Number(value) <= 0) return; resource[action](value); setValue(""); };
  return <div className={`compact-resources space-y-2${stacked ? " compact-resources-stacked" : ""}`}>
    <div className="compact-resource-options grid grid-cols-3 gap-1" aria-label="Select resource">{resources.map((item, index) => { const display = resourceDisplay(item.current, item.temporary); return <button type="button" key={item.name} aria-pressed={selected === index} onClick={() => setSelected(index)} className={`compact-resource-choice min-w-0 border p-2 text-center ${selected === index ? "border-primary bg-primary/10" : "border-border"}`}>
      <span className="compact-resource-name block text-xs font-bold">{item.name}</span>
      <span className="compact-resource-values block font-mono font-bold">{display.hasTemporary && <span className="compact-resource-temporary" title="Temporary points" aria-label={`${display.temporary} temporary points`}>{display.temporary}</span>}<span className="compact-resource-total" data-has-temporary={display.hasTemporary || undefined}>{display.total}</span><span className="compact-resource-maximum text-xs text-muted-foreground"> / {item.max}</span></span>
      {!!item.bonus && <span className="compact-resource-bonus text-xs text-amber-400">+{item.bonus} buff</span>}
      <span className="compact-resource-bar bg-accent/50" role="progressbar" aria-label={`${item.name} remaining`} aria-valuemin={0} aria-valuemax={Math.max(0, item.barMax)} aria-valuenow={Math.max(0, Math.min(item.barMax, display.total))} aria-valuetext={`${display.total} / ${item.barMax}`}><span style={{ width: `${item.barMax > 0 ? Math.max(0, Math.min(100, display.total / item.barMax * 100)) : 0}%`, background: item.color }} /></span>
    </button>; })}</div>
    <div className="flex gap-2 items-center"><label className="text-xs shrink-0" htmlFor={valueInputId}>{resource.name}</label><Input id={valueInputId} type="number" min="0" value={value} onChange={event => setValue(event.target.value)} placeholder="Amount" className="h-6 text-xs text-center font-mono min-w-0 flex-1 bg-background/50 border-border/50 px-1 rounded-md" /></div>
    <div className="grid grid-cols-3 gap-1"><Button size="sm" variant="outline" className="h-6 text-xs border-green-600/40 text-green-500 hover:bg-green-500/10 px-2 min-w-0 rounded-md cursor-pointer font-bold btn-resource-add" onClick={() => apply("add")}>{selected === 1 ? "Heal" : "Add"}</Button><Button size="sm" variant="destructive" className="h-6 text-xs px-2 min-w-0 rounded-md cursor-pointer font-bold btn-resource-dmg" onClick={() => apply("remove")}>{selected === 2 ? "Use" : "Dmg"}</Button><Button size="sm" variant="outline" className="h-6 text-xs border-amber-500/30 text-amber-500 hover:bg-amber-500/10 px-2 min-w-0 rounded-md cursor-pointer font-bold btn-resource-buff" onClick={() => apply("temp")}>Temp</Button></div>
  </div>;
}
