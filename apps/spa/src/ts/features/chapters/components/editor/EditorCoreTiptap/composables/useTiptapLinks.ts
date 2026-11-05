import { onMounted, onUnmounted } from 'vue';
import type { Ref } from 'vue';
import type { Editor } from '@tiptap/vue-3';
import * as api from '@/services/api.client';
import { openEntityEditorWindow } from '@/utils/windowManager';

export interface UseTiptapLinksOptions {
  project: string;
  isLocked?: boolean;
  ctrlPressed: Ref<boolean>;
  editor: Ref<Editor | undefined>;
  onOpenEntity: (payload: { type: string; id: string }) => void;
}

export function useTiptapLinks(options: UseTiptapLinksOptions) {
  let handleLinkInteraction: ((e: MouseEvent) => void) | null = null;
  let handleQuickLink: ((e: Event) => void) | null = null;

  onMounted(() => {
    handleQuickLink = async (e: Event) => {
      const { name, startPos, endPos } = (e as CustomEvent).detail;
      if (!name || !options.editor.value) return;

      try {
        const response = await api.searchEntities(options.project, name, null);
        if (response && response.length > 0) {
          const entity = response[0];
          const url = `?type=${entity.entity_type}&id=${entity.id}`;

          options.editor.value
            .chain()
            .focus()
            .deleteRange({ from: startPos, to: endPos })
            .insertContent(`<a href="${url}">${name}</a>`)
            .run();
        } else {
          const { appAlert } = await import('@worldwiki/components');
          appAlert(`Сущность "${name}" не найдена.`);
        }
      } catch {
        const { appAlert } = await import('@worldwiki/components');
        appAlert(`Ошибка при поиске сущности "${name}"`);
      }
    };
    document.addEventListener('ww:quick-link', handleQuickLink);

    handleLinkInteraction = (e: MouseEvent) => {
      const link = (e.target as HTMLElement).closest('a');
      if (!link) return;

      const url = link.getAttribute('href') || link.getAttribute('data-href') || '';
      if (!url) return;
      if (url && (url.includes('type=') || url.includes('id=') || url.startsWith('entity://'))) {
        const isLocked = options.isLocked !== undefined ? options.isLocked : true;
        const isCtrlPressed = e.ctrlKey || e.metaKey || options.ctrlPressed.value;

        if (isLocked && !isCtrlPressed) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }

        e.preventDefault();
        e.stopPropagation();

        try {
          let type: string | null = null;
          let id: string | null = null;
          let project = 'default';

          if (url.includes('ui_editor.html')) {
            const urlObj = new URL(url, window.location.origin);
            project = urlObj.searchParams.get('project') || 'default';
            type = urlObj.searchParams.get('type');
            id = urlObj.searchParams.get('id');
            const name = link.textContent || 'Сущность';

            if (project && type && id) {
              openEntityEditorWindow(project, type as string, id as string, name);
            }
            return;
          } else if (url.startsWith('entity://')) {
            const parts = url.replace('entity://', '').split('/');
            type = parts[0];
            id = parts.slice(1).join('/');
          } else {
            const queryStart = url.indexOf('?');
            if (queryStart !== -1) {
              const queryString = url.substring(queryStart + 1);
              const params = new URLSearchParams(queryString);
              type = params.get('type');
              id = params.get('id');
            }
          }

          if (type && id) {
            if (isCtrlPressed) {
              document.dispatchEvent(new CustomEvent('ww:open-entity-window', { detail: { type, id } }));
            } else {
              options.onOpenEntity({ type, id });
            }
          }
        } catch (err) {
          console.error('[EditorCore] Link parse error:', err);
        }
      }
    };

    document.addEventListener('click', handleLinkInteraction, true);
  });

  onUnmounted(() => {
    if (handleQuickLink) document.removeEventListener('ww:quick-link', handleQuickLink);
    if (handleLinkInteraction) document.removeEventListener('click', handleLinkInteraction, true);
  });
}
