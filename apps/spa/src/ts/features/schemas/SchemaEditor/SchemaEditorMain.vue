<template>
  <div class="schema-editor-main glass-theme">
    
    <SchemaEditorToolbar
      :local-entity-type="localEntityType"
      :is-history-preview-mode="isHistoryPreviewMode"
      @update:local-entity-type="setLocalEntityType"
      @exit-preview="exitPreviewMode"
      @reset-changes="loadSchema(true)"
      @open-preview="openPreview"
      @open-json="setShowJsonPreview(true)"
      @save="saveSchema"
      @toggle-history="toggleHistoryPanel"
    />

    <div class="flex-1 flex overflow-hidden">
      <!-- ПРЕДПРОСМОТР -->
      <div v-if="isPreviewMode" class="flex-1 flex-col">
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

        <div ref="scrollContainer" class="schema-canvas" @dragenter.prevent @dragover.prevent="handleDragOverCanvas" @drop.stop.prevent="handleDropNew" @scroll="handleScroll">
          <div v-if="activeSection" class="schema-canvas-inner" @dragenter.prevent @dragover.prevent="handleDragOverCanvas">
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
            
            <div v-if="activeSection.items.length === 0" class="empty-canvas-state" @dragenter.prevent @dragover.prevent="handleDragOverCanvas">
              ПЕРЕТАЩИТЕ ЭЛЕМЕНТЫ СЮДА
            </div>

            <!-- ЭЛЕМЕНТЫ -->
            <div v-for="(item, iIdx) in activeSection.items" :key="iIdx" class="schema-item-card" :draggable="!(activeSectionIdx === 0 && Number(iIdx) === 0)" :class="{ 'is-dragging-over': draggedOverIdx === Number(iIdx), 'is-pinned-first': activeSectionIdx === 0 && Number(iIdx) === 0 }" @dragstart="handleItemDragStart($event, Number(iIdx))" @dragenter.prevent="draggedOverIdx = Number(iIdx)" @dragover.prevent="handleDragOverCanvas" @drop.stop.prevent="handleItemDrop(Number(iIdx), $event)">
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
                @drop-custom="handleDropIntoModule(Number(iIdx), $event)"
              />
            </div>
          </div>
        </div>
      </main>

      <!-- SIDEBAR (Catalog) -->
      <SchemaCatalogSidebar
        v-if="showCatalog"
        :catalog-width="catalogWidth"
        :atomic-bricks="atomicBricks"
        :timeline-templates="timelineTemplates"
        :dynamic-templates="dynamicTemplates"
        @start-resize="startResize"
        @drag-start-palette="handleDragStartPalette"
      />

      <!-- RIGHT SIDEBAR (HISTORY) -->
      <SchemaHistoryDrawer
        v-if="showHistory"
        v-model:max-saves="maxSaves"
        :history="schemaHistory"
        :preview-id="historyPreviewId"
        @close="showHistory = false"
        @preview="previewHistory"
        @toggle-pin="togglePin"
      />
    </div>

    <!-- JSON ПРЕВЬЮ -->
    <div v-if="showJsonPreview" class="glass-modal-overlay visible" @click="setShowJsonPreview(false)">
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
import SchemaEditorToolbar from './components/SchemaEditorToolbar.vue';
import SchemaCatalogSidebar from './components/SchemaCatalogSidebar.vue';
import SchemaHistoryDrawer from './components/SchemaHistoryDrawer.vue';
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
  localEntityType,
  showJsonPreview,
  isPreviewMode,
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
  saveSchema,
  loadSchema,
  previewHistory,
  exitPreviewMode,
  togglePin,
  toggleHistoryPanel,
  openPreview,
  setShowJsonPreview,
  setIsPreviewMode,
  setLocalEntityType,
  deleteSection,
  addNewPage,
  removeItem,
  isAtomicField,
  handleDragOverCanvas,
  handleDropNew,
  handleItemDragStart,
  handleItemDrop,
  handleDropIntoModule,
  handleDragStartPalette
} = hook;
</script>
