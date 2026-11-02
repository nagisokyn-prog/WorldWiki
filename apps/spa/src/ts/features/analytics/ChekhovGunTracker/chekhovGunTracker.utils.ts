import type { PlotPromise } from '@/types/generated/PlotPromise';
import type { RichPlotPromise } from '@/types/narrative';
import type {
  TrackedItem,
  ItemJourneyReport,
  ItemJourneyNode,
} from './ChekhovGunTracker.model';

export function isGunItem(item: TrackedItem): boolean {
  return (
    item.id.startsWith('plot_promises:') ||
    item.item_type === 'Чеховское ружьё' ||
    item.item_type === 'Предзнаменование'
  );
}

export function buildGunJourneyReport(
  item: TrackedItem,
  promise: PlotPromise | RichPlotPromise | null,
  chapters: Array<{ id: string | unknown; title?: string; sort_order?: number | bigint | null }> = []
): ItemJourneyReport {
  const getChapterInfo = (chId?: string | null): { title: string; order: number } | null => {
    if (!chId) return null;
    const cleanCid = chId.replace(/^chapters:/, '');
    const found = chapters.find((c) => {
      const cid = typeof c.id === 'string' ? c.id : String(c.id);
      return cid === chId || cid === cleanCid || cid.replace(/^chapters:/, '') === cleanCid;
    });
    if (!found) return null;
    const rawOrder = found.sort_order;
    const order = typeof rawOrder === 'bigint' ? Number(rawOrder) : (rawOrder ?? 0);
    return {
      title: found.title || `Глава ${order}`,
      order,
    };
  };

  const nodes: ItemJourneyNode[] = [];
  const rich = promise as RichPlotPromise | null;
  const firstMilestone = promise?.milestones?.[0];

  if (promise && Array.isArray(promise.milestones) && promise.milestones.length > 0) {
    promise.milestones.forEach((m, idx) => {
      const chInfo = getChapterInfo(m.chapter_id);
      let nodeType = 'scene';
      let title = '🌿 Развитие сюжета';
      if (m.stage === 'plant' || idx === 0) {
        nodeType = 'creation';
        title = '🌱 Завязка (Посадка ружья)';
      } else if (m.stage === 'resolution') {
        nodeType = 'destruction';
        title = '🎯 Выстрел (Развязка)';
      }

      nodes.push({
        id: m.milestone_id || `${item.id}_milestone_${idx}`,
        title,
        node_type: nodeType,
        chapter_id: m.chapter_id,
        chapter_title: chInfo?.title || (m.chapter_id ? 'Глава' : undefined),
        chapter_order: chInfo?.order,
        owner_name: item.current_owner_name,
        description: m.quote || m.note || item.name,
        quote: m.quote || m.note || item.name,
        block_id: m.block_id || null,
        paragraph_index: m.order_index ?? null,
      });
    });
  } else {
    const plantChapterId =
      rich?.chapter_id ||
      firstMilestone?.chapter_id ||
      (item.custody_chain?.[0]?.chapter_id ?? null);
    const plantChInfo = getChapterInfo(plantChapterId);

    const plantTitle =
      item.custody_chain?.[0]?.chapter_title ||
      plantChInfo?.title ||
      (item.first_chapter_order !== null && item.first_chapter_order !== undefined
        ? `Глава ${item.first_chapter_order}`
        : undefined);

    nodes.push({
      id: `${item.id}_plant`,
      title: '🌱 Завязка (Посадка ружья)',
      node_type: 'creation',
      chapter_id: plantChapterId,
      chapter_title: plantTitle,
      chapter_order: plantChInfo?.order ?? item.first_chapter_order ?? 0,
      owner_name: item.current_owner_name,
      description: promise?.title || item.name,
      quote: rich?.quote || promise?.title || item.name,
      block_id: rich?.block_id || firstMilestone?.block_id || null,
      paragraph_index: rich?.paragraph_index ?? firstMilestone?.order_index ?? 0,
    });

    const isResolved =
      item.status_category.includes('Выстрел') ||
      promise?.status === 'resolved' ||
      promise?.status === 'fired';
    const isBroken =
      item.status_category.includes('Сорвано') ||
      promise?.status === 'broken';

    if (isResolved || isBroken) {
      nodes.push({
        id: `${item.id}_resolution`,
        title: isBroken ? '💥 Срыв ружья' : '🎯 Выстрел (Развязка)',
        node_type: 'destruction',
        chapter_id: plantChapterId,
        chapter_title: plantTitle,
        chapter_order: plantChInfo?.order ?? item.last_chapter_order ?? 0,
        owner_name: item.current_owner_name,
        description: isBroken
          ? 'Обещание или предзнаменование снято или сорвано по ходу сюжета.'
          : 'Сюжетное ружьё успешно выстрелило — драматургическая линия завершена.',
      });
    }
  }

  return {
    item_id: item.id,
    item_name: promise?.title || item.name,
    item_type: item.item_type || 'Чеховское ружьё',
    status_category: item.status_category || 'Заряжено',
    nodes,
  };
}
