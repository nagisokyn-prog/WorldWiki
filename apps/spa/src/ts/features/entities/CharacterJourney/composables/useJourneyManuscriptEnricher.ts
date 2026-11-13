import { chapterService } from '@/services/chapter.service';
import { useChapterStore } from '@/stores/chapter.store';
import type { JourneyAppearance, JourneyEvent, JourneyPromise, MultiJourneyScene } from '../CharacterJourney.model';
import {
  isAbstractPlaceholder,
  findParagraphIndexByQuote,
  extractParagraphMentions,
  isMentionCoveredByPromise,
  type ChapterParagraphMention,
} from './journeyMentionParser';

export {
  isAbstractPlaceholder,
  findParagraphIndexByQuote,
  extractParagraphMentions,
  isMentionCoveredByPromise,
  type ChapterParagraphMention,
};

function createChapterContentLoader(projectId: string) {
  const chapterStore = useChapterStore();
  const chapterCache = new Map<string, string>();

  const getChapterContent = async (chapId: string): Promise<string> => {
    const cleanId = chapId.split(':').pop() || chapId;
    if (chapterCache.has(cleanId)) {
      return chapterCache.get(cleanId) || '';
    }

    if (chapterStore.currentChapter?.id && (chapterStore.currentChapter.id.split(':').pop() || '') === cleanId) {
      const content = chapterStore.currentChapter.content || '';
      chapterCache.set(cleanId, content);
      return content;
    }

    const cached = chapterStore.chapters?.find((c) => (c.id ? String(c.id).split(':').pop() : '') === cleanId);
    if (cached?.content) {
      chapterCache.set(cleanId, cached.content);
      return cached.content;
    }

    try {
      const full = await chapterService.get(projectId, chapId);
      const content = full?.content || '';
      chapterCache.set(cleanId, content);
      return content;
    } catch {
      chapterCache.set(cleanId, '');
      return '';
    }
  };

  return { chapterStore, getChapterContent };
}

export async function enrichJourneyAppearances(
  projectId: string,
  appearances: JourneyAppearance[],
  entityId: string,
  entityName: string,
  aliases: string[] = [],
  promises: JourneyPromise[] = []
): Promise<JourneyAppearance[]> {
  if (!appearances || appearances.length === 0) return [];
  const { getChapterContent } = createChapterContentLoader(projectId);

  for (const prom of promises) {
    if (prom.chapter_id && prom.quote && (!prom.paragraph_index || prom.paragraph_index <= 1 || !prom.block_id)) {
      const html = await getChapterContent(prom.chapter_id);
      if (html) {
        const found = findParagraphIndexByQuote(html, prom.quote);
        if (found) {
          prom.paragraph_index = found.paragraphIndex;
          if (!prom.block_id) prom.block_id = found.blockId;
        }
      }
    }
  }

  const enriched: JourneyAppearance[] = [];
  const seenParagraphKeys = new Set<string>();

  for (const app of appearances) {
    if (!app.chapter_id) {
      enriched.push(app);
      continue;
    }

    const aChap = (app.chapter_id || '').split(':').pop() || '';
    if (app.source === 'scene') {
      const isAlreadyInPromises = promises.some((p) => {
        const pChap = (p.chapter_id || '').split(':').pop() || '';
        if (pChap && aChap && pChap !== aChap) return false;
        if (app.quote && p.quote) {
          const aQ = app.quote.slice(0, 30).trim().toLowerCase();
          const pQ = p.quote.slice(0, 30).trim().toLowerCase();
          if (aQ && pQ && (aQ.includes(pQ) || pQ.includes(aQ))) return true;
        }
        if (app.block_id && p.block_id && app.block_id === p.block_id) return true;
        if (app.paragraph_index && p.paragraph_index && app.paragraph_index === p.paragraph_index) return true;
        return aChap === pChap && (p.kind === 'scene' || !p.kind);
      });

      const hasAnySceneInChap = promises.some((p) => ((p.chapter_id || '').split(':').pop() || '') === aChap);
      if (isAlreadyInPromises || hasAnySceneInChap) continue;
      enriched.push(app);
      continue;
    }

    if (!isAbstractPlaceholder(app.quote) && app.paragraph_index && app.paragraph_index > 0) {
      enriched.push(app);
      continue;
    }

    const html = await getChapterContent(app.chapter_id);
    if (!html) {
      enriched.push(app);
      continue;
    }

    const mentions = extractParagraphMentions(html, entityId, entityName, aliases);
    if (mentions.length === 0) {
      enriched.push(app);
      continue;
    }

    for (let mIdx = 0; mIdx < mentions.length; mIdx++) {
      const m = mentions[mIdx];
      const key = `${aChap}_para_${m.paragraphIndex}`;
      if (seenParagraphKeys.has(key)) continue;
      seenParagraphKeys.add(key);
      if (isMentionCoveredByPromise(m, app.chapter_id, promises)) continue;

      enriched.push({
        ...app,
        id: `${app.chapter_id}-mention-${m.paragraphIndex}-${mIdx}`,
        source: 'mention',
        quote: m.text,
        paragraph_index: m.paragraphIndex,
        block_id: m.blockId,
      });
    }
  }

  return enriched;
}

