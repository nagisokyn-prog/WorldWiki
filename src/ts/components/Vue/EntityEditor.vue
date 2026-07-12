<template>
  <div v-if="loading" class="editor-loading">
    <div style="text-align: center; color: var(--text-muted); padding: 40px;">
      ⏳ Загрузка конфигурации и данных...
    </div>
  </div>
  <div v-else-if="!config" class="editor-error">
    <div style="text-align: center; color: #ef4444; padding: 40px;">
      ❌ Ошибка загрузки схемы для типа {{ entityType }}
    </div>
  </div>
  <div v-else class="entity-editor-vue" style="display:flex; flex-direction:column; flex:1; min-height:0;">
    <div class="editor-tabs-new" v-if="(config as any)?.sections && (config as any).sections.length > 1">
      <template v-for="(section, idx) in (config as any).sections" :key="section.id">
        <div 
          v-if="!section.hidden"
          class="editor-tab-new interactive-el" 
          :class="{ active: activeSection === section.id }"
          @click="activeSection = section.id; $emit('section-change', section.id)"
        >
          {{ section.icon || '' }} {{ section.title }}
        </div>
      </template>
    </div>

    <!-- Предупреждение о режиме истории -->
    <div v-if="isPreviewingHistory" style="background: rgba(245,166,35,0.1); border-bottom: 1px solid rgba(245,166,35,0.3); padding: 8px 24px; display: flex; justify-content: space-between; align-items: center; flex-shrink: 0;">
      <span style="font-size: 11px; color: #f5a623; font-weight: bold;">⚠️ ВЫ ПРОСМАТРИВАЕТЕ СТАРУЮ ВЕРСИЮ СУЩНОСТИ</span>
      <div style="display: flex; gap: 8px;">
         <button class="btn-new btn-outline-new" style="font-size: 10px; border: 1px solid rgba(245,166,35,0.3); background: transparent; color: #f5a623; padding: 4px 8px; border-radius: 4px; cursor: pointer;" @click="exitHistoryPreview">Отмена</button>
         <button class="btn-new" style="font-size: 10px; background: #f5a623; color: #000; padding: 4px 8px; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;" @click="restoreHistory">Восстановить эту версию</button>
      </div>
    </div>

    <!-- Область формы -->
    <div class="split-view" style="flex:1; display:flex; flex-direction:row; min-height:0;">
      <div ref="scrollContainer" class="split-editor-core" style="flex:1; padding: 24px; overflow-y:auto; overflow-x:hidden;">
        <transition name="fade" mode="out-in">
          <div :key="activeSection">
            <template v-for="section in config.sections" :key="'sec-'+section.id">
              <div v-if="activeSection === section.id && !section.hidden" class="section-content">
                
                <!-- Простые поля (Fields) -->
                <div v-if="section.fields && section.fields.length > 0" class="glass-card" style="margin-bottom:24px;">
                  <h2 class="card-title">{{ section.title }}</h2>
                    <div class="grid-dynamic">
                      <template v-for="field in section.fields" :key="field.id">
                        <div v-if="!field.hidden" class="form-group" :class="{ 'full-width': field.fullWidth, 'history-changed': isFieldChanged(field.path || field.id) }" style="position: relative; overflow: visible;">
                          <label class="form-label" :for="field.id">
                            {{ field.label }} 
                            <span v-if="field.required" style="color:var(--accent)">*</span>
                            <span v-if="isFieldChanged(field.path || field.id)" class="changed-indicator" title="Значение отличается от текущей версии">Изменено</span>
                          </label>
                          
                          <textarea v-if="field.type === 'textarea'" 
                                    :value="getProp(field.path || field.id)"
                                    @input="e => { setProp(field.path || field.id, (e.target as any).value); markModified(); }"
                                    class="input-base interactive-el" 
                                    :rows="field.rows || 3" 
                                    :placeholder="field.placeholder"></textarea>

                          <!-- Photo upload field -->
                          <div v-else-if="field.type === 'photo'" class="photo-upload-zone" @click="triggerPhotoUpload(field.path || field.id)" @dragover.prevent @drop.prevent="e => handlePhotoDrop(e, field.path || field.id)">
                            <input type="file" accept="image/*" style="display:none" :ref="el => photoInputs[field.path || field.id] = el" @change="e => handlePhotoFile(e, field.path || field.id)" />
                            <div v-if="getProp(field.path || field.id)" class="photo-preview">
                              <img :src="getPhotoUrl(getProp(field.path || field.id))" alt="Фото" />
                              <button class="photo-remove-btn" @click.stop="removePhoto(field.path || field.id)" title="Удалить фото">✕</button>
                            </div>
                            <div v-else class="photo-placeholder">
                              <div class="photo-icon">🖼️</div>
                              <div class="photo-hint">{{ field.placeholder || 'Нажмите или перетащите изображение' }}</div>
                            </div>
                          </div>

                          <XboxWheel v-else-if="field.type === 'select'"
                                     :horizontal="wheelHorizontal"
                                     :model-value="getProp(field.path || field.id)"
                                     @update:modelValue="val => { setProp(field.path || field.id, val); markModified(); }"
                                     :options="getOptionsFor(field)" />

                          <div v-else-if="field.type === 'multiselect'" class="multiselect-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 12px; margin-top: 8px;">
                            <label v-for="opt in getOptionsFor(field)" :key="opt.value" class="checkbox-item interactive-el" style="display: flex; align-items: center; gap: 8px; cursor: pointer; padding: 8px 12px; background: var(--bg-input, rgba(255,255,255,0.05)); border: 1px solid var(--border-color, rgba(255,255,255,0.1)); border-radius: 8px; transition: all 0.2s ease;">
                              <input type="checkbox" 
                                     :value="opt.value" 
                                     :checked="(getProp(field.path || field.id) || []).includes(opt.value)"
                                     @change="e => { 
                                       let arr = getProp(field.path || field.id) || []; 
                                       if (!Array.isArray(arr)) arr = [];
                                       if ((e.target as any).checked && !arr.includes(opt.value)) arr.push(opt.value);
                                       else if (!(e.target as any).checked) arr = arr.filter((v: any) => v !== opt.value);
                                       setProp(field.path || field.id, arr);
                                       markModified();
                                     }"
                                     style="accent-color: var(--accent, #7c3aed); width: 16px; height: 16px;"> 
                              <span style="font-size: 13px; color: var(--text-main, #fff);">{{ opt.label }}</span>
                            </label>
                          </div>

                          <DateWheels v-else-if="field.type === 'calendar_date' || field.type === 'calendar_date_base'"
                                      :model-value="getProp(field.path || field.id)"
                                      :project="project"
                                      @update:modelValue="val => { setProp(field.path || field.id, val); markModified(); }" />
                          
                          <TagsField v-else-if="field.type === 'tags'"
                                     :model-value="getProp(field.path || field.id)"
                                     :project="project"
                                     :placeholder="field.placeholder"
                                     @update:modelValue="val => { setProp(field.path || field.id, val); markModified(); }"
                                     @modified="markModified" />

                          <input v-else 
                                 :type="field.type || 'text'" 
                                 :value="getProp(field.path || field.id)"
                                 @input="e => { setProp(field.path || field.id, (e.target as any).value); markModified(); }"
                                 class="input-base interactive-el"
                                 :placeholder="field.placeholder">
                                 
                          <div v-if="field.hint" class="form-hint" style="font-size:11px; color:var(--text-muted); margin-top:4px;">{{ field.hint }}</div>
                        </div>
                      </template>
                    </div>
                </div>

                <!-- Динамические контейнеры (Массивы записей) -->
                <div v-if="section.dynamicContainers && section.dynamicContainers.length > 0" style="margin-top:24px;">
                  <template v-for="(container, cIdx) in section.dynamicContainers" :key="container.id">
                    <div v-if="!container.hidden" 
                         :class="{ 'history-changed': isFieldChanged(container.dataPath || container.id) }"
                         style="margin-bottom:24px; position: relative; overflow: visible;" 
                         :style="{ zIndex: 100 - (cIdx as any) }">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                      <h4 style="color:var(--text-muted); text-transform:uppercase; font-size:12px; font-weight:600; letter-spacing:1px;">
                        {{ container.title || 'Дополнительно' }}
                        <span v-if="isFieldChanged(container.dataPath || container.id)" class="changed-indicator" title="Связи отличаются от текущей версии">Изменено</span>
                      </h4>
                      <button class="btn btn-small btn-outline interactive-el" @click="addDynamicItem(container.dataPath || container.id, container.template)">➕ Добавить</button>
                    </div>

                    <div v-if="!getProp(container.dataPath || container.id) || getProp(container.dataPath || container.id).length === 0" class="empty-timeline" style="padding:20px; text-align:center; color:var(--text-muted); background:rgba(0,0,0,0.2); border-radius:12px; border:1px solid var(--border-color);">
                      {{ container.emptyMessage || 'Элементы не добавлены' }}
                    </div>
                    
                     <div v-else style="position: relative; z-index: 50;">
                      <!-- Двусторонние связи — свой компонент -->
                      <template v-if="getResolvedTemplate(container)?.isBidirectional">
                        <RelationshipBlock
                          v-for="(item, idx) in getProp(container.dataPath || container.id)"
                          :key="idx"
                          :item="item"
                          :idx="idx as any"
                          :template-conf="getResolvedTemplate(container)"
                          :all-templates="(config as any).templates"
                          :reference-data="referenceData"
                          :entity-id="props.entityId"
                          :entity-type="props.entityType"
                          :project="props.project"
                          @remove="removeDynamicItem(container.dataPath || container.id, $event)"
                          @modified="markModified"
                          @foreign-update="handleForeignUpdate"
                          @item-updated="({ item: updatedItem, idx: itemIdx }: any) => { 
                            const structuredArr = getProp(container.dataPath || container.id);
                            if (structuredArr && Array.isArray(structuredArr) && (itemIdx as any) < structuredArr.length) {
                              structuredArr[itemIdx] = updatedItem;
                              console.log('[EntityEditor.vue] 🔄 item-updated: обновил структурированный путь', itemIdx, 'в', container.dataPath || container.id);
                              
                              // ТАКЖЕ обновляем плоский путь если он отличается (Удалено по просьбе пользователя)
                            }
                          }"
                        />
                      </template>

                      <!-- Обычные динамические элементы -->
                      <template v-else>
                        <div v-for="(item, idx) in getProp(container.dataPath || container.id)" :key="idx" class="glass-card" :style="{ marginBottom: '16px', padding: '16px', overflow: 'visible', position: 'relative', zIndex: 50 - (idx as any) }">
                          <div style="display:flex; justify-content:space-between; margin-bottom:12px; padding-bottom:8px; border-bottom:1px solid rgba(255,255,255,0.05);">
                            <strong style="color:var(--accent);">Элемент #{{ (idx as any) + 1 }}</strong>
                            <button class="btn-danger-icon interactive-el" @click="removeDynamicItem(container.dataPath || container.id, idx)" style="background:transparent; border:none; color:#ef4444; cursor:pointer;" title="Удалить">🗑️</button>
                          </div>
                          
                          <!-- Рендерим шаблон -->
                          <div v-if="getResolvedTemplate(container)">
                            <div v-for="tField in getResolvedTemplate(container).fields" :key="tField.id || tField.class" class="form-group" style="margin-bottom:12px;">
                              <label v-if="tField.label" class="form-label" style="font-size:10px;">{{ tField.label }}</label>
                              
                              <textarea v-if="tField.type === 'textarea'" 
                                    :value="getProp(item, tField.id || tField.class)"
                                    @input="e => { setProp(item, tField.id || tField.class, (e.target as any).value); markModified(); }"
                                    class="input-base" 
                                    :rows="tField.rows || 2" 
                                    :placeholder="tField.placeholder"></textarea>
                                    
                              <XboxWheel v-else-if="tField.type === 'select'"
                                         :horizontal="wheelHorizontal"
                                         :model-value="getProp(item, tField.id || tField.class)"
                                         @update:modelValue="val => { setProp(item, tField.id || tField.class, val); markModified(); }"
                                         :options="getOptionsFor(tField)"
                                         :placeholder="tField.placeholder" />
                                         
                              <div v-else-if="tField.type === 'multiselect'" class="multiselect-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 12px; margin-top: 8px;">
                                <label v-for="opt in getOptionsFor(tField)" :key="opt.value" class="checkbox-item interactive-el" style="display: flex; align-items: center; gap: 8px; cursor: pointer; padding: 8px 12px; background: var(--bg-input, rgba(255,255,255,0.05)); border: 1px solid var(--border-color, rgba(255,255,255,0.1)); border-radius: 8px; transition: all 0.2s ease;">
                                  <input type="checkbox" 
                                         :value="opt.value" 
                                         :checked="(getProp(item, tField.id || tField.class) || []).includes(opt.value)"
                                         @change="e => { 
                                           let arr = getProp(item, tField.id || tField.class) || []; 
                                           if (!Array.isArray(arr)) arr = [];
                                           if ((e.target as any).checked && !arr.includes(opt.value)) arr.push(opt.value);
                                           else if (!(e.target as any).checked) arr = arr.filter((v: any) => v !== opt.value);
                                           setProp(item, tField.id || tField.class, arr);
                                           markModified();
                                         }"
                                         style="accent-color: var(--accent, #7c3aed); width: 16px; height: 16px;"> 
                                  <span style="font-size: 13px; color: var(--text-main, #fff);">{{ opt.label }}</span>
                                </label>
                              </div>
                              
                              <div v-else-if="tField.type === 'range'" class="range-wrap">
                                <input type="range"
                                  :min="tField.min ?? -100"
                                  :max="tField.max ?? 100"
                                  :value="getProp(item, tField.id || tField.class) ?? 0"
                                  @input="e => { setProp(item, tField.id || tField.class, Number((e.target as any).value)); markModified(); }"
                                  style="flex:1; accent-color: var(--accent);"
                                >
                                <span style="min-width:36px; text-align:right; font-size:12px; color:var(--accent); font-weight:600;">{{ getProp(item, tField.id || tField.class) ?? 0 }}</span>
                              </div>

                              <DateWheels v-else-if="tField.type === 'calendar_date' || tField.type === 'calendar_date_base'"
                                          :model-value="getProp(item, tField.id || tField.class)"
                                          :project="project"
                                          @update:modelValue="val => { setProp(item, tField.id || tField.class, val); markModified(); }" />

                              <input v-else 
                                     :type="tField.type || 'text'" 
                                     :value="getProp(item, tField.id || tField.class)"
                                     @input="e => { setProp(item, tField.id || tField.class, (e.target as any).value); markModified(); }"
                                     class="input-base"
                                     :placeholder="tField.placeholder">
                            </div>
                          </div>
                        </div>
                      </template>
                    </div>
                    </div>
                  </template>
                </div>

              </div>
            </template>
          </div>
        </transition>
      </div>

      <!-- RIGHT SIDEBAR (HISTORY) -->
      <aside v-if="showHistory" style="width: 280px; background: var(--bg-panel); border-left: 1px solid var(--border-color); display: flex; flex-direction: column; flex-shrink: 0; box-shadow: -5px 0 20px rgba(0,0,0,0.2); z-index: 10;">
          <div style="padding: 16px; border-bottom: 1px solid var(--border-color); font-size: 12px; font-weight: bold; display: flex; justify-content: space-between; align-items: center;">
              <span>История изменений</span>
              <button style="background: none; border: none; cursor: pointer; color: var(--text-muted);" @click="showHistory = false">✕</button>
          </div>
          
          <div style="padding: 12px; border-bottom: 1px solid var(--border-color);">
            <label style="font-size: 10px; color: var(--text-muted);">Хранить последних версий:</label>
            <input type="number" v-model="maxSaves" class="input-base" style="width: 100%; font-size: 12px; padding: 4px; margin-top: 4px;">
          </div>
          
          <div v-if="isLoadingHistory" style="padding: 20px; text-align: center; color: var(--text-muted); font-size: 12px;">
              Загрузка истории...
          </div>
          <div v-else style="flex: 1; overflow-y: auto; padding: 12px; display: flex; flex-direction: column; gap: 8px;">
              <div v-if="revisions.length === 0" style="font-size: 10px; color: var(--text-muted); text-align: center;">Нет сохраненных версий</div>
              
              <div v-for="(rev, idx) in revisions" :key="rev.id" 
                   @click="previewHistory(rev)"
                   :style="{ background: previewingRevId === rev.id ? 'rgba(139,92,246,0.1)' : 'var(--bg-input)' }"
                   style="padding: 10px 12px; border-radius: 8px; border: 1px solid var(--border-color); cursor: pointer; transition: all 0.2s;">
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                      <span style="font-size: 11px; font-weight: bold;">{{ new Date(rev.created_at).toLocaleString() }}</span>
                      <button style="background: none; border: none; cursor: pointer; font-size: 12px; color: var(--accent);" @click.stop="togglePin(rev)" :title="rev.is_pinned ? 'Открепить' : 'Закрепить от удаления'">
                        {{ rev.is_pinned ? '📍' : '📌' }}
                      </button>
                  </div>
                  <div style="font-size: 10px; color: var(--text-muted); margin-top: 4px; line-height: 1.4;">
                      <span v-if="getDiffSummary(rev, revisions[idx + 1])" v-html="getDiffSummary(rev, revisions[idx + 1])"></span>
                      <span v-else>Базовая версия</span>
                  </div>
                  <div v-if="previewingRevId === rev.id" style="margin-top: 8px;">
                      <span style="font-size: 9px; color: #f5a623;">Режим предпросмотра</span>
                  </div>
              </div>
          </div>
      </aside>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, nextTick } from 'vue';
