import { describe, expect, it } from 'vitest';
import { parsePolarCsv } from './polarCsv';

const sample = `twa/tws;4;6;8;10;12;14;16;20;24
52;3.57;5.06;6.07;6.58;6.87;7.02;7.12;7.23;7.21
60;3.84;5.35;6.29;6.77;7.15;7.34;7.47;7.62;7.65
75;4.03;5.54;6.41;6.94;7.44;7.85;8.07;8.37;8.54
90;3.97;5.64;6.64;7.2;7.55;8.06;8.64;9.29;9.75
110;4.06;5.76;6.8;7.6;8.38;8.94;9.47;10.67;11.85
120;3.94;5.62;6.68;7.51;8.4;9.4;10.24;11.89;13.43
135;3.49;5.05;6.23;7;7.79;8.81;10.22;13.58;15.52
150;2.89;4.24;5.4;6.31;6.99;7.65;8.54;11.78;15.28
`;

describe('parsePolarCsv', () => {
  it('parses the windregatta/ORC CSV format', () => {
    const polar = parsePolarCsv(sample, 'Marea SUI 20 2026');
    expect(polar.name).toBe('Marea SUI 20 2026');
    expect(polar.twsValues).toEqual([4, 6, 8, 10, 12, 14, 16, 20, 24]);
    expect(polar.twaValues).toEqual([52, 60, 75, 90, 110, 120, 135, 150]);
    expect(polar.speeds).toHaveLength(8);
    expect(polar.speeds[0]).toEqual([3.57, 5.06, 6.07, 6.58, 6.87, 7.02, 7.12, 7.23, 7.21]);
    expect(polar.speeds[3][0]).toBe(3.97);
  });

  it('accepts comma decimal separators and CRLF line endings', () => {
    const csv = 'twa/tws;4;8\r\n52;3,57;6,07\r\n90;3,97;6,64\r\n';
    const polar = parsePolarCsv(csv);
    expect(polar.twsValues).toEqual([4, 8]);
    expect(polar.speeds).toEqual([
      [3.57, 6.07],
      [3.97, 6.64],
    ]);
  });

  it('ignores blank trailing lines', () => {
    const csv = 'twa/tws;4;8\n52;3.57;6.07\n\n\n';
    const polar = parsePolarCsv(csv);
    expect(polar.twaValues).toEqual([52]);
  });

  it('throws on a row with the wrong number of columns', () => {
    const csv = 'twa/tws;4;8\n52;3.57\n';
    expect(() => parsePolarCsv(csv)).toThrow(/columns/);
  });

  it('throws on a header with no TWS columns', () => {
    expect(() => parsePolarCsv('twa/tws\n52;3.57\n')).toThrow(/TWS columns/);
  });

  it('throws on an invalid number', () => {
    const csv = 'twa/tws;4;8\n52;abc;6.07\n';
    expect(() => parsePolarCsv(csv)).toThrow(/Invalid number/);
  });
});
