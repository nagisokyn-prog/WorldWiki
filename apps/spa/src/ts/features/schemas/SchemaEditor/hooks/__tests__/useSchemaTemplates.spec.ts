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
    // Line 47: null & undefined checks
    expect(templates.isAtomicField(null)).toBe(false);
    expect(templates.isAtomicField(undefined)).toBe(false);
  });

  it('computes timeline and dynamic templates from uiEditorData', () => {
    const templates = useSchemaTemplates();

    expect(typeof templates.timelineTemplates.value).toBe('object');
    expect(typeof templates.dynamicTemplates.value).toBe('object');
  });

  it('filters helper templates and correctly classifies timeline vs dynamic templates', async () => {
    const templates = useSchemaTemplates();

    // Verify helper templates are excluded
    expect(templates.timelineTemplates.value['dynamicEndDateTemplate']).toBeUndefined();
    expect(templates.dynamicTemplates.value['dynamicEndDateTemplate']).toBeUndefined();

    // Check that keys in timelineTemplates have type === 'timeline'
    Object.values(templates.timelineTemplates.value).forEach((tpl: any) => {
      expect(tpl.type).toBe('timeline');
    });

    // Check that keys in dynamicTemplates have type === 'dynamic'
    Object.values(templates.dynamicTemplates.value).forEach((tpl: any) => {
      expect(tpl.type).toBe('dynamic');
    });
  });

  it('handles empty uiEditorData.templates fallback', async () => {
    vi.resetModules();
    vi.doMock('../../../../../../../public/struct/editor/ui_editor.json', () => ({
      default: {},
    }));
    const { useSchemaTemplates: useSchemaTemplatesMocked } = await import('../useSchemaTemplates');
    const mockedTpl = useSchemaTemplatesMocked();
    expect(mockedTpl.timelineTemplates.value).toEqual({});
    expect(mockedTpl.dynamicTemplates.value).toEqual({});
    vi.resetModules();
  });
});
