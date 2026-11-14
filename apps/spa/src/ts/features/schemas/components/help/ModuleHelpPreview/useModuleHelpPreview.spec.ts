import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { reactive } from 'vue';
import { useModuleHelpPreview } from './useModuleHelpPreview';
import type { SchemaFieldDef } from '@/features/schemas/composables/useModuleReferenceData';

const mockGetModuleUsageInfo = vi.fn();

vi.mock('@/features/schemas/composables/useModuleReferenceData', () => ({
  useModuleReferenceData: () => ({
    getModuleUsageInfo: mockGetModuleUsageInfo
  })
}));

describe('useModuleHelpPreview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockGetModuleUsageInfo.mockImplementation((key: string) => ({
      templateKey: key,
      title: `Info for ${key}`,
      description: 'Sample description'
    }));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('computes usageInfo, type flags, field helpers, and select options', () => {
    const props = reactive({ templateKey: 'Двунаправленная связь' });
    const preview = useModuleHelpPreview(props);

    expect(preview.usageInfo.value).toMatchObject({ templateKey: 'Двунаправленная связь' });
    expect(preview.isBidiType.value).toBe(true);
    expect(preview.isTimelineType.value).toBe(false);

    props.templateKey = 'Базовая хронология';
    expect(preview.isBidiType.value).toBe(false);
    expect(preview.isTimelineType.value).toBe(true);

    expect(preview.isChapterField({ entityType: 'chapter' } as SchemaFieldDef)).toBe(true);
    expect(preview.isChapterField({ type: 'manuscript_point' } as SchemaFieldDef)).toBe(true);
    expect(preview.isChapterField({ label: 'Начальная глава' } as SchemaFieldDef)).toBe(true);
    expect(preview.isChapterField({ type: 'text', label: 'Имя' } as SchemaFieldDef)).toBe(false);

    expect(preview.isEntityOrChapterSelect({ entityType: 'character' } as SchemaFieldDef)).toBe(true);
    expect(preview.isEntityOrChapterSelect({ entityType: 'none', id: 'глава' } as SchemaFieldDef)).toBe(true);
    expect(preview.isEntityOrChapterSelect({ class: 'целевая_сущность' } as SchemaFieldDef)).toBe(true);
    expect(preview.isEntityOrChapterSelect({ entityType: 'none', label: 'Заметка' } as SchemaFieldDef)).toBe(false);

    expect(
      preview.getSelectOptions({
        options: [{ value: 'a', label: 'A' }]
      } as unknown as SchemaFieldDef)
    ).toEqual([{ value: 'a', label: 'A' }]);

    expect(
      preview.getSelectOptions({ placeholder: 'Укажите...' } as SchemaFieldDef)
    ).toEqual([{ value: '', label: 'Укажите...' }]);
  });

  it('shows, hides with delay, and toggles popup', () => {
    const props = reactive({ templateKey: 'text' });
    const preview = useModuleHelpPreview(props);

    const trigger = document.createElement('button');
    trigger.getBoundingClientRect = vi.fn(() => ({
      top: 100,
      bottom: 120,
      left: 700,
      right: 800,
      width: 100,
      height: 20,
      x: 700,
      y: 100,
      toJSON: () => ({})
    }));
    preview.triggerEl.value = trigger;

    expect(preview.isVisible.value).toBe(false);

    preview.showPopup();
    expect(preview.isVisible.value).toBe(true);
    expect(preview.popoverStyle.value.left).toBeDefined();

    preview.hidePopup();
    expect(preview.isVisible.value).toBe(true);
    vi.advanceTimersByTime(160);
    expect(preview.isVisible.value).toBe(false);

    preview.togglePopup();
    expect(preview.isVisible.value).toBe(true);

    preview.togglePopup();
    expect(preview.isVisible.value).toBe(false);
  });

  it('clamps popover position near viewport edges', () => {
    const originalWidth = window.innerWidth;
    const originalHeight = window.innerHeight;
    Object.defineProperty(window, 'innerWidth', { value: 400, configurable: true });
    Object.defineProperty(window, 'innerHeight', { value: 300, configurable: true });

    const props = reactive({ templateKey: 'text' });
    const preview = useModuleHelpPreview(props);

    const trigger = document.createElement('button');
    trigger.getBoundingClientRect = vi.fn(() => ({
      top: 260,
      bottom: 280,
      left: 10,
      right: 50,
      width: 40,
      height: 20,
      x: 10,
      y: 260,
      toJSON: () => ({})
    }));
    preview.triggerEl.value = trigger;

    preview.showPopup();
    expect(preview.popoverStyle.value.left).toBeDefined();
    expect(preview.popoverStyle.value.top).toBeDefined();

    Object.defineProperty(window, 'innerWidth', { value: originalWidth, configurable: true });
    Object.defineProperty(window, 'innerHeight', { value: originalHeight, configurable: true });
  });

  it('scrollToExample handles missing and existing target safely', () => {
    const props = reactive({ templateKey: 'text' });
    const preview = useModuleHelpPreview(props);

    expect(() => preview.scrollToExample(2)).not.toThrow();

    const target = document.createElement('div');
    target.id = 'example-card-2';
    target.scrollIntoView = vi.fn();
    document.body.appendChild(target);

    preview.scrollToExample(2);
    expect(target.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });
    target.remove();
  });
});
