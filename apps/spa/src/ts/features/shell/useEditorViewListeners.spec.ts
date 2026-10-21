/**
 * @file useEditorViewListeners.spec.ts
 * @description Unit-тесты для useEditorViewListeners
 */

import { describe, it, expect, vi } from 'vitest';
import { useEditorViewListeners } from './useEditorViewListeners';

describe('useEditorViewListeners', () => {
  const mockShell = () => ({
    isWowilonOpen: false,
    editorGroups: [
      {
        id: 'group_1',
        tabs: [
          { id: 'entity:calendar:cal_1', rawId: 'cal_1', entityType: 'calendar', title: 'Старый календарь' },
          { id: 'entity:planet:p_1', rawId: 'p_1', entityType: 'planet', title: 'Старая планета' },
        ],
      },
    ],
    closeEditor: vi.fn(),
  });

  it('matchesEntityId корректно сопоставляет ID с префиксом и без', () => {
    const shell = mockShell() as any;
    const { matchesEntityId } = useEditorViewListeners({ shell });

    const tab = shell.editorGroups[0].tabs[0];
    expect(matchesEntityId(tab, 'calendar', 'cal_1')).toBe(true);
    expect(matchesEntityId(tab, 'calendar', 'calendar:cal_1')).toBe(true);
    expect(matchesEntityId(tab, 'calendar', 'other_id')).toBe(false);
    expect(matchesEntityId(tab, 'planet', 'cal_1')).toBe(false);
  });

  it('обновляет название календаря по событию calendar-renamed', () => {
    const shell = mockShell() as any;
    const { calendarRenamedListener } = useEditorViewListeners({ shell });

    const event = new CustomEvent('ww:calendar-renamed', {
      detail: { id: 'calendar:cal_1', name: '567 (Новый)' },
    });
    calendarRenamedListener(event);

    expect(shell.editorGroups[0].tabs[0].title).toBe('567 (Новый)');
  });

  it('обновляет название планеты по событию planet-renamed', () => {
    const shell = mockShell() as any;
    const { planetRenamedListener } = useEditorViewListeners({ shell });

    const event = new CustomEvent('ww:planet-renamed', {
      detail: { id: 'planet:p_1', name: 'Земля-2' },
    });
    planetRenamedListener(event);

    expect(shell.editorGroups[0].tabs[1].title).toBe('Земля-2');
  });

  it('закрывает вкладку при удалении календаря', () => {
    const shell = mockShell() as any;
    const { calendarDeletedListener } = useEditorViewListeners({ shell });

    const event = new CustomEvent('ww:calendar-deleted', {
      detail: { id: 'cal_1' },
    });
    calendarDeletedListener(event);

    expect(shell.closeEditor).toHaveBeenCalledWith('entity:calendar:cal_1');
  });

  it('закрывает вкладку при удалении планеты', () => {
    const shell = mockShell() as any;
    const { planetDeletedListener } = useEditorViewListeners({ shell });

    const event = new CustomEvent('ww:planet-deleted', {
      detail: { id: 'p_1' },
    });
    planetDeletedListener(event);

    expect(shell.closeEditor).toHaveBeenCalledWith('entity:planet:p_1');
  });
});
