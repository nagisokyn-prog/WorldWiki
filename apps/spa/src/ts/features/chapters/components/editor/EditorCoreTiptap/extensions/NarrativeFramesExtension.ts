import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

export const narrativeFramesPluginKey = new PluginKey<DecorationSet>('narrativeFrames');
export const narrativeHighlightPluginKey = new PluginKey<DecorationSet>('narrativeHighlight');

function createDecorationPlugin(key: PluginKey<DecorationSet>) {
  return new Plugin<DecorationSet>({
    key,
    state: {
      init: () => DecorationSet.empty,
      apply(tr, oldSet) {
        const nextDecorations = tr.getMeta(key) as Decoration[] | undefined;
        if (Array.isArray(nextDecorations)) {
          return nextDecorations.length > 0
            ? DecorationSet.create(tr.doc, nextDecorations)
            : DecorationSet.empty;
        }
        return tr.docChanged ? oldSet.map(tr.mapping, tr.doc) : oldSet;
      }
    },
    props: {
      decorations(state) {
        return key.getState(state) ?? DecorationSet.empty;
      }
    }
  });
}

/**
 * Нативное расширение ProseMirror для отрисовки рамок сцен, ружей и подсветки
 * через `Decoration.node` без ручного патчинга DOM поверх Vue NodeView.
 */
export const NarrativeFramesExtension = Extension.create({
  name: 'narrativeFrames',
  addProseMirrorPlugins() {
    return [
      createDecorationPlugin(narrativeFramesPluginKey),
      createDecorationPlugin(narrativeHighlightPluginKey)
    ];
  }
});
