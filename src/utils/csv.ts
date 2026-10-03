const DELIMITERS = [',', ';', '\t'] as const;

/** Delimiter that appears most often outside quotes on the first non-empty line. */
function guessDelimiter(text: string): string {
  const line = text.split(/\r?\n/).find((l) => l.trim()) ?? '';
  const counts = new Map<string, number>(DELIMITERS.map((d) => [d, 0]));
  let isQuoted = false;
  for (const ch of line) {
    if (ch === '"') isQuoted = !isQuoted;
    else if (!isQuoted && counts.has(ch)) counts.set(ch, counts.get(ch)! + 1);
  }
  return [...counts].reduce((best, cur) => (cur[1] > best[1] ? cur : best))[0];
}

/**
 * Split CSV text into rows of trimmed cells (RFC 4180): quoted fields may hold the
 * delimiter, line breaks and doubled quotes, e.g. "1,411,058" or "Month".
 * The delimiter (comma, semicolon or tab) is guessed from the first line.
 */
export function parseCsv(input: string): string[][] {
  const text = input.replace(/^\uFEFF/, '');
  const delim = guessDelimiter(text);
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let isQuoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (isQuoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') {
        isQuoted = false;
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      isQuoted = true;
    } else if (ch === delim) {
      row.push(cell.trim());
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell.trim());
      rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += ch;
    }
  }
  if (cell || row.length) {
    row.push(cell.trim());
    rows.push(row);
  }
  return rows;
}
