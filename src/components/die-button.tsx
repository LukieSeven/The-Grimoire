import { Button } from "./ui/button";

export type StandardDie = "d4" | "d6" | "d8" | "d10" | "d12" | "d20" | "d100";
const outlines: Record<Exclude<StandardDie, "d100">, { points: string; facets?: string }> = {
  d4: { points: "32,4 61,55 3,55", facets: "M32 4V55M3 55L32 35L61 55" },
  d6: { points: "9,9 55,9 55,55 9,55" },
  d8: { points: "32,3 59,32 32,61 5,32", facets: "M5 32H59M32 3L21 32L32 61L43 32Z" },
  d10: { points: "32,3 59,24 52,49 32,61 12,49 5,24", facets: "M32 3L19 34L32 61L45 34ZM5 24L19 34L12 49M59 24L45 34L52 49" },
  d12: { points: "32,3 60,23 49,57 15,57 4,23", facets: "M32 16L48 28L42 46H22L16 28ZM32 3V16M60 23L48 28M49 57L42 46M15 57L22 46M4 23L16 28" },
  d20: { points: "32,3 58,18 58,47 32,61 6,47 6,18", facets: "M32 3L15 42H49ZM6 18L32 23L58 18M6 47L15 42L32 61L49 42L58 47M15 42L32 23L49 42" },
};

/** Code-native outlines keep labels sharp and inherit the active tool theme. */
export function DieButton({ die, rolling, disabled, onClick }: { die: StandardDie; rolling: boolean; disabled: boolean; onClick: () => void }) {
  return <Button type="button" variant="ghost" className={`die-button die-button-${die} ${rolling ? "animate-pulse" : ""}`} title={`Roll ${die}`} disabled={disabled} onClick={onClick}>
    <svg viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      {die === "d100" ? <>
        <polygon className="die-outline" points="21,4 40,18 35,38 21,47 7,38 2,18" />
        <path className="die-facets" d="M21 4L13 27L21 47L29 27ZM2 18L13 27M40 18L29 27" />
        <polygon className="die-outline" points="43,17 62,31 57,51 43,60 29,51 24,31" />
        <path className="die-facets" d="M43 17L35 40L43 60L51 40ZM24 31L35 40M62 31L51 40" />
      </> : <>
        <polygon className="die-outline" points={outlines[die].points} />
        {outlines[die].facets && <path className="die-facets" d={outlines[die].facets} />}
      </>}
    </svg>
    <span className="die-label">{die}</span>
  </Button>;
}
