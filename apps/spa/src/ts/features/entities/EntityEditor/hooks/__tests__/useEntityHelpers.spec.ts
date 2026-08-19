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

  it('gets property by path or fallback', () => {
    const helpers = useEntityHelpers(formData, config);

    expect(helpers.getProp('name')).toBe('Arthur');
    expect(helpers.getProp('profile.title')).toBe('King');
    expect(helpers.getProp('profile.stats.hp')).toBe(100);
    expect(helpers.getProp('profile.missing')).toBeUndefined();
    expect(helpers.getProp('')).toBe('');
  });

  it('sets property by nested path', () => {
    const helpers = useEntityHelpers(formData, config);

    helpers.setProp('profile.stats.mp', 50);
    expect(formData.value.profile.stats.mp).toBe(50);

    helpers.setProp('newGroup.sub.val', 'hello');
    expect(formData.value.newGroup.sub.val).toBe('hello');
  });

  it('caches photo URLs', async () => {
    const helpers = useEntityHelpers(formData, config);

    expect(helpers.getPhotoUrl('')).toBe('');
    expect(helpers.getPhotoUrl('http://example.com/pic.jpg')).toBe('http://example.com/pic.jpg');
    expect(helpers.getPhotoUrl('data:image/png;base64,123')).toBe('data:image/png;base64,123');

    helpers.getPhotoUrl('local/path.png');
    await Promise.resolve();
    expect(helpers.getPhotoUrl('local/path.png')).toBe('local/path.png');
  });

  it('resolves template with overrides', () => {
    const helpers = useEntityHelpers(formData, config);

    const container = {
      template: 'roleTpl',
      fieldOverrides: {
        role: { label: 'Primary Role' },
        secret: { hidden: true },
      },
    };

    const resolved = helpers.getResolvedTemplate(container);

    expect(resolved.fields.length).toBe(1);
    expect(resolved.fields[0]).toEqual({
      class: 'role',
      label: 'Primary Role',
    });
  });

  it('identifies atomic fields', () => {
    const helpers = useEntityHelpers(formData, config);

    expect(helpers.isAtomicField({ type: 'text' })).toBe(true);
    expect(helpers.isAtomicField({ type: 'tags' })).toBe(true);
    expect(helpers.isAtomicField({ type: 'range' })).toBe(true);
    expect(helpers.isAtomicField({ type: 'dynamic' })).toBe(false);
  });
});