export async function enrichMultiJourneyScenes(
  projectId: string,
  scenes: MultiJourneyScene[]
): Promise<MultiJourneyScene[]> {
  if (!scenes || scenes.length === 0) return [];
  const { getChapterContent } = createChapterContentLoader(projectId);
  const enriched: MultiJourneyScene[] = [];
  const seenSceneKeys = new Set<string>();

  for (const scene of scenes) {
    if (!scene.chapter_id) continue;
    const cleanChap = scene.chapter_id.split(':').pop() || scene.chapter_id;
    const sceneKey = `${cleanChap}_scene_${scene.id || scene.paragraph_index || scene.sort_order}`;
    if (seenSceneKeys.has(sceneKey)) continue;
    seenSceneKeys.add(sceneKey);

    if (!isAbstractPlaceholder(scene.quote) && scene.paragraph_index && scene.paragraph_index > 0) {
      enriched.push(scene);
      continue;
    }

    const html = await getChapterContent(scene.chapter_id);
    if (!html) {
      enriched.push(scene);
      continue;
    }

    const names = scene.present_entities?.map((e) => e.entity_name).filter(Boolean) || [];
    const firstEntity = scene.present_entities?.[0];
    const mentions = extractParagraphMentions(html, firstEntity?.entity_id || '', names[0] || '', names.slice(1));
    if (mentions.length > 0) {
      enriched.push({ ...scene, quote: mentions[0].text, paragraph_index: mentions[0].paragraphIndex, block_id: mentions[0].blockId });
    } else {
      enriched.push(scene);
    }
  }

  return enriched;
}

export async function enrichJourneyEvents(
  projectId: string,
  events: JourneyEvent[]
): Promise<JourneyEvent[]> {
  if (!events || events.length === 0) return [];
  const { chapterStore, getChapterContent } = createChapterContentLoader(projectId);
  const enriched: JourneyEvent[] = [];

  for (const ev of events) {
    let targetChapId = ev.chapter_id;
    let targetChapTitle = ev.chapter_title;
    let targetChapOrder = ev.chapter_order;
    let foundMention: ChapterParagraphMention | null = null;

    if (!targetChapId) {
      if (!chapterStore.chapters || chapterStore.chapters.length === 0) {
        try {
          await chapterStore.loadChapters(projectId);
        } catch (err) {
          console.warn('[CharacterJourney] Failed to load chapters for manuscript enrichment:', err);
        }
      }
      for (const ch of chapterStore.chapters || []) {
        if (!ch.id) continue;
        const html = await getChapterContent(ch.id);
        if (!html) continue;
        const mentions = extractParagraphMentions(html, ev.event_id, ev.event_title, []);
        if (mentions.length > 0) {
          targetChapId = ch.id;
          targetChapTitle = ch.title || undefined;
          targetChapOrder = ch.sort_order !== null && ch.sort_order !== undefined ? Number(ch.sort_order) : undefined;
          foundMention = mentions[0];
          break;
        }
      }
    } else {
      if (ev.quote && !isAbstractPlaceholder(ev.quote) && ev.paragraph_index && ev.paragraph_index > 0 && ev.block_id) {
        enriched.push(ev);
        continue;
      }
      const html = await getChapterContent(targetChapId);
      if (html) {
        const mentions = extractParagraphMentions(html, ev.event_id, ev.event_title, []);
        if (mentions.length > 0) foundMention = mentions[0];
      }
    }

    enriched.push(
      foundMention
        ? {
            ...ev,
            chapter_id: targetChapId,
            chapter_title: targetChapTitle,
            chapter_order: targetChapOrder,
            quote: foundMention.text,
            paragraph_index: foundMention.paragraphIndex,
            block_id: foundMention.blockId,
          }
        : { ...ev, chapter_id: targetChapId, chapter_title: targetChapTitle, chapter_order: targetChapOrder }
    );
  }

  return enriched;
}
