import type {
  InspectorChapter,
  InspectorEvent,
  InspectorReveal,
  TimelineVolumeSegment,
  VisualizedConnectionLine,
  VisualizedSceneHierarchyLine,
} from './TimelineInspector.model';
import { checkIsFlashback, getEventId, normalizeId } from './timelineInspector.utils';

export interface VolumeLike {
  id?: string | null;
  title?: string | null;
}

export interface ChapterLike {
  id?: string | null;
  volume_id?: string | null;
  volume_title?: string | null;
  title?: string;
  sort_order?: number | bigint | null;
}

export function buildVolumeOptions(
  volumes: VolumeLike[] = [],
  allChapters: ChapterLike[] = []
): Array<{ id: string; title: string }> {
  const list: Array<{ id: string; title: string }> = [{ id: 'all', title: 'Все тома' }];
  const known = new Set<string>();

  volumes.forEach((v) => {
    const clean = normalizeId(v.id);
    if (clean && !known.has(clean)) {
      known.add(clean);
      list.push({ id: clean, title: v.title || `Том ${clean}` });
    }
  });

  allChapters.forEach((c) => {
    const vId = normalizeId(c.volume_id);
    if (vId && !known.has(vId)) {
      known.add(vId);
      list.push({ id: vId, title: `Том ${vId}` });
    }
  });

  return list;
}

export function resolveChaptersWithVolumes(
  inspectorChapters: InspectorChapter[],
  hierarchyChapters: ChapterLike[],
  volumes: VolumeLike[],
  selectedVolumeId?: string
): InspectorChapter[] {
  const volMap = new Map<string, string>();
  const volOrderMap = new Map<string, number>();
  const volTitleMap = new Map<string, string>();

  volumes.forEach((v, vIdx) => {
    const cleanV = normalizeId(v.id);
    volOrderMap.set(cleanV, vIdx);
    if (v.title) volTitleMap.set(cleanV, v.title);
  });

  hierarchyChapters.forEach((hc) => {
    const cleanChId = normalizeId(hc.id);
    const cleanVolId = normalizeId(hc.volume_id);
    if (cleanChId && cleanVolId) volMap.set(cleanChId, cleanVolId);
  });

  let chList = inspectorChapters.map((ch) => {
    const cleanChId = normalizeId(ch.id);
    const resolvedVol = normalizeId(ch.volume_id) || volMap.get(cleanChId) || '';
    const rawTitle = (ch as unknown as { volume_title?: string }).volume_title;
    const resolvedTitle =
      rawTitle || volTitleMap.get(resolvedVol) || (resolvedVol ? `Том ${resolvedVol}` : 'Основной том');
    return { ...ch, volume_id: resolvedVol, volume_title: resolvedTitle };
  });

  if (selectedVolumeId && selectedVolumeId !== 'all') {
    const cleanTarget = normalizeId(selectedVolumeId);
    chList = chList.filter((c) => normalizeId(c.volume_id) === cleanTarget);
  }

  chList.sort((a, b) => {
    const vA = volOrderMap.get(a.volume_id || '') ?? 0;
    const vB = volOrderMap.get(b.volume_id || '') ?? 0;
    if (vA !== vB) return vA - vB;
    return (a.sort_order || 0) - (b.sort_order || 0);
  });

  return chList;
}

export function buildVolumeSegments(
  chs: InspectorChapter[],
  volumes: VolumeLike[] = []
): TimelineVolumeSegment[] {
  if (!chs.length) return [];
  const volTitleMap = new Map<string, string>();
  volumes.forEach((v) => {
    volTitleMap.set(normalizeId(v.id), v.title || `Том ${normalizeId(v.id)}`);
  });

  const segments: TimelineVolumeSegment[] = [];
  let currentVolId: string | null = null;
  let currentSegment: TimelineVolumeSegment | null = null;

  chs.forEach((ch, idx) => {
    const vId = normalizeId(ch.volume_id) || 'default';
    const vTitle =
      (ch as unknown as { volume_title?: string }).volume_title ||
      volTitleMap.get(vId) ||
      (vId !== 'default' ? `Том ${vId}` : 'Основной том');

    if (vId !== currentVolId || !currentSegment) {
      currentVolId = vId;
      currentSegment = {
        volumeId: vId,
        volumeTitle: vTitle,
        startIndex: idx,
        count: 1,
        leftPx: 60 + idx * 140,
        widthPx: 110,
        boundaryLeftPx: idx > 0 ? Math.round(60 + (idx - 0.5) * 140) : undefined,
      };
      segments.push(currentSegment);
    } else {
      currentSegment.count++;
      const c1 = 60 + currentSegment.startIndex * 140;
      const c2 = 60 + (currentSegment.startIndex + currentSegment.count - 1) * 140;
      currentSegment.leftPx = Math.round((c1 + c2) / 2);
      currentSegment.widthPx = (currentSegment.count - 1) * 140 + 110;
    }
  });

  return segments;
}

