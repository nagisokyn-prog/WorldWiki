import type {
  ConnectionLinkMode,
  DateClusterColumn,
  FormattedInspectorEvent,
  InspectorChapter,
  VisualizedConnectionLine,
  VisualizedSceneHierarchyLine,
} from './TimelineInspector.model';
import { checkIsFlashback, normalizeId } from './timelineInspector.utils';

export function computeViewportConnectionLines(params: {
  mode: ConnectionLinkMode;
  chapters: InspectorChapter[];
  dateColumns: DateClusterColumn[];
  formattedEvents: FormattedInspectorEvent[];
  narrativeScrollLeft: number;
  diegeticScrollLeft: number;
  startX: number;
  chapterSpacing: number;
  columnStartX: number;
  columnSpacing: number;
  targetChId: string | null;
  targetEvId: string | null;
}): VisualizedConnectionLine[] {
  const {
    mode, chapters, dateColumns, formattedEvents,
    narrativeScrollLeft, diegeticScrollLeft,
    startX, chapterSpacing, columnStartX, columnSpacing,
    targetChId, targetEvId,
  } = params;
  if (mode === 'none' || !chapters.length || !dateColumns.length) return [];

  const chapterX = new Map<string, number>();
  chapters.forEach((ch, idx) => chapterX.set(normalizeId(ch.id), startX + idx * chapterSpacing - narrativeScrollLeft));

  const eventX = new Map<string, number>();
  dateColumns.forEach((col, colIdx) => {
    const cx = columnStartX + colIdx * columnSpacing - diegeticScrollLeft;
    col.events.forEach((ev) => {
      eventX.set(ev.id, cx);
      ev.sameDayChildren?.forEach((sub) => eventX.set(sub.id, cx));
    });
  });

  const lines: VisualizedConnectionLine[] = [];
  for (const ev of formattedEvents) {
    if (mode === 'focus') {
      if (targetChId) {
        if (!ev.reveals?.some((r) => normalizeId(r.chapter_id) === targetChId)) continue;
      } else if (targetEvId) {
        if (normalizeId(ev.id) !== targetEvId) continue;
      } else {
        continue;
      }
    }
    for (const r of ev.reveals || []) {
      const cleanCh = normalizeId(r.chapter_id);
      if (targetChId && cleanCh !== targetChId) continue;
      const x1 = chapterX.get(cleanCh);
      const x2 = eventX.get(ev.id);
      if (x1 === undefined || x2 === undefined) continue;
      lines.push({
        id: `${ev.id}-${cleanCh}`,
        eventId: ev.id,
        chapterId: cleanCh,
        eventTitle: ev.title,
        chapterTitle: r.chapter_title || '',
        chapterOrder: r.chapter_order || 0,
        m_abs: ev.m_abs,
        kind: r.kind || 'direct',
        isFlashback: checkIsFlashback(ev) || r.kind === 'flashback',
        x1,
        y1: 98,
        x2,
        y2: 196,
      });
    }
  }
  return lines;
}

export function computeCrossDayHierarchyLines(params: {
  mode: ConnectionLinkMode;
  dateColumns: DateClusterColumn[];
  diegeticScrollLeft: number;
  diegeticScrollTop?: number;
  columnStartX: number;
  columnSpacing: number;
  targetChId: string | null;
  targetEvId: string | null;
}): VisualizedSceneHierarchyLine[] {
  const {
    mode,
    dateColumns,
    diegeticScrollLeft,
    diegeticScrollTop = 0,
    columnStartX,
    columnSpacing,
    targetChId,
    targetEvId,
  } = params;
  if (mode === 'none' || !dateColumns.length) return [];

  const canvasEl = typeof document !== 'undefined'
    ? (document.querySelector('.dual-axis-canvas') as HTMLElement | null)
    : null;
  const canvasRect = canvasEl ? canvasEl.getBoundingClientRect() : null;

  const posMap = new Map<string, { x: number; y: number; ev: FormattedInspectorEvent }>();
  dateColumns.forEach((col, colIdx) => {
    const fallbackX = columnStartX + colIdx * columnSpacing - diegeticScrollLeft;
    col.events.forEach((ev, stackIdx) => {
      const cleanId = normalizeId(ev.id);
      let x = fallbackX;
      let y = 358 + stackIdx * 102 - diegeticScrollTop;
      if (canvasRect && typeof document !== 'undefined') {
        const cardEl = document.querySelector(`[data-event-id="${cleanId}"]`) as HTMLElement | null;
        if (cardEl) {
          const rect = cardEl.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            x = rect.left + rect.width / 2 - canvasRect.left;
            y = rect.bottom - canvasRect.top + 3;
          }
        }
      }
      posMap.set(cleanId, { x, y, ev });
    });
  });

  const lines: VisualizedSceneHierarchyLine[] = [];
  for (const [, childPos] of posMap) {
    const parentKey = childPos.ev.parentIdNormalized;
    if (!parentKey) continue;
    const parentPos = posMap.get(parentKey);
    if (!parentPos || Math.abs(parentPos.x - childPos.x) < 4) continue;

    if (mode === 'focus') {
      const matchesEvent =
        targetEvId &&
        (normalizeId(childPos.ev.id) === targetEvId || normalizeId(parentPos.ev.id) === targetEvId);
      const matchesChapter =
        targetChId &&
        (childPos.ev.reveals?.some((r) => normalizeId(r.chapter_id) === targetChId) ||
          parentPos.ev.reveals?.some((r) => normalizeId(r.chapter_id) === targetChId));
      if (!matchesEvent && !matchesChapter) continue;
    }

    const distance = Math.abs(childPos.x - parentPos.x);
    const arcDepth = Math.min(56, Math.max(24, distance * 0.2));
    lines.push({
      id: `scene-link-${parentKey}-${normalizeId(childPos.ev.id)}`,
      parentId: parentKey,
      childId: normalizeId(childPos.ev.id),
      x1: parentPos.x,
      y1: parentPos.y,
      x2: childPos.x,
      y2: childPos.y,
      yBottom: Math.max(parentPos.y, childPos.y) + arcDepth,
    });
  }
  return lines;
}
