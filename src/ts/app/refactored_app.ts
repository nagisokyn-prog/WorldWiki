/**
 * @file refactored_app.ts
 * @description Demonstration of how to use `tauri-surreal-kit` in your domain app.
 *
 * It uses `useShellApp` to handle all the infrastructure (panes, zoom, saves, shortcuts)
 * and leaves only the domain logic (loading chapters, entities) here.
 */

import { createApp, ref, computed, watch, onMounted, shallowRef, defineAsyncComponent } from 'vue';
import { apiService } from '../services/api.service';
import { connectionsManager } from '../services/connections.service';
import { useShellApp } from '../../../tauri-surreal-kit/frontend/src/js/composables/useShellApp';

// UI Kit components
import QuickOpenVue from '../../../tauri-surreal-kit/frontend/src/components/Vue/QuickOpen.vue';
import CommandPaletteVue from '../../../tauri-surreal-kit/frontend/src/components/Vue/CommandPalette.vue';
import EditorTabBarVue from '../../../tauri-surreal-kit/frontend/src/components/Vue/EditorTabBar.vue';
import EditorGroupPaneVue from '../../../tauri-surreal-kit/frontend/src/components/Vue/EditorGroupPane.vue';

// Domain components
import ChapterTreeVue from '../components/Vue/Chapters/ChapterTree.vue';
import ChaptersMainVue from '../components/Vue/Chapters/ChaptersMain.vue';
const EntityEditorVue = defineAsyncComponent(() => import('../components/Vue/EntityEditor.vue'));
const TimelinePanelVue = defineAsyncComponent(() => import('../components/Vue/Calendars/TimelinePanel.vue'));
// ... other async domain components ...

async function init() {
  const params = new URLSearchParams(window.location.search);
  const projectName = params.get('project') || 'default';

  const app = createApp({
    setup() {
      // ─── Framework Shell ──────────────────────────────────────────
      const quickOpenRef = ref<any>(null);
      const commandPaletteRef = ref<any>(null);

      const shell = useShellApp({
        storagePrefix: `worldwiki-state-${projectName}`,
        appId: 'world-wiki',
        quickOpenRef: quickOpenRef as any,
        commandPaletteRef: commandPaletteRef as any,
        
        // 1. Hook: Handle Ctrl+S / CommandPalette Save
        onSave: async () => {
          shell.addLog('Saving all tabs...', 'info');
          const unsaved = shell.allTabs.value.filter((t: any) => t.unsaved);
          for (const tab of unsaved) {
            try {
              if ((tab as any).tabType === 'entity') {
                await apiService.saveEntity(projectName, (tab as any).entityType, tab.data);
              } else if ((tab as any).tabType === 'chapter') {
                await apiService.saveChapter(projectName, tab.data);
              }
              tab.unsaved = false;
            } catch (e) {
              shell.addToast(`Failed to save: ${tab.title}`, 'error');
            }
          }
          shell.addToast('All tabs saved!', 'success');
        },

        // 2. Hook: Serialize domain extra state (sidebar state, etc)
        serializeExtra: () => ({
          activeView: activeView.value,
          currentSidebarTab: currentSidebarTab.value,
        }),

        // 3. Hook: Restore domain extra state and load actual tab data
        restoreExtra: async (savedState: Record<string, unknown>) => {
          activeView.value = (savedState.activeView as 'entity' | 'chapters') || 'entity';
          currentSidebarTab.value = (savedState.currentSidebarTab as string) || null;

          // Load data for the tabs restored by useShellApp
          const loadedTabs = new Map<string, any>();
          const allRawTabs = shell.allTabs.value; // These are placeholders without `.data` right now

          for (const tab of allRawTabs as any[]) {
            try {
              if (tab.tabType === 'entity') {
                const detail = await apiService.getEntity(projectName, tab.entityType, tab.rawId);
                loadedTabs.set(tab.id, { ...tab, data: detail, unsaved: false });
              } else if (tab.tabType === 'chapter') {
                const chapter = await apiService.getChapter(projectName, tab.rawId);
                if (chapter) loadedTabs.set(tab.id, { ...tab, data: chapter, unsaved: false });
              }
            } catch (e) {
              shell.addLog(`Failed to restore tab ${tab.id}`, 'error');
            }
          }

          // Update shell tabs with actual data
          shell.eg.restoreState(savedState.editorGroups as any, loadedTabs);
        }
      });

      // ─── Domain State ─────────────────────────────────────────────
      const activeView = ref<'entity' | 'chapters'>('entity');
      const currentSidebarTab = ref<string | null>(null);

      // (Proceed to implement specific loadEntityList, getChapter logic here as before...)

      // ─── Domain Commands for Palette ──────────────────────────────
      const domainCommands = computed(() => [
        {
          id: 'new-entity',
          title: 'Создать новую сущность',
          desc: 'Добавить запись текущего типа',
          icon: '✨', hotkey: 'Ctrl+N',
          action: () => { /* domain logic */ }
        },
        {
          id: 'new-chapter',
          title: 'Новая глава',
          desc: 'Создать новую главу в рукописи',
          icon: '📖', hotkey: 'Ctrl+Shift+N',
          action: () => { /* domain logic */ }
        }
      ]);

      return {
        // Expose shell to template
        shell,
        
        // Expose refs
        quickOpenRef,
        commandPaletteRef,
        domainCommands,

        // Domain refs
        projectName,
        activeView,
        currentSidebarTab,
      };
    }
  });

  // Register components
  app.component('QuickOpen', QuickOpenVue);
  app.component('CommandPalette', CommandPaletteVue);
  app.component('EditorTabBar', EditorTabBarVue);
  app.component('EditorGroupPane', EditorGroupPaneVue);
  // ...

  app.mount('#app');
}

init();

