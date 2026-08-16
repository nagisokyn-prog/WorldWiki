<template>
  <div class="schema-editor-main glass-theme" style="width: 100%; height: 100%; display: flex; flex-direction: column;">
    
    <header class="glass-panel" style="border-radius: 0; border: none; border-bottom: 1px solid var(--border-color); padding: 0 24px; display: flex; justify-content: space-between; align-items: center; z-index: 1000; height: 50px; background: var(--bg-panel); backdrop-filter: blur(20px); flex-shrink: 0;">
      <div style="display: flex; align-items: center; gap: 30px;">
        <div style="font-weight: 900; color: var(--accent); font-size: 14px; display: flex; align-items: center; gap: 8px;">
          ⚙️ СХЕМА:
          <input :value="hook.localEntityType.value" class="input-base" style="background: transparent; border: none; font-weight: 900; color: var(--accent); font-size: 14px; text-transform: uppercase; padding: 0;" placeholder="ИМЯ СХЕМЫ" @input="setLocalEntityType(($event.target as HTMLInputElement).value)" />
        </div>
      </div>
      <div style="display: flex; gap: 8px; align-items: center;">
        <button v-if="isHistoryPreviewMode" class="btn-new btn-outline-new" style="font-size: 10px; padding: 4px 12px; color: #f5a623; border-color: rgba(245,166,35,0.3);" @click="exitPreviewMode">Вернуться к текущей</button>
        <button class="btn-new btn-outline-new" style="font-size: 10px; padding: 4px 12px; color: #f55; border-color: rgba(255,85,85,0.3);" @click="loadSchema(true)">Сбросить изменения</button>
        <button class="btn-new btn-outline-new" style="font-size: 10px; padding: 4px 12px;" @click="openPreview">ПРЕДПРОСМОТР</button>
        <button class="btn-new btn-outline-new" style="font-size: 10px; padding: 4px 12px;" @click="setShowJsonPreview(true)">Схема</button>
        <button class="btn-new btn-outline-new" style="font-size: 10px; padding: 4px 12px;" @click="exportSchema">Экспорт</button>
        <button class="btn-new" style="font-size: 10px; padding: 4px 12px; background: var(--accent);" @click="saveSchema">Сохранить</button>
        <button class="btn-new btn-outline-new" style="font-size: 14px; padding: 4px 8px; border-color: var(--border-color); color: var(--text-muted);" title="История изменений" @click="toggleHistoryPanel">
          <svg stroke="currentColor" fill="none" stroke-width="2" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round" height="16" width="16" xmlns="http://www.w3.org/2000/svg" style="display:inline;vertical-align:middle"><path d="M7 18m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"></path><path d="M7 6m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"></path><path d="M17 6m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"></path><path d="M7 8l0 8"></path><path d="M9 18h6a2 2 0 0 0 2 -2v-5"></path><path d="M14 14l3 -3l3 3"></path></svg>
        </button>
      </div>
    </header>

    <div style="flex: 1; display: flex; overflow: hidden; background: var(--bg-base);">
      <!-- ПРЕДПРОСМОТР -->
      <div v-if="hook.isPreviewMode.value" style="flex: 1; display: flex; flex-direction: column;">
        <div style="padding: 12px; background: rgba(245,166,35,0.1); border-bottom: 1px solid rgba(245,166,35,0.3); display: flex; justify-content: space-between; align-items: center;">
           <span style="color: #f5a623; font-weight: bold; font-size: 11px;">👁️ РЕЖИМ ПРЕДПРОСМОТРА</span>
           <button class="btn-new" style="background: #f5a623; color: #000; padding: 4px 12px; font-size: 10px;" @click="setIsPreviewMode(false)">ВЕРНУТЬСЯ В РЕДАКТОР</button>
        </div>
        <div style="flex: 1; position: relative;">
          <EntityEditorVue :key="previewKey" entity-id="preview" entity-type="sandbox_preview" project="sandbox" :initial-data="{}" :config="schema" />
        </div>
      </div>

      <!-- ЦЕНТРАЛЬНЫЙ ХОЛСТ -->
      <main v-else class="content-area-new" style="flex: 1; display: flex; flex-direction: column; overflow: hidden; position: relative;">
        <!-- ЖЕЛТАЯ ПЛАШКА ИСТОРИИ -->
        <div v-if="isHistoryPreviewMode" style="background: rgba(245,166,35,0.1); border-bottom: 1px solid rgba(245,166,35,0.3); padding: 8px 24px; display: flex; justify-content: space-between; align-items: center;">
          <span style="font-size: 11px; color: #f5a623; font-weight: bold;">⚠️ ВЫ ПРОСМАТРИВАЕТЕ СТАРУЮ ВЕРСИЮ СХЕМЫ</span>
          <div style="display: flex; gap: 8px;">
             <button class="btn-new btn-outline-new" style="font-size: 10px; border-color: rgba(245,166,35,0.3); color: #f5a623; padding: 2px 8px;" @click="exitPreviewMode">Отмена</button>
             <button class="btn-new" style="font-size: 10px; background: #f5a623; color: #000; padding: 2px 8px; border: none;" @click="saveSchema">Восстановить эту версию</button>
          </div>
        </div>
        <!-- Вкладки (страницы) -->
        <div class="editor-tabs-new" style="padding: 8px 24px; background: var(--bg-panel); border-bottom: 1px solid var(--bg-input); display: flex; gap: 4px; overflow-x: auto;">
          <div v-for="(sec, idx) in schema.sections" :key="idx" class="editor-tab-new interactive-el" :class="{ active: activeSectionIdx === Number(idx) }" style="padding: 6px 16px; font-size: 11px; border-radius: 8px;" @click="activeSectionIdx = Number(idx)">
            {{ sec.icon || '📄' }} {{ sec.title || 'Страница ' + (Number(idx) + 1) }}
            <span v-if="Number(idx) > 0" style="margin-left: 8px; opacity: 0.5; font-size: 10px; cursor: pointer;" @mousedown.stop="deleteSection(Number(idx))">✕</span>
          </div>
          <button class="btn-new btn-outline-new" style="font-size: 10px; border-color: var(--accent); color: var(--accent); padding: 4px 12px; margin-left: 8px;" @click="addNewPage">+ СТРАНИЦА</button>
        </div>

        <div ref="scrollContainer" style="flex: 1; padding: 24px; overflow-y: auto;" @dragenter.prevent @dragover.prevent="handleDragOverCanvas" @drop="handleDropNew" @scroll="handleScroll">
          <div v-if="activeSection" style="max-width: 900px; margin: 0 auto; display: flex; flex-direction: column; gap: 16px;">
            <div style="display: flex; align-items: center; gap: 16px; border-bottom: 1px solid var(--accent); padding-bottom: 8px; margin-bottom: 16px;">
              <input v-model="activeSection.title" class="input-base" style="font-size: 24px; font-weight: 900; background: transparent; border: none; color: var(--text-main); flex: 1; padding: 0;" placeholder="ИМЯ СТРАНИЦЫ" :style="{ opacity: activeSection.hidden ? 0.4 : 1 }">
              <button
