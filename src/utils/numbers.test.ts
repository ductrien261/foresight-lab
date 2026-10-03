import { decimalMark, parseNumber, parseNumbers } from './numbers';

describe('number parsing', () => {
  it('reads a cell on its own when it can tell the decimal mark', () => {
    expect(parseNumber('1.234,5')).toBe(1234.5);
    expect(parseNumber('1,234.5')).toBe(1234.5);
    expect(parseNumber('1,411,058')).toBe(1411058);
    expect(parseNumber('1.411.058')).toBe(1411058);
    expect(parseNumber('109.7843')).toBe(109.7843);
    expect(parseNumber('0.125')).toBe(0.125);
    expect(parseNumber('-12,5')).toBe(-12.5);
    expect(parseNumber('120 tỷ')).toBeNull();
    expect(parseNumber(42)).toBe(42);
  });

  it('keeps the Vietnamese reading for an ambiguous cell without column context', () => {
    expect(parseNumber('1.234')).toBe(1234);
    expect(parseNumber('1,234')).toBe(1.234);
  });

  it('reads "101.821" as a decimal in a column that uses decimal points (FRED)', () => {
    const cells = ['109.7843', '101.821', '100.4265', '98.5'];
    expect(decimalMark(cells)).toBe('.');
    expect(parseNumbers(cells)).toEqual([109.7843, 101.821, 100.4265, 98.5]);
  });

  it('reads "7,497" as thousands in a column that uses comma thousands (EIA)', () => {
    const cells = ['7,497', '1,411,058', '6,334', '976,715'];
    expect(decimalMark(cells)).toBe('.');
    expect(parseNumbers(cells)).toEqual([7497, 1411058, 6334, 976715]);
  });

  it('reads Vietnamese columns', () => {
    const cells = ['1.234,5', '2.345', '12,75'];
    expect(decimalMark(cells)).toBe(',');
    expect(parseNumbers(cells)).toEqual([1234.5, 2345, 12.75]);
  });
});
