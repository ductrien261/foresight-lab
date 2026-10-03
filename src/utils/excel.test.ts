import { parseNumber, parsePeriod, sheetToSeries } from './excel';

describe('excel parsing', () => {
  it('reads periods written in many ways', () => {
    expect(parsePeriod(2009)?.label).toBe('2009');
    expect(parsePeriod('2009Q3')?.label).toBe('2009Q3');
    expect(parsePeriod('Tháng 1/2020')?.label).toBe('2020-01');
    expect(parsePeriod('2020M02')?.label).toBe('2020-02');
    expect(parsePeriod(new Date(Date.UTC(2021, 11, 1)))?.label).toBe('2021-12');
    expect(parsePeriod('abc')).toBeNull();
  });

  it('reads Vietnamese and English numbers', () => {
    expect(parseNumber('1.234,5')).toBe(1234.5);
    expect(parseNumber('1,234.5')).toBe(1234.5);
    expect(parseNumber('12,5')).toBe(12.5);
    expect(parseNumber('120 tỷ')).toBeNull();
  });

  it('decides the decimal mark per column, not per cell', () => {
    const rows = [
      ['Tháng', 'Điện', 'Vận tải'],
      ['2020-01', '109.7843', '7,497'],
      ['2020-02', '101.821', '1,411,058'],
      ['2020-03', '100.5', '6,334'],
    ];
    const [elec, transport] = sheetToSeries('Thang', rows);
    expect(elec!.values).toEqual([109.7843, 101.821, 100.5]);
    expect(transport!.values).toEqual([7497, 1411058, 6334]);
  });

  it('finds the header row, the time column and numeric columns', () => {
    const rows = [
      ['Bảng số liệu', null, null],
      ['Năm', 'Năng lượng', 'Ghi chú'],
      [2009, 462.68, 'x'],
      [2010, 535.32, 'y'],
      [2011, '590,23', 'z'],
    ];
    const series = sheetToSeries('Nam', rows);
    expect(series).toHaveLength(1);
    expect(series[0]).toMatchObject({
      column: 'Năng lượng',
      freq: 'annual',
      periods: ['2009', '2010', '2011'],
    });
    expect(series[0]!.values).toEqual([462.68, 535.32, 590.23]);
  });

  it('turns a wide table (years as columns) into series', () => {
    const rows = [
      ['Chỉ tiêu', 2019, 2020, 2021, 2022],
      ['GDP', 1, 2, 3, 4],
    ];
    const [gdp] = sheetToSeries('Rong', rows);
    expect(gdp).toMatchObject({ column: 'GDP', freq: 'annual', periods: ['2019', '2020', '2021', '2022'] });
  });
});
