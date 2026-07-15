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
    <div v-if="(config as any)?.sections && (config as any).sections.length > 1" class="editor-tabs-new">
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
                          
                          <textarea
v-if="field.type === 'textarea'" 
                                    :value="getProp(field.path || field.id)"
                                    class="input-base interactive-el"
                                    :rows="field.rows || 3" 
                                    :placeholder="field.placeholder" 
                                    @input="e => { setProp(field.path || field.id, (e.target as any).value); markModified(); }"></textarea>

                          <!-- Photo upload field -->
                          <div v-else-if="field.type === 'photo'" class="photo-upload-zone" @click="triggerPhotoUpload(field.path || field.id)" @dragover.prevent @drop.prevent="e => handlePhotoDrop(e, field.path || field.id)">
                            <input :ref="el => photoInputs[field.path || field.id] = el" type="file" accept="image/*" style="display:none" @change="e => handlePhotoFile(e, field.path || field.id)" />
                            <div v-if="getProp(field.path || field.id)" class="photo-preview">
                              <img :src="getPhotoUrl(getProp(field.path || field.id))" alt="Фото" />
                              <button class="photo-remove-btn" title="Удалить фото" @click.stop="removePhoto(field.path || field.id)">✕</button>
                            </div>
                            <div v-else class="photo-placeholder">
                              <div class="photo-icon">🖼️</div>
                              <div class="photo-hint">{{ field.placeholder || 'Нажмите или перетащите изображение' }}</div>
                            </div>
                          </div>

                          <XboxWheel
v-else-if="field.type === 'select'"
                                     :horizontal="wheelHorizontal"
                                     :model-value="getProp(field.path || field.id)"
                                     :options="getOptionsFor(field)"
                                     @update:model-value="(val: any) => { setProp(field.path || field.id, val); markModified(); }" />

                          <div v-else-if="field.type === 'multiselect'" class="multiselect-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 12px; margin-top: 8px;">
                            <label v-for="opt in getOptionsFor(field)" :key="opt.value" class="checkbox-item interactive-el" style="display: flex; align-items: center; gap: 8px; cursor: pointer; padding: 8px 12px; background: var(--bg-input, rgba(255,255,255,0.05)); border: 1px solid var(--border-color, rgba(255,255,255,0.1)); border-radius: 8px; transition: all 0.2s ease;">
                              <input
type="checkbox" 
                                     :value="opt.value" 
                                     :checked="(getProp(field.path || field.id) || []).includes(opt.value)"
                                     style="accent-color: var(--accent, #7c3aed); width: 16px; height: 16px;"
                                     @change="e => { 
                                       let arr = getProp(field.path || field.id) || []; 
                                       if (!Array.isArray(arr)) arr = [];
                                       if ((e.target as any).checked && !arr.includes(opt.value)) arr.push(opt.value);
                                       else if (!(e.target as any).checked) arr = arr.filter((v: any) => v !== opt.value);
                                       setProp(field.path || field.id, arr);
                                       markModified();
                                     }"> 
                              <span style="font-size: 13px; color: var(--text-main, #fff);">{{ opt.label }}</span>
                            </label>
                          </div>

                          <DateWheels
v-else-if="field.type === 'calendar_date' || field.type === 'calendar_date_base'"
                                      :model-value="getProp(field.path || field.id)"
                                      :project="project"
                                      @update:model-value="(val: any) => { setProp(field.path || field.id, val); markModified(); }" />
                          
                          <TagsField
v-else-if="field.type === 'tags'"
                                     :model-value="getProp(field.path || field.id)"
                                     :project="project"
                                     :placeholder="field.placeholder"
                                     @update:model-value="(val: any) => { setProp(field.path || field.id, val); markModified(); }"
                                     @modified="markModified" />

                          <input
v-else 
                                 :type="field.type || 'text'" 
                                 :value="getProp(field.path || field.id)"
                                 class="input-base interactive-el"
                                 :placeholder="field.placeholder"
                                 @input="e => { setProp(field.path || field.id, (e.target as any).value); markModified(); }">
                                 
                          <div v-if="field.hint" class="form-hint" style="font-size:11px; color:var(--text-muted); margin-top:4px;">{{ field.hint }}</div>
                        </div>
                      </template>
                    </div>
                </div>

                <!-- Динамические контейнеры (Массивы записей) -->
                <div v-if="section.dynamicContainers && section.dynamicContainers.length > 0" style="margin-top:24px;">
                  <template v-for="(container, cIdx) in section.dynamicContainers" :key="container.id">
                    <div
v-if="!container.hidden" 
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
                            <button class="btn-danger-icon interactive-el" style="background:transparent; border:none; color:#ef4444; cursor:pointer;" title="Удалить" @click="removeDynamicItem(container.dataPath || container.id, idx)">🗑️</button>
                          </div>
                          
                          <!-- Рендерим шаблон -->
                          <div v-if="getResolvedTemplate(container)">
                            <div v-for="tField in getResolvedTemplate(container).fields" :key="tField.id || tField.class" class="form-group" style="margin-bottom:12px;">
                              <label v-if="tField.label" class="form-label" style="font-size:10px;">{{ tField.label }}</label>
                              
                              <textarea
v-if="tField.type === 'textarea'" 
                                    :value="getProp(item, tField.id || tField.class)"
                                    class="input-base"
                                    :rows="tField.rows || 2" 
                                    :placeholder="tField.placeholder" 
                                    @input="e => { setProp(item, tField.id || tField.class, (e.target as any).value); markModified(); }"></textarea>
                                    
                              <XboxWheel