export function calculateConnectionLines(params: {
  linkMode: 'focus' | 'all' | 'none';
  chapters: InspectorChapter[];
  events: InspectorEvent[];
  activeChapterId: string | null;
  hoveredChapterId: string | null;
  hoveredEventId: string | null;
  startX?: number;
  chapterSpacing?: number;
  eventSpacing?: number;
}): VisualizedConnectionLine[] {
  const {
    linkMode,
    chapters,
    events,
    activeChapterId,
    hoveredChapterId,
    hoveredEventId,
    startX = 60,
    chapterSpacing = 140,
    eventSpacing = 160,
  } = params;

  if (linkMode === 'none' || !chapters.length || !events.length) return [];

  const lines: VisualizedConnectionLine[] = [];
  const chapterPositions = new Map<string, number>();
  chapters.forEach((ch, idx) => chapterPositions.set(normalizeId(ch.id), startX + idx * chapterSpacing));

  const eventPositions = new Map<string, number>();
  events.forEach((ev, idx) => eventPositions.set(getEventId(ev) || `ev-${idx}`, startX + idx * eventSpacing));

  const targetChId = activeChapterId
    ? normalizeId(activeChapterId)
    : hoveredChapterId
      ? normalizeId(hoveredChapterId)
      : null;
  const targetEvId = hoveredEventId
    ? getEventId({ id: hoveredEventId, title: '', m_abs: 0, reveals: [], participants: [] })
    : null;

  events.forEach((ev) => {
    const evId = getEventId(ev);
    if (linkMode === 'focus') {
      if (targetChId) {
        if (!ev.reveals.some((r) => normalizeId(r.chapter_id) === targetChId)) return;
      } else if (targetEvId) {
        if (evId !== targetEvId) return;
      } else {
        return;
      }
    }

    ev.reveals.forEach((r: InspectorReveal) => {
      const cleanRChId = normalizeId(r.chapter_id);
      if (targetChId && cleanRChId !== targetChId) return;
      const x1 = chapterPositions.get(cleanRChId);
      const x2 = eventPositions.get(evId);
      if (x1 !== undefined && x2 !== undefined) {
        const isFlashback = checkIsFlashback(ev, chapters) || r.kind === 'flashback' || x1 > x2;
        lines.push({
          id: `line-${evId}-${r.chapter_id}`,
          eventId: evId,
          chapterId: r.chapter_id,
          eventTitle: ev.title,
          chapterTitle: r.chapter_title,
          chapterOrder: r.chapter_order ?? r.chapter_sort_order ?? 0,
          m_abs: ev.m_abs,
          kind: r.kind,
          isFlashback,
          x1,
          y1: 60,
          x2,
          y2: 170,
        });
      }
    });
  });

  return lines;
}

export function calculateSceneHierarchyLines(params: {
  events: InspectorEvent[];
  startX?: number;
  eventSpacing?: number;
}): VisualizedSceneHierarchyLine[] {
  const { events, startX = 60, eventSpacing = 160 } = params;
  if (!events.length) return [];

  const lines: VisualizedSceneHierarchyLine[] = [];
  const eventPositions = new Map<string, number>();

  events.forEach((ev, idx) => {
    const evId = getEventId(ev);
    const cleanId = normalizeId(evId);
    const pinX = startX + idx * eventSpacing + 70;
    eventPositions.set(cleanId, pinX);
    eventPositions.set(evId, pinX);
  });

  events.forEach((ev) => {
    if (!ev.parent_id) return;
    const childId = getEventId(ev);
    const cleanParentId = normalizeId(ev.parent_id);
    const x1 = eventPositions.get(cleanParentId);
    const x2 = eventPositions.get(normalizeId(childId)) ?? eventPositions.get(childId);

    if (x1 !== undefined && x2 !== undefined) {
      const y1 = 305;
      const y2 = 305;
      const distance = Math.abs(x2 - x1);
      const arcDepth = Math.min(65, Math.max(30, distance * 0.25));
      const yBottom = y1 + arcDepth;

      lines.push({
        id: `scene-link-${cleanParentId}-${normalizeId(childId)}`,
        parentId: cleanParentId,
        childId: normalizeId(childId),
        x1,
        y1,
        x2,
        y2,
        yBottom,
      });
    }
  });

  return lines;
}

