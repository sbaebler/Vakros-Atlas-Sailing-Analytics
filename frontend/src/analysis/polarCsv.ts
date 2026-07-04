// Import for ORC-style polar CSVs (e.g. windregatta.com's "download CSV" export):
// a header row "twa/tws;<tws...>" followed by rows of "<twa>;<speed...>",
// semicolon-delimited. Some exports use a comma as the decimal separator.

import { Polar } from './polar';

function parseNumber(cell: string): number {
  const s = cell.trim();
  const n = /^\d+,\d+$/.test(s) ? parseFloat(s.replace(',', '.')) : parseFloat(s);
  if (!Number.isFinite(n)) throw new Error(`Invalid number: "${cell}"`);
  return n;
}

export function parsePolarCsv(text: string, name = 'Imported polar'): Polar {
  const lines = text
    .split(/\r\n|\r|\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length < 2) {
    throw new Error('CSV must have a header row and at least one data row');
  }

  const [header, ...rows] = lines;
  const headerCells = header.split(';').map((c) => c.trim());
  const twsValues = headerCells.slice(1).map(parseNumber);
  if (twsValues.length === 0) {
    throw new Error('Header row must list TWS columns, e.g. "twa/tws;4;6;8"');
  }

  const twaValues: number[] = [];
  const speeds: number[][] = [];
  for (const row of rows) {
    const cells = row.split(';').map((c) => c.trim());
    if (cells.length !== twsValues.length + 1) {
      throw new Error(`Row "${row}" has ${cells.length} columns, expected ${twsValues.length + 1}`);
    }
    twaValues.push(parseNumber(cells[0]));
    speeds.push(cells.slice(1).map(parseNumber));
  }

  return { name, twsValues, twaValues, speeds };
}
