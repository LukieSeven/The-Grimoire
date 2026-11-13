import { useState } from "react";
import { HelpCircle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";

export function SectionHelp({ label, children }: { label: string; children: string }) {
  const [open, setOpen] = useState(false);

  return <Tooltip open={open} onOpenChange={setOpen} delayDuration={240}>
    <TooltipTrigger asChild>
      <button
        type="button"
        aria-label={`Help: ${label}`}
        className="ml-1 inline-flex size-6 shrink-0 cursor-help items-center justify-center rounded-full align-middle text-muted-foreground hover:bg-primary/10 hover:text-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
        onClick={event => {
          // The help button can live inside a disclosure heading without toggling it.
          event.preventDefault();
          event.stopPropagation();
          setOpen(true);
        }}
        onKeyDown={event => {
          if (event.key === "Enter" || event.key === " ") event.stopPropagation();
        }}
      >
        <HelpCircle aria-hidden="true" className="size-3.5" />
      </button>
    </TooltipTrigger>
    <TooltipContent side="top" align="start" collisionPadding={12} sideOffset={6} className="z-[100] w-72 max-w-[calc(100vw-2rem)] border border-primary/35 bg-popover p-3 text-popover-foreground shadow-lg">
      <p className="mb-1 font-semibold text-primary">{label}</p>
      <p className="leading-relaxed">{children}</p>
    </TooltipContent>
  </Tooltip>;
}
