import type { JourneyPromise } from '../CharacterJourney.model';

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

function extractTopBlocks(chapterHtml: string): Element[] {
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
    if (
      el.classList.contains('editor-scene-header') ||
      el.classList.contains('editor-scene-ribbon') ||
      el.classList.contains('semantic-tag-badge')
    ) {
      continue;
    }
    if (topBlocks.some((p) => p.contains(el))) continue;
    topBlocks.push(el);
  }
  return topBlocks;
}

function extractCleanElementText(el: Element): string {
  const clone = el.cloneNode(true) as HTMLElement;
  const icons = clone.querySelectorAll('.entity-icon, .chip-icon, .mention-icon, .btn-icon, .semantic-tag-badge');
  icons.forEach((ic) => ic.remove());
  return (clone.textContent || '').trim();
}

export function findParagraphIndexByQuote(
  chapterHtml: string,
  quote: string
): { paragraphIndex: number; blockId: string } | null {
  if (!chapterHtml || !quote || !quote.trim()) return null;

  const topBlocks = extractTopBlocks(chapterHtml);
  const cleanQ = quote.replace(/[«»""''„“—–−.,!?:;…()-]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
  const firstLine = cleanQ.slice(0, 40).trim();
  if (!firstLine) return null;

  for (let i = 0; i < topBlocks.length; i++) {
    const el = topBlocks[i];
    const cleanText = extractCleanElementText(el)
      .replace(/[«»""''„“—–−.,!?:;…()-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
    if (cleanText.includes(firstLine) || firstLine.includes(cleanText)) {
      const blockId = el.getAttribute('data-block-id') || el.getAttribute('data-id') || `para-${i + 1}`;
      return { paragraphIndex: i + 1, blockId };
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

  const searchTerms = [entityName, ...aliases].map((s) => s.trim().toLowerCase()).filter(Boolean);

  if (!chapterHtml.includes('<')) {
    const lines = chapterHtml.split(/\r?\n\r?\n/);
    const results: ChapterParagraphMention[] = [];
    lines.forEach((line, idx) => {
      const lower = line.toLowerCase();
      if (searchTerms.some((term) => lower.includes(term))) {
        results.push({ text: line.trim(), paragraphIndex: idx + 1, blockId: `para-${idx + 1}` });
      }
    });
    return results;
  }

  const topBlocks = extractTopBlocks(chapterHtml);
  const cleanId = entityId.replace(/^entities:/, '').toLowerCase();
  const results: ChapterParagraphMention[] = [];

  topBlocks.forEach((el, idx) => {
    const rawHtml = el.innerHTML.toLowerCase();
    const hasIdMatch =
      cleanId.length > 0 &&
      (rawHtml.includes(cleanId) || rawHtml.includes(encodeURIComponent(cleanId)));

    let hasNameMatch = searchTerms.some(
      (term) => rawHtml.includes(`((${term}`) || rawHtml.includes(`((${term}))`)
    );

    const cleanText = extractCleanElementText(el);
    if (!hasIdMatch && !hasNameMatch) {
      const lowerText = cleanText.toLowerCase();
      if (searchTerms.some((term) => lowerText.includes(term))) {
        hasNameMatch = true;
      }
    }

    if ((hasIdMatch || hasNameMatch) && cleanText.length > 0) {
      const blockId = el.getAttribute('data-block-id') || el.getAttribute('data-id') || `para-${idx + 1}`;
      results.push({ text: cleanText, paragraphIndex: idx + 1, blockId });
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

  return promises.some((p) => {
    const pChap = (p.chapter_id || '').split(':').pop() || '';
    if (pChap && pChap !== cleanTargetChap) return false;

    if (typeof p.paragraph_index === 'number' && p.paragraph_index > 0 && p.paragraph_index === mention.paragraphIndex) {
      return true;
    }
    if (p.block_id && (p.block_id === mention.blockId || p.block_id.endsWith(`_${mention.blockId}`))) {
      return true;
    }

    const checkRange = (raw: string) => {
      const rangeMatch = raw.match(/para-(\d+)\.\.para-(\d+)/);
      if (!rangeMatch) return false;
      const start = parseInt(rangeMatch[1], 10);
      const end = parseInt(rangeMatch[2], 10);
      return mention.paragraphIndex >= start && mention.paragraphIndex <= end;
    };

    if (p.block_id && checkRange(p.block_id)) return true;

    const bIds = (p as unknown as { block_ids?: string[] }).block_ids;
    if (Array.isArray(bIds) && (bIds.includes(mention.blockId) || bIds.some(checkRange))) {
      return true;
    }

    if (p.quote && p.quote.trim().length > 10) {
      const pClean = p.quote.replace(/[«»""''„“—–−.,!?:;…()-]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
      const mClean = mention.text.replace(/[«»""''„“—–−.,!?:;…()-]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
      const firstLine = mClean.slice(0, 35).trim();
      if (firstLine && (pClean.includes(firstLine) || mClean.includes(pClean.slice(0, 35).trim()))) {
        return true;
      }
    }

    return false;
  });
}

