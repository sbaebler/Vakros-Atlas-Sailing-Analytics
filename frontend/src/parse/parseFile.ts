// Parse an uploaded file into a ParsedTrack by extension. VKX and CSV parsing are fast
// enough (a full session decodes in a few milliseconds) to run on the main thread.

import { parseCsv } from './csv';
import { ParsedTrack } from './types';
import { parseVkx } from './vkx';

export async function parseFile(file: File): Promise<ParsedTrack> {
  const name = file.name.toLowerCase();
  if (name.endsWith('.vkx')) {
    return parseVkx(await file.arrayBuffer());
  }
  if (name.endsWith('.csv')) {
    return parseCsv(await file.text());
  }
  throw new Error('Nicht unterstütztes Format – bitte eine .vkx- oder .csv-Datei wählen.');
}
