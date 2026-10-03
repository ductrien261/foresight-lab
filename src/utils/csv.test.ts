import { parseCsv } from './csv';
import { sheetToSeries } from './excel';

describe('CSV parsing', () => {
  it('strips quotes around cells (AirPassengers)', () => {
    expect(parseCsv('"Month","Passengers"\n"1949-01",112\n"1949-02",118\n')).toEqual([
      ['Month', 'Passengers'],
      ['1949-01', '112'],
      ['1949-02', '118'],
    ]);
  });

  it('keeps delimiters, doubled quotes and CRLF inside quoted cells', () => {
    expect(parseCsv('\uFEFFPeriod,Total,Note\r\n2016,"1,411,058","a ""b"""\r\n')).toEqual([
      ['Period', 'Total', 'Note'],
      ['2016', '1,411,058', 'a "b"'],
    ]);
  });

  it('guesses semicolon and tab delimiters', () => {
    expect(parseCsv('Tháng;Điện\n2020-01;1.234,5')).toEqual([['Tháng', 'Điện'], ['2020-01', '1.234,5']]);
    expect(parseCsv('a\tb\n1\t2')).toEqual([['a', 'b'], ['1', '2']]);
  });

  it('reads a FRED file without inflating values with three decimals', () => {
    const text = 'observation_date,IPG2211A2N\n2005-01-01,109.7843\n2005-02-01,101.821\n2005-03-01,100.4265\n';
    const [series] = sheetToSeries('fred.csv', parseCsv(text));
    expect(series?.values).toEqual([109.7843, 101.821, 100.4265]);
  });
});