import { apiService } from '../../services/api.service';
import XboxWheel from '../../../../tauri-surreal-kit/frontend/src/components/Vue/XboxWheel.vue';
import DateWheels from './DateWheels.vue';
import RelationshipBlock from './RelationshipBlock.vue';
import TagsField from '../../../../tauri-surreal-kit/frontend/src/components/Vue/TagsField.vue';
import { settingsService } from '../../../../tauri-surreal-kit/frontend/src/js/services/settings.service';

const wheelHorizontal = ref(settingsService.getSettings()?.dropdowns?.wheelOrientation === 'horizontal');

const props = defineProps({
  entityId: { type: String, required: true },
  entityType: { type: String, required: true },
  project: { type: String, required: true },
  initialData: { type: Object, default: () => ({}) },
  initialSection: { type: String, default: '' },
  initialScrollPos: { type: Number, default: 0 }
});

const emit = defineEmits(['update-data', 'modified', 'section-change', 'scroll-change']);

const loading = ref(true);
const isInitializing = ref(false); 
const config = ref<any>(null);
const formData = ref<any>({});
const lastEmittedData = ref<any>(null);
const foreignUpdates = ref<any>({});
const activeSection = ref('');
const referenceData = ref<any>({});
const photoInputs: any = {};
const hoverState = ref(false);
const scrollContainer = ref<HTMLElement | null>(null);

