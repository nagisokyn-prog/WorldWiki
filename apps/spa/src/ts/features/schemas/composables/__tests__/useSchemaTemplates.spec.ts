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
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ templates: {} })
    } as any);
    const { useSchemaTemplates: useSchemaTemplatesMocked } = await import('../useSchemaTemplates');
    const mockedTpl = useSchemaTemplatesMocked();
    expect(mockedTpl.timelineTemplates.value).toEqual({});
    expect(mockedTpl.dynamicTemplates.value).toEqual({});

    // Mount with populated templates
    const { defineComponent } = await import('vue');
    const { mount, flushPromises } = await import('@vue/test-utils');
    vi.resetModules();
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          templates: {
            'Базовая хронология': { type: 'timeline', fields: [] },
            'Динамический элемент': { type: 'dynamic', fields: [] },
          },
        }),
    } as any);
    const { useSchemaTemplates: useMountedTpl } = await import('../useSchemaTemplates');
    let apiHook!: ReturnType<typeof useMountedTpl>;
    const Comp = defineComponent({
      setup() {
        apiHook = useMountedTpl();
        return {};
      },
      template: '<div />',
    });
    const w = mount(Comp);
    await flushPromises();
    expect(Object.keys(apiHook.timelineTemplates.value)).toEqual(['Базовая хронология']);
    expect(Object.keys(apiHook.dynamicTemplates.value)).toEqual(['Динамический элемент']);
    w.unmount();

    // Error catch
    vi.resetModules();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    globalThis.fetch = vi.fn().mockRejectedValueOnce(new Error('net err'));
    const { useSchemaTemplates: useErrTpl } = await import('../useSchemaTemplates');
    const wErr = mount(
      defineComponent({
        setup() {
          useErrTpl();
          return {};
        },
        template: '<div />',
      })
    );
    await flushPromises();
    expect(warnSpy).toHaveBeenCalled();
    wErr.unmount();
    warnSpy.mockRestore();

    globalThis.fetch = originalFetch;
    vi.resetModules();
  });
});
