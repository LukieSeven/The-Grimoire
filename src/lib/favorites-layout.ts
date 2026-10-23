/** UI geometry only: slot assignments and execution remain owned by the character sheet. */
export function favoritesCapacity(width: number, height: number, count: number, rem: number) {
  // The wide hotbar keeps the original two-row arrangement inside its fixed grid cell.
  if (width >= rem * 60 && height >= rem * 6) {
    const columns = Math.min(10, Math.max(1, count));
    return { columns, perPage: columns * 2, tileHeight: Math.min(rem * 4.5, (height - rem * .5) / 2) };
  }
  const gap = rem * .75, tileWidth = rem * 8, tileHeight = rem * 4.5;
  const columns = Math.max(1, Math.min(10, Math.max(1, count), Math.floor((width + gap) / (tileWidth + gap))));
  const rows = Math.max(1, Math.floor((height + gap) / (tileHeight + gap)));
  return { columns, perPage: Math.max(1, columns * rows), tileHeight };
}
