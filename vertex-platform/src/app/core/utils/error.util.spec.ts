import { errorMessage } from './error.util';
import { describe, it, expect } from 'vitest';

describe('error.util', () => {
  it('extracts message from standard Error object', () => {
    expect(errorMessage(new Error('Test error message'))).toBe('Test error message');
  });

  it('extracts message from string literal error', () => {
    expect(errorMessage('Direct error string')).toBe('Direct error string');
  });

  it('extracts message from object with message property', () => {
    expect(errorMessage({ message: 'Object error message' })).toBe('Object error message');
  });

  it('returns fallback string when error is null or undefined', () => {
    expect(errorMessage(null)).toBe('Ha ocurrido un error.');
    expect(errorMessage(undefined, 'Custom fallback')).toBe('Custom fallback');
  });

  it('returns fallback string when error is a number or boolean', () => {
    expect(errorMessage(404)).toBe('Ha ocurrido un error.');
    expect(errorMessage(false, 'Fallback for boolean')).toBe('Fallback for boolean');
  });
});