// История версий
const showHistory = ref(false);
const isLoadingHistory = ref(false);
const revisions = ref<any[]>([]);
const isPreviewingHistory = ref(false);
const previewingRevId = ref<string | null>(null);
const currentSavedData = ref<any>(null);

const maxSaves = ref(30);

const togglePin = async (rev: any) => {
  const newStatus = !rev.is_pinned;
  try {
    await apiService.toggleEntityHistoryPin(rev.id, newStatus);
    rev.is_pinned = newStatus;
  } catch (e) {
    console.error('Ошибка при пине ревизии:', e);
  }
};

const loadHistory = async () => {
  console.log(`[EntityEditor.vue] loadHistory called for project=`, props.project, ` entityId=`, props.entityId);
  if (!props.project || !props.entityId || !(window as any).__TAURI__) {
    console.warn(`[EntityEditor.vue] loadHistory aborted due to missing props or TAURI`);
    return;
  }
  isLoadingHistory.value = true;
  try {
    console.log(`[EntityEditor.vue] invoking get_entity_revisions...`);
    revisions.value = await (window as any).__TAURI__.core.invoke('get_entity_revisions', {
      project: props.project,
      entityId: props.entityId
    });
    console.log(`[EntityEditor.vue] get_entity_revisions returned:`, revisions.value);
  } catch (e) {
    console.error('Ошибка загрузки истории:', e);
  } finally {
    isLoadingHistory.value = false;
  }
};

