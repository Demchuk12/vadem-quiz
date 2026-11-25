import { formatNumber, parseNumber } from './numbers';

describe('numbers', () => {
  it('reads numbers the way people type them', () => {
    expect(parseNumber('1 234,5', 'uk')).toBe(1234.5);
    expect(parseNumber('1 234 567', 'uk')).toBe(1234567);
    expect(parseNumber('1,234.5', 'uk')).toBe(1234.5);
    expect(parseNumber('1.234,5', 'en')).toBe(1234.5);
    expect(parseNumber('1,234,567', 'uk')).toBe(1234567);
    expect(parseNumber('1.234.567', 'en')).toBe(1234567);
    expect(parseNumber(' −3 ', 'uk')).toBe(-3);
    expect(parseNumber('.5', 'en')).toBe(0.5);
    expect(parseNumber('0', 'uk')).toBe(0);
  });

  it('reads a lone comma by the language', () => {
    expect(parseNumber('1,234', 'uk')).toBe(1.234);
    expect(parseNumber('1,234', 'en')).toBe(1234);
    expect(parseNumber('1,5', 'en')).toBe(1.5);
  });

  it('refuses what is not a number', () => {
    for (const text of ['', '-', '.', 'abc', '12км', '1e5', '1,2.3,4', '--5', 'Infinity']) {
      expect(parseNumber(text, 'uk'), text).toBeNull();
    }
  });

  it('groups long numbers but leaves a year alone', () => {
    expect(formatNumber(1969, 'uk')).toBe('1969');
    expect(formatNumber(1234567.5, 'en')).toBe('1,234,567.5');
    expect(formatNumber(-12345, 'en')).toBe('−12,345');
    expect(formatNumber(12345, 'uk').replace(/\s/g, ' ')).toBe('12 345');
  });
});
