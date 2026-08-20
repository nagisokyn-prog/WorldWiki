<template>
  <div class="entity-editor-wrapper">
    <div v-if="loading" class="loading-overlay">
      <div class="spinner"></div>
      <div style="margin-top:12px; font-size:12px; color:var(--text-muted)">Загрузка сущности...</div>
    </div>

    <!-- PREVIEW HEADER NOTIFICATION -->
    <div v-if="isPreviewingHistory" class="history-preview-banner">
      <span>👁️ Вы просматриваете сохраненную версию от <strong>{{ revisions.find(r => r.id === previewingRevId)?.formattedDate }}</strong></span>
      <div style="display: flex; gap: 8px;">
        <button class="btn btn-small btn-primary" @click="restoreHistory">Восстановить эту версию</button>
        <button class="btn btn-small btn-outline" @click="exitHistoryPreview">Выйти</button>
      </div>
    </div>

    <div v-else-if="props.entityId === 'preview'" class="history-preview-banner" style="background: rgba(139, 92, 246, 0.2); border-color: rgba(139, 92, 246, 0.4); color: #c4b5fd;">
      <span>🧪 <strong>Песочница:</strong> Предпросмотр кастомной схемы</span>
    </div>

    <div class="entity-editor-layout" :class="{ 'with-history': showHistory }">
      <!-- MAIN FORM CONTAINER -->
      <div ref="scrollContainer" class="form-container">
        <!-- SECTIONS NAV (TABS) -->
        <div v-if="config && config.sections && config.sections.length > 1" class="sections-nav" style="display:flex; gap:8px; border-bottom:1px solid var(--border-color); margin-bottom:24px; padding-bottom:8px; overflow-x:auto;">
          <button
            v-for="sec in config.sections" 
            :key="sec.id"
            class="section-tab-btn interactive-el"
            :class="{ active: activeSection === sec.id }"
            style="padding:6px 14px; border-radius:6px; border:none; cursor:pointer; font-size:13px; font-weight:600; display:flex; align-items:center; gap:6px; transition:all 0.2s;"
            :style="{ background: activeSection === sec.id ? 'var(--accent)' : 'transparent', color: activeSection === sec.id ? '#fff' : 'var(--text-muted)' }"
            @click="activeSection = sec.id"
          >
            <span>{{ sec.icon || '📄' }}</span>
            <span>{{ sec.title }}</span>
          </button>
        </div>

        <!-- RENDER ACTIVE SECTION -->
        <transition name="fade-fast" mode="out-in">
          <div v-if="config && config.sections" :key="activeSection" class="active-section-content">
            <template v-for="section in config.sections" :key="section.id">
              <div v-if="section.id === activeSection">
                <!-- Обычные поля секции -->
                <div v-if="section.fields && section.fields.length > 0" class="glass-card" style="margin-bottom:24px; padding:20px;">
                    <div class="form-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px;">
                      <template v-for="field in section.fields" :key="field.id || field.class">
                        <div v-if="!field.hidden" class="form-group" :class="{ 'full-width': field.fullWidth || field.type === 'textarea' || field.type === 'tags' || field.type === 'multiselect' }">
                          <label class="form-label" style="display: flex; justify-content: space-between; align-items: center;">
                            {{ field.label }} 
                            <span v-if="field.required" style="color:var(--accent)">*</span>
                            <span v-if="isFieldChanged(field.path || field.id || field.class || '')" class="changed-indicator" title="Значение отличается от текущей версии">Изменено</span>
                          </label>
                          
                          <textarea
                            v-if="field.type === 'textarea'" 
                            :value="String(getProp(field.path || field.id || field.class || '') ?? '')"
                            class="input-base interactive-el"
                            :rows="field.rows || 3" 
                            :placeholder="field.placeholder" 
                            @input="e => { setProp(field.path || field.id || field.class || '', (e.target as HTMLTextAreaElement).value); markModified(); }"></textarea>

                          <!-- Photo upload field -->
                          <div v-else-if="field.type === 'photo'" class="photo-upload-zone" @click="triggerPhotoUpload(field.path || field.id || field.class || '')" @dragover.prevent @drop.prevent="e => handlePhotoDrop(e, field.path || field.id || field.class || '')">
                            <input :ref="el => { if (el) photoInputs[field.path || field.id || field.class || ''] = el as HTMLInputElement; }" type="file" accept="image/*" style="display:none" @change="e => handlePhotoFile(e, field.path || field.id || field.class || '')" />
                            <div v-if="getProp(field.path || field.id || field.class || '')" class="photo-preview">
                              <img :src="getPhotoUrl(String(getProp(field.path || field.id || field.class || '') ?? ''))" alt="Фото" />
                              <button class="photo-remove-btn" title="Удалить фото" @click.stop="removePhoto(field.path || field.id || field.class || '')">✕</button>
                            </div>
                            <div v-else class="photo-placeholder">
                              <div class="photo-icon">🖼️</div>
                              <div class="photo-hint">{{ field.placeholder || 'Нажмите или перетащите изображение' }}</div>
                            </div>
                          </div>

                          <XboxWheel
                            v-else-if="field.type === 'select'"
                            :horizontal="wheelHorizontal"
                            :model-value="(getProp(field.path || field.id || field.class || '') as string | number) || ''"
                            :options="getOptionsFor(field)"
                            @update:model-value="(val: unknown) => { setProp(field.path || field.id || field.class || '', val); markModified(); }" />

                          <div v-else-if="field.type === 'multiselect'" class="multiselect-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 12px; margin-top: 8px;">
                            <label v-for="opt in getOptionsFor(field)" :key="opt.value" class="checkbox-item interactive-el" style="display: flex; align-items: center; gap: 8px; cursor: pointer; padding: 8px 12px; background: var(--bg-input, rgba(255,255,255,0.05)); border: 1px solid var(--border-color, rgba(255,255,255,0.1)); border-radius: 8px; transition: transform 0.2s ease, background-color 0.2s ease, border-color 0.2s ease;">
                              <input
                                type="checkbox" 
                                :value="opt.value" 
                                :checked="((getProp(field.path || field.id || field.class || '') as string[]) || []).includes(opt.value)"
                                style="accent-color: var(--accent, #7c3aed); width: 16px; height: 16px;"
                                @change="e => { 
                                  let arr = ((getProp(field.path || field.id || field.class || '') as string[]) || []); 
                                  if (!Array.isArray(arr)) arr = [];
                                  const target = e.target as HTMLInputElement;
                                  if (target.checked && !arr.includes(opt.value)) arr = [...arr, opt.value];
                                  else if (!target.checked) arr = arr.filter((v: string) => v !== opt.value);
                                  setProp(field.path || field.id || field.class || '', arr);
                                  markModified();
                                }"> 
                              <span style="font-size: 13px; color: var(--text-main, #fff);">{{ opt.label }}</span>
                            </label>
                          </div>

                          <UniversalDatePicker
                            v-else-if="field.type === 'calendar_date' || field.type === 'calendar_date_base' || field.type === 'calendar_datetime'"
                            :show-time="field.type === 'calendar_datetime'"
                            :model-value="getProp(field.path || field.id || field.class || '') as any"
                            :project="project"
                            @update:model-value="(val: unknown) => { setProp(field.path || field.id || field.class || '', val); markModified(); }" />
                          
                          <TagsField
                            v-else-if="field.type === 'tags'"
                            :model-value="(getProp(field.path || field.id || field.class || '') as string | string[] | undefined) || ''"
                            :project="project"
                            :placeholder="field.placeholder"
                            @update:model-value="(val: unknown) => { setProp(field.path || field.id || field.class || '', val); markModified(); }"
                            @modified="markModified" />

                          <input
                            v-else 
                            :type="field.type || 'text'" 
                            :value="String(getProp(field.path || field.id || field.class || '') ?? '')"
                            class="input-base interactive-el"
                            :placeholder="field.placeholder"
                            @input="e => { setProp(field.path || field.id || field.class || '', (e.target as HTMLInputElement).value); markModified(); }">
                                
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
                      :class="{ 'history-changed': isFieldChanged(container.dataPath || container.id || '') }"
                      style="margin-bottom:24px; position: relative; overflow: visible;" 
                      :style="{ zIndex: 100 - cIdx }">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                      <h4 style="color:var(--text-muted); text-transform:uppercase; font-size:12px; font-weight:600; letter-spacing:1px;">
                        {{ container.title || 'Дополнительно' }}
                        <span v-if="isFieldChanged(container.dataPath || container.id || '')" class="changed-indicator" title="Связи отличаются от текущей версии">Изменено</span>
                      </h4>
                      <button class="btn btn-small btn-outline interactive-el" @click="addDynamicItem(container.dataPath || container.id || '', container.template || '')">➕ Добавить</button>
                    </div>

                    <div v-if="!getProp(container.dataPath || container.id || '') || (getProp(container.dataPath || container.id || '') as unknown[]).length === 0" class="empty-timeline" style="padding:20px; text-align:center; color:var(--text-muted); background:rgba(0,0,0,0.2); border-radius:12px; border:1px solid var(--border-color);">
                      {{ container.emptyMessage || 'Элементы не добавлены' }}
                    </div>
                    
                     <div v-else style="position: relative; z-index: 50;">
                      <!-- Двусторонние связи — свой компонент -->
                      <template v-if="container.isBidirectional || (getResolvedTemplate(container) as any)?.isBidirectional">
                        <RelationshipBlock
                          v-for="(item, idx) in ((getProp(container.dataPath || container.id || '') as Array<Record<string, unknown>>) || [])"
                          :key="idx"
                          :item="item"
                          :idx="idx"
                          :template-conf="(getResolvedTemplate(container) as any) || {}"
                          :all-templates="(config?.templates as any) || {}"
                          :reference-data="referenceData"
                          :entity-id="props.entityId"
                          :entity-type="props.entityType"
                          :project="props.project"
                          @remove="removeDynamicItem(container.dataPath || container.id || '', idx)"
                          @modified="markModified"
                          @foreign-update="handleForeignUpdate"
                          @item-updated="(payload?: { item?: Record<string, unknown>; idx?: number }) => { 
                            const itemIdx = payload?.idx ?? idx;
                            const updatedItem = payload?.item ?? item;
                            const structuredArr = getProp(container.dataPath || container.id || '') as Array<Record<string, unknown>>;
                            if (structuredArr && Array.isArray(structuredArr) && itemIdx < structuredArr.length) {
                              if (payload?.item) structuredArr[itemIdx] = updatedItem;
                              console.log('[EntityEditor.vue] 🔄 item-updated: обновил структурированный путь', itemIdx, 'в', container.dataPath || container.id);
                              markModified();
                            }
                          }"
                        />
                      </template>

                      <!-- Обычные динамические элементы -->
                      <template v-else>
                        <div v-for="(item, idx) in ((getProp(container.dataPath || container.id || '') as Array<Record<string, unknown>>) || [])" :key="idx" class="glass-card" :style="{ marginBottom: '16px', padding: '16px', overflow: 'visible', position: 'relative', zIndex: 50 - idx }">
                          <div style="display:flex; justify-content:space-between; margin-bottom:12px; padding-bottom:8px; border-bottom:1px solid rgba(255,255,255,0.05);">
                            <strong style="color:var(--accent);">Элемент #{{ idx + 1 }}</strong>
                            <button class="btn-danger-icon interactive-el" style="background:transparent; border:none; color:#ef4444; cursor:pointer;" title="Удалить" @click="removeDynamicItem(container.dataPath || container.id || '', idx)">🗑️</button>
                          </div>
                          
                          <!-- Рендерим шаблон -->
                          <div v-if="getResolvedTemplate(container)">
                            <div v-for="tField in getResolvedTemplate(container)?.fields || []" :key="tField.id || tField.class" class="form-group" style="margin-bottom:12px;">
                              <label v-if="tField.label" class="form-label" style="font-size:10px;">{{ tField.label }}</label>
                              
                              <textarea
                                v-if="tField.type === 'textarea'" 
                                :value="String(getProp(item, tField.id || tField.class || '') ?? '')"
                                class="input-base"
                                :rows="tField.rows || 2" 
                                :placeholder="tField.placeholder" 
                                @input="e => { setProp(item, tField.id || tField.class || '', (e.target as HTMLTextAreaElement).value); markModified(); }"></textarea>
                                    
                              <XboxWheel
                                v-else-if="tField.type === 'select'"
                                :horizontal="wheelHorizontal"
                                :model-value="(getProp(item, tField.id || tField.class || '') as string | number) || ''"
                                :options="getOptionsFor(tField)"
                                :placeholder="tField.placeholder"
                                @update:model-value="(val: unknown) => { setProp(item, tField.id || tField.class || '', val); markModified(); }" />
                                      
                              <div v-else-if="tField.type === 'multiselect'" class="multiselect-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 12px; margin-top: 8px;">
                                <label v-for="opt in getOptionsFor(tField)" :key="opt.value" class="checkbox-item interactive-el" style="display: flex; align-items: center; gap: 8px; cursor: pointer; padding: 8px 12px; background: var(--bg-input, rgba(255,255,255,0.05)); border: 1px solid var(--border-color, rgba(255,255,255,0.1)); border-radius: 8px; transition: transform 0.2s ease, background-color 0.2s ease, border-color 0.2s ease;">
                                  <input
                                    type="checkbox" 
                                    :value="opt.value" 
                                    :checked="((getProp(item, tField.id || tField.class || '') as string[]) || []).includes(opt.value)"
                                    style="accent-color: var(--accent, #7c3aed); width: 16px; height: 16px;"
                                    @change="e => { 
                                      let arr = ((getProp(item, tField.id || tField.class || '') as string[]) || []); 
                                      if (!Array.isArray(arr)) arr = [];
                                      const target = e.target as HTMLInputElement;
                                      if (target.checked && !arr.includes(opt.value)) arr = [...arr, opt.value];
                                      else if (!target.checked) arr = arr.filter((v: string) => v !== opt.value);
                                      setProp(item, tField.id || tField.class || '', arr);
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
                                  :value="Number(getProp(item, tField.id || tField.class || '') ?? 0)"
                                  style="flex:1; accent-color: var(--accent);"
                                  @input="e => { setProp(item, tField.id || tField.class || '', Number((e.target as HTMLInputElement).value)); markModified(); }"
                                >
                                <span style="min-width:36px; text-align:right; font-size:12px; color:var(--accent); font-weight:600;">{{ getProp(item, tField.id || tField.class || '') ?? 0 }}</span>
                              </div>

                              <UniversalDatePicker
                                v-else-if="tField.type === 'calendar_date' || tField.type === 'calendar_date_base' || tField.type === 'calendar_datetime'"
                                :show-time="tField.type === 'calendar_datetime'"
                                :model-value="getProp(item, tField.id || tField.class || '') as any"
                                :project="project"
                                @update:model-value="(val: unknown) => { setProp(item, tField.id || tField.class || '', val); markModified(); }" />

                              <input
                                v-else 
                                :type="tField.type || 'text'" 
                                :value="String(getProp(item, tField.id || tField.class || '') ?? '')"
                                class="input-base"
                                :placeholder="tField.placeholder"
                                @input="e => { setProp(item, tField.id || tField.class || '', (e.target as HTMLInputElement).value); markModified(); }">
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
                style="padding: 10px 12px; border-radius: 8px; border: 1px solid var(--border-color); cursor: pointer; transition: transform 0.2s, background-color 0.2s, opacity 0.2s;"
                @click="previewHistory(rev)">
                   <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                       <span style="font-size: 11px; font-weight: bold;">{{ rev.formattedDate }}</span>
                       <button style="background: none; border: none; cursor: pointer; font-size: 12px; color: var(--accent);" :title="rev.is_pinned ? 'Открепить' : 'Закрепить от удаления'" @click.stop="togglePin(rev)">
                         {{ rev.is_pinned ? '📍' : '📌' }}
                       </button>
                   </div>
                   <div style="font-size: 10px; color: var(--text-muted); margin-top: 4px; line-height: 1.4;">
                       <!-- eslint-disable-next-line vue/no-v-html -->
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
import { ref } from 'vue';
import { XboxWheel, TagsField } from '@worldwiki/components';
import UniversalDatePicker from '../../../features/timeline/UniversalDatePicker/UniversalDatePicker.vue';
import RelationshipBlock from '../../../features/schemas/SchemaEditor/RelationshipBlock.vue';
import { useEntityEditor } from './useEntityEditor';
import type { EntityEditorProps } from './EntityEditor.model';

