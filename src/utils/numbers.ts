export type Raw = string | number | boolean | Date | null | undefined;
export type DecimalMark = '.' | ',';

const NUMERIC = /^-?[\d.,]*\d[\d.,]*$/;

function clean(s: string): string {
  return s.trim().replace(/\s/g, '');
}

/**
 * Decimal mark of one numeric string, or null when the string alone cannot tell:
 * "1.234" / "1,234" may be a thousands group (vi / en) or three decimals.
 */
function markOf(s: string): DecimalMark | null {
  const dot = s.lastIndexOf('.');
  const comma = s.lastIndexOf(',');
  if (dot >= 0 && comma >= 0) return dot > comma ? '.' : ',';
  const sep = dot >= 0 ? '.' : comma >= 0 ? ',' : null;
  if (!sep) return null;
  const parts = s.replace(/^-/, '').split(sep);
  if (parts.length > 2) return sep === '.' ? ',' : '.'; // repeated mark: thousands groups
  const [int = '', frac = ''] = parts;
  if (frac.length !== 3 || int.length > 3 || /^0*$/.test(int)) return sep;
  return null;
}

/**
 * Decimal mark used by a whole column, from the cells that can tell (majority).
 * Deciding per column avoids reading "101.821" as 101821 when other cells such as
 * "109.7843" show the column uses a decimal point, and "7,497" as 7.497 when cells
 * such as "1,411,058" show commas are thousands separators.
 */
export function decimalMark(cells: Raw[]): DecimalMark | null {
  let dot = 0;
  let comma = 0;
  for (const cell of cells) {
    if (typeof cell !== 'string') continue;
    const s = clean(cell);
    if (!NUMERIC.test(s)) continue;
    const mark = markOf(s);
    if (mark === '.') dot++;
    else if (mark === ',') comma++;
  }
  if (dot === 0 && comma === 0) return null;
  return dot >= comma ? '.' : ',';
}

/**
 * Read a cell as a number. `mark` is the column's decimal mark (see decimalMark);
 * without it, an ambiguous "1.234" or "1,234" follows the Vietnamese convention
 * (dot for thousands, comma for decimals).
 */
export function parseNumber(cell: Raw, mark: DecimalMark | null = null): number | null {
  if (typeof cell === 'number') return Number.isFinite(cell) ? cell : null;
  if (typeof cell !== 'string') return null;
  const s = clean(cell);
  if (!s) return null;
  if (!NUMERIC.test(s)) {
    const v = Number(s);
    return Number.isFinite(v) ? v : null;
  }
  const decimal = markOf(s) ?? mark ?? ',';
  const normal = decimal === '.' ? s.replace(/,/g, '') : s.replace(/\./g, '').replace(',', '.');
  const v = Number(normal);
  return Number.isFinite(v) ? v : null;
}

/** Read a column of cells with one decimal mark for the whole column. */
export function parseNumbers(cells: Raw[]): (number | null)[] {
  const mark = decimalMark(cells);
  return cells.map((c) => parseNumber(c, mark));
}
