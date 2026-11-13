export interface GearNoteFields {
  description: string;
  diceType?: string;
  modifier?: string;
  dtBonus?: string;
  statModifiers?: Record<string, number | string>;
}

const fields = {
  "description": "description",
  "dice": "diceType",
  "modifier": "modifier",
  "dt bonus": "dtBonus",
  "stat modifiers": "statModifiers",
} as const;

/** Read the existing gear-note format without truncating prose or formulas. */
export function readGearNote(content: string, readLegacyGearFields = false): GearNoteFields {
  const fieldHeader = /^(Description|Dice|Modifier|DT Bonus|Stat Modifiers):[^\S\r\n]*/gim;
  const headers = Array.from(content.matchAll(fieldHeader));
  const description = headers.find(header => header.index === 0 && header[1].toLowerCase() === "description");
  // Generated equipment notes append these four metadata fields in this order.
  // Parse from the end so lines like “Dice:” inside a description stay prose.
  const trailer = headers.slice(-4);
  const hasTrailer = trailer.map(header => header[1].toLowerCase()).join("|") === "dice|modifier|dt bonus|stat modifiers";
  const metadata = hasTrailer ? trailer : description && !readLegacyGearFields ? [] : headers;
  const found: Partial<Record<(typeof fields)[keyof typeof fields], string>> = {};
  for (const [index, header] of metadata.entries()) {
    const key = fields[header[1].toLowerCase() as keyof typeof fields];
    if (found[key] === undefined) {
      found[key] = content.slice(header.index! + header[0].length, metadata[index + 1]?.index ?? content.length).trim();
    }
  }

  const optionalField = (value?: string) => value === undefined ? undefined : /^none$/i.test(value) ? "" : value;
  const result: GearNoteFields = {
    description: description && (hasTrailer || !readLegacyGearFields)
      ? content.slice(description[0].length, hasTrailer ? trailer[0].index : content.length).trim()
      : found.description ?? content,
    diceType: optionalField(found.diceType),
    modifier: optionalField(found.modifier),
    dtBonus: optionalField(found.dtBonus),
  };
  if (found.statModifiers) {
    try {
      const values: unknown = JSON.parse(found.statModifiers);
      if (values && typeof values === "object" && !Array.isArray(values) && Object.values(values).every(value => typeof value === "number" || typeof value === "string")) {
        result.statModifiers = values as Record<string, number | string>;
      }
    } catch {
      // Invalid optional data should not prevent copying the note's text.
    }
  }
  return result;
}
