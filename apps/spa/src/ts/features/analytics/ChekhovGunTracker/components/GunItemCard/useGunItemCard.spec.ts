import { describe, it, expect } from 'vitest';
import { useGunItemCard } from './useGunItemCard';
import type { TrackedItem } from '../../ChekhovGunTracker.model';

describe('useGunItemCard Composable', () => {
  it('correctly detects weapon type icon and active state', () => {
    const item: TrackedItem = {
      id: 'item:1',
      name: 'Меч Героя',
      item_type: 'оружие',
      status_category: 'Цел / Активен',
      current_owner_id: 'char:1',
      current_owner_name: 'Арагорн',
      first_chapter_order: 1,
      last_chapter_order: 5,
      skipped_chapters: 0,
      total_mentions: 5,
      usage_state: 'active',
      custody_chain: [],
    };

    const { typeIcon, stateLabel, chapterRangeLabel } = useGunItemCard(() => item);

    expect(typeIcon.value).toBe('⚔️');
    expect(stateLabel.value).toContain('В сюжете');
    expect(chapterRangeLabel.value).toBe('Главы 1 → 5 (5 сцен)');
  });

  it('correctly labels forgotten item with skipped chapters', () => {
    const item: TrackedItem = {
      id: 'item:2',
      name: 'Таинственный Свиток',
      item_type: 'артефакт',
      status_category: 'Цел / Активен',
      current_owner_id: null,
      current_owner_name: null,
      first_chapter_order: 2,
      last_chapter_order: 2,
      skipped_chapters: 14,
      total_mentions: 1,
      usage_state: 'forgotten',
      custody_chain: [],
    };

    const { typeIcon, stateLabel, chapterRangeLabel } = useGunItemCard(() => item);

    expect(typeIcon.value).toBe('🔮');
    expect(stateLabel.value).toContain('Забыт (14 глав)');
    expect(chapterRangeLabel.value).toBe('Глава 2 (1 появление)');
  });

  it('correctly discriminates narrative promises (Chekhov guns) from physical items', () => {
    const gun: TrackedItem = {
      id: 'plot_promises:secret_letter',
      name: 'Тайна письма',
      item_type: 'Чеховское ружьё',
      status_category: 'Заряжено',
      current_owner_id: 'char:1',
      current_owner_name: 'Ника',
      first_chapter_order: 1,
      last_chapter_order: 3,
      skipped_chapters: 0,
      total_mentions: 3,
      usage_state: 'active',
      custody_chain: [],
    };

    const { isPromise, typeIcon, stateLabel, participantOrOwnerLabel, actionButtonText } =
      useGunItemCard(() => gun);

    expect(isPromise.value).toBe(true);
    expect(typeIcon.value).toBe('🗡️');
    expect(stateLabel.value).toBe('🌱 Заряжено');
    expect(participantOrOwnerLabel.value).toBe('🎭 В сцене: Ника');
    expect(actionButtonText.value).toBe('Вехи');
  });

  it('covers all item type icons, usage states, owner labels, and chapter range fallbacks', () => {
    const base: TrackedItem = {
      id: 'item:x',
      name: 'X',
      item_type: 'other',
      status_category: '',
      current_owner_id: null,
      current_owner_name: null,
      first_chapter_order: null,
      last_chapter_order: null,
      skipped_chapters: 3,
      total_mentions: 0,
      usage_state: 'sleeping',
      custody_chain: [],
    };

    const cases: Array<[Partial<TrackedItem>, string, string, string]> = [
      [{ item_type: 'улика', usage_state: 'sleeping' }, '📜', 'badge-sleeping', '🟡 Спит'],
      [{ item_type: 'реликвия', usage_state: 'destroyed_or_lost' }, '👑', 'badge-destroyed', '⚪ Выбыл'],
      [{ item_type: 'транспорт', usage_state: 'unknown' as TrackedItem['usage_state'] }, '🚀', 'badge-default', '⚪ Не указано'],
      [{ item_type: 'зелье' }, '🧪', 'badge-sleeping', '🟡 Спит'],
      [{ item_type: 'прочее' }, '📦', 'badge-sleeping', '🟡 Спит'],
      [{ id: 'plot_promises:1', item_type: 'Предзнаменование', usage_state: 'active', status_category: 'Выстрелило' }, '🔮', 'badge-active', '🎯 Выстрелило'],
      [{ id: 'plot_promises:2', item_type: 'Предзнаменование', usage_state: 'sleeping' }, '🔮', 'badge-sleeping', '🟡 Ждёт выстрела (5+ глав)'],
      [{ id: 'plot_promises:3', item_type: 'Чеховское ружьё', usage_state: 'forgotten' }, '🗡️', 'badge-forgotten', '🔴 Забыто (3 глав)'],
      [{ id: 'plot_promises:4', item_type: 'Чеховское ружьё', usage_state: 'destroyed_or_lost' }, '🗡️', 'badge-destroyed', '⚪ Сорвано / Снято'],
      [{ id: 'plot_promises:5', item_type: 'Чеховское ружьё', usage_state: 'other' as TrackedItem['usage_state'] }, '🗡️', 'badge-default', '🌱 Заложено']
    ];

    for (const [override, expectedIcon, expectedBadge, expectedLabel] of cases) {
      const card = useGunItemCard(() => ({ ...base, ...override }));
      expect(card.typeIcon.value).toBe(expectedIcon);
      expect(card.stateBadgeClass.value).toContain(expectedBadge);
      expect(card.stateLabel.value).toBe(expectedLabel);
    }

    const noOwnerItem = useGunItemCard(() => base);
    expect(noOwnerItem.participantOrOwnerLabel.value).toBe('Без постоянного владельца');
    expect(noOwnerItem.chapterRangeLabel.value).toBe('В тексте еще не появлялся');
    expect(noOwnerItem.actionButtonText.value).toBe('Путь');

    const noOwnerPromise = useGunItemCard(() => ({ ...base, id: 'plot_promises:p', total_mentions: 0 }));
    expect(noOwnerPromise.participantOrOwnerLabel.value).toBe('📖 Заложено в тексте рукописи');
    expect(noOwnerPromise.chapterRangeLabel.value).toBe('В главах пока не упоминалось');

    const unknownRange = useGunItemCard(() => ({ ...base, total_mentions: 2 }));
    expect(unknownRange.chapterRangeLabel.value).toBe('Главы ? → ? (2 сцен)');
  });
});
