import { describe, it, expect } from 'vitest';
import { useGunItemCard } from './useGunItemCard';
import type { TrackedItem } from '../ChekhovGunTracker.model';

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
});
