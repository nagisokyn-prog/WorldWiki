import type { Node as ProseMirrorNode } from '@tiptap/pm/model';

export interface ResolvedDocBlock {
  pos: number;
  node: ProseMirrorNode;
  index: number;
}

interface DocBlockEntry extends ResolvedDocBlock {
  text: string;
  blockId: string;
}

export function cleanNarrativeText(s: string): string {
  return s
    .replace(/[«»""''„“]/g, '')
    .replace(/[—–−-]/g, ' ')
    .replace(/[.,!?:;…()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function normalizeBlockId(raw?: string | null): string {
  if (!raw) return '';
  return (raw.split(':').pop() || raw).replace(/[`⟨⟩"']/g, '').trim().toLowerCase();
}

export function isSyntheticParaId(id: string): boolean {
  return /^para-\d+$/i.test(id);
}

function doesBlockIdMatch(blockId: string, targetId: string): boolean {
  if (!blockId || !targetId) return false;
  return (
    blockId === targetId ||
    targetId.endsWith(`_${blockId}`) ||
    targetId === `blk_${blockId}` ||
    blockId.endsWith(`_${targetId}`)
  );
}

function textMatchesAnchor(blockText: string, anchor: string): boolean {
  if (!blockText || !anchor || blockText.length < 4 || anchor.length < 4) return false;
  return blockText.includes(anchor) || (blockText.length >= 10 && anchor.includes(blockText));
}

function collectDocBlocks(doc: ProseMirrorNode): DocBlockEntry[] {
  const entries: DocBlockEntry[] = [];
  let idx = 0;
  doc.forEach((node, offset) => {
    const rawId = (node.attrs?.block_id as string | undefined) || (node.attrs?.id as string | undefined);
    entries.push({
      pos: offset,
      node,
      index: idx,
      text: cleanNarrativeText(node.textContent || ''),
      blockId: normalizeBlockId(rawId)
    });
    idx++;
  });
  return entries;
}

/**
 * Единый резолвер абзацев внутри ProseMirror `doc` для рамок сцен и перехода к сцене.
 *
 * Приоритеты:
 * 1) Реальные стабильные `block_id` (UUID / `blk_*`, не синтетические `para-N`) с обязательной
 *    проверкой консистентности против `quote` (чтобы съехавший/перебитый ID не подсвечивал чужой абзац).
 * 2) Поиск по тексту `quote` (с `para-N` / `paragraphIndex` только как tie-breaker при дублях).
 * 3) Фоллбэк на `para-N` / `paragraphIndex`, только если цитата отсутствует.
 */
export function findNarrativeBlocksInDoc(
  doc: ProseMirrorNode,
  quote?: string,
  blockId?: string,
  paragraphIndex?: number,
  blockIds?: string[]
): ResolvedDocBlock[] {
  const blocks = collectDocBlocks(doc);
  if (blocks.length === 0) return [];

  const allInputIds = [
    ...(blockIds || []),
    ...(blockId ? [blockId] : [])
  ]
    .filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
    .map(normalizeBlockId)
    .filter(Boolean);

  const realTargetIds = Array.from(new Set(allInputIds.filter((id) => !isSyntheticParaId(id))));
  const paraIndices: number[] = [];
  for (const id of allInputIds) {
    const m = id.match(/^para-(\d+)$/);
    if (m) {
      const idx0 = parseInt(m[1], 10) - 1;
      if (idx0 >= 0 && !paraIndices.includes(idx0)) {
        paraIndices.push(idx0);
      }
    }
  }
  paraIndices.sort((a, b) => a - b);

  const minParaIdx = paraIndices.length > 0 ? paraIndices[0] : -1;
  const maxParaIdx = paraIndices.length > 0 ? paraIndices[paraIndices.length - 1] : -1;
  const hintIndex = minParaIdx >= 0
    ? minParaIdx
    : (typeof paragraphIndex === 'number' && paragraphIndex > 0 ? paragraphIndex - 1 : -1);

  const trimmedQuote = (quote || '').trim();
  const rawLines = trimmedQuote ? trimmedQuote.split(/\r?\n/).map(cleanNarrativeText) : [];
  const rawLineCount = rawLines.length;
  const quoteLines = trimmedQuote
    ? trimmedQuote.split(/[\r\n]+/).map(cleanNarrativeText).filter((s) => s.length >= 4)
    : [];
  const quoteChunks = trimmedQuote
    ? trimmedQuote.split(/[\r\n]+|[.!?—–]+\s+/).map(cleanNarrativeText).filter((s) => s.length > 5)
    : [];

  const firstLine = quoteLines[0] || quoteChunks[0] || rawLines[0] || cleanNarrativeText(trimmedQuote.slice(0, 45));
  const startAnchor = firstLine.length > 45 ? firstLine.slice(0, 45).trim() : firstLine;

  const isMultiParagraph =
    (minParaIdx !== -1 && maxParaIdx > minParaIdx) ||
    realTargetIds.length > 1 ||
    rawLineCount > 1 ||
    quoteLines.length > 1 ||
    trimmedQuote.includes('\n');

  const lastRawLine = rawLines.length > 1 ? rawLines[rawLines.length - 1] : '';
  const lastLine =
    quoteLines.length > 1
      ? quoteLines[quoteLines.length - 1]
      : quoteChunks.length > 1
        ? quoteChunks[quoteChunks.length - 1]
        : (lastRawLine || cleanNarrativeText(trimmedQuote.slice(-45)));
  const endAnchor = lastLine.length > 45 ? lastLine.slice(-45).trim() : lastLine;

  const expandFromStart = (startBlock: DocBlockEntry): ResolvedDocBlock[] => {
    let endIndex = startBlock.index;
    if (isMultiParagraph) {
      const expectedSpan = Math.max(
        realTargetIds.length,
        minParaIdx !== -1 && maxParaIdx !== -1 ? maxParaIdx - minParaIdx + 1 : 0,
        rawLineCount,
        quoteLines.length,
        2
      );
      const maxSearchIdx = Math.min(blocks.length - 1, startBlock.index + expectedSpan + 12);

      if (endAnchor && endAnchor.length >= 4) {
        for (let i = maxSearchIdx; i >= startBlock.index; i--) {
          if (textMatchesAnchor(blocks[i].text, endAnchor)) {
            endIndex = i;
            break;
          }
        }
      } else if (lastRawLine && lastRawLine.length > 0) {
        const expectedLastIdx = startBlock.index + expectedSpan - 1;
        if (expectedLastIdx < blocks.length && blocks[expectedLastIdx].text === lastRawLine) {
          endIndex = expectedLastIdx;
        }
      }
      if (endIndex === startBlock.index && expectedSpan > 1) {
        endIndex = Math.min(blocks.length - 1, startBlock.index + expectedSpan - 1);
      }
    }
    return blocks.slice(startBlock.index, endIndex + 1);
  };

  // 1. Поиск по реальным UUID / block_id (НЕ para-N)
  const matchedReal = realTargetIds.length > 0
    ? blocks.filter((b) => b.blockId && realTargetIds.some((t) => doesBlockIdMatch(b.blockId, t)))
    : [];

  if (matchedReal.length > 0) {
    const firstMatched = matchedReal[0];
    const lastMatched = matchedReal[matchedReal.length - 1];
    const hasQuoteAnchor = Boolean(startAnchor && startAnchor.length >= 4);

    if (!hasQuoteAnchor) {
      if (matchedReal.length >= realTargetIds.length) {
        return blocks.slice(firstMatched.index, lastMatched.index + 1);
      }
    } else if (realTargetIds.length === 1 && !isMultiParagraph) {
      if (textMatchesAnchor(firstMatched.text, startAnchor)) {
        return [firstMatched];
      }
    } else if (realTargetIds.length === 1 && isMultiParagraph) {
      if (textMatchesAnchor(firstMatched.text, startAnchor)) {
        return expandFromStart(firstMatched);
      }
    } else if (matchedReal.length >= 2 || matchedReal.length >= realTargetIds.length) {
      const startOk = textMatchesAnchor(firstMatched.text, startAnchor);
      const endOk = !endAnchor || endAnchor.length < 4 || textMatchesAnchor(lastMatched.text, endAnchor);
      if (startOk && endOk) {
        return blocks.slice(firstMatched.index, lastMatched.index + 1);
      }
    }
  }

  // 2. Поиск по тексту цитаты (единый и точный путь при отсутствии/рассинхроне block_id)
  if (startAnchor && startAnchor.length >= 4) {
    const startCandidates = blocks.filter((b) => textMatchesAnchor(b.text, startAnchor));
    if (startCandidates.length > 0) {
      let chosenStart = startCandidates[0];
      if (startCandidates.length > 1 && hintIndex >= 0) {
        chosenStart = startCandidates.reduce((best, cur) =>
          Math.abs(cur.index - hintIndex) < Math.abs(best.index - hintIndex) ? cur : best
        );
      }

      return expandFromStart(chosenStart);
    }
  }

  // 3. Фоллбэк: только если цитата не помогла или её нет
  if (matchedReal.length > 0) {
    return matchedReal;
  }

  if (paraIndices.length > 0) {
    const byPara = paraIndices
      .filter((idx0) => idx0 >= 0 && idx0 < blocks.length)
      .map((idx0) => blocks[idx0]);
    if (byPara.length > 0) return byPara;
  }

  if (hintIndex >= 0 && hintIndex < blocks.length) {
    return [blocks[hintIndex]];
  }

  return [];
}
