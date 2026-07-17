<template>
  <div class="schema-editor-main glass-theme" style="width: 100%; height: 100%; display: flex; flex-direction: column;">
    
    <header class="glass-panel" style="border-radius: 0; border: none; border-bottom: 1px solid var(--border-color); padding: 0 24px; display: flex; justify-content: space-between; align-items: center; z-index: 1000; height: 50px; background: var(--bg-panel); backdrop-filter: blur(20px); flex-shrink: 0;">
      <div style="display: flex; align-items: center; gap: 30px;">
        <div style="font-weight: 900; color: var(--accent); font-size: 14px; display: flex; align-items: center; gap: 8px;">
          ⚙️ СХЕМА:
          <input v-model="localEntityType" class="input-base" style="background: transparent; border: none; font-weight: 900; color: var(--accent); font-size: 14px; text-transform: uppercase; padding: 0;" placeholder="ИМЯ СХЕМЫ" />
        </div>
      </div>
      <div style="display: flex; gap: 8px; align-items: center;">
        <button v-if="isHistoryPreviewMode" class="btn-new btn-outline-new" style="font-size: 10px; padding: 4px 12px; color: #f5a623; border-color: rgba(245,166,35,0.3);" @click="exitPreviewMode">Вернуться к текущей</button>
        <button class="btn-new btn-outline-new" style="font-size: 10px; padding: 4px 12px; color: #f55; border-color: rgba(255,85,85,0.3);" @click="loadSchema(true)">Сбросить изменения</button>
        <button class="btn-new btn-outline-new" style="font-size: 10px; padding: 4px 12px;" @click="openPreview">ПРЕДПРОСМОТР</button>
        <button class="btn-new btn-outline-new" style="font-size: 10px; padding: 4px 12px;" @click="showJsonPreview = true">Схема</button>
        <button class="btn-new btn-outline-new" style="font-size: 10px; padding: 4px 12px;" @click="exportSchema">Экспорт</button>
        <button class="btn-new" style="font-size: 10px; padding: 4px 12px; background: var(--accent);" @click="saveSchema">Сохранить</button>
        <button class="btn-new btn-outline-new" style="font-size: 14px; padding: 4px 8px; border-color: var(--border-color); color: var(--text-muted);" title="История изменений" @click="toggleHistoryPanel">
          <svg stroke="currentColor" fill="none" stroke-width="2" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round" height="16" width="16" xmlns="http://www.w3.org/2000/svg" style="display:inline;vertical-align:middle"><path d="M7 18m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"></path><path d="M7 6m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"></path><path d="M17 6m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"></path><path d="M7 8l0 8"></path><path d="M9 18h6a2 2 0 0 0 2 -2v-5"></path><path d="M14 14l3 -3l3 3"></path></svg>
        </button>
      </div>
    </header>

    <div style="flex: 1; display: flex; overflow: hidden; background: var(--bg-base);">
      <!-- ПРЕДПРОСМОТР -->
      <div v-if="isPreviewMode" style="flex: 1; display: flex; flex-direction: column;">
        <div style="padding: 12px; background: rgba(245,166,35,0.1); border-bottom: 1px solid rgba(245,166,35,0.3); display: flex; justify-content: space-between; align-items: center;">
           <span style="color: #f5a623; font-weight: bold; font-size: 11px;">👁️ РЕЖИМ ПРЕДПРОСМОТРА</span>
           <button class="btn-new" style="background: #f5a623; color: #000; padding: 4px 12px; font-size: 10px;" @click="isPreviewMode = false">ВЕРНУТЬСЯ В РЕДАКТОР</button>
        </div>
        <div style="flex: 1; position: relative;">
          <EntityEditorVue :key="previewKey" entity-id="preview" entity-type="sandbox_preview" project="sandbox" :initial-data="{}" />
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
    <div v-if="showJsonPreview" class="glass-modal-overlay visible" @click="showJsonPreview = false">
      <div class="glass-modal glass-panel" style="width: 1100px; height: 85vh; display: flex; flex-direction: column;" @click.stop>
         <div class="glass-title" style="display: flex; justify-content: space-between; align-items: center; padding-right: 20px;">
            <span>SCHEMA (JSON)</span>
            <button class="btn-new" style="font-size: 10px; padding: 4px 12px;" @click="showJsonPreview = false">ЗАКРЫТЬ</button>
         </div>
         <div style="flex: 1; padding: 24px; overflow: hidden;">
            <textarea :value="jsonPreviewContent" readonly class="input-base" style="width: 100%; height: 100%; background: #000; color: #0f0; font-family: monospace; font-size: 12px; padding: 20px; border: 1px solid var(--border-color); resize: none;"></textarea>
         </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch, nextTick, shallowRef } from 'vue';
