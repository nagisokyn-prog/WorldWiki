import type { Editor } from '@tiptap/vue-3';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { Decoration } from '@tiptap/pm/view';
import type { PlotPromise } from '@/types/generated/PlotPromise';
import type { RichPlotPromise } from '@/features/chapters/components/panels/PromisesPanel/usePromisesPanel';
import { findSceneElements } from './sceneElementsFinder';
import { findNarrativeBlocksInDoc, type ResolvedDocBlock } from './narrativeDocResolver';
import { narrativeFramesPluginKey } from '../extensions/NarrativeFramesExtension';

export interface NarrativeQuery {
  quote?: string;
  blockId?: string;
  paragraphIndex?: number;
  blockIds?: string[];
}

export interface ChapterNarrativeItem {
  item: PlotPromise | RichPlotPromise;
  kind: string;
  queries: NarrativeQuery[];
}

interface NodeStyleAccum {
  block: ResolvedDocBlock;
  classes: Set<string>;
  attrs: Record<string, string>;
}

const normalizeId = (id?: string | null) => (id || '').split(':').pop()?.replace(/["'`]/g, '').trim() || '';

export function isProseMirrorReady(ed?: Editor): boolean {
  if (!ed || ed.isDestroyed) return false;
  try {
    const view = ed.view;
    return Boolean(
      view &&
      view.state &&
      view.state.doc &&
      typeof view.dispatch === 'function' &&
      narrativeFramesPluginKey.get(view.state)
    );
  } catch {
    return false;
  }
}

export function getRelevantChapterItems(
  promises: (PlotPromise | RichPlotPromise)[] | undefined,
  chapterId: string | null | undefined
): ChapterNarrativeItem[] {
  const currentChapterClean = normalizeId(chapterId);
  if (!currentChapterClean || !promises) return [];

  const narrativeItems = promises.filter(p => p && p.id).sort((a, b) => {
    const isMacroA = a.kind === 'scene';
    const isMacroB = b.kind === 'scene';
    if (isMacroA === isMacroB) return 0;
    return isMacroA ? -1 : 1;
  });

  const resolved: ChapterNarrativeItem[] = [];

  for (const item of narrativeItems) {
    const kind = item.kind || 'scene';
    const itemChap = (item as unknown as { chapter_id?: string }).chapter_id;
    const itemCleanChap = itemChap ? normalizeId(itemChap) : null;
    const itemBlockIds = (item as unknown as { block_ids?: string[] }).block_ids;

    const milestones = item.milestones || [];
    const relevantMilestones = milestones.filter(m => {
      if (!m.chapter_id) return false;
      return normalizeId(m.chapter_id) === currentChapterClean;
    });

    const hasMatchingBlockPrefix = Boolean(
      itemBlockIds && itemBlockIds.some(b => normalizeId(b).startsWith(`blk_${currentChapterClean}_`))
    );

    const belongsToCurrentChapter =
      relevantMilestones.length > 0 ||
      (itemCleanChap !== null && itemCleanChap === currentChapterClean) ||
      hasMatchingBlockPrefix;

    if (!belongsToCurrentChapter) continue;

    const itemQuote = (item as unknown as { quote?: string }).quote || undefined;
    const itemsToMatch = relevantMilestones.length > 0 ? relevantMilestones : [{
      chapter_id: chapterId || '',
      order_index: null,
      block_id: null,
      quote: itemQuote || item.title,
      stage: 'setup' as const
    }];

    const queries: NarrativeQuery[] = itemsToMatch.map(m => {
      const mObj = m as unknown as {
        block_id?: string | null;
        block_ids?: string[];
        quote?: string | null;
        paragraph_index?: number;
        order_index?: number | null;
      };
      const pIdx = mObj.paragraph_index ?? (mObj.order_index ? Number(mObj.order_index) : undefined);
      const bIds = mObj.block_ids && mObj.block_ids.length > 0 ? mObj.block_ids : (itemsToMatch.length === 1 ? itemBlockIds : undefined);
      const quoteToUse = m.quote || itemQuote || item.title;
      return { quote: quoteToUse, blockId: mObj.block_id || undefined, paragraphIndex: pIdx, blockIds: bIds };
    });

    resolved.push({ item, kind, queries });
  }

  return resolved;
}

export function renderDecorationsInProseMirror(ed: Editor, items: ChapterNarrativeItem[]): void {
  const view = ed.view;
  const state = view.state;
  const doc: ProseMirrorNode = state.doc;
  const nodeMap = new Map<number, NodeStyleAccum>();

  for (const { item, kind, queries } of items) {
    const isMicroItem = kind !== 'scene';

    for (const q of queries) {
      const matchedBlocks = findNarrativeBlocksInDoc(doc, q.quote, q.blockId, q.paragraphIndex, q.blockIds);
      if (matchedBlocks.length === 0) continue;

      const count = matchedBlocks.length;
      matchedBlocks.forEach((blk, index) => {
        let acc = nodeMap.get(blk.pos);
        if (!acc) {
          acc = { block: blk, classes: new Set<string>(), attrs: {} };
          nodeMap.set(blk.pos, acc);
        }

        const alreadyInScene = acc.classes.has('scene-frame') || acc.attrs['data-narrative-kind'] === 'scene';
        if (alreadyInScene && isMicroItem) {
          acc.classes.add(`narrative-embedded-${kind}`);
          acc.attrs['data-embedded-kind'] = kind;
          return;
        }

        acc.classes.add('narrative-frame');
        acc.classes.add(`narrative-kind-${kind}`);
        if (kind === 'scene') acc.classes.add('scene-frame');
        acc.attrs['data-narrative-id'] = item.id || '';
        acc.attrs['data-narrative-kind'] = kind;
        acc.attrs['data-scene-id'] = item.id || '';

        if (count === 1) {
          acc.classes.delete('narrative-frame-middle');
          acc.classes.add('narrative-frame-single');
          acc.attrs['data-narrative-frame'] = 'single';
        } else if (index === 0) {
          acc.classes.delete('narrative-frame-middle');
          acc.classes.add('narrative-frame-first');
          acc.attrs['data-narrative-frame'] = 'first';
        } else if (index === count - 1) {
          acc.classes.delete('narrative-frame-middle');
          acc.classes.add('narrative-frame-last');
          acc.attrs['data-narrative-frame'] = 'last';
        } else if (!acc.classes.has('narrative-frame-first') && !acc.classes.has('narrative-frame-last') && !acc.classes.has('narrative-frame-single')) {
          acc.classes.add('narrative-frame-middle');
          acc.attrs['data-narrative-frame'] = 'middle';
        }
      });
    }
  }

  const decorations = Array.from(nodeMap.values()).map(acc =>
    Decoration.node(acc.block.pos, acc.block.pos + acc.block.node.nodeSize, {
      class: Array.from(acc.classes).join(' '),
      ...acc.attrs
    })
  );

  view.dispatch(
    state.tr.setMeta(narrativeFramesPluginKey, decorations).setMeta('addToHistory', false)
  );
}

const FRAME_CLASSES = [
  'scene-frame', 'narrative-frame', 'narrative-frame-first', 'narrative-frame-middle',
  'narrative-frame-last', 'narrative-frame-single', 'narrative-kind-scene',
  'narrative-kind-conflict', 'narrative-kind-gun', 'narrative-kind-foreshadowing',
  'narrative-kind-mystery', 'narrative-kind-question', 'narrative-embedded-gun',
  'narrative-embedded-foreshadowing', 'narrative-embedded-mystery',
  'narrative-embedded-question', 'narrative-embedded-conflict'
];

export function renderFramesDomFallback(editorDom: HTMLElement, items: ChapterNarrativeItem[]): void {
  const existingFrames = editorDom.querySelectorAll('.scene-frame, .narrative-frame, [data-narrative-frame], [class*="narrative-embedded-"], [data-embedded-kind]');
  existingFrames.forEach(el => {
    el.classList.remove(...FRAME_CLASSES);
    el.removeAttribute('data-scene-id');
    el.removeAttribute('data-narrative-id');
    el.removeAttribute('data-narrative-kind');
    el.removeAttribute('data-narrative-frame');
    el.removeAttribute('data-embedded-kind');
  });

  for (const { item, kind, queries } of items) {
    const matchedElements: HTMLElement[] = [];
    for (const q of queries) {
      for (const el of findSceneElements(editorDom, q.quote, q.blockId, q.paragraphIndex, q.blockIds)) {
        if (!matchedElements.includes(el)) matchedElements.push(el);
      }
    }
    if (matchedElements.length === 0) continue;

    matchedElements.sort((a, b) => (a === b ? 0 : (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1)));
    const count = matchedElements.length;
    const isMicroItem = kind !== 'scene';

    matchedElements.forEach((el, index) => {
      const alreadyInScene = el.classList.contains('scene-frame') || el.getAttribute('data-narrative-kind') === 'scene';
      if (alreadyInScene && isMicroItem) {
        el.classList.add(`narrative-embedded-${kind}`);
        el.setAttribute('data-embedded-kind', kind);
        return;
      }

      el.classList.add('narrative-frame', `narrative-kind-${kind}`);
      if (kind === 'scene') el.classList.add('scene-frame');
      el.setAttribute('data-narrative-id', item.id || '');
      el.setAttribute('data-narrative-kind', kind);
      el.setAttribute('data-scene-id', item.id || '');

      if (count === 1) {
        el.classList.remove('narrative-frame-middle');
        el.classList.add('narrative-frame-single');
        el.setAttribute('data-narrative-frame', 'single');
      } else if (index === 0) {
        el.classList.remove('narrative-frame-middle');
        el.classList.add('narrative-frame-first');
        el.setAttribute('data-narrative-frame', 'first');
      } else if (index === count - 1) {
        el.classList.remove('narrative-frame-middle');
        el.classList.add('narrative-frame-last');
        el.setAttribute('data-narrative-frame', 'last');
      } else if (!el.classList.contains('narrative-frame-first') && !el.classList.contains('narrative-frame-last') && !el.classList.contains('narrative-frame-single')) {
        el.classList.add('narrative-frame-middle');
        el.setAttribute('data-narrative-frame', 'middle');
      }
    });
  }
}

export function scrollTargetIntoView(editorDom: HTMLElement, firstTarget: HTMLElement): void {
  const wrapper = (editorDom.closest('.editor-wrapper') || editorDom.parentElement) as HTMLElement | null;
  if (wrapper && wrapper.scrollHeight > wrapper.clientHeight) {
    const wrapperRect = wrapper.getBoundingClientRect();
    const targetRect = firstTarget.getBoundingClientRect();
    const offsetTop = targetRect.top - wrapperRect.top + wrapper.scrollTop;
    wrapper.scrollTo({
      top: Math.max(0, offsetTop - wrapper.clientHeight / 2 + targetRect.height / 2),
      behavior: 'smooth'
    });
  }
  firstTarget.scrollIntoView({ behavior: 'smooth', block: 'center' });
}
