<template>
  <div class="schema-editor-main glass-theme">
    
    <header class="schema-header">
      <div class="flex items-center gap-6">
        <div class="schema-header-title">
          ⚙️ СХЕМА:
          <input :value="hook.localEntityType.value" class="input-base schema-header-input" placeholder="ИМЯ СХЕМЫ" @input="setLocalEntityType(($event.target as HTMLInputElement).value)" />
        </div>
      </div>
      <div class="flex items-center gap-2">
        <button v-if="isHistoryPreviewMode" class="btn-new btn-warning-outline text-xs" @click="exitPreviewMode">Вернуться к текущей</button>
        <button class="btn-new btn-danger-outline text-xs" @click="loadSchema(true)">Сбросить изменения</button>
        <button class="btn-new btn-outline-new text-xs" @click="openPreview">ПРЕДПРОСМОТР</button>
        <button class="btn-new btn-outline-new text-xs" @click="setShowJsonPreview(true)">Схема</button>
        <button class="btn-new btn-primary text-xs" @click="saveSchema">Сохранить</button>
        <button class="btn-new btn-outline-new p-1" title="История изменений" @click="toggleHistoryPanel">
          <svg stroke="currentColor" fill="none" stroke-width="2" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round" height="16" width="16" xmlns="http://www.w3.org/2000/svg"><path d="M7 18m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"></path><path d="M7 6m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"></path><path d="M17 6m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"></path><path d="M7 8l0 8"></path><path d="M9 18h6a2 2 0 0 0 2 -2v-5"></path><path d="M14 14l3 -3l3 3"></path></svg>
        </button>
      </div>
    </header>

    <div class="flex-1 flex overflow-hidden">
      <!-- ПРЕДПРОСМОТР -->
      <div v-if="hook.isPreviewMode.value" class="flex-1 flex-col">
        <div class="schema-history-banner">
           <span class="schema-history-text">👁️ РЕЖИМ ПРЕДПРОСМОТРА</span>
           <button class="btn-new text-xs btn-warning-action" @click="setIsPreviewMode(false)">ВЕРНУТЬСЯ В РЕДАКТОР</button>
        </div>
        <div class="flex-1 relative">
          <EntityEditorVue :key="previewKey" entity-id="preview" entity-type="sandbox_preview" project="sandbox" :initial-data="{}" :config="schema" />
        </div>
      </div>

      <!-- ЦЕНТРАЛЬНЫЙ ХОЛСТ -->
      <main v-else class="content-area-new flex-1 flex-col overflow-hidden relative">
        <!-- ЖЕЛТАЯ ПЛАШКА ИСТОРИИ -->
        <div v-if="isHistoryPreviewMode" class="schema-history-banner">
          <span class="schema-history-text">⚠️ ВЫ ПРОСМАТРИВАЕТЕ СТАРУЮ ВЕРСИЮ СХЕМЫ</span>
          <div class="flex gap-2">
             <button class="btn-new btn-warning-outline text-xs" @click="exitPreviewMode">Отмена</button>
             <button class="btn-new text-xs btn-warning-action" @click="saveSchema">Восстановить эту версию</button>
          </div>
        </div>
        <!-- Вкладки (страницы) -->
        <div class="sections-nav schema-tabs-bar flex gap-2 border-b overflow-x-auto flex-shrink-0 p-2">
          <button
            v-for="(sec, idx) in schema.sections" 
            :key="idx" 
            class="section-tab-btn interactive-el" 
            :class="{ active: activeSectionIdx === Number(idx) }" 
            @click="activeSectionIdx = Number(idx)"
          >
            <span>{{ sec.icon || '📄' }}</span>
            <span>{{ sec.title || 'Страница ' + (Number(idx) + 1) }}</span>
            <span v-if="Number(idx) > 0" class="ml-2 text-xs text-muted cursor-pointer hover:text-error" @mousedown.stop="deleteSection(Number(idx))">✕</span>
          </button>
          <button class="section-tab-btn interactive-el btn-add-page" @click="addNewPage">
            <i class="fas fa-plus"></i> <span>СТРАНИЦА</span>
          </button>
        </div>

        <div ref="scrollContainer" class="schema-canvas" @dragenter.prevent @dragover.prevent="handleDragOverCanvas" @drop="handleDropNew" @scroll="handleScroll">
          <div v-if="activeSection" class="schema-canvas-inner">
            <div class="schema-page-title-row">
              <input v-model="activeSection.title" class="input-base interactive-el schema-page-title-input" placeholder="ИМЯ СТРАНИЦЫ" :class="{ 'is-hidden-page': activeSection.hidden }">
              <button
                v-if="activeSectionIdx > 0"
                class="schema-btn-icon interactive-el text-lg flex-shrink-0" 
                :title="activeSection.hidden ? 'Показать страницу' : 'Скрыть страницу'"
                @click="activeSection.hidden = !activeSection.hidden">
                {{ activeSection.hidden ? '👁️‍🗨️' : '👁️' }}
              </button>
            </div>
            
            <div v-if="activeSection.items.length === 0" class="empty-canvas-state">
              ПЕРЕТАЩИТЕ ЭЛЕМЕНТЫ СЮДА
            </div>

            <!-- ЭЛЕМЕНТЫ -->
            <div v-for="(item, iIdx) in activeSection.items" :key="iIdx" class="schema-item-card" :draggable="!(activeSectionIdx === 0 && Number(iIdx) === 0)" :class="{ 'is-dragging-over': draggedOverIdx === Number(iIdx), 'is-pinned-first': activeSectionIdx === 0 && Number(iIdx) === 0 }" @dragstart="handleItemDragStart($event, Number(iIdx))" @dragenter.prevent="draggedOverIdx = Number(iIdx)" @dragover.prevent @drop.stop="handleItemDrop(Number(iIdx))">
              <SchemaFieldEditor
                v-if="isAtomicField(item)"
                :item="item"
                :is-first="activeSectionIdx === 0 && Number(iIdx) === 0"
                @remove="removeItem(Number(iIdx))"
              />
              <SchemaContainer
                v-else
                :item="item"
                @remove="removeItem(Number(iIdx))"
                @drop-custom="handleDropIntoModule(Number(iIdx))"
              />
            </div>
          </div>
        </div>
      </main>

      <!-- SIDEBAR (Catalog) -->
      <div v-if="showCatalog" class="schema-resizer" @mousedown="startResize"></div>
      <aside v-show="showCatalog" class="schema-catalog" :style="{ '--catalog-w': catalogWidth + 'px' }">
        <div class="catalog-section-title">БАЗОВЫЕ ПОЛЯ</div>
        <div class="flex-col gap-2 p-2">
          <div v-for="brick in atomicBricks" :key="brick.val" class="catalog-item interactive-el" draggable="true" @dragstart="handleDragStartPalette($event, 'atomic', brick.val, brick.label)">
            <span class="text-lg">{{ brick.icon }}</span>
            <span class="text-xs font-bold">{{ brick.label }}</span>
          </div>
        </div>

        <div class="catalog-section-title mt-2">⏱️ TIMELINE-МОДУЛИ</div>
        <div class="flex-col gap-2 p-2">
          <div v-for="(tpl, key) in timelineTemplates" :key="key" class="catalog-item interactive-el flex justify-between items-center" draggable="true" @dragstart="handleDragStartPalette($event, 'module', String(key), String(key))">
            <div class="flex items-center gap-2">
              <span class="text-lg">⏱️</span>
              <span class="text-xs font-bold">{{ key }}</span>
            </div>
            <ModuleHelpPreview :template-key="String(key)" />
          </div>
        </div>

        <div class="catalog-section-title mt-2">📋 DYNAMIC-МОДУЛИ</div>
        <div class="flex-col gap-2 p-2">
          <div v-for="(tpl, key) in dynamicTemplates" :key="key" class="catalog-item interactive-el flex justify-between items-center" draggable="true" @dragstart="handleDragStartPalette($event, 'module', String(key), String(key))">
            <div class="flex items-center gap-2">
              <span class="text-lg">{{ tpl.isBidirectional ? '🤝' : '📋' }}</span>
              <span class="text-xs font-bold">{{ key }}</span>
            </div>
            <ModuleHelpPreview :template-key="String(key)" />
          </div>
        </div>
      </aside>

      <!-- RIGHT SIDEBAR (HISTORY) -->
      <aside v-if="showHistory" class="schema-catalog history-sidebar-drawer">
        <div class="flex justify-between items-center p-3 border-b text-xs font-bold">
          <span>История изменений</span>
          <button class="cursor-pointer text-muted" @click="showHistory = false">✕</button>
        </div>
        
        <div class="p-3 border-b">
          <label class="text-xs text-muted">Хранить последних версий:</label>
          <input v-model="maxSaves" type="number" class="input-base text-xs w-full mt-1">
        </div>

        <div class="flex-1 overflow-y-auto p-3 flex-col gap-2">
          <div v-if="schemaHistory.length === 0" class="text-xs text-muted text-center">Нет сохраненных версий</div>
          <div
            v-for="h in schemaHistory" :key="h.id" 
            class="catalog-item interactive-el" 
            :class="{ 'is-previewing': historyPreviewId === h.id }"
            @click="previewHistory(h)">
            <div class="flex justify-between items-center w-full">
              <span class="text-xs font-bold">{{ h.formattedDate }}</span>
              <button class="cursor-pointer text-sm text-accent" :title="h.is_pinned ? 'Открепить' : 'Закрепить от удаления'" @click.stop="togglePin(h)">
                {{ h.is_pinned ? '📌' : '📍' }}
              </button>
            </div>
            <div v-if="historyPreviewId === h.id" class="mt-1">
              <span class="text-xs text-warning">Режим предпросмотра</span>
            </div>
          </div>
        </div>
      </aside>
    </div>
    <!-- JSON ПРЕВЬЮ -->
    <div v-if="hook.showJsonPreview.value" class="glass-modal-overlay visible" @click="setShowJsonPreview(false)">
      <div class="glass-modal glass-panel flex-col json-preview-modal" @click.stop>
         <div class="glass-title flex justify-between items-center p-3">
            <span>SCHEMA (JSON)</span>
            <button class="btn-new text-xs" @click="setShowJsonPreview(false)">ЗАКРЫТЬ</button>
         </div>
         <div class="flex-1 p-4 overflow-hidden">
            <textarea :value="jsonPreviewContent" readonly class="input-base w-full h-full font-mono text-xs p-4 json-preview-textarea"></textarea>
         </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import SchemaFieldEditor from './SchemaFieldEditor.vue';