import { apiService } from '../../../services/api.service';
import SchemaFieldEditor from './SchemaFieldEditor.vue';
import SchemaContainer from './SchemaContainer.vue';
import EntityEditorVue from '../../../features/entities/EntityEditor/EntityEditor.vue';
import uiEditorData from '../../../../../public/struct/editor/ui_editor.json';

const props = withDefaults(defineProps<{
  entityType: string;
  project: string;
  initialScrollPos?: number;
  initialSection?: string;
}>(), {
  initialScrollPos: 0,
  initialSection: ''
});

const emit = defineEmits(['scroll-change', 'section-change']);

const localEntityType = ref(props.entityType);
const catalogWidth = ref(250);

const startResize = (e: MouseEvent) => {
  const startX = e.clientX;
  const startWidth = catalogWidth.value;
  const onMouseMove = (moveEvent: MouseEvent) => {
    catalogWidth.value = Math.max(200, Math.min(600, startWidth - (moveEvent.clientX - startX)));
  };
  const onMouseUp = () => {
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
  };
  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp);
};

const schema = ref<any>({ sections: [] });
const scrollContainer = ref<HTMLElement | null>(null);

const showHistory = ref(false);
const schemaHistory = shallowRef<any[]>([]);
const maxSaves = ref(30);
const isHistoryPreviewMode = ref(false);
const historyPreviewId = ref<string | null>(null);

const handleScroll = (e: any) => {
  emit('scroll-change', e.target.scrollTop);
};
const activeSectionIdx = ref(0);
const activeSection = computed(() => schema.value.sections[activeSectionIdx.value]);

watch(activeSectionIdx, (newIdx) => {
  if (schema.value?.sections?.[newIdx]) {
    emit('section-change', schema.value.sections[newIdx].id);
  }
});
const draggedOverIdx = ref(-1);
let draggedItemInfo: any = null;

const isPreviewMode = ref(false);
const showJsonPreview = ref(false);
const previewKey = ref(0);

const jsonPreviewContent = computed(() => {
  return JSON.stringify(schema.value, null, 2);
});

const openPreview = () => {
  sessionStorage.setItem('sandbox_preview_config', jsonPreviewContent.value);
  previewKey.value++; // Force EntityEditor remount
  isPreviewMode.value = true;
};

const exportSchema = () => {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(jsonPreviewContent.value);
  const downloadAnchorNode = document.createElement('a');
  downloadAnchorNode.setAttribute("href", dataStr);
  downloadAnchorNode.setAttribute("download", `${props.entityType || 'schema'}.json`);
  document.body.appendChild(downloadAnchorNode);
  downloadAnchorNode.click();
  downloadAnchorNode.remove();
};

const atomicBricks = [
  { val: 'text', icon: '📝', label: 'Текст' },
  { val: 'textarea', icon: '📄', label: 'Абзац' },
  { val: 'select', icon: '🔽', label: 'Список' },
  { val: 'multiselect', icon: '☑️', label: 'Мульти' },
  { val: 'calendar_date', icon: '📅', label: 'Дата' },
  { val: 'range', icon: '🎚️', label: 'Шкала' },
  { val: 'number', icon: '🔢', label: 'Число' },
  { val: 'tags', icon: '🏷️', label: 'Теги' },
  { val: 'photo', icon: '🖼️', label: 'Фото' }
];