const toggleHistory = () => {
  showHistory.value = !showHistory.value;
  if (showHistory.value && revisions.value.length === 0) {
    loadHistory();
  }
};

const previewHistory = (rev: any) => {
  if (!isPreviewingHistory.value) {
    // Сохраняем текущие данные редактора, чтобы можно было отменить
    currentSavedData.value = JSON.parse(JSON.stringify(formData.value));
  }
  isPreviewingHistory.value = true;
  previewingRevId.value = rev.id;
  
  console.log('[EntityEditor] previewHistory rev:', rev);
  console.log('[EntityEditor] previewHistory rev.content:', rev.content);
  console.log('[EntityEditor] previewHistory rev.content.attributes:', rev.content?.attributes);
  console.log('[EntityEditor] previewHistory rev.content.data:', rev.content?.data);

  // Подменяем данные в форме. Данные сущности лежат в rev.content.attributes или rev.content.data
  formData.value = JSON.parse(JSON.stringify(rev.content?.attributes || rev.content?.data || rev.content || {}));
};

const exitHistoryPreview = () => {
  if (currentSavedData.value) {
    formData.value = JSON.parse(JSON.stringify(currentSavedData.value));
  }
  isPreviewingHistory.value = false;
  previewingRevId.value = null;
  currentSavedData.value = null;
};