import SchemaContainer from './SchemaContainer.vue';
import ModuleHelpPreview from './ModuleHelpPreview.vue';
import EntityEditorVue from '../../../features/entities/EntityEditor/EntityEditor.vue';
import { useSchemaEditorMain } from './useSchemaEditorMain';

const props = withDefaults(defineProps<{
  entityType: string;
  project: string;
  initialScrollPos?: number;
  initialSection?: string;
}>(), {
  initialScrollPos: 0,
  initialSection: ''
});

const emit = defineEmits(['scroll-change', 'section-change', 'modified']);

const hook = useSchemaEditorMain(props, emit as (event: string, ...args: unknown[]) => void);

const {
  catalogWidth,
  schema,
  scrollContainer,
  showHistory,
  schemaHistory,
  maxSaves,
  isHistoryPreviewMode,
  historyPreviewId,
  activeSectionIdx,
  activeSection,
  draggedOverIdx,
  previewKey,
  jsonPreviewContent,
  atomicBricks,
  showCatalog,
  timelineTemplates,
  dynamicTemplates,
  startResize,
  handleScroll,
  openPreview,
  loadSchema,
  saveSchema,
  toggleHistoryPanel,
  togglePin,
  previewHistory,
  exitPreviewMode,
  addNewPage,
  deleteSection,
  removeItem,
  handleDragStartPalette,
  handleItemDragStart,
  handleDragOverCanvas,
  handleDropNew,
  handleItemDrop,
  handleDropIntoModule
} = hook;

const setLocalEntityType = (val: string) => {
  hook.localEntityType.value = val;
};

const setShowJsonPreview = (val: boolean) => {
  hook.showJsonPreview.value = val;
};

const setIsPreviewMode = (val: boolean) => {
  hook.isPreviewMode.value = val;
};

const isAtomicField = (item: { type?: string }) => {
  return atomicBricks.some((b: { val: string }) => b.val === item.type) || item.type === 'tags' || item.type === 'range';
};
</script>

<style scoped src="@worldwiki/resources/styles/features/schemas/SchemaEditorMain.css"></style>