const showCatalog = ref(true);

const HELPER_TEMPLATES = ['dynamicEndDateTemplate', 'dynamicDisbandDateTemplate', 'dynamicAbolitionDateTemplate', 'stateCollapseDateTemplate'];

const timelineTemplates = computed(() => {
  const all = uiEditorData.templates || {} as any;
  const result: Record<string, any> = {};
  Object.entries(all).forEach(([key, tpl]: [string, any]) => {
    if (HELPER_TEMPLATES.includes(key)) return;
    if (tpl.type === 'timeline') result[key] = tpl;
  });
  return result;
});

const dynamicTemplates = computed(() => {
  const all = uiEditorData.templates || {} as any;
  const result: Record<string, any> = {};
  Object.entries(all).forEach(([key, tpl]: [string, any]) => {
    if (HELPER_TEMPLATES.includes(key)) return;
    if (tpl.type === 'dynamic') result[key] = tpl;
  });
  return result;
});

const handleGlobalKeydown = (e: KeyboardEvent) => {
  if (e.ctrlKey && e.shiftKey && e.code === 'KeyB') {
    e.preventDefault();
    showCatalog.value = !showCatalog.value;
  }
};

const loadSchema = async (forceRefetch = false) => {
  try {
    const schemas = await apiService.getSchemas(props.project);
    if (schemas[props.entityType] && schemas[props.entityType].full_schema) {
      schema.value = JSON.parse(JSON.stringify(schemas[props.entityType].full_schema));
    } else {
      try {
        const res = await fetch(`/struct/editor/${props.entityType}.json`);
        if (res.ok) {
          schema.value = await res.json();
        } else {
          throw new Error('Not found');
        }
      } catch (err) {
        // Инициализируем пустую схему если JSON не найден
        schema.value = {
          name: props.entityType,
          entityType: props.entityType,
          titleField: 'name',
          sections: [
            {
              id: 'page_main',
              title: 'Главное',
              icon: '📄',
              items: [
                { type: 'text', class: 'name', label: 'НАЗВАНИЕ', placeholder: '...', _isSystemName: true }
              ]
            }
          ]
        };
      }
    }
    
    // Миграция старых схем: объединяем fields и dynamicContainers в единый массив items
    if (schema.value.sections) {
      schema.value.sections.forEach((sec: any) => {
        if (!sec.items) {
          sec.items = [];
          if (sec.fields) {
            sec.items.push(...sec.fields);
            delete sec.fields;
          }
          if (sec.dynamicContainers) {
            sec.items.push(...sec.dynamicContainers);
            delete sec.dynamicContainers;
          }
        }
      });
    }
    
    // Если схема загрузилась пустая (например, из-за предыдущих ошибок сохранения),
    // инициализируем её базовой страницей, иначе холст будет абсолютно пустым.
    if (!schema.value.sections || schema.value.sections.length === 0) {
      schema.value.sections = [
        {
          id: 'page_main',
          title: 'Главное',
          icon: '📄',
          items: [
            { type: 'text', class: 'name', label: 'НАЗВАНИЕ', placeholder: '...', _isSystemName: true }
          ]
        }
      ];
    }
    if (props.initialSection) {
      const idx = schema.value.sections.findIndex((s: any) => s.id === props.initialSection);
      activeSectionIdx.value = idx !== -1 ? idx : 0;
    } else {
      activeSectionIdx.value = 0;
    }

    // Восстанавливаем скролл после загрузки (небольшая задержка, чтобы DOM обновился)
    setTimeout(() => {
      if (scrollContainer.value && props.initialScrollPos > 0) {
        scrollContainer.value.scrollTop = props.initialScrollPos;
      }
    }, 50);

  } catch (e) {
    console.error('Schema loading error:', e);
  }
};

onMounted(() => {
  loadSchema();
  document.addEventListener('keydown', handleGlobalKeydown);
});

