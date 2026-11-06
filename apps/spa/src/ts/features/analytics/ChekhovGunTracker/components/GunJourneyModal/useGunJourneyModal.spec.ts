import { describe, it, expect } from 'vitest';
import { useGunJourneyModal } from './useGunJourneyModal';
import type { ItemJourneyReport } from '../../ChekhovGunTracker.model';

describe('useGunJourneyModal Composable', () => {
  it('correctly provides journey nodes and node icon mappings', () => {
    const journey: ItemJourneyReport = {
      item_id: 'item:1',
      item_name: 'Кольцо Всевластия',
      item_type: 'артефакт',
      status_category: 'Цел / Активен',
      nodes: [
        {
          id: 'node:1',
          title: 'Создание в Роковой Горе',
          node_type: 'creation',
          description: 'Выковано Сауроном',
        },
        {
          id: 'node:2',
          title: 'Владелец: Голлум',
          node_type: 'custody',
          owner_name: 'Голлум',
          description: 'Хранилось 500 лет в пещерах',
        },
        {
          id: 'node:3',
          title: 'Сцена: Находка Бильбо',
          node_type: 'scene',
          chapter_title: 'Глава 5',
          description: 'Бильбо находит кольцо в темноте',
        },
      ],
    };

    const { hasNodes, nodes, getNodeIcon, getNodeBadgeClass } = useGunJourneyModal(() => journey);

    expect(hasNodes.value).toBe(true);
    expect(nodes.value.length).toBe(3);
    expect(getNodeIcon('creation')).toBe('🌱');
    expect(getNodeIcon('custody')).toBe('👤');
    expect(getNodeIcon('scene')).toBe('⚡');
    expect(getNodeBadgeClass('creation')).toContain('text-success');
    expect(getNodeBadgeClass('scene')).toContain('text-warning');
  });

  it('handles null journey gracefully', () => {
    const { hasNodes, nodes, isPromise, modalTitle, emptyText } = useGunJourneyModal(() => null);

    expect(hasNodes.value).toBe(false);
    expect(nodes.value).toEqual([]);
    expect(isPromise.value).toBe(false);
    expect(modalTitle.value).toBe('Путь предмета');
    expect(emptyText.value).toBe('История владения и упоминания данного предмета в тексте пока отсутствуют.');
  });

  it('correctly adapts for Chekhov gun when activeItem is provided even with null journey', () => {
    const gunItem = {
      id: 'plot_promises:gun1',
      name: 'Пистолет в первом акте',
      item_type: 'Чеховское ружьё',
      status_category: 'Заряжено',
      current_owner_id: null,
      current_owner_name: 'Лёха',
      first_chapter_order: 0,
      last_chapter_order: 0,
      skipped_chapters: 0,
      total_mentions: 1,
      usage_state: 'active' as const,
      custody_chain: [],
    };

    const { isPromise, modalTitle, itemTypeLabel, statusCategoryLabel, emptyText, getNodeIcon, getNodeBadgeClass } =
      useGunJourneyModal(() => null, () => gunItem);

    expect(isPromise.value).toBe(true);
    expect(modalTitle.value).toBe('Пистолет в первом акте');
    expect(itemTypeLabel.value).toBe('Чеховское ружьё');
    expect(statusCategoryLabel.value).toBe('Заряжено');
    expect(emptyText.value).toBe('Вехи развития этого сюжетного ружья в тексте пока отсутствуют.');
    expect(getNodeIcon('destruction')).toBe('🎯');
    expect(getNodeIcon('scene')).toBe('🌿');
    expect(getNodeBadgeClass('destruction')).toContain('text-primary');
  });
});
