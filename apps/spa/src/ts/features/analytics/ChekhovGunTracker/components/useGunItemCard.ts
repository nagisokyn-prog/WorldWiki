import { computed } from 'vue';
import type { TrackedItem } from '../ChekhovGunTracker.model';

export function useGunItemCard(itemGetter: () => TrackedItem) {
  const item = computed(() => itemGetter());

  const typeIcon = computed(() => {
    const t = item.value.item_type.toLowerCase();
    if (t.includes('оружие') || t.includes('weapon')) return '⚔️';
    if (t.includes('артефакт') || t.includes('artifact')) return '🔮';
    if (t.includes('улик') || t.includes('документ') || t.includes('clue')) return '📜';
    if (t.includes('реликв') || t.includes('relic')) return '👑';
    if (t.includes('транспорт') || t.includes('vehicle')) return '🚀';
    if (t.includes('зелье') || t.includes('веществ') || t.includes('potion')) return '🧪';
    return '🗡️';
  });

  const stateBadgeClass = computed(() => {
    switch (item.value.usage_state) {
      case 'active':
        return 'badge-active text-success bg-success/10 border-success/30';
      case 'sleeping':
        return 'badge-sleeping text-warning bg-warning/10 border-warning/30';
      case 'forgotten':
        return 'badge-forgotten text-danger bg-danger/10 border-danger/30';
      case 'destroyed_or_lost':
        return 'badge-destroyed text-muted bg-surface-hover border-border';
      default:
        return 'badge-default text-muted bg-surface-hover border-border';
    }
  });

  const stateLabel = computed(() => {
    switch (item.value.usage_state) {
      case 'active':
        return '🟢 В сюжете';
      case 'sleeping':
        return '🟡 Спит';
      case 'forgotten':
        return `🔴 Забыт (${item.value.skipped_chapters} глав)`;
      case 'destroyed_or_lost':
        return '⚪ Выбыл';
      default:
        return '⚪ Не указано';
    }
  });

  const chapterRangeLabel = computed(() => {
    if (item.value.total_mentions === 0) {
      return 'В тексте еще не появлялся';
    }
    const first = item.value.first_chapter_order;
    const last = item.value.last_chapter_order;
    if (first === last && first !== null && first !== undefined) {
      return `Глава ${first} (1 появление)`;
    }
    return `Главы ${first ?? '?'} → ${last ?? '?'} (${item.value.total_mentions} сцен)`;
  });

  return {
    item,
    typeIcon,
    stateBadgeClass,
    stateLabel,
    chapterRangeLabel,
  };
}