onUnmounted(() => {
  document.removeEventListener('keydown', handleGlobalKeydown);
});

const saveSchema = async () => {
  try {
    const schemaCopy = JSON.parse(JSON.stringify(schema.value));
    schemaCopy.sections.forEach((sec: any) => {
      sec.fields = [];
      sec.dynamicContainers = [];
      if (sec.items) {
        sec.items.forEach((item: any) => {
          if (isAtomicField(item)) {
            sec.fields.push(item);
          } else {
            sec.dynamicContainers.push(item);
          }
        });
        delete sec.items;
      }
    });

    const dataToSave = {
      id: `entity_schemas:${localEntityType.value}`,
      type_key: localEntityType.value,
      type_name: schemaCopy.name || localEntityType.value,
      icon: schemaCopy.icon || '📄',
      color: schemaCopy.color || '#333333',
      fields_schema: [],
      full_schema: schemaCopy,
      is_custom: true
    };
    await apiService.saveSchema(props.project, dataToSave, maxSaves.value);
    document.dispatchEvent(new CustomEvent('ww:schema-updated', { detail: { entityType: localEntityType.value } }));
    
    if (isHistoryPreviewMode.value) {
      exitPreviewMode();
    }
    
    if (showHistory.value) {
      await loadHistory();
    }
    
    alert('Схема сохранена!');
  } catch (e) {
    console.error('Schema saving error:', e);
    alert('Ошибка сохранения');
  }
};

const isAtomicField = (item: any) => {
  return atomicBricks.some(b => b.val === item.type) || item.type === 'tags' || item.type === 'range';
};

const toggleHistoryPanel = async () => {
  showHistory.value = !showHistory.value;
  if (showHistory.value) {
    await loadHistory();
  }
};

const loadHistory = async () => {
  try {
    const history = await apiService.getSchemaHistory(props.project, props.entityType) || [];
    schemaHistory.value = history.map((h: any) => ({
      ...h,
      formattedDate: new Date(h.saved_at).toLocaleString()
    }));
  } catch (e) {
    console.error(e);
  }
};

const togglePin = async (history: any) => {
  try {
    await apiService.toggleSchemaHistoryPin(history.id, !history.is_pinned);
    history.is_pinned = !history.is_pinned;
  } catch (e) {
    console.error(e);
  }
};

const previewHistory = (history: any) => {
  isHistoryPreviewMode.value = true;
  historyPreviewId.value = history.id;
  const data = history.snapshot;
  if (data.full_schema) {
    schema.value = JSON.parse(JSON.stringify(data.full_schema));
    if (!schema.value.sections) schema.value.sections = [];
    schema.value.sections.forEach((sec: any) => {
      sec.items = [
        ...(sec.fields || []).map((f: any) => ({ ...f, _isAtomic: true })),
        ...(sec.dynamicContainers || []).map((c: any) => ({ ...c, _isAtomic: false }))
      ];
    });
  }
};

const exitPreviewMode = () => {
  isHistoryPreviewMode.value = false;
  historyPreviewId.value = null;
  loadSchema(false);
};

const addNewPage = () => {
  schema.value.sections.push({
    id: `page_${Date.now()}`,
    title: `Новая страница`,
    icon: '📄',
    items: [],
    dynamicContainers: []
  });
  activeSectionIdx.value = schema.value.sections.length - 1;
};

const deleteSection = (idx: number) => {
  if (idx === 0) return; // Нельзя удалять первую страницу
  if (confirm('Удалить страницу?')) {
    schema.value.sections.splice(idx, 1);
    if (activeSectionIdx.value >= schema.value.sections.length) {
      activeSectionIdx.value = Math.max(0, schema.value.sections.length - 1);
    }
  }
};

const removeItem = (idx: number) => {
  if (activeSectionIdx.value === 0 && idx === 0) return; // Защита
  activeSection.value.items.splice(idx, 1);
};

