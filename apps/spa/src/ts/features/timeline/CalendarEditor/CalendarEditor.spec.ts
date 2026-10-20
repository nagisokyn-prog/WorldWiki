/**
 * @file CalendarEditor.spec.ts
 * @description Unit-тесты логики главного контейнера CalendarEditor
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useCalendarEditor } from './useCalendarEditor';
import type { CalendarEditorProps, CalendarEditorEmits } from './CalendarEditor.model';

vi.mock('@/stores/calendar.store', () => ({
  useCalendarStore: () => ({
    getCalendars: vi.fn().mockResolvedValue([
      {
        id: 'cal_1',
        name: 'Григорианский',
        is_default: true,
        is_master: true,
        data: {
          название: 'Григорианский',
          месяцы: [{ название: 'Январь', дней: 31 }],
          эпохи: [{ название: 'Наша эра', год_начала: 1 }],
          праздники: [{ название: 'Новый год' }],
        },
      },
    ]),
    saveCalendar: vi.fn().mockResolvedValue({ success: true }),
    deleteCalendar: vi.fn().mockResolvedValue(true),
  }),
}));

describe('useCalendarEditor', () => {
  const props: CalendarEditorProps = {
    calendarId: 'cal_1',
    projectId: 'test_project',
  };

  const emit: CalendarEditorEmits = vi.fn() as unknown as CalendarEditorEmits;

  it('инициализирует дефолтный таб timeGrid', () => {
    const editor = useCalendarEditor(props, emit);
    expect(editor.activeTab.value).toBe('timeGrid');
  });

  it('переключает табы на канонические 5 вкладок', () => {
    const editor = useCalendarEditor(props, emit);
    editor.setTab('erasSync');
    expect(editor.activeTab.value).toBe('erasSync');

    editor.setTab('cultureLore');
    expect(editor.activeTab.value).toBe('cultureLore');

    editor.setTab('playground');
    expect(editor.activeTab.value).toBe('playground');

    editor.setTab('reformsDst');
    expect(editor.activeTab.value).toBe('reformsDst');
  });

  it('формирует список из 5 канонических табов', () => {
    const editor = useCalendarEditor(props, emit);
    expect(editor.tabsList.value.length).toBe(5);
    expect(editor.tabsList.value.map((t) => t.id)).toEqual([
      'timeGrid',
      'erasSync',
      'cultureLore',
      'playground',
      'reformsDst',
    ]);
  });
});
