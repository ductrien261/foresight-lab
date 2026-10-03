import { extractNumbers, findUnsupportedNumbers } from './numberGuard';

describe('number guard for AI answers', () => {
  it('reads Vietnamese and English number formats', () => {
    expect(extractNumbers('1.457,18 tỷ kWh, tăng 4,3% và 1916.63').map((n) => n.value)).toEqual([
      1457.18, 4.3, 1916.63,
    ]);
  });

  it('accepts rounded values and percentages present in the data', () => {
    const ctx = { end: 1916.63, growth: 0.0468, years: [2025, 2030] };
    expect(findUnsupportedNumbers('Năm 2030 đạt khoảng 1.917 tỷ kWh, tăng 4,7%/năm.', ctx)).toEqual([]);
  });

  it('flags numbers the data does not contain', () => {
    const ctx = { end: 1916.63 };
    expect(findUnsupportedNumbers('Nhu cầu sẽ đạt 2.400 tỷ kWh.', ctx)).toEqual([2400]);
  });
});
