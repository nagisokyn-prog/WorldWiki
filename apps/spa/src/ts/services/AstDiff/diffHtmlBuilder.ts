/**
 * @file diffHtmlBuilder.ts
 * @description Сервис построчного/поблочного сравнения HTML документа в стиле VS Code unified diff.
 * Анализирует абзацы между старой ревизией (было) и текущей версией (стало):
 * - Изменённый абзац: старый абзац сверху в красном блоке (diff-block-mod-del), новый снизу в зелёном блоке (diff-block-mod-ins).
 * - Чисто добавленный абзац: ярко-зелёный блок (diff-block-ins).
 * - Чисто удалённый абзац: красный блок (diff-block-del).
 * - Неизменённые абзацы: стандартный чистый вид без подсветок.
 */

export interface BlockSegment {
  tag: string;
  openTag: string;
  closeTag: string;
  innerHtml: string;
  cleanText: string;
}

/**
 * Извлекает чистый текст из HTML для точного сопоставления блоков
 */
export function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, '').trim();
}

/**
 * Разбивает HTML строку на массив блоков (абзацев, заголовков и т.д.)
 */
export function parseBlocks(html: string): BlockSegment[] {
  if (!html || !html.trim()) return [];

  const blockRegex = /(<([a-z0-9]+)(?:\s+[^>]*)?>)([\s\S]*?)(<\/\2>)/gi;
  const blocks: BlockSegment[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = blockRegex.exec(html)) !== null) {
    if (match.index > lastIndex) {
      const interstitial = html.slice(lastIndex, match.index).trim();
      if (interstitial) {
        blocks.push({
          tag: 'p',
          openTag: '<p>',
          closeTag: '</p>',
          innerHtml: interstitial,
          cleanText: stripTags(interstitial),
        });
      }
    }

    blocks.push({
      tag: match[2].toLowerCase(),
      openTag: match[1],
      closeTag: match[4],
      innerHtml: match[3],
      cleanText: stripTags(match[3]),
    });
    lastIndex = blockRegex.lastIndex;
  }

  if (lastIndex < html.length) {
    const trailing = html.slice(lastIndex).trim();
    if (trailing) {
      blocks.push({
        tag: 'p',
        openTag: '<p>',
        closeTag: '</p>',
        innerHtml: trailing,
        cleanText: stripTags(trailing),
      });
    }
  }

  if (blocks.length === 0 && html.trim()) {
    blocks.push({
      tag: 'p',
      openTag: '<p>',
      closeTag: '</p>',
      innerHtml: html,
      cleanText: stripTags(html),
    });
  }

  return blocks;
}

/**
 * Применяет класс диффа к блоку HTML
 */
function renderBlock(block: BlockSegment, diffClass?: string): string {
  if (!diffClass) {
    return `${block.openTag}${block.innerHtml}${block.closeTag}`;
  }

  const classAttrRegex = /class=["']([^"']*)["']/i;
  const match = classAttrRegex.exec(block.openTag);

  let newOpenTag: string;
  if (match) {
    const existingClasses = match[1];
    const combinedClasses = `${existingClasses} ${diffClass}`.trim();
    newOpenTag = block.openTag.replace(classAttrRegex, `class="${combinedClasses}" data-diff="${diffClass}"`);
  } else {
    // Вставляем class и data-diff перед закрывающей скобкой открывающего тега
    newOpenTag = block.openTag.replace(/>$/, ` class="${diffClass}" data-diff="${diffClass}">`);
  }

  return `${newOpenTag}${block.innerHtml}${block.closeTag}`;
}

/**
 * Вычисляет текстовое сходство (Жаккар / общие слова) между двумя строками [0..1]
 */
function computeTextSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  if (!a || !b) return 0;

  if (a.includes(b) || b.includes(a)) {
    return Math.min(a.length, b.length) / Math.max(a.length, b.length);
  }

  const wordsA = a.toLowerCase().split(/\s+/).filter(Boolean);
  const wordsB = b.toLowerCase().split(/\s+/).filter(Boolean);

  if (wordsA.length > 0 && wordsB.length > 0) {
    const setA = new Set(wordsA);
    const setB = new Set(wordsB);
    let common = 0;
    for (const w of setA) {
      if (setB.has(w)) common++;
    }
    const maxLen = Math.max(setA.size, setB.size);
    return maxLen === 0 ? 0 : common / maxLen;
  }

  return 0;
}

/**
 * Находит наибольшую общую подпоследовательность (LCS) точных совпадений блоков
 */
function findLcsExactMatches(
  base: BlockSegment[],
  target: BlockSegment[]
): Array<{ bIdx: number; tIdx: number }> {
  const n = base.length;
  const m = target.length;
  if (n === 0 || m === 0) return [];

  // Таблица LCS
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));

  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      if (base[i - 1].cleanText === target[j - 1].cleanText && base[i - 1].tag === target[j - 1].tag) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Восстановление совпадений
  const matches: Array<{ bIdx: number; tIdx: number }> = [];
  let i = n;
  let j = m;

  while (i > 0 && j > 0) {
    if (base[i - 1].cleanText === target[j - 1].cleanText && base[i - 1].tag === target[j - 1].tag) {
      matches.push({ bIdx: i - 1, tIdx: j - 1 });
      i--;
      j--;
    } else if (dp[i - 1][j] >= dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }

  return matches.reverse();
}

/**
 * Обрабатывает диапазон расхождений между двумя точками совпадения блоков
 */
