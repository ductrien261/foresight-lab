import { parseCsv } from './csv';
import { parseNumbers, type Raw } from './numbers';

export { parseNumber } from './numbers';

export type Frequency = 'annual' | 'quarterly' | 'monthly';

export interface ParsedSeries {
  id: string;
  sheet: string;
  column: string;
  freq: Frequency;
  periods: string[];
  values: (number | null)[];
}

interface Period {
  key: number;
  freq: Frequency;
  label: string;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Read a cell as a period: 2009, 2009Q1, 2009-01, 01/2009, Tháng 1/2009, or an Excel date. */
export function parsePeriod(cell: Raw): Period | null {
  if (cell instanceof Date && !Number.isNaN(cell.getTime())) {
    const y = cell.getUTCFullYear();
    const m = cell.getUTCMonth() + 1;
    return { key: y * 12 + m - 1, freq: 'monthly', label: `${y}-${pad(m)}` };
  }
  if (typeof cell === 'number' && Number.isInteger(cell) && cell >= 1900 && cell <= 2100) {
    return { key: cell * 12, freq: 'annual', label: String(cell) };
  }
  if (typeof cell !== 'string') return null;
  const s = cell.trim().replace(/^(tháng|thang|t)\s*/i, '');
  let m = /^(\d{4})$/.exec(s);
  if (m) return { key: Number(m[1]) * 12, freq: 'annual', label: m[1]! };
  m = /^(\d{4})\s*[-/ ]?\s*[Qq]([1-4])$/.exec(s) ?? /^[Qq]([1-4])\s*[-/ ]\s*(\d{4})$/.exec(s);
  if (m) {
    const [y, q] = m[1]!.length === 4 ? [Number(m[1]), Number(m[2])] : [Number(m[2]), Number(m[1])];
    return { key: y * 12 + (q - 1) * 3, freq: 'quarterly', label: `${y}Q${q}` };
  }
  m = /^(\d{4})\s*[-/.M]\s*(\d{1,2})(?:[-/.]\d{1,2})?$/.exec(s);
  if (m && Number(m[2]) >= 1 && Number(m[2]) <= 12) {
    return {
      key: Number(m[1]) * 12 + Number(m[2]) - 1,
      freq: 'monthly',
      label: `${m[1]}-${pad(Number(m[2]))}`,
    };
  }
  m = /^(\d{1,2})\s*[-/.]\s*(\d{4})$/.exec(s);
  if (m && Number(m[1]) >= 1 && Number(m[1]) <= 12) {
    return {
      key: Number(m[2]) * 12 + Number(m[1]) - 1,
      freq: 'monthly',
      label: `${m[2]}-${pad(Number(m[1]))}`,
    };
  }
  return null;
}

function headerRow(rows: Raw[][]): number {
  for (let r = 0; r < Math.min(rows.length, 10); r++) {
    const texts = (rows[r] ?? []).filter((c) => typeof c === 'string' && c.trim() && parsePeriod(c) === null);
    if (texts.length >= 2) return r;
  }
  return -1;
}

/** Long tables (one row per period) and wide tables (one column per year) are both accepted. */
export function sheetToSeries(sheet: string, rows: Raw[][]): ParsedSeries[] {
  const h = headerRow(rows);
  const body = rows.slice(h + 1).filter((r) => r.some((c) => c !== null && c !== undefined && c !== ''));
  const header = h >= 0 ? (rows[h] ?? []) : [];
  const width = Math.max(header.length, ...body.map((r) => r.length));

  for (let c = 0; c < width; c++) {
    const periods = body.map((r) => parsePeriod(r[c]));
    const hits = periods.filter((p): p is Period => p !== null);
    if (hits.length < Math.max(3, body.length * 0.8)) continue;
    const freq = hits[0]!.freq;
    if (!hits.every((p) => p.freq === freq)) continue;
    const out: ParsedSeries[] = [];
    for (let v = 0; v < width; v++) {
      if (v === c) continue;
      const values = parseNumbers(body.map((r) => r[v]));
      if (values.filter((x) => x !== null).length < hits.length * 0.5) continue;
      const name = String(header[v] ?? `Cột ${v + 1}`).trim();
      out.push({
        id: `${sheet}::${name}::${v}`,
        sheet,
        column: name,
        freq,
        periods: periods.map((p) => p?.label ?? ''),
        values,
      });
    }
    if (out.length) return out.map((sr) => dropBlankPeriods(sr));
  }

  const wh = rows.slice(0, 10).findIndex((r) => r.filter((cell) => parsePeriod(cell) !== null).length >= 4);
  if (wh >= 0) {
    const wide = (rows[wh] ?? []).map((cell) => parsePeriod(cell));
    const cols = wide.map((p, i) => ({ p, i })).filter((x): x is { p: Period; i: number } => x.p !== null);
    return rows.slice(wh + 1).flatMap((r, ri) => {
      const name = String(r[0] ?? `Dòng ${ri + 1}`).trim();
      const values = parseNumbers(cols.map(({ i }) => r[i]));
      if (values.filter((x) => x !== null).length < 3) return [];
      return [
        {
          id: `${sheet}::${name}::r${ri}`,
          sheet,
          column: name,
          freq: cols[0]!.p.freq,
          periods: cols.map((x) => x.p.label),
          values,
        },
      ];
    });
  }
  return [];
}

function dropBlankPeriods(s: ParsedSeries): ParsedSeries {
  const keep = s.periods.map((p) => p !== '');
  return { ...s, periods: s.periods.filter((_, i) => keep[i]), values: s.values.filter((_, i) => keep[i]) };
}

export async function readWorkbook(file: File): Promise<ParsedSeries[]> {
  if (file.name.toLowerCase().endsWith('.csv')) {
    return sheetToSeries(file.name, parseCsv(await file.text()));
  }
  const { default: readExcelFile } = await import('read-excel-file/browser');
  const sheets = await readExcelFile(file);
  return sheets.flatMap((s) => sheetToSeries(s.sheet, s.data as Raw[][]));
}
