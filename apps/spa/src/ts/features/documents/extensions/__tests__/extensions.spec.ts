import { describe, expect, it } from 'vitest';
import { createDocumentEditorExtensions } from '../index';

describe('DocumentEditorExtensions', () => {
  it('creates full set of document editor extensions', () => {
    const extensions = createDocumentEditorExtensions({
      defaultAlignment: 'justify',
      defaultLineHeight: '1.5',
      defaultFirstLineIndent: '12.5mm'
    });

    expect(extensions.length).toBeGreaterThanOrEqual(8);

    const names = extensions.map((ext: { name?: string }) => ext.name);
    expect(names).toContain('textAlign');
    expect(names.some(n => n?.toLowerCase() === 'mathematics')).toBe(true);
    expect(names).toContain('lineHeight');
    expect(names).toContain('textIndent');
    expect(names).toContain('figure');
    expect(names).toContain('footnote_reference');
    expect(names).toContain('cross_reference');
    expect(names.some(n => n?.toLowerCase().includes('pagination'))).toBe(true);
    expect(names.some(n => n?.toLowerCase().includes('ruler'))).toBe(true);
  });
});