const restoreHistory = () => {
  isPreviewingHistory.value = false;
  previewingRevId.value = null;
  currentSavedData.value = null;
  // Помечаем форму как измененную
  emit('modified');
  lastEmittedData.value = null; 
  markModified();
};

const getDiffSummary = (current: any, previous: any) => {
  if (!previous) return '';
  const currData = current.content?.attributes || current.content?.data || current.content || {};
  const prevData = previous.content?.attributes || previous.content?.data || previous.content || {};
  
  const changes = [];
  
  // Проверяем измененные/добавленные поля
  for (const key of Object.keys(currData)) {
    const cVal = JSON.stringify(currData[key]);
    const pVal = JSON.stringify(prevData[key]);
    if (cVal !== pVal) {
      if (!prevData[key] && currData[key]) {
        changes.push(`<span style="color: #10b981;">+ ${key}</span>`);
      } else {
        changes.push(`<span style="color: #f5a623;">~ ${key}</span>`);
      }
    }
  }
  
  // Проверяем удаленные поля
  for (const key of Object.keys(prevData)) {
    if (!(key in currData)) {
      changes.push(`<span style="color: #ef4444;">- ${key}</span>`);
    }
  }
  
  if (changes.length === 0) return 'Без изменений';
  return changes.join(', ');
};
const isFieldChanged = (path: string) => {
  if (!isPreviewingHistory.value || !currentSavedData.value) return false;
  const currentVal = path.split('.').reduce((obj: any, key: string) => (obj && obj[key] !== 'undefined') ? obj[key] : undefined, currentSavedData.value);
  const historyVal = getProp(path);
  return JSON.stringify(currentVal) !== JSON.stringify(historyVal);
};

const photoUrlCache = ref<Record<string, string>>({});
const getPhotoUrl = (path: string) => {
  if (!path) return '';
  if (path.startsWith('data:') || path.startsWith('blob:') || path.startsWith('http')) return path;
  if (photoUrlCache.value[path]) return photoUrlCache.value[path];
  
  apiService.getLocalPhotoUrl(path).then(url => {
    photoUrlCache.value[path] = url;
  });
  return '';
};

const getProp = (obj: any, path?: any) => {
  if (path === undefined) {
    path = obj;
    obj = formData.value;
  }
  if (!path) return '';
  const parts = path.split('.');
  let current = obj;
  for (let i = 0; i < parts.length; i++) {
    if (current === undefined || current === null) return '';
    current = current[parts[i]];
  }
  return current;
};

const setProp = (obj: any, path: any, val?: any) => {
  if (val === undefined) {
    val = path;
    path = obj;
    obj = formData.value;
  }
  if (!path) return;
  const parts = path.split('.');
  let current = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (current[parts[i]] === undefined || current[parts[i]] === null) {
      current[parts[i]] = {};
    }
    current = current[parts[i]];
  }
  current[parts[parts.length - 1]] = val;
};

const getResolvedTemplate = (container: any) => {
  let baseTpl: any = null;
  if (container.fields && !container.template) {
    baseTpl = container;
  } else {
    baseTpl = config.value?.templates?.[container.template];
  }
  if (!baseTpl) return null;
  
  let resolvedFields = baseTpl.fields || [];
  if (container.fieldOverrides) {
    resolvedFields = resolvedFields.map((f: any) => {
      const override = container.fieldOverrides[f.class];
      if (override) {
        if (override.hidden) return null;
        return { ...f, ...override };
      }
      return f;
    }).filter((f: any) => f !== null);
  }
  
  let resolvedChildContainers = baseTpl.dynamicContainers;
  if (container.customChildContainers) {
    resolvedChildContainers = container.customChildContainers;
  }
  
  return {
    ...baseTpl,
    fields: resolvedFields,
    dynamicContainers: resolvedChildContainers
  };
};

