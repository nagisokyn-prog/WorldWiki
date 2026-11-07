import { chapterService } from '@/services/chapter.service';
import { useChapterStore } from '@/stores/chapter.store';
import type { JourneyAppearance, JourneyEvent, JourneyPromise, MultiJourneyScene } from '../CharacterJourney.model';

export interface ChapterParagraphMention {
  text: string;
  paragraphIndex: number;
  blockId: string;
}

export function isAbstractPlaceholder(quote?: string | null): boolean {
  if (!quote || !quote.trim()) return true;
  const t = quote.trim();
  return (
    t.startsWith('Упоминание в тексте') ||
    t.startsWith('Сцена в') ||
    t.startsWith('Совместная сцена') ||
    t.startsWith('Появление:') ||
    t.startsWith('Глава #') ||
    t.startsWith('Участие:') ||
    t === 'Участник события' ||
    /^Глава «.+»$/.test(t) ||
    /^Событие «.+»$/.test(t)
  );
}

export function findParagraphIndexByQuote(
  chapterHtml: string,
  quote: string
): { paragraphIndex: number; blockId: string } | null {
  if (!chapterHtml || !quote || !quote.trim()) return null;

  const parser = new DOMParser();
  const doc = parser.parseFromString(chapterHtml, 'text/html');
  const rawBlocks = Array.from(
    doc.body.querySelectorAll('p, .semantic-paragraph-node, blockquote, h1, h2, h3, h4, h5, h6, pre')
  );
  const blocks = rawBlocks.length > 0
    ? rawBlocks
    : Array.from(doc.body.querySelectorAll(':scope > div, :scope > p'));

  const topBlocks: Element[] = [];
  for (const el of blocks) {
    if (el.classList.contains('editor-scene-header') || el.classList.contains('editor-scene-ribbon') || el.classList.contains('semantic-tag-badge')) continue;
    if (topBlocks.some(p => p.contains(el))) continue;
    topBlocks.push(el);
  }

  const cleanQ = quote.replace(/[«»""''„“—–−.,!?:;…()\-]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
  const firstLine = cleanQ.slice(0, 40).trim();
  if (!firstLine) return null;

  for (let i = 0; i < topBlocks.length; i++) {
    const el = topBlocks[i];
    const clone = el.cloneNode(true) as HTMLElement;
    const icons = clone.querySelectorAll('.entity-icon, .chip-icon, .mention-icon, .btn-icon, .semantic-tag-badge');
    icons.forEach(ic => ic.remove());
    const cleanText = (clone.textContent || '').replace(/[«»""''„“—–−.,!?:;…()\-]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
    if (cleanText.includes(firstLine) || firstLine.includes(cleanText)) {
      const blockId = el.getAttribute('data-block-id') || el.getAttribute('data-id') || `para-${i + 1}`;
      return {
        paragraphIndex: i + 1,
        blockId,
      };
    }
  }

  return null;
}

export function extractParagraphMentions(
  chapterHtml: string,
  entityId: string,
  entityName: string,
  aliases: string[] = []
): ChapterParagraphMention[] {
  if (!chapterHtml || !chapterHtml.trim()) return [];

  if (!chapterHtml.includes('<')) {
    const lines = chapterHtml.split(/\r?\n\r?\n/);
    const searchTerms = [entityName, ...aliases].map(s => s.trim().toLowerCase()).filter(Boolean);
    const results: ChapterParagraphMention[] = [];

    lines.forEach((line, idx) => {
      const lower = line.toLowerCase();
      if (searchTerms.some(term => lower.includes(term))) {
        results.push({
          text: line.trim(),
          paragraphIndex: idx + 1,
          blockId: `para-${idx + 1}`,
        });
      }
    });

    return results;
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(chapterHtml, 'text/html');
  const rawBlocks = Array.from(
    doc.body.querySelectorAll('p, .semantic-paragraph-node, blockquote, h1, h2, h3, h4, h5, h6, pre')
  );
  const blocks = rawBlocks.length > 0
    ? rawBlocks
    : Array.from(doc.body.querySelectorAll(':scope > div, :scope > p'));

  const topBlocks: Element[] = [];
  for (const el of blocks) {
    if (el.classList.contains('editor-scene-header') || el.classList.contains('editor-scene-ribbon') || el.classList.contains('semantic-tag-badge')) continue;
    if (topBlocks.some(p => p.contains(el))) continue;
    topBlocks.push(el);
  }

  const cleanId = entityId.replace(/^entities:/, '').toLowerCase();
  const searchTerms = [entityName, ...aliases].map(s => s.trim().toLowerCase()).filter(Boolean);
  const results: ChapterParagraphMention[] = [];

  topBlocks.forEach((el, idx) => {
    const rawHtml = el.innerHTML.toLowerCase();

    // 1. Direct ID match in attributes: data-entity-id="entities:kira" or encoded id
    const hasIdMatch =
      cleanId.length > 0 &&
      (rawHtml.includes(cleanId) || rawHtml.includes(encodeURIComponent(cleanId)));

    // 2. Mention syntax match: ((Name)) or ((Name))[...]
    let hasNameMatch = false;
    for (const term of searchTerms) {
      if (rawHtml.includes(`((${term}`) || rawHtml.includes(`((${term}))`)) {
        hasNameMatch = true;
        break;
      }
    }

    // 3. Fallback: text contains name/alias
    if (!hasIdMatch && !hasNameMatch) {
      const clone = el.cloneNode(true) as HTMLElement;
      const icons = clone.querySelectorAll('.entity-icon, .chip-icon, .mention-icon, .btn-icon, .semantic-tag-badge');
      icons.forEach(ic => ic.remove());
      const text = (clone.textContent || '').toLowerCase();
      if (searchTerms.some(term => text.includes(term))) {
        hasNameMatch = true;
      }
    }

    if (hasIdMatch || hasNameMatch) {
      const clone = el.cloneNode(true) as HTMLElement;
      const icons = clone.querySelectorAll('.entity-icon, .chip-icon, .mention-icon, .btn-icon, .semantic-tag-badge');
      icons.forEach(ic => ic.remove());
      const cleanText = (clone.textContent || '').trim();
      const blockId = el.getAttribute('data-block-id') || el.getAttribute('data-id') || `para-${idx + 1}`;

      if (cleanText.length > 0) {
        results.push({
          text: cleanText,
          paragraphIndex: idx + 1,
          blockId,
        });
      }
    }
  });

  return results;
}

export function isMentionCoveredByPromise(
  mention: ChapterParagraphMention,
  chapId: string,
  promises: JourneyPromise[] = []
): boolean {
  if (!promises || promises.length === 0) return false;
  const cleanTargetChap = chapId.split(':').pop() || chapId;

  return promises.some(p => {
    const pChap = (p.chapter_id || '').split(':').pop() || '';
    if (pChap && pChap !== cleanTargetChap) return false;

    // 1. Exact paragraph index match
    if (typeof p.paragraph_index === 'number' && p.paragraph_index > 0 && p.paragraph_index === mention.paragraphIndex) {
      return true;
    }

    // 2. Block ID match
    if (p.block_id && (p.block_id === mention.blockId || p.block_id.endsWith(`_${mention.blockId}`))) {
      return true;
    }

    // 3. Range match if block_id is like 'para-3..para-7'
    if (p.block_id) {
      const rangeMatch = p.block_id.match(/para-(\d+)\.\.para-(\d+)/);
      if (rangeMatch) {
        const start = parseInt(rangeMatch[1], 10);
        const end = parseInt(rangeMatch[2], 10);
        if (mention.paragraphIndex >= start && mention.paragraphIndex <= end) {
          return true;
        }
      }
    }

    // 4. Multiple block IDs match or range in block_ids
    const bIds = (p as unknown as { block_ids?: string[] }).block_ids;
    if (Array.isArray(bIds)) {
      if (bIds.includes(mention.blockId)) return true;
      for (const b of bIds) {
        const rangeMatch = b.match(/para-(\d+)\.\.para-(\d+)/);
        if (rangeMatch) {
          const start = parseInt(rangeMatch[1], 10);
          const end = parseInt(rangeMatch[2], 10);
          if (mention.paragraphIndex >= start && mention.paragraphIndex <= end) {
            return true;
          }
        }
      }
    }

    // 4. Quote text inclusion match (if scene quote contains the paragraph snippet)
    if (p.quote && p.quote.trim().length > 10) {
      const pClean = p.quote.replace(/[«»""''„“—–−.,!?:;…()\-]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
      const mClean = mention.text.replace(/[«»""''„“—–−.,!?:;…()\-]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
      const firstLine = mClean.slice(0, 35).trim();
      if (firstLine && (pClean.includes(firstLine) || mClean.includes(pClean.slice(0, 35).trim()))) {
        return true;
      }
    }

    return false;
  });
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

    const cached = chapterStore.chapters?.find(c => (c.id ? String(c.id).split(':').pop() : '') === cleanId);
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

  // Step 1: Also resolve paragraph_index and block_id on promises if missing or defaulted to 1
  for (const prom of promises) {
    if (prom.chapter_id && prom.quote && (!prom.paragraph_index || prom.paragraph_index <= 1 || !prom.block_id)) {
      const html = await getChapterContent(prom.chapter_id);
      if (html) {
        const found = findParagraphIndexByQuote(html, prom.quote);
        if (found) {
          prom.paragraph_index = found.paragraphIndex;
          if (!prom.block_id) {
            prom.block_id = found.blockId;
          }
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

    // If it's a scene, check if it's already represented in promises
    if (app.source === 'scene') {
      const isAlreadyInPromises = promises.some(p => {
        const pChap = (p.chapter_id || '').split(':').pop() || '';
        if (pChap && aChap && pChap !== aChap) return false;

        // Quote text overlap
        if (app.quote && p.quote) {
          const aQ = app.quote.slice(0, 30).trim().toLowerCase();
          const pQ = p.quote.slice(0, 30).trim().toLowerCase();
          if (aQ && pQ && (aQ.includes(pQ) || pQ.includes(aQ))) return true;
        }

        // Block id or paragraph index match
        if (app.block_id && p.block_id && app.block_id === p.block_id) return true;
        if (app.paragraph_index && p.paragraph_index && app.paragraph_index === p.paragraph_index) return true;

        // If in the same chapter and both are scenes
        if (aChap === pChap && (p.kind === 'scene' || !p.kind)) return true;

        return false;
      });

      // If a promise represents this scene, skip duplicate from appearances!
      if (isAlreadyInPromises) {
        continue;
      }

      // If there are ANY scenes in promises for this chapter, skip duplicate appearance scene
      const hasAnySceneInChap = promises.some(p => ((p.chapter_id || '').split(':').pop() || '') === aChap);
      if (hasAnySceneInChap) {
        continue;
      }

      enriched.push(app);
      continue;
    }

    // If it already has a real manuscript quote and paragraph index, preserve it
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

      // If this mention is already inside an existing scene promise, do not show it separately
      if (isMentionCoveredByPromise(m, app.chapter_id, promises)) {
        continue;
      }

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

    const names = scene.present_entities?.map(e => e.entity_name).filter(Boolean) || [];
    const firstEntity = scene.present_entities?.[0];
    const mentions = extractParagraphMentions(
      html,
      firstEntity?.entity_id || '',
      names[0] || '',
      names.slice(1)
    );

    if (mentions.length > 0) {
      enriched.push({
        ...scene,
        quote: mentions[0].text,
        paragraph_index: mentions[0].paragraphIndex,
        block_id: mentions[0].blockId,
      });
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

    const cached = chapterStore.chapters?.find(c => (c.id ? String(c.id).split(':').pop() : '') === cleanId);
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
        } catch {
          // ignore
        }
      }
      if (chapterStore.chapters && chapterStore.chapters.length > 0) {
        for (const ch of chapterStore.chapters) {
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
      }
    } else {
      if (ev.quote && !isAbstractPlaceholder(ev.quote) && ev.paragraph_index && ev.paragraph_index > 0 && ev.block_id) {
        enriched.push(ev);
        continue;
      }
      const html = await getChapterContent(targetChapId);
      if (html) {
        const mentions = extractParagraphMentions(html, ev.event_id, ev.event_title, []);
        if (mentions.length > 0) {
          foundMention = mentions[0];
        }
      }
    }

    if (foundMention) {
      enriched.push({
        ...ev,
        chapter_id: targetChapId,
        chapter_title: targetChapTitle,
        chapter_order: targetChapOrder,
        quote: foundMention.text,
        paragraph_index: foundMention.paragraphIndex,
        block_id: foundMention.blockId,
      });
    } else {
      enriched.push({
        ...ev,
        chapter_id: targetChapId,
        chapter_title: targetChapTitle,
        chapter_order: targetChapOrder,
      });
    }
  }

  return enriched;
}
