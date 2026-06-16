import { Timestamp } from 'firebase/firestore';
import { convertTimestampsToDates } from './date-converter';

describe('convertTimestampsToDates', () => {
  it('should return null/undefined as-is', () => {
    expect(convertTimestampsToDates(null)).toBeNull();
    expect(convertTimestampsToDates(undefined)).toBeUndefined();
  });

  it('should convert a Firestore Timestamp to a Date', () => {
    const ts = Timestamp.fromDate(new Date('2024-01-15'));
    const result = convertTimestampsToDates(ts);
    expect(result).toBeInstanceOf(Date);
    expect((result as Date).getFullYear()).toBe(2024);
  });

  it('should recursively convert Timestamps inside an array', () => {
    const ts = Timestamp.fromDate(new Date('2024-06-01'));
    const result = convertTimestampsToDates([ts, 'string', 42]) as unknown[];
    expect(result[0]).toBeInstanceOf(Date);
    expect(result[1]).toBe('string');
    expect(result[2]).toBe(42);
  });

  it('should recursively convert Timestamps inside a plain object', () => {
    const ts = Timestamp.fromDate(new Date('2024-03-10'));
    const input = { createdAt: ts, name: 'test', count: 5 };
    const result = convertTimestampsToDates(input) as Record<string, unknown>;
    expect(result['createdAt']).toBeInstanceOf(Date);
    expect(result['name']).toBe('test');
    expect(result['count']).toBe(5);
  });

  it('should return primitive values unchanged', () => {
    expect(convertTimestampsToDates('hello')).toBe('hello');
    expect(convertTimestampsToDates(42)).toBe(42);
    expect(convertTimestampsToDates(true)).toBe(true);
  });

  it('should handle nested objects with Timestamps', () => {
    const ts = Timestamp.fromDate(new Date('2024-01-01'));
    const input = { order: { createdAt: ts, items: [{ date: ts }] } };
    const result = convertTimestampsToDates(input) as {
      order: { createdAt: unknown; items: Array<{ date: unknown }> };
    };
    expect(result.order.createdAt).toBeInstanceOf(Date);
    expect(result.order.items[0].date).toBeInstanceOf(Date);
  });
});