const loadConfigAndData = async () => {
  loading.value = true;
  isInitializing.value = true; // запрещаем dirty во время загрузки
  try {
    // 0. Check for sandbox preview injection
    const sandboxConfig = sessionStorage.getItem('sandbox_preview_config');
    if (props.entityId === 'preview' && sandboxConfig) {
      console.log('[EntityEditor] 🛠️ Using Sandbox Preview Config from sessionStorage');
      config.value = JSON.parse(sandboxConfig);
    } else {
      // 1. Try to load config from DB first
      const schemas = await apiService.getSchemas(props.project);
      if (schemas[props.entityType] && schemas[props.entityType].full_schema) {
        config.value = schemas[props.entityType].full_schema;
      } else {
        // 2. Fallback to file
        const res = await fetch(`/struct/editor/${props.entityType}.json`);
        if (res.ok) {
          config.value = await res.json();
        }
      }
    }

    // 3. Load global templates from ui_editor.json
    try {
      const uiRes = await fetch('/struct/editor/ui_editor.json');
      if (uiRes.ok) {
        const uiData = await uiRes.json();
        if (!config.value.templates) {
          config.value.templates = {};
        }
        if (uiData.templates) {
          Object.assign(config.value.templates, uiData.templates);
        }
      }
    } catch (e) {
      console.warn('[EntityEditor] Failed to load ui_editor.json templates', e);
    }

     // Ensure a section is selected after config is loaded
     console.log(`[EntityEditor.vue ${props.entityId}] config loaded. initialSection prop is:`, props.initialSection);
     if (config.value && config.value.sections && config.value.sections.length > 0) {
       if (props.initialSection && config.value.sections.some((s: any) => s.id === props.initialSection)) {
         activeSection.value = props.initialSection;
         console.log(`[EntityEditor.vue ${props.entityId}] Applied initialSection:`, props.initialSection);
       } else {
         activeSection.value = config.value.sections[0].id;
         console.log(`[EntityEditor.vue ${props.entityId}] initialSection not found or empty. Using default:`, activeSection.value);
       }
       // Emit initial section change so parent can react if needed
       emit('section-change', activeSection.value);
     }
    
    formData.value = JSON.parse(JSON.stringify(props.initialData));
    foreignUpdates.value = {}; 
    
    lastEmittedData.value = JSON.stringify({ ...formData.value, __foreignUpdates: {} });
    
    await loadReferenceData();
    
  } catch (e) {
    console.error('[EntityEditor] Error loading:', e);
  } finally {
    await nextTick();
    loading.value = false;
    isInitializing.value = false;

    // Restore scroll position
    if (props.initialScrollPos > 0) {
      setTimeout(() => {
        if (scrollContainer.value) scrollContainer.value.scrollTop = props.initialScrollPos;
      }, 100);
    }
    
    // Add scroll listener
    nextTick(() => {
      if (scrollContainer.value) {
        scrollContainer.value.addEventListener('scroll', (e: any) => {
          emit('scroll-change', e.target.scrollTop);
        });
      }
    });
  }
};

// In case config loads after component mount and activeSection is still empty,
// ensure we set a default section to trigger rendering.
watch(() => config.value, (newConfig) => {
  if (newConfig && newConfig.sections && newConfig.sections.length > 0 && !activeSection.value) {
    if (props.initialSection && newConfig.sections.some((s: any) => s.id === props.initialSection)) {
      activeSection.value = props.initialSection;
    } else {
      activeSection.value = newConfig.sections[0].id;
    }
    emit('section-change', activeSection.value);
  }
});

const loadReferenceData = async () => {
  const typesToLoad = new Set<string>();
  const scanFields = (fields: any[]) => {
    if (!fields) return;
    fields.forEach((f: any) => {
      if ((f.type === 'select' || f.type === 'multiselect') && f.entityType) typesToLoad.add(f.entityType);
    });
  };
  
  if (config.value && config.value.sections) {
    config.value.sections.forEach((s: any) => {
      scanFields(s.fields);
      if(s.dynamicContainers) {
        s.dynamicContainers.forEach((c: any) => {
          const resolvedTpl = getResolvedTemplate(c);
          if (resolvedTpl) {
            scanFields(resolvedTpl.fields);
            if (resolvedTpl.dynamicContainers) {
              resolvedTpl.dynamicContainers.forEach((nested: any) => {
                const nTpl = getResolvedTemplate(nested);
                if (nTpl) scanFields(nTpl.fields);
              });
            }
          }
        });
      }
    });
  }
  
  const newRefData: any = { ...referenceData.value };
  
  for (const type of typesToLoad) {
    try {
      let list = [];
      if (type === 'chapter') {
        list = await apiService.getChaptersList(props.project);
      } else {
        list = await apiService.getEntityList(props.project, type);
      }

      let titleField = null;
      if (type !== 'chapter') {
        try {
          const res = await fetch(`/struct/editor/${type}.json`);
          if (res.ok) {
            const schema = await res.json();
            titleField = schema.titleField;
          }
        } catch(e) {}
      }
      
      const getValueByPath = (obj: any, path: string): any => {
        if (!path) return undefined;
        return path.split('.').reduce((cur: any, k: string) => (cur != null ? cur[k] : undefined), obj);
      };

      const mappedList = list.map((item: any) => {
        if (titleField) {
          const val = getValueByPath(item, titleField);
          if (val && String(val).trim().length > 0) {
            return { value: String(item.id), label: String(val).trim() };
          }
        }

        let title = item.Name || item.name || item.название;
        
        if (!title) title = `[${String(item.id).substring(0,8)}]`;

        return {
          value: String(item.id),
          label: String(title).trim()
        };
      });
      
      if (type === 'chapter' && list.length > 0) {
        const latestChapter = list[list.length - 1];
        mappedList.unshift({ 
          value: String(latestChapter.id), 
          label: '➡️ Текущая (Автопродление)' 
        });
      }
      
      newRefData[type] = mappedList;
    } catch(e) {
      console.error(`[EntityEditor] Error loading reference data for ${type}:`, e);
      newRefData[type] = [];
    }
  }
  referenceData.value = newRefData;
};

