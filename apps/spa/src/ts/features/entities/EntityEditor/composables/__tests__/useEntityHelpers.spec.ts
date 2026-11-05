import { describe, it, expect, beforeEach } from 'vitest';
import { ref } from 'vue';
import { useEntityHelpers } from '../useEntityHelpers';

describe('useEntityHelpers', () => {
  let formData: any;
  let config: any;

  beforeEach(() => {
    formData = ref({
      name: 'Arthur',
      profile: {
        title: 'King',
        stats: { hp: 100 },
      },
    });
    config = ref({
      templates: {
        roleTpl: {
          fields: [
            { class: 'role', label: 'Role' },
            { class: 'secret', label: 'Secret' },
          ],
        },
      },
    });
  });

  it('gets property by path or fallback with single and multiple arguments', () => {
    const helpers = useEntityHelpers(formData, config);

    expect(helpers.getProp('name')).toBe('Arthur');
    expect(helpers.getProp('profile.title')).toBe('King');
    expect(helpers.getProp('profile.stats.hp')).toBe(100);
    expect(helpers.getProp('profile.missing')).toBeUndefined();
    expect(helpers.getProp('')).toBe('');

    // Custom object
    const custom = { user: { name: 'Galahad' } };
    expect(helpers.getProp(custom, 'user.name')).toBe('Galahad');
    expect(helpers.getProp(null, 'user.name')).toBe('');
    expect(helpers.getProp(custom, '')).toBe('');
  });

  it('sets property by nested path with single and multiple arguments', () => {
    const helpers = useEntityHelpers(formData, config);

    helpers.setProp('profile.stats.mp', 50);
    expect(formData.value.profile.stats.mp).toBe(50);

    helpers.setProp('newGroup.sub.val', 'hello');
    expect(formData.value.newGroup.sub.val).toBe('hello');

    // Empty path does nothing
    helpers.setProp('', 123);
    helpers.setProp(null, '', 123);

    // Custom object
    const custom: any = {};
    helpers.setProp(custom, 'a.b.c', 999);
    expect(custom.a.b.c).toBe(999);
  });

  it('caches photo URLs and handles blob/data/http', async () => {
    const helpers = useEntityHelpers(formData, config);

    expect(helpers.getPhotoUrl('')).toBe('');
    expect(helpers.getPhotoUrl('http://example.com/pic.jpg')).toBe('http://example.com/pic.jpg');
    expect(helpers.getPhotoUrl('blob:http://example.com/uuid')).toBe('blob:http://example.com/uuid');
    expect(helpers.getPhotoUrl('data:image/png;base64,123')).toBe('data:image/png;base64,123');

    helpers.getPhotoUrl('local/path.png');
    await Promise.resolve();
    expect(helpers.getPhotoUrl('local/path.png')).toBe('local/path.png');
  });

  it('resolves template with container fields, template lookup, overrides, and missing template', () => {
    const helpers = useEntityHelpers(formData, config);

    // Template lookup with overrides (and un-overridden field for line 85)
    config.value.templates!.roleTpl.fields!.push({ class: 'unmodified', label: 'Keep As Is' });
    const container = {
      template: 'roleTpl',
      fieldOverrides: {
        role: { label: 'Primary Role' },
        secret: { hidden: true },
      },
    };
    const resolved = helpers.getResolvedTemplate(container);
    expect(resolved?.fields?.length).toBe(2);
    expect(resolved?.fields?.[0]).toEqual({
      class: 'role',
      label: 'Primary Role',
    });
    expect(resolved?.fields?.[1]?.class).toBe('unmodified');

    // Container with direct fields and no template
    const directContainer = {
      fields: [{ class: 'directField', label: 'Direct' }],
    };
    const resolvedDirect = helpers.getResolvedTemplate(directContainer as any);
    expect(resolvedDirect?.fields?.length).toBe(1);

    // Missing template in config
    const unknownTpl = { template: 'unknownTpl' };
    expect(helpers.getResolvedTemplate(unknownTpl)).toBeNull();

    // Template without fields and field without class (covers lines 76, 80)
    config.value.templates!.emptyTpl = {};
    const resEmpty = helpers.getResolvedTemplate({ template: 'emptyTpl', fieldOverrides: { f1: { hidden: true } } });
    expect(resEmpty?.fields).toEqual([]);

    config.value.templates!.noClassTpl = { fields: [{ label: 'No Class' } as any] };
    const resNoClass = helpers.getResolvedTemplate({ template: 'noClassTpl', fieldOverrides: { f1: { hidden: true } } });
    expect(resNoClass?.fields?.length).toBe(1);

    // Container with neither fields nor template (covers line 71 else)
    expect(helpers.getResolvedTemplate({} as any)).toBeNull();
  });

  it('identifies atomic fields, null and undefined', () => {
    const helpers = useEntityHelpers(formData, config);

    expect(helpers.isAtomicField({ type: 'text' })).toBe(true);
    expect(helpers.isAtomicField({ type: 'tags' })).toBe(true);
    expect(helpers.isAtomicField({ type: 'range' })).toBe(true);
    expect(helpers.isAtomicField({ type: 'dynamic' })).toBe(false);
    expect(helpers.isAtomicField(null)).toBe(false);
    expect(helpers.isAtomicField(undefined)).toBe(false);

    // Edge cases for getProp & setProp (lines 26, 48-52)
    expect(helpers.getProp(123)).toBe('');
    helpers.setProp(123, 'ignored');
    helpers.setProp({}, 123, 'ignored');
    helpers.setProp(null, 'name', 'King Arthur');
    expect(formData.value.name).toBe('King Arthur');
  });

  describe('getPhotoUrl', () => {
    it('handles web prefixes and cache', () => {
      const helpers = useEntityHelpers(formData, config);

      expect(helpers.getPhotoUrl('')).toBe('');
      expect(helpers.getPhotoUrl('http://example.com/img.png')).toBe('http://example.com/img.png');
      expect(helpers.getPhotoUrl('data:image/png;base64,...')).toBe('data:image/png;base64,...');
      expect(helpers.getPhotoUrl('blob:http://...')).toBe('blob:http://...');
      expect(helpers.getPhotoUrl('asset://...')).toBe('asset://...');
      expect(helpers.getPhotoUrl('tauri://...')).toBe('tauri://...');
    });

    it('converts file src via tauri variants and handles errors', async () => {
      const helpers = useEntityHelpers(formData, config);

      // 1. __TAURI__.core.convertFileSrc
      (window as any).__TAURI__ = {
        core: { convertFileSrc: (p: string) => `asset://${p}` },
      };
      expect(helpers.getPhotoUrl('C:/path/1.png')).toBe('asset://C:/path/1.png');

      // 2. __TAURI__.convertFileSrc
      (window as any).__TAURI__ = {
        convertFileSrc: (p: string) => `tauri://${p}`,
      };
      expect(helpers.getPhotoUrl('C:/path/2.png')).toBe('tauri://C:/path/2.png');

      // 3. __TAURI_INTERNALS__.convertFileSrc
      delete (window as any).__TAURI__;
      (window as any).__TAURI_INTERNALS__ = {
        convertFileSrc: (p: string) => `internal://${p}`,
      };
      expect(helpers.getPhotoUrl('C:/path/3.png')).toBe('internal://C:/path/3.png');

      // 4. Exception in convertFileSrc
      (window as any).__TAURI_INTERNALS__ = {
        convertFileSrc: () => { throw new Error('Crash'); },
      };
      expect(helpers.getPhotoUrl('C:/path/4.png')).toBe('C:/path/4.png');

      // 5. No Tauri at all
      delete (window as any).__TAURI_INTERNALS__;
      expect(helpers.getPhotoUrl('C:/path/5.png')).toBe('C:/path/5.png');
    });
  });
});
