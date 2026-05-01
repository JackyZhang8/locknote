export function getImageGridColumnCount(width: number): number {
  if (width >= 1400) return 8;
  if (width >= 1180) return 7;
  if (width >= 960) return 6;
  if (width >= 760) return 5;
  if (width >= 560) return 4;
  if (width >= 420) return 3;
  return 2;
}

export function toImageRows<T>(items: T[], columnCount: number): T[][] {
  const safeColumnCount = Math.max(1, columnCount);
  const rows: T[][] = [];
  for (let index = 0; index < items.length; index += safeColumnCount) {
    rows.push(items.slice(index, index + safeColumnCount));
  }
  return rows;
}