const getOptionsFor = (field: any) => {
  if (field.options && field.options.length > 0) return field.options;
  if (field.entityType && referenceData.value[field.entityType]) {
    return referenceData.value[field.entityType];
  }
  return [];
};

const markModified = () => {
  if (isInitializing.value) return; // программная загрузка — не dirty
  console.log('[EntityEditor.vue] 📤 markModified вызвана');
  nextTick(() => {
    _doMarkModified();
  });
};

const _doMarkModified = () => {
  // 🔴 ВАЖНО: НЕ используем JSON.parse(JSON.stringify) - это теряет изменения!
  // Компоненты динамических списков редактируют объекты через прямые ссылки на объекты
  // Отправляем formData.value напрямую - это Proxy который отслеживает все изменения
  
  const dataWithForeignUpdates = {
    ...formData.value,
    __foreignUpdates: foreignUpdates.value
  };
  
  // Лог для отладки
  console.log('[EntityEditor.vue] 📨 markModified отправляет update-data');
  
  // 🔴 GUARD: Не отправляем если данные идентичны
  const serialized = JSON.stringify(dataWithForeignUpdates);
  
  if (lastEmittedData.value === serialized) {
    console.log('[EntityEditor.vue] ⏭️  Пропускаю emit - данные не изменились');
    return;
  }
  
  console.log('[EntityEditor.vue] ✅ Отправляю update-data - данные изменились!');
  lastEmittedData.value = serialized;
  emit('update-data', dataWithForeignUpdates);
  
  // Также уведомляем родителя что данные изменены (для отметки как "с изменениями")
  emit('modified');
};

// Обработка обновлений "чужой" стороны связи (для сохранения потом)
const handleForeignUpdate = ({ entityType, entityId, data, linkClass, backLinkValue }: any) => {
  if (!entityType || !entityId) return;
  const key = `${entityType}:${entityId}`;
  console.log('[EntityEditor.vue] 🔄 handleForeignUpdate сохраняет данные:', { key, entityType, entityId, dataKeys: Object.keys(data) });
  foreignUpdates.value[key] = { entityType, entityId, data, linkClass, backLinkValue };
  console.log('[EntityEditor.vue] 🔄 foreignUpdates.value ключи обновлены:', Object.keys(foreignUpdates.value));
  
  // ВАЖНО: Вызываем markModified, чтобы прокинуть __foreignUpdates наверх в app.ts
  markModified();
};

const addDynamicItem = (path: any, templateId: any) => {
  if (!getProp(path) || !Array.isArray(getProp(path))) setProp(path, []);
  
  const newItem: any = {};
  const tpl = (config.value as any).templates?.[templateId as string];
  if (tpl && tpl.fields) {
    tpl.fields.forEach((f: any) => {
      newItem[(f.id || f.class) as string] = '';
    });
  }
  
  getProp(path).push(newItem);
  markModified();
};

const removeDynamicItem = (path: any, idx: any) => {
  if(confirm('Удалить элемент?')) {
    getProp(path).splice(idx, 1);
    markModified();
  }
};


const triggerPhotoUpload = (path: any) => {
  photoInputs[path]?.click();
};

const handlePhotoFile = async (e: any, path: string) => {
  const file = (e.target as any).files?.[0];
  if (!file) return;
  try {
    const savedPath = await apiService.uploadPhoto(file);
    setProp(path, savedPath);
    markModified();
  } catch (err) {
    console.error('Failed to upload photo:', err);
  }
};

const handlePhotoDrop = async (e: any, path: string) => {
  const file = e.dataTransfer.files?.[0];
  if (!file || !file.type.startsWith('image/')) return;
  try {
    const savedPath = await apiService.uploadPhoto(file);
    setProp(path, savedPath);
    markModified();
  } catch (err) {
    console.error('Failed to upload photo:', err);
  }
};

const removePhoto = (path: string) => {
  setProp(path, '');
  if (photoInputs[path]) photoInputs[path].value = '';
  markModified();
};

watch(() => props.entityId, () => {
  loadConfigAndData();
});

