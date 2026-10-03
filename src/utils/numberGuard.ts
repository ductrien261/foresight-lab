/** Parse numbers written the Vietnamese way (1.457,18 · 4,3% · −114) or the English way (1457.18). */
export function extractNumbers(text: string): { value: number; decimals: number }[] {
  const out: { value: number; decimals: number }[] = [];
  const re = /[-−]?\d{1,3}(?:[.\s]\d{3})+(?:,\d+)?|[-−]?\d+(?:[.,]\d+)?/g;
  for (const match of text.matchAll(re)) {
    let raw = match[0].replace('−', '-').replace(/\s/g, '');
    if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(raw)) raw = raw.replace(/\./g, '').replace(',', '.');
    else raw = raw.replace(',', '.');
    const value = Number(raw);
    if (Number.isFinite(value)) out.push({ value, decimals: raw.split('.')[1]?.length ?? 0 });
  }
  return out;
}

function collect(value: unknown, into: number[]): void {
  if (typeof value === 'number') into.push(value);
  else if (Array.isArray(value)) value.forEach((v) => collect(v, into));
  else if (value && typeof value === 'object') Object.values(value).forEach((v) => collect(v, into));
}

/**
 * Every number in an AI answer must come from the data it was given (allowing rounding
 * and the same value shown as a percentage). Years and small counts are allowed.
 */
export function findUnsupportedNumbers(answer: string, context: unknown): number[] {
  const known: number[] = [];
  collect(context, known);
  const candidates = known.flatMap((k) => [k, Math.abs(k), k * 100]);
  return extractNumbers(answer)
    .filter(({ value, decimals }) => {
      const v = Math.abs(value);
      if (Number.isInteger(value) && v >= 1900 && v <= 2100) return false;
      if (Number.isInteger(value) && v <= 12) return false;
      const tol = 0.5 * 10 ** -decimals + 1e-9;
      return !candidates.some((k) => Math.abs(Math.abs(k) - v) <= Math.max(tol, Math.abs(k) * 0.005));
    })
    .map((n) => n.value);
}
