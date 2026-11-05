import { Extension } from '@tiptap/core';
import { Plugin, PluginKey, type EditorState, type Transaction } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { invoke } from '@tauri-apps/api/core';

export interface AiGhostTextOptions {
  projectId: string;
}

interface GhostPluginState {
  ghostText: string;
  pos: number | null;
}

type PluginSpecType = ConstructorParameters<typeof Plugin<GhostPluginState>>[0];
type PluginProps = NonNullable<PluginSpecType['props']>;
type PluginEditorView = Parameters<NonNullable<PluginProps['handleKeyDown']>>[0];
type PluginDecorationsReturn = ReturnType<NonNullable<PluginProps['decorations']>>;

const ghostPluginKey = new PluginKey<GhostPluginState>('aiGhostText');

export const AiGhostTextExtension = Extension.create<AiGhostTextOptions>({
  name: 'aiGhostText',

  addOptions() {
    return {
      projectId: '',
    };
  },

  addProseMirrorPlugins() {
    let timeout: ReturnType<typeof setTimeout>;
    let isFetching = false;

    return [
      new Plugin<GhostPluginState>({
        key: ghostPluginKey,
        state: {
          init(): GhostPluginState {
            return { ghostText: '', pos: null };
          },
          apply(tr: Transaction, value: GhostPluginState): GhostPluginState {
            const meta = tr.getMeta(ghostPluginKey) as GhostPluginState | undefined;
            if (meta) {
              return meta;
            }
            if (tr.docChanged) {
              return { ghostText: '', pos: null };
            }
            return value;
          },
        },
        props: {
          decorations(state: EditorState) {
            const pluginState = ghostPluginKey.getState(state);
            if (!pluginState || !pluginState.ghostText || pluginState.pos === null) {
              return DecorationSet.empty as unknown as PluginDecorationsReturn;
            }
            const widget = document.createElement('span');
            widget.classList.add('ai-ghost-text');
            widget.textContent = pluginState.ghostText;
            widget.style.color = 'var(--text-muted)';
            widget.style.pointerEvents = 'none';
            widget.style.userSelect = 'none';

            return DecorationSet.create(state.doc, [
              Decoration.widget(pluginState.pos, widget, { side: 1 }),
            ]) as unknown as PluginDecorationsReturn;
          },
          handleKeyDown(view: PluginEditorView, event: KeyboardEvent): boolean {
            if (event.key === 'Tab') {
              const state = ghostPluginKey.getState(view.state);
              if (state && state.ghostText && state.pos !== null) {
                event.preventDefault();
                const pos = state.pos;
                const tr = view.state.tr.insertText(state.ghostText, pos);
                tr.setMeta(ghostPluginKey, { ghostText: '', pos: null });
                view.dispatch(tr);
                return true;
              }
            }
            return false;
          },
        },
        view: (_view: PluginEditorView) => {
          return {
            update: (view: PluginEditorView, prevState: EditorState) => {
              const state = view.state;
              if (prevState && prevState.doc.eq(state.doc) && prevState.selection.eq(state.selection)) {
                return;
              }

              clearTimeout(timeout);

              const { $head } = state.selection;
              if (!$head || !$head.parent) {
                return;
              }

              const isAtBlockEnd = $head.parentOffset === $head.parent.content.size;
              const currentPluginState = ghostPluginKey.getState(state);

              if (!isAtBlockEnd) {
                if (currentPluginState && currentPluginState.ghostText) {
                  const tr = view.state.tr.setMeta(ghostPluginKey, { ghostText: '', pos: null });
                  view.dispatch(tr);
                }
                return;
              }

              const parentText = $head.parent.textContent || '';
              const textBefore = parentText.slice(Math.max(0, $head.parentOffset - 25), $head.parentOffset);

              if (!textBefore || textBefore.trim().length < 10) {
                return;
              }

              const pos = $head.pos;

              timeout = setTimeout(async () => {
                if (isFetching) return;
                isFetching = true;
                try {
                  const suggestion = await invoke<string>('get_ai_completion', {
                    textBefore,
                    projectId: this.options.projectId,
                  });
                  if (suggestion && suggestion.trim()) {
                    const tr = view.state.tr.setMeta(ghostPluginKey, {
                      ghostText: suggestion,
                      pos,
                    });
                    view.dispatch(tr);
                  }
                } catch (err) {
                  console.error('Failed to fetch AI ghost text completion:', err);
                } finally {
                  isFetching = false;
                }
              }, 600);
            },
            destroy: () => {
              clearTimeout(timeout);
            },
          };
        },
      }),
    ];
  },
});

