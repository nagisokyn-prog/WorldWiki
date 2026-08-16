import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { invoke } from '@tauri-apps/api/core';

export interface AiGhostTextOptions {
  projectId: string;
}

const ghostPluginKey = new PluginKey('aiGhostText');

export const AiGhostTextExtension = Extension.create<AiGhostTextOptions>({
  name: 'aiGhostText',

  addOptions() {
    return {
      projectId: '',
    };
  },

  addProseMirrorPlugins() {
    let timeout: ReturnType<typeof setTimeout>;
    let currentGhostText = '';
    let isFetching = false;

    return [
      new Plugin({
        key: ghostPluginKey,
        state: {
          init() {
            return { ghostText: '', pos: null };
          },
          apply(tr, value) {
            const meta = tr.getMeta(ghostPluginKey);
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
          decorations(state) {
            const pluginState = ghostPluginKey.getState(state);
            if (!pluginState || !pluginState.ghostText || !pluginState.pos) {
              return DecorationSet.empty;
            }
            const widget = document.createElement('span');
            widget.classList.add('ai-ghost-text');
            widget.textContent = pluginState.ghostText;
            widget.style.color = '#999';
            widget.style.pointerEvents = 'none';
            widget.style.userSelect = 'none';
            
            return DecorationSet.create(state.doc, [
              Decoration.widget(pluginState.pos, widget, { side: 1 })
            ]);
          },
          handleKeyDown(view, event) {
            if (event.key === 'Tab') {
              const state = ghostPluginKey.getState(view.state);
              if (state && state.ghostText) {
                event.preventDefault();
                const pos = state.pos;
                const tr = view.state.tr.insertText(state.ghostText, pos);
                tr.setMeta(ghostPluginKey, { ghostText: '', pos: null });
                view.dispatch(tr);
                return true;
              }
            }
            return false;
          }
        },
        view: (_view) => {
          return {
            update: (view, prevState) => {
              const state = view.state;
              if (prevState.doc.eq(state.doc) && prevState.selection.eq(state.selection)) {
                return;
              }
              
              // Clear on any change
              if (ghostPluginKey.getState(state)?.ghostText) {
                 view.dispatch(state.tr.setMeta(ghostPluginKey, { ghostText: '', pos: null }));
              }
              currentGhostText = '';
              clearTimeout(timeout);
              
              const { $head } = state.selection;
              // Only trigger at the end of a block
              if ($head.parentOffset !== $head.parent.content.size) {
                 return;
              }
              
              const textBefore = $head.parent.textContent.slice(0, $head.parentOffset);
              if (textBefore.trim().length < 10) return; // Need some context
              
              timeout = setTimeout(async () => {
                if (isFetching) return;
                isFetching = true;
                try {
                  const res = await invoke<string>('get_ai_completion', { 
                    textBefore,
                    projectId: this.options.projectId
                  });
                  if (res && res.trim()) {
                    currentGhostText = res;
                    const pos = view.state.selection.$head.pos;
                    view.dispatch(view.state.tr.setMeta(ghostPluginKey, { ghostText: currentGhostText, pos }));
                  }
                } catch(e) {
                  console.error('AI completion error', e);
                } finally {
                  isFetching = false;
                }
              }, 1000); // 1s debounce
            },
            destroy: () => {
              clearTimeout(timeout);
            }
          };
        }
      })
    ];
  },
});