const props = defineProps<EntityEditorProps>();
const emit = defineEmits(['update-data', 'modified', 'section-change', 'scroll-change', 'update:modelValue']);

const photoInputs = ref<Record<string, HTMLInputElement>>({});

const {
    loading,
    wheelHorizontal,
    config,
    formData,
    foreignUpdates,
    activeSection,
    referenceData,
    scrollContainer,
    showHistory,
    isLoadingHistory,
    revisions,
    isPreviewingHistory,
    previewingRevId,
    maxSaves,
    togglePin,
    toggleHistory,
    previewHistory,
    exitHistoryPreview,
    restoreHistory,
    getDiffSummary,
    isFieldChanged,
    getPhotoUrl,
    getProp,
    setProp,
    getResolvedTemplate,
    getOptionsFor,
    markModified,
    handleForeignUpdate,
    addDynamicItem,
    removeDynamicItem,
    triggerPhotoUpload,
    handlePhotoFile,
    handlePhotoDrop,
    removePhoto
  } = useEntityEditor(props, emit as (event: string, ...args: unknown[]) => void);

defineExpose({
  toggleHistory,
  getFormData: () => formData.value,
  getForeignUpdates: () => foreignUpdates.value
});
</script>

<style scoped src="@worldwiki/resources/styles/modules/entity-editor.css"></style>
<style scoped src="./EntityEditor.style.css"></style>