v-else-if="tField.type === 'select'"
                                         :horizontal="wheelHorizontal"
                                         :model-value="getProp(item, tField.id || tField.class)"
                                         :options="getOptionsFor(tField)"
                                         :placeholder="tField.placeholder"
                                         @update:model-value="(val: any) => { setProp(item, tField.id || tField.class, val); markModified(); }" />
                                         
                              <div v-else-if="tField.type === 'multiselect'" class="multiselect-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 12px; margin-top: 8px;">
                                <label v-for="opt in getOptionsFor(tField)" :key="opt.value" class="checkbox-item interactive-el" style="display: flex; align-items: center; gap: 8px; cursor: pointer; padding: 8px 12px; background: var(--bg-input, rgba(255,255,255,0.05)); border: 1px solid var(--border-color, rgba(255,255,255,0.1)); border-radius: 8px; transition: all 0.2s ease;">
                                  <input
type="checkbox" 
                                         :value="opt.value" 
                                         :checked="(getProp(item, tField.id || tField.class) || []).includes(opt.value)"
                                         style="accent-color: var(--accent, #7c3aed); width: 16px; height: 16px;"
                                         @change="e => { 
                                           let arr = getProp(item, tField.id || tField.class) || []; 
                                           if (!Array.isArray(arr)) arr = [];
                                           if ((e.target as any).checked && !arr.includes(opt.value)) arr.push(opt.value);
                                           else if (!(e.target as any).checked) arr = arr.filter((v: any) => v !== opt.value);
                                           setProp(item, tField.id || tField.class, arr);
                                           markModified();
                                         }"> 
                                  <span style="font-size: 13px; color: var(--text-main, #fff);">{{ opt.label }}</span>
                                </label>
                              </div>
                              
                              <div v-else-if="tField.type === 'range'" class="range-wrap">
                                <input
type="range"
                                  :min="tField.min ?? -100"
                                  :max="tField.max ?? 100"
                                  :value="getProp(item, tField.id || tField.class) ?? 0"
                                  style="flex:1; accent-color: var(--accent);"
                                  @input="e => { setProp(item, tField.id || tField.class, Number((e.target as any).value)); markModified(); }"
                                >
                                <span style="min-width:36px; text-align:right; font-size:12px; color:var(--accent); font-weight:600;">{{ getProp(item, tField.id || tField.class) ?? 0 }}</span>
                              </div>

                              <DateWheels
v-else-if="tField.type === 'calendar_date' || tField.type === 'calendar_date_base'"
                                          :model-value="getProp(item, tField.id || tField.class)"
                                          :project="project"
                                          @update:model-value="(val: any) => { setProp(item, tField.id || tField.class, val); markModified(); }" />

                              <input
v-else 
                                     :type="tField.type || 'text'" 
                                     :value="getProp(item, tField.id || tField.class)"
                                     class="input-base"
                                     :placeholder="tField.placeholder"
                                     @input="e => { setProp(item, tField.id || tField.class, (e.target as any).value); markModified(); }">
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
            <input v-model="maxSaves" type="number" class="input-base" style="width: 100%; font-size: 12px; padding: 4px; margin-top: 4px;">
          </div>
          
          <div v-if="isLoadingHistory" style="padding: 20px; text-align: center; color: var(--text-muted); font-size: 12px;">
              Загрузка истории...
          </div>
          <div v-else style="flex: 1; overflow-y: auto; padding: 12px; display: flex; flex-direction: column; gap: 8px;">
              <div v-if="revisions.length === 0" style="font-size: 10px; color: var(--text-muted); text-align: center;">Нет сохраненных версий</div>
              
              <div
v-for="(rev, idx) in revisions" :key="rev.id" 
                   :style="{ background: previewingRevId === rev.id ? 'rgba(139,92,246,0.1)' : 'var(--bg-input)' }"
                   style="padding: 10px 12px; border-radius: 8px; border: 1px solid var(--border-color); cursor: pointer; transition: all 0.2s;"
                   @click="previewHistory(rev)">
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                      <span style="font-size: 11px; font-weight: bold;">{{ rev.formattedDate }}</span>
                      <button style="background: none; border: none; cursor: pointer; font-size: 12px; color: var(--accent);" :title="rev.is_pinned ? 'Открепить' : 'Закрепить от удаления'" @click.stop="togglePin(rev)">
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
import { ref, watch, onMounted, onUnmounted, nextTick, shallowRef } from 'vue';
import { apiService } from '../../services/api.service';
import { XboxWheel, TagsField, settingsService } from '@worldwiki/components';
import DateWheels from './DateWheels.vue';
import RelationshipBlock from './RelationshipBlock.vue';
import { useEntityEditor } from '../../composables/useEntityEditor';

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

const {
    loading,
    isInitializing,
    config,
    formData,
    lastEmittedData,
    foreignUpdates,
    activeSection,
    referenceData,
    hoverState,
    scrollContainer,
    showHistory,
    isLoadingHistory,
    revisions,
    isPreviewingHistory,
    previewingRevId,
    currentSavedData,
    maxSaves,
    togglePin,
    loadHistory,
    toggleHistory,
    previewHistory,
    exitHistoryPreview,
    restoreHistory,
    getDiffSummary,
    isFieldChanged,
    photoUrlCache,
    getPhotoUrl,
    getProp,
    setProp,
    getResolvedTemplate,
    loadConfigAndData,
    loadReferenceData,
    getOptionsFor,
    markModified,
    handleForeignUpdate,
    addDynamicItem,
    removeDynamicItem,
    triggerPhotoUpload,
    handlePhotoFile,
    handlePhotoDrop,
    removePhoto
} = useEntityEditor(props, emit);

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