v-if="activeSectionIdx > 0" style="background: none; border: none; cursor: pointer; font-size: 20px; flex-shrink: 0;" 
                      :title="activeSection.hidden ? 'Показать страницу' : 'Скрыть страницу'"
                      @click="activeSection.hidden = !activeSection.hidden">
                {{ activeSection.hidden ? '👁️‍🗨️' : '👁️' }}
              </button>
            </div>
            
            <div v-if="activeSection.items.length === 0" class="empty-canvas-state" style="padding: 40px; border: 2px dashed var(--border-active); border-radius: 16px; text-align: center; opacity: 0.5;">
              ПЕРЕТАЩИТЕ ЭЛЕМЕНТЫ СЮДА
            </div>

            <!-- ЭЛЕМЕНТЫ -->
            <div v-for="(item, iIdx) in activeSection.items" :key="iIdx" class="schema-item-card" draggable="true" :class="{ 'is-dragging-over': draggedOverIdx === Number(iIdx) }" style="background: var(--bg-secondary); padding: 20px; border-radius: 16px; border: 1px solid var(--border-color);" @dragstart="handleItemDragStart($event, Number(iIdx))" @dragenter.prevent="draggedOverIdx = Number(iIdx)" @dragover.prevent @drop.stop="handleItemDrop(Number(iIdx))">
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
      <div v-if="showCatalog" class="catalog-resizer" style="width: 8px; cursor: ew-resize; background: transparent; z-index: 100; transition: background 0.2s;" onmouseover="this.style.background='var(--accent)'" onmouseout="this.style.background='transparent'" @mousedown="startResize"></div>
      <aside v-show="showCatalog" class="schema-catalog" :style="{ width: catalogWidth + 'px' }" style="border-left: 1px solid var(--border-color); background: var(--bg-panel); display: flex; flex-direction: column; overflow-y: auto; flex-shrink: 0;">
        <div style="padding: 16px; font-weight: 900; font-size: 12px; opacity: 0.5;">БАЗОВЫЕ ПОЛЯ</div>
        <div style="padding: 0 16px; display: flex; flex-direction: column; gap: 8px;">
          <div v-for="brick in atomicBricks" :key="brick.val" class="catalog-item interactive-el" draggable="true" style="padding: 12px; background: var(--bg-input); border-radius: 8px; border: 1px solid rgba(255,255,255,0.05); display: flex; align-items: center; gap: 10px; cursor: grab;" @dragstart="handleDragStartPalette($event, 'atomic', brick.val, brick.label)">
            <span style="font-size: 18px;">{{ brick.icon }}</span>
            <span style="font-size: 11px; font-weight: 600;">{{ brick.label }}</span>
          </div>
        </div>

        <div style="padding: 16px; font-weight: 900; font-size: 12px; opacity: 0.5; margin-top: 10px;">⏱️ TIMELINE-МОДУЛИ</div>
        <div style="padding: 0 16px; display: flex; flex-direction: column; gap: 8px;">
          <div v-for="(tpl, key) in timelineTemplates" :key="key" class="catalog-item interactive-el" draggable="true" style="padding: 12px; background: var(--bg-input); border-radius: 8px; border: 1px solid rgba(255,255,255,0.05); display: flex; align-items: center; gap: 10px; cursor: grab;" @dragstart="handleDragStartPalette($event, 'module', String(key), String(key))">
            <span style="font-size: 18px;">⏱️</span>
            <span style="font-size: 11px; font-weight: 600;">{{ key }}</span>
          </div>
        </div>

        <div style="padding: 16px; font-weight: 900; font-size: 12px; opacity: 0.5; margin-top: 10px;">📋 DYNAMIC-МОДУЛИ</div>
        <div style="padding: 0 16px; display: flex; flex-direction: column; gap: 8px;">
          <div v-for="(tpl, key) in dynamicTemplates" :key="key" class="catalog-item interactive-el" draggable="true" style="padding: 12px; background: var(--bg-input); border-radius: 8px; border: 1px solid rgba(255,255,255,0.05); display: flex; align-items: center; gap: 10px; cursor: grab;" @dragstart="handleDragStartPalette($event, 'module', String(key), String(key))">
            <span style="font-size: 18px;">{{ tpl.isBidirectional ? '🤝' : '📋' }}</span>
            <span style="font-size: 11px; font-weight: 600;">{{ key }}</span>
          </div>
        </div>
      </aside>

      <!-- RIGHT SIDEBAR (HISTORY) -->
      <aside v-if="showHistory" style="width: 280px; background: var(--bg-panel); border-left: 1px solid var(--border-color); display: flex; flex-direction: column; flex-shrink: 0;">
        <div style="padding: 16px; border-bottom: 1px solid var(--border-color); font-size: 12px; font-weight: bold; display: flex; justify-content: space-between; align-items: center;">
          <span>История изменений</span>
          <button style="background: none; border: none; cursor: pointer; color: var(--text-muted);" @click="showHistory = false">✕</button>
        </div>
        
        <div style="padding: 12px; border-bottom: 1px solid var(--border-color);">
          <label style="font-size: 10px; color: var(--text-muted);">Хранить последних версий:</label>
          <input v-model="maxSaves" type="number" class="input-base" style="width: 100%; font-size: 12px; padding: 4px; margin-top: 4px;">
        </div>

        <div style="flex: 1; overflow-y: auto; padding: 12px; display: flex; flex-direction: column; gap: 8px;">
          <div v-if="schemaHistory.length === 0" style="font-size: 10px; color: var(--text-muted); text-align: center;">Нет сохраненных версий</div>
          <div
