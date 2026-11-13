export function findSceneElements(
  editorDom: HTMLElement,
  quote?: string,
  blockId?: string,
  paragraphIndex?: number,
  blockIds?: string[]
): HTMLElement[] {
  const topBlocks = Array.from(
    editorDom.querySelectorAll(':scope > p, :scope > blockquote, :scope > h1, :scope > h2, :scope > h3, :scope > div.semantic-paragraph-node, :scope > div')
  ) as HTMLElement[];

  if (topBlocks.length === 0) return [];

  let minParaIdx = -1;
  let maxParaIdx = -1;
  const paraIndices: number[] = [];

  if (blockIds && blockIds.length > 0) {
    const cleanTargetIds = blockIds
      .filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
      .map((id) => (id.split(':').pop() || id).replace(/[`⟨⟩"']/g, '').trim().toLowerCase());

    const matchedByExplicitDomAttr = topBlocks.filter((el) => {
      const explicitAttr = el.getAttribute('data-block-id') || el.getAttribute('data-id');
      if (!explicitAttr) return false;
      const bId = explicitAttr.trim().toLowerCase();
      const cleanBId = bId.split(':').pop() || bId;
      return (
        cleanTargetIds.includes(bId) ||
        cleanTargetIds.includes(cleanBId) ||
        cleanTargetIds.some((t) => t.endsWith(`_${cleanBId}`) || t === `blk_${cleanBId}`)
      );
    });

    if (matchedByExplicitDomAttr.length > 0) {
      return matchedByExplicitDomAttr;
    }

    for (const t of cleanTargetIds) {
      const match = t.match(/para-(\d+)/);
      if (match) {
        const pNum = parseInt(match[1], 10);
        if (pNum >= 1) {
          const idx0 = pNum - 1;
          if (!paraIndices.includes(idx0)) {
            paraIndices.push(idx0);
          }
        }
      }
    }

    if (paraIndices.length > 0) {
      paraIndices.sort((a, b) => a - b);
      minParaIdx = paraIndices[0];
      maxParaIdx = paraIndices[paraIndices.length - 1];
    }
  }

  const trimmedQuote = (quote || '').trim();

  if (!trimmedQuote && paraIndices.length > 0) {
    return paraIndices
      .filter((idx0) => idx0 >= 0 && idx0 < topBlocks.length)
      .map((idx0) => topBlocks[idx0]);
  }

  const cleanString = (s: string) =>
    s
      .replace(/[«»""''„“]/g, '')
      .replace(/[—–−-]/g, ' ')
      .replace(/[.,!?:;…()]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();

  const extractText = (el: HTMLElement) => {
    const clone = el.cloneNode(true) as HTMLElement;
    const icons = clone.querySelectorAll('.entity-icon, .chip-icon, .mention-icon, .btn-icon, .semantic-tag-badge');
    icons.forEach((ic) => ic.remove());
    return cleanString(clone.textContent || '');
  };

  const blockTexts = topBlocks.map((el) => extractText(el));
  const quoteLines = trimmedQuote
    ? trimmedQuote.split(/[\r\n]+/).map(cleanString).filter((s) => s.length >= 4)
    : [];
  const quoteChunks = trimmedQuote
    ? trimmedQuote.split(/[\r\n]+|[.!?—–]+\s+/).map(cleanString).filter((s) => s.length > 5)
    : [];

  const expectedSpan = minParaIdx !== -1 && maxParaIdx !== -1 ? Math.max(1, maxParaIdx - minParaIdx + 1) : 0;

  let startIndex = -1;
  if (blockId && blockId.trim()) {
    const safeId = blockId.replace(/[`⟨⟩"']/g, '').trim();
    const cleanId = safeId.split(':').pop() || safeId;
    startIndex = topBlocks.findIndex((el) => {
      const bId = el.getAttribute('data-block-id') || el.getAttribute('data-id');
      return Boolean(bId && (bId === safeId || bId === cleanId || safeId.endsWith(`_${bId}`) || cleanId.endsWith(`_${bId}`)));
    });
    if (startIndex === -1 && minParaIdx === -1) {
      const m = cleanId.toLowerCase().match(/para-(\d+)/);
      if (m) minParaIdx = parseInt(m[1], 10) - 1;
    }
  }

  if (startIndex === -1 && trimmedQuote) {
    const firstLine = quoteLines[0] || quoteChunks[0] || cleanString(trimmedQuote.slice(0, 45));
    const startAnchor = firstLine.length > 45 ? firstLine.slice(0, 45).trim() : firstLine;
    if (startAnchor && startAnchor.length >= 4) {
      startIndex = blockTexts.findIndex((text) => {
        if (!text || text.length < 4) return false;
        return text.includes(startAnchor) || (text.length >= 10 && startAnchor.includes(text));
      });
    }
  }

  if (startIndex === -1) {
    if (minParaIdx >= 0 && minParaIdx < topBlocks.length) {
      startIndex = minParaIdx;
    } else if (typeof paragraphIndex === 'number' && paragraphIndex > 0) {
      startIndex = Math.max(0, Math.min(topBlocks.length - 1, paragraphIndex - 1));
    }
  }

  if (startIndex === -1) return [];

  let endIndex = startIndex;
  const isMultiParagraph = expectedSpan > 1 || quoteLines.length > 1 || trimmedQuote.includes('\n');

  if (isMultiParagraph) {
    const lastLine =
      quoteLines.length > 1
        ? quoteLines[quoteLines.length - 1]
        : quoteChunks.length > 1
          ? quoteChunks[quoteChunks.length - 1]
          : cleanString(trimmedQuote.slice(-45));
    const endAnchor = lastLine.length > 45 ? lastLine.slice(-45).trim() : lastLine;

    const maxSearchIdx = Math.min(
      topBlocks.length - 1,
      startIndex + Math.max(expectedSpan, quoteLines.length, 2) + 12
    );

    if (endAnchor && endAnchor.length >= 4) {
      for (let i = maxSearchIdx; i >= startIndex; i--) {
        const text = blockTexts[i];
        if (text && text.length >= 4 && (text.includes(endAnchor) || (text.length >= 10 && endAnchor.includes(text)))) {
          endIndex = i;
          break;
        }
      }
    }

    if (endIndex === startIndex && expectedSpan > 1) {
      endIndex = Math.min(topBlocks.length - 1, startIndex + expectedSpan - 1);
    }
  }

  return topBlocks.slice(startIndex, endIndex + 1);
}

