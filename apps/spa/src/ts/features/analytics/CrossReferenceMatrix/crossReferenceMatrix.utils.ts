/**
 * @file crossReferenceMatrix.utils.ts
 * @description Вспомогательные функции расчёта матрицы связей, весов ролей и статистики глав.
 */

import type { MatrixChapter, MatrixEntity } from '@/stores/analytics.store';
import type {
  EntityPresenceRow,
  CellStatusInfo,
  AppearanceStatus,
  ChapterColumnSummary,
} from './CrossReferenceMatrix.model';

export function getRoleWeight(role?: string | null): number {
  if (!role) return 1;
  const r = role.toLowerCase().trim();
  if (r.includes('главн') || r.includes('main') || r.includes('protagonist')) return 4;
  if (r.includes('антагон') || r.includes('antagonist') || r.includes('злодей')) return 3;
  if (r.includes('второстепен') || r.includes('secondary')) return 2;
  return 1;
}

export function formatWordCount(count?: number | null): string {
  if (!count) return '0 сл.';
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}k сл.`;
  }
  return `${count} сл.`;
}

interface MergedApp {
  hasScene: boolean;
  hasMention: boolean;
  isDeceased: boolean;
  count: number;
  role?: string | null;
}

export function buildEntityPresenceRow(
  entity: MatrixEntity,
  chapters: MatrixChapter[]
): EntityPresenceRow {
  const cells = new Map<string, CellStatusInfo>();
  let total = 0;
  let totalScenes = 0;
  let totalMentions = 0;
  let lastSeenIdx = -1;
  let maxGap = 0;
  const isDeceased = Boolean(entity.is_deceased || entity.status_category === 'Мёртв');

  const appearancesMap = new Map<string, MergedApp>();
  const rawApps = entity.appearances_by_chapter || entity.appearances || [];
  rawApps.forEach((app) => {
    if (!app.chapter_id) return;
    const cleanId = app.chapter_id.replace(/^chapters:/, '');
    const existing = appearancesMap.get(cleanId) || {
      hasScene: false,
      hasMention: false,
      isDeceased: false,
      count: 0,
      role: null,
    };

    const isScene = Boolean(
      app.has_scene || app.kind === 'scene' || app.kind === 'both' || app.source === 'scene' || app.source === 'manual'
    );
    const isMention = Boolean(
      app.has_mention || app.kind === 'mention' || app.kind === 'both' || app.source === 'mention'
    );
    const isDec = app.kind === 'deceased';

    existing.hasScene = existing.hasScene || isScene;
    existing.hasMention = existing.hasMention || isMention;
    existing.isDeceased = existing.isDeceased || isDec;
    existing.count += (app.count ?? 1);
    if (app.role) existing.role = app.role;
    appearancesMap.set(cleanId, existing);
  });

  const cellList: Array<CellStatusInfo & { chapterId: string; chapterTitle: string }> = [];

  chapters.forEach((ch, idx) => {
    const cleanChId = ch.id.replace(/^chapters:/, '');
    const app = appearancesMap.get(cleanChId);

    let status: AppearanceStatus = 'absent';
    let label = 'Отсутствует в главе';

    if (app && (app.hasScene || app.hasMention || app.isDeceased)) {
      if (app.isDeceased) {
        status = 'deceased';
        label = `💀 Погиб в главе (${app.count} упоминаний)`;
      } else if (app.hasScene && app.hasMention) {
        status = 'both';
        label = `Сцена и упоминания (${app.count})`;
      } else if (app.hasScene) {
        status = 'scene';
        label = `Участие в сцене (${app.count})`;
      } else if (app.hasMention) {
        status = 'mention';
        label = `Упоминание в тексте (${app.count})`;
      }

      total += app.count;
      if (app.hasScene) totalScenes++;
      if (app.hasMention) totalMentions++;

      if (lastSeenIdx !== -1) {
        const gap = idx - lastSeenIdx - 1;
        if (gap > maxGap) maxGap = gap;
      }
      lastSeenIdx = idx;
    } else {
      if (isDeceased && lastSeenIdx !== -1) {
        status = 'deceased';
        label = 'Мёртв (не участвует)';
      }
    }

    const cellInfo: CellStatusInfo = {
      status,
      hasScene: Boolean(app?.hasScene),
      hasMention: Boolean(app?.hasMention),
      isDeceased: Boolean(app?.isDeceased || (isDeceased && lastSeenIdx !== -1)),
      count: app?.count ?? 0,
      role: app?.role,
      label,
    };

    cells.set(ch.id, cellInfo);
    cellList.push({
      ...cellInfo,
      chapterId: ch.id,
      chapterTitle: ch.title,
    });
  });

  return {
    entity,
    cells,
    cellList,
    totalAppearances: total,
    totalScenes,
    totalMentions,
    hasGapWarning: maxGap >= 3,
  };
}

export function buildChapterColumns(
  chapters: MatrixChapter[],
  chapterStats: Map<string, { scenes: number; mentions: number; total: number }>
): ChapterColumnSummary[] {
  return chapters.map((ch) => {
    const st = chapterStats.get(ch.id) || { scenes: 0, mentions: 0, total: 0 };
    return {
      id: ch.id,
      sort_order: ch.sort_order,
      title: ch.title,
      word_count: ch.word_count,
      formattedWordCount: formatWordCount(ch.word_count),
      uniqueEntities: st.total,
    };
  });
}
