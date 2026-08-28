import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useModuleReferenceData } from '../useModuleReferenceData';
import * as api from '@/services/api.client';
import { useShellStore } from '@/stores/shell';

vi.mock('@/services/api.client', () => ({
  getEntitySchemas: vi.fn(),
}));

vi.mock('../../../../services/api.client', () => ({
  getEntitySchemas: vi.fn(),
}));

vi.mock('@/stores/shell', () => ({
  useShellStore: () => ({
    projectName: 'my_proj',
  }),
}));

vi.mock('../../../../stores/shell', () => ({
  useShellStore: () => ({
    projectName: 'my_proj',
  }),
}));

describe('useModuleReferenceData', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it('loads schemas from DB when project is active', async () => {
    const shell = useShellStore();
    shell.projectName = 'my_proj';

    const mockDbSchemas = [
      {
        type_name: 'character',
        full_schema: {
          name: 'Уникальный Персонаж',
          entityType: 'unique_character',
          iconEmoji: '👤',
          sections: [
            {
              id: 'sec_1',
              title: 'Связи',
              dynamicContainers: [
                {
                  id: 'dc_rel',
                  title: 'Уникальные Связи',
                  template: 'relationship',
                  isBidirectional: true,
                  fields: [
                    { class: 'цель', label: 'Цель', type: 'text' },
                    { class: 'начальная_глава', label: 'Начало', type: 'text' },
                  ],
                  fieldOverrides: {
                    цель: { label: 'Новая цель', placeholder: 'Выбрать...' },
                    начальная_глава: { hidden: true }, // protected, shouldn't be hidden
                    hidden_custom: { hidden: true },
                    extra_field: { label: 'Экстра' },
                  },
                },
              ],
            },
          ],
          templates: {
            relationship: {
              fields: [{ class: 'цель', label: 'Цель' }],
            },
          },
        },
      },
    ];

    vi.mocked(api.getEntitySchemas).mockResolvedValue(mockDbSchemas as any);

    const helper = useModuleReferenceData();
    await helper.loadDbSchemas();

    const info = helper.getModuleUsageInfo('Двунаправленная связь');
    expect(info.templateKey).toBe('Двунаправленная связь');
    expect(info.examples.length).toBeGreaterThan(0);
    const ex = info.examples.find(e => e.entityName === 'Уникальный Персонаж');
    expect(ex).toBeDefined();
    if (!ex) return;
    expect(ex.isBidirectional).toBe(true);

    // Verify protected field was preserved despite hidden: true
    const startChapField = ex.fields.find(f => f.class === 'начальная_глава');
    expect(startChapField).toBeDefined();

    // Verify extra_field added from overrides
    const extraField = ex.fields.find(f => f.class === 'extra_field');
    expect(extraField).toBeDefined();
    expect(extraField?.label).toBe('Экстра');
  });

  it('matches all template categories: timeline, single parameter, and dynamic element', async () => {
    const shell = useShellStore();
    shell.projectName = 'my_proj';

    const mockDbSchemas = [
      {
        full_schema: {
          name: 'Мир',
          sections: [
            {
              dynamicContainers: [
                { id: 'dc_time', type: 'timeline', title: 'Хронология событий' },
                { id: 'dc_param', template: 'Одиночный параметр', title: 'Параметр силы' },
                { id: 'dc_dyn', type: 'dynamic', title: 'Список инвентаря' },
              ],
            },
          ],
        },
      },
    ];
    vi.mocked(api.getEntitySchemas).mockResolvedValue(mockDbSchemas as any);

    const helper = useModuleReferenceData();
    await helper.loadDbSchemas();

    const timeInfo = helper.getModuleUsageInfo('Базовая хронология');
    expect(timeInfo.examples.length).toBeGreaterThan(0);

    const paramInfo = helper.getModuleUsageInfo('Одиночный параметр');
    expect(paramInfo.examples.length).toBeGreaterThan(0);

    const dynInfo = helper.getModuleUsageInfo('Динамический элемент');
    expect(dynInfo.examples.length).toBeGreaterThan(0);
  });

  it('provides fallback default example for unknown canonicalKey', () => {
    const helper = useModuleReferenceData();
    const info = helper.getModuleUsageInfo('Неизвестный шаблон xyz');
    expect(info.examples).toHaveLength(1);
    expect(info.examples[0].id).toBe('fallback_default');
    expect(info.examples[0].entityName).toBe('Базовый шаблон');
  });

  it('handles DB fetch error and falls back to static schemas without crashing', async () => {
    const shell = useShellStore();
    shell.projectName = 'my_proj';
    vi.mocked(api.getEntitySchemas).mockRejectedValueOnce(new Error('DB failure'));

    const helper = useModuleReferenceData();
    await helper.loadDbSchemas();
    expect(helper.getModuleUsageInfo('Базовая хронология')).toBeDefined();
  });
});
