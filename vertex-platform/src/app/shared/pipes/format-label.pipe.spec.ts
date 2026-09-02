import { FormatLabelPipe } from './format-label.pipe';

describe('FormatLabelPipe', () => {
  let pipe: FormatLabelPipe;

  beforeEach(() => {
    pipe = new FormatLabelPipe();
  });

  it('should keep versions as-is (v0.5.0, 0.4.0)', () => {
    expect(pipe.transform('v0.5.0')).toBe('v0.5.0');
    expect(pipe.transform('0.4.0')).toBe('0.4.0');
  });

  it('should convert slug/technical ids to readable Title Case', () => {
    expect(pipe.transform('lobo-suelto')).toBe('Lobo Suelto');
    expect(pipe.transform('ropa-de-hombre')).toBe('Ropa De Hombre');
    expect(pipe.transform('stable')).toBe('Stable');
    expect(pipe.transform('beta')).toBe('Beta');
  });

  it('should capitalize plain text words and handle multiple underscores or spaces', () => {
    expect(pipe.transform('ropa de hombre')).toBe('Ropa De Hombre');
    expect(pipe.transform('__custom__slug__')).toBe('Custom Slug');
    expect(pipe.transform('1.2')).toBe('1.2');
  });

  it('should handle empty/null/undefined and whitespace strings', () => {
    expect(pipe.transform('')).toBe('');
    expect(pipe.transform('   ')).toBe('');
    expect(pipe.transform(null)).toBe('');
    expect(pipe.transform(undefined)).toBe('');
    expect(pipe.transform('v2.0.1-alpha')).toBe('v2.0.1-alpha');
  });
});