// Синхронизация данных из других сплитов
watch(() => props.initialData, (newVal) => {
  if (isInitializing.value) return;
  // Чтобы не перезаписать локальные изменения и не сбросить курсор, 
  // используем глубокий merge, как и в app.ts
  const merge = (target: any, source: any) => {
    for (const key in source) {
      if (source[key] !== null && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        if (!target[key] || typeof target[key] !== 'object') target[key] = {};
        merge(target[key], source[key]);
      } else if (Array.isArray(source[key])) {
        if (!Array.isArray(target[key])) target[key] = [];
        for (let i = 0; i < source[key].length; i++) {
          if (i < target[key].length) {
            if (typeof source[key][i] === 'object' && source[key][i] !== null) {
              merge(target[key][i], source[key][i]);
            } else {
              target[key][i] = source[key][i];
            }
          } else {
            target[key].push(source[key][i]);
          }
        }
        target[key].length = source[key].length;
      } else {
        target[key] = source[key];
      }
    }
  };
  
  // Отключаем на секунду отправку update-data, чтобы не было бесконечного цикла (эхо)
  const previousState = lastEmittedData.value;
  // ВАЖНО: Не перезаписываем массивы связей через merge из initialData!
  // Эти массивы редактируются напрямую через компоненты списков (по ссылке на объекты formData).
  // Собираем пути динамических контейнеров из схемы, чтобы исключить их из merge.
  const skipKeys = new Set(['__foreignUpdates']);
  if (config.value && config.value.sections) {
    for (const sec of config.value.sections) {
      if (sec.dynamicContainers) {
        for (const dc of sec.dynamicContainers) {
          const path = dc.dataPath || dc.id;
          skipKeys.add(path.split('.')[0]); // Исключаем корневой ключ
        }
      }
    }
  }
  const filteredNewVal: any = {};
  for (const k in newVal) {
    if (!skipKeys.has(k)) filteredNewVal[k] = (newVal as any)[k];
  }
  merge(formData.value, filteredNewVal);
  lastEmittedData.value = JSON.stringify({ ...formData.value, __foreignUpdates: foreignUpdates.value });
}, { deep: true });

onMounted(() => {
  loadConfigAndData();

  // Alt+1..9 — switch section
  const onSwitchSection = (e: CustomEvent) => {
    if (!config.value?.sections) return;
    const idx = e.detail as number;
    const section = config.value.sections[idx];
    if (section) {
      activeSection.value = section.id;
      emit('section-change', section.id);
    }
  };
  document.addEventListener('ww:switch-section', onSwitchSection as EventListener);
  const onEntitySaved = () => {
    loadReferenceData();
    if (showHistory.value) {
      setTimeout(() => {
        loadHistory();
      }, 500);
    }
  };
  document.addEventListener('ww:entity-saved', onEntitySaved);
  
  const handleToggleHistory = (e: any) => {
    console.log(`[EntityEditor.vue] handleToggleHistory triggered, detail.id=`, e.detail?.id, ` props.entityId=`, props.entityId);
    if (e.detail && e.detail.id === props.entityId) {
      console.log(`[EntityEditor.vue] MATCH! calling toggleHistory()`);
      toggleHistory();
    }
  };
  document.addEventListener('ww:toggle-entity-history', handleToggleHistory as EventListener);

  onUnmounted(() => {
    document.removeEventListener('ww:switch-section', onSwitchSection as EventListener);
    document.removeEventListener('ww:entity-saved', onEntitySaved);
    document.removeEventListener('ww:toggle-entity-history', handleToggleHistory as EventListener);
  });

  settingsService.onChange((newSettings) => {
    wheelHorizontal.value = newSettings?.dropdowns?.wheelOrientation === 'horizontal';
  });
});

defineExpose({
  toggleHistory
});
</script>

<style scoped>
.fade-enter-active, .fade-leave-active {
  transition: opacity 0.3s ease, transform 0.3s ease;
}
.fade-enter-from, .fade-leave-to {
  opacity: 0;
  transform: translateY(10px);
}

/* Photo Upload */
.photo-upload-zone {
  position: relative;
  width: 100%;
  min-height: 180px;
  border: 2px dashed rgba(255,255,255,0.15);
  border-radius: 16px;
  cursor: pointer;
  overflow: hidden;
  background: rgba(255,255,255,0.03);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: border-color 0.2s ease, background 0.2s ease;
}
.photo-upload-zone:hover {
  border-color: var(--accent, #a78bfa);
  background: rgba(167,139,250,0.06);
}
.photo-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  pointer-events: none;
}
.photo-icon {
  font-size: 40px;
  opacity: 0.5;
}
.photo-hint {
  font-size: 13px;
  color: var(--text-muted, rgba(255,255,255,0.4));
  text-align: center;
  padding: 0 20px;
}
.photo-preview {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 180px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.photo-preview img {
  max-width: 100%;
  max-height: 260px;
  object-fit: contain;
  border-radius: 12px;
  display: block;
}
.photo-remove-btn {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: rgba(239,68,68,0.85);
  border: none;
  color: #fff;
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(4px);
  transition: background 0.2s;
}
.photo-remove-btn:hover {
  background: #ef4444;
}

.history-changed {
  position: relative;
  background-color: rgba(245, 166, 35, 0.05) !important;
  border-radius: 8px;
  padding: 8px;
  margin: -8px;
  margin-bottom: 16px;
  box-shadow: inset 0 0 0 1px rgba(245, 166, 35, 0.3);
  transition: all 0.3s ease;
}

.changed-indicator {
  font-size: 9px;
  background: #f5a623;
  color: #000;
  padding: 2px 6px;
  border-radius: 4px;
  margin-left: 8px;
  font-weight: bold;
  vertical-align: middle;
}
</style>