// --- DRAG & DROP LOGIC ---
const handleDragStartPalette = (e: DragEvent, kind: string, val: string, label: string) => {
  draggedItemInfo = { source: 'palette', kind, val, label };
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData('text/plain', kind);
  }
};

const handleItemDragStart = (e: DragEvent, idx: number) => {
  if (activeSectionIdx.value === 0 && idx === 0) {
    e.preventDefault(); // Нельзя перетаскивать первое поле первой страницы
    return;
  }
  draggedItemInfo = { source: 'canvas', idx };
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', 'canvasItem');
  }
};

const handleDragOverCanvas = (e: DragEvent) => {
  if (e.dataTransfer) e.dataTransfer.dropEffect = draggedItemInfo?.source === 'palette' ? 'copy' : 'move';
};

const handleDropNew = (e: DragEvent) => {
  draggedOverIdx.value = -1;
  if (!draggedItemInfo) return;
  if (draggedItemInfo.source === 'palette' && draggedItemInfo.kind === 'atomic') {
    activeSection.value.items.push({
      type: draggedItemInfo.val,
      class: `field_${Date.now()}`,
      label: draggedItemInfo.label.toUpperCase(),
      placeholder: '...'
    });
  } else if (draggedItemInfo.source === 'palette' && draggedItemInfo.kind === 'module') {
    activeSection.value.items.push({
      type: draggedItemInfo.template?.includes('timeline') ? 'timeline' : 'dynamic',
      template: draggedItemInfo.val,
      title: 'НОВЫЙ МОДУЛЬ',
      emptyMessage: 'Пусто...',
      customFields: []
    });
  }
  draggedItemInfo = null;
};

const handleItemDrop = (targetIdx: number) => {
  draggedOverIdx.value = -1;
  if (!draggedItemInfo) return;
  if (targetIdx === 0 && activeSectionIdx.value === 0) return; // Нельзя бросать на место первого поля
  
  if (draggedItemInfo.source === 'canvas') {
    const srcIdx = draggedItemInfo.idx;
    if (srcIdx === targetIdx) return;
    const item = activeSection.value.items.splice(srcIdx, 1)[0];
    const insertIdx = srcIdx < targetIdx ? targetIdx : targetIdx;
    activeSection.value.items.splice(insertIdx, 0, item);
  } else if (draggedItemInfo.source === 'palette') {
    if (draggedItemInfo.kind === 'atomic') {
      activeSection.value.items.splice(targetIdx, 0, {
        type: draggedItemInfo.val,
        class: `field_${Date.now()}`,
        label: draggedItemInfo.label.toUpperCase(),
        placeholder: '...'
      });
    } else if (draggedItemInfo.kind === 'module') {
      activeSection.value.items.splice(targetIdx, 0, {
        type: draggedItemInfo.template?.includes('timeline') ? 'timeline' : 'dynamic',
        template: draggedItemInfo.val,
        title: 'НОВЫЙ МОДУЛЬ',
        emptyMessage: 'Пусто...',
        customFields: []
      });
    }
  }
  draggedItemInfo = null;
};

const handleDropIntoModule = (moduleIdx: number) => {
  if (!draggedItemInfo) return;
  if (draggedItemInfo.source === 'palette' && draggedItemInfo.kind === 'atomic') {
    const mod = activeSection.value.items[moduleIdx];
    if (!mod.customFields) mod.customFields = [];
    mod.customFields.push({
      type: draggedItemInfo.val,
      class: `custom_${Date.now()}`,
      label: draggedItemInfo.label.toUpperCase(),
      placeholder: '...',
      sourceType: '',
      targetType: ''
    });
  }
  draggedItemInfo = null;
};
</script>

<style scoped>
.is-dragging-over {
  border-color: var(--accent) !important;
  box-shadow: 0 0 15px rgba(139,92,246,0.5);
  transform: scale(1.02);
}
.schema-item-card {
  transition: all 0.2s ease;
}
.catalog-item:hover {
  background: rgba(139,92,246,0.1) !important;
  border-color: rgba(139,92,246,0.3) !important;
}
</style>
