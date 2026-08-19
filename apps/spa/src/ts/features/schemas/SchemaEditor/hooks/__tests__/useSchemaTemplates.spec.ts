import { describe, it, expect } from 'vitest';
import { useSchemaTemplates } from '../useSchemaTemplates';

describe('useSchemaTemplates', () => {
  it('provides atomic bricks and identifies atomic fields', () => {
    const templates = useSchemaTemplates();

    expect(templates.atomicBricks.length).toBeGreaterThan(0);
    expect(templates.isAtomicField({ type: 'text' })).toBe(true);
    expect(templates.isAtomicField({ type: 'tags' })).toBe(true);
    expect(templates.isAtomicField({ type: 'range' })).toBe(true);
    expect(templates.isAtomicField({ type: 'custom_module' })).toBe(false);
  });

  it('computes timeline and dynamic templates from uiEditorData', () => {
    const templates = useSchemaTemplates();

    expect(typeof templates.timelineTemplates.value).toBe('object');
    expect(typeof templates.dynamicTemplates.value).toBe('object');
  });
});