v-for="h in schemaHistory" :key="h.id" 
               class="interactive-el" 
               :style="{ background: historyPreviewId === h.id ? 'rgba(139,92,246,0.1)' : 'var(--bg-input)' }"
               style="padding: 8px 12px; border-radius: 8px; border: 1px solid var(--border-color); cursor: pointer;"
               @click="previewHistory(h)">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
              <span style="font-size: 11px; font-weight: bold;">{{ h.formattedDate }}</span>
              <button style="background: none; border: none; cursor: pointer; font-size: 12px; color: var(--accent);" :title="h.is_pinned ? 'Открепить' : 'Закрепить от удаления'" @click.stop="togglePin(h)">
                {{ h.is_pinned ? '📌' : '📍' }}
              </button>
            </div>
            <div v-if="historyPreviewId === h.id" style="margin-top: 8px;">
              <span style="font-size: 9px; color: #f5a623;">Режим предпросмотра</span>
            </div>
          </div>
        </div>
      </aside>
    </div>
    <!-- JSON ПРЕВЬЮ -->
    <div v-if="hook.showJsonPreview.value" class="glass-modal-overlay visible" @click="setShowJsonPreview(false)">
      <div class="glass-modal glass-panel" style="width: 1100px; height: 85vh; display: flex; flex-direction: column;" @click.stop>
         <div class="glass-title" style="display: flex; justify-content: space-between; align-items: center; padding-right: 20px;">
            <span>SCHEMA (JSON)</span>
            <button class="btn-new" style="font-size: 10px; padding: 4px 12px;" @click="setShowJsonPreview(false)">ЗАКРЫТЬ</button>
         </div>
         <div style="flex: 1; padding: 24px; overflow: hidden;">
            <textarea :value="jsonPreviewContent" readonly class="input-base" style="width: 100%; height: 100%; background: #000; color: #0f0; font-family: monospace; font-size: 12px; padding: 20px; border: 1px solid var(--border-color); resize: none;"></textarea>
         </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import SchemaFieldEditor from './SchemaFieldEditor.vue';
import SchemaContainer from './SchemaContainer.vue';
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

const hook = useSchemaEditorMain(props, emit);

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
  exportSchema,
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

const isAtomicField = (item: any) => {
  return atomicBricks.some((b: any) => b.val === item.type) || item.type === 'tags' || item.type === 'range';
};
</script>

<style scoped src="./SchemaEditorMain.vue.css"></style>
