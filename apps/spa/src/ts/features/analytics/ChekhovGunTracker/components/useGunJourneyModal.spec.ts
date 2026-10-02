import { describe, it, expect } from 'vitest';
import { useGunJourneyModal } from './useGunJourneyModal';
import type { ItemJourneyReport } from '../ChekhovGunTracker.model';

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
    const { hasNodes, nodes } = useGunJourneyModal(() => null);

    expect(hasNodes.value).toBe(false);
    expect(nodes.value).toEqual([]);
  });
});