function processDiffRange(
  baseSlice: BlockSegment[],
  targetSlice: BlockSegment[],
  resultHtml: string[]
): void {
  const n = baseSlice.length;
  const m = targetSlice.length;

  if (n === 0 && m === 0) return;

  // 1. Все блоки в target чисто добавлены
  if (n === 0) {
    for (const tb of targetSlice) {
      resultHtml.push(renderBlock(tb, 'diff-block-ins'));
    }
    return;
  }

  // 2. Все блоки в base чисто удалены
  if (m === 0) {
    for (const bb of baseSlice) {
      resultHtml.push(renderBlock(bb, 'diff-block-del'));
    }
    return;
  }

  // 3. Блоки 1 к 1 изменены (или одинаковое количество)
  if (n === m) {
    for (let i = 0; i < n; i++) {
      // Старый абзац сверху — в красный
      resultHtml.push(renderBlock(baseSlice[i], 'diff-block-mod-del'));
      // Новый абзац снизу — в зелёный
      resultHtml.push(renderBlock(targetSlice[i], 'diff-block-mod-ins'));
    }
    return;
  }

  // 4. Разное количество: ищем пары по схожести текста
  const matchedTargetIndices = new Set<number>();
  const matchedBaseIndices = new Set<number>();
  const pairs: Array<{ b: number; t: number; sim: number }> = [];

  for (let b = 0; b < n; b++) {
    for (let t = 0; t < m; t++) {
      const sim = computeTextSimilarity(baseSlice[b].cleanText, targetSlice[t].cleanText);
      if (sim > 0) {
        pairs.push({ b, t, sim });
      }
    }
  }

  // Сортируем пары по убыванию схожести
  pairs.sort((a, b) => b.sim - a.sim);

  const finalPairs: Array<{ b: number; t: number }> = [];
  for (const pair of pairs) {
    if (!matchedBaseIndices.has(pair.b) && !matchedTargetIndices.has(pair.t)) {
      matchedBaseIndices.add(pair.b);
      matchedTargetIndices.add(pair.t);
      finalPairs.push({ b: pair.b, t: pair.t });
    }
  }

  // Сортируем сопоставленные пары в порядке их следования
  finalPairs.sort((a, b) => a.t - b.t);

  let currentTargetIdx = 0;

  for (const pair of finalPairs) {
    // Несопоставленные target блоки до этой пары — чисто добавленные (ярко-зелёные)
    while (currentTargetIdx < pair.t) {
      if (!matchedTargetIndices.has(currentTargetIdx)) {
        resultHtml.push(renderBlock(targetSlice[currentTargetIdx], 'diff-block-ins'));
      }
      currentTargetIdx++;
    }

    // Сопоставленная пара: старый красный сверху, новый зелёный снизу
    resultHtml.push(renderBlock(baseSlice[pair.b], 'diff-block-mod-del'));
    resultHtml.push(renderBlock(targetSlice[pair.t], 'diff-block-mod-ins'));
    currentTargetIdx = pair.t + 1;
  }

  // Хвост несопоставленных target блоков
  while (currentTargetIdx < m) {
    if (!matchedTargetIndices.has(currentTargetIdx)) {
      resultHtml.push(renderBlock(targetSlice[currentTargetIdx], 'diff-block-ins'));
    }
    currentTargetIdx++;
  }

  // Несопоставленные base блоки — чисто удалённые
  for (let b = 0; b < n; b++) {
    if (!matchedBaseIndices.has(b)) {
      resultHtml.push(renderBlock(baseSlice[b], 'diff-block-del'));
    }
  }
}

/**
 * Строит HTML со встроенным поблочным Git/VS Code диффом.
 * 
 * @param baseHtml - Базовый текст (старый снимок из истории)
 * @param targetHtml - Текст текущей рабочей версии документа
 * @returns HTML разметка с визуальным диффом абзацев
 */
export function buildDiffHtml(baseHtml: string, targetHtml: string): string {
  if (baseHtml === targetHtml) return targetHtml;

  const baseBlocks = parseBlocks(baseHtml);
  const targetBlocks = parseBlocks(targetHtml);

  if (baseBlocks.length === 0 && targetBlocks.length === 0) return '';
  if (baseBlocks.length === 0) {
    return targetBlocks.map((b) => renderBlock(b, 'diff-block-ins')).join('\n');
  }
  if (targetBlocks.length === 0) {
    return baseBlocks.map((b) => renderBlock(b, 'diff-block-del')).join('\n');
  }

  const exactMatches = findLcsExactMatches(baseBlocks, targetBlocks);
  const resultHtml: string[] = [];

  let lastB = 0;
  let lastT = 0;

  for (const match of exactMatches) {
    const baseSlice = baseBlocks.slice(lastB, match.bIdx);
    const targetSlice = targetBlocks.slice(lastT, match.tIdx);

    processDiffRange(baseSlice, targetSlice, resultHtml);

    // Точно совпавший блок — рендерим стандартно без классов
    resultHtml.push(renderBlock(targetBlocks[match.tIdx]));

    lastB = match.bIdx + 1;
    lastT = match.tIdx + 1;
  }

  // Хвост после последнего совпадения
  const remainingBase = baseBlocks.slice(lastB);
  const remainingTarget = targetBlocks.slice(lastT);
  processDiffRange(remainingBase, remainingTarget, resultHtml);

  return resultHtml.join('\n');
}
