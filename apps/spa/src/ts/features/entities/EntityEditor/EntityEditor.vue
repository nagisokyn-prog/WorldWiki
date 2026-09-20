<template>
  <div class="entity-editor-wrapper">
    <div v-if="loading" class="loading-overlay">
      <div class="spinner"></div>
      <div class="mt-2 text-xs text-muted">Загрузка сущности...</div>
    </div>

    <!-- PREVIEW HEADER NOTIFICATION -->
    <div v-if="isPreviewingHistory" class="history-preview-banner">
      <span>👁️ Вы просматриваете сохраненную версию от <strong>{{ revisions.find((r: any) => r.id === previewingRevId)?.formattedDate }}</strong></span>
      <div class="flex gap-2">
        <button class="btn btn-small btn-primary" @click="restoreHistory">Восстановить эту версию</button>
        <button class="btn btn-small btn-outline" @click="exitHistoryPreview">Выйти</button>
      </div>
    </div>

    <div v-else-if="props.entityId === 'preview'" class="history-preview-banner banner-sandbox-preview">
      <span>🧪 <strong>Песочница:</strong> Предпросмотр кастомной схемы</span>
    </div>

    <div class="entity-editor-layout" :class="{ 'with-history': showHistory }">
      <!-- MAIN COLUMN -->
      <div class="entity-main-pane flex-1 flex-col overflow-hidden min-h-0">
        <!-- SECTIONS NAV (TABS - FIXED ON TOP) -->
        <div v-if="config && config.sections && config.sections.length > 1" class="sections-nav flex gap-2 border-b overflow-x-auto flex-shrink-0">
          <button
            v-for="sec in config.sections" 
            :key="sec.id"
            class="section-tab-btn interactive-el"
            :class="{ active: activeSection === sec.id }"
            @click="activeSection = sec.id"
          >
            <span>{{ sec.icon || '📄' }}</span>
            <span>{{ sec.title }}</span>
          </button>
        </div>

        <!-- MAIN FORM CONTAINER -->
        <div ref="scrollContainer" class="form-container">
          <!-- RENDER ACTIVE SECTION -->
          <transition name="fade-fast" mode="out-in">
            <div v-if="config && config.sections" :key="activeSection" class="active-section-content">
            <template v-for="section in config.sections" :key="section.id">
              <div v-if="section.id === activeSection">
                <!-- Обычные поля секции -->
                <div v-if="section.fields && section.fields.length > 0" class="glass-card mb-4 p-4">
                    <div class="form-grid grid-dynamic">
                      <template v-for="field in section.fields" :key="field.id || field.class">
                        <div v-if="!field.hidden" class="form-group" :class="{ 'full-width': field.fullWidth || field.type === 'textarea' || field.type === 'tags' || field.type === 'multiselect' }">
                          <label class="form-label flex justify-between items-center">
                            {{ field.label }} 
                            <span v-if="field.required" class="text-accent">*</span>
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
                            <input :ref="el => { if (el) photoInputs[field.path || field.id || field.class || ''] = el as HTMLInputElement; }" type="file" accept="image/*" class="hidden" @change="e => handlePhotoFile(e, field.path || field.id || field.class || '')" />
                            <div v-if="getProp(field.path || field.id || field.class || '')" class="photo-preview">
                              <img :src="getPhotoUrl(String(getProp(field.path || field.id || field.class || '') ?? ''))" alt="Фото" />
                              <button class="photo-remove-btn" title="Удалить фото" @click.stop="removePhoto(field.path || field.id || field.class || '')">✕</button>
                            </div>
                            <div v-else class="photo-placeholder">
                              <div class="photo-icon">🖼️</div>
                              <div class="photo-hint">{{ field.placeholder || 'Нажмите или перетащите изображение' }}</div>
                            </div>
                          </div>

                          <ManuscriptPointPicker
                            v-else-if="isChapterField(field)"
                            :model-value="getProp(field.path || field.id || field.class || '') as any"
                            :allow-auto-extend="!((field.class || field.id || '').toLowerCase().includes('начальная'))"
                            :project="props.project"
                            @update:model-value="(val: ManuscriptPoint) => { setProp(field.path || field.id || field.class || '', val); markModified(); }" />

                          <XboxWheel
                            v-else-if="field.type === 'select'"
                            :horizontal="wheelHorizontal"
                            :model-value="(getProp(field.path || field.id || field.class || '') as string | number) || ''"
                            :options="getOptionsFor(field)"
                            @update:model-value="(val: unknown) => { setProp(field.path || field.id || field.class || '', val); markModified(); }" />

                          <div v-else-if="field.type === 'multiselect'" class="multiselect-grid">
                            <label v-for="opt in getOptionsFor(field)" :key="opt.value" class="checkbox-item interactive-el">
                              <input
                                type="checkbox" 
                                :value="opt.value" 
                                :checked="((getProp(field.path || field.id || field.class || '') as string[]) || []).includes(opt.value)"
                                class="checkbox-accent"
                                @change="e => { 
                                  let arr = ((getProp(field.path || field.id || field.class || '') as string[]) || []); 
                                  if (!Array.isArray(arr)) arr = [];
                                  const target = e.target as HTMLInputElement;
                                  if (target.checked && !arr.includes(opt.value)) arr = [...arr, opt.value];
                                  else if (!target.checked) arr = arr.filter((v: string) => v !== opt.value);
                                  setProp(field.path || field.id || field.class || '', arr);
                                  markModified();
                                }"> 
                              <span class="text-sm text-main">{{ opt.label }}</span>
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
                                
                          <div v-if="field.hint" class="form-hint">{{ field.hint }}</div>
                        </div>
                      </template>
                    </div>
                </div>

                <!-- Динамические контейнеры (Массивы записей) -->
                <div v-if="section.dynamicContainers && section.dynamicContainers.length > 0" class="mt-4">
                  <template v-for="(container, cIdx) in section.dynamicContainers" :key="container.id">
                    <div
                      v-if="!container.hidden" 
                      :class="{ 'history-changed': isFieldChanged(container.dataPath || container.id || '') }"
                      class="dynamic-container-card mb-4 relative" 
                      :style="{ '--z-stack': 100 - cIdx }">
                    <div class="flex justify-between items-center mb-2">
                      <h4 class="text-xs font-bold text-muted uppercase tracking-wide">
                        {{ container.title || 'Дополнительно' }}
                        <span v-if="isFieldChanged(container.dataPath || container.id || '')" class="changed-indicator" title="Связи отличаются от текущей версии">Изменено</span>
                      </h4>
                      <button class="btn btn-small btn-outline interactive-el" @click="addDynamicItem(container.dataPath || container.id || '', container.template || '')">➕ Добавить</button>
                    </div>

                    <div v-if="getDynamicList(container).length === 0" class="empty-timeline">
                      {{ container.emptyMessage || 'Элементы не добавлены' }}
                    </div>
                    
                     <div v-else class="relative z-50">
                      <!-- Двусторонние связи — свой компонент -->
                      <template v-if="container.isBidirectional || (getResolvedTemplate(container) as any)?.isBidirectional">
                        <RelationshipBlock
                          v-for="(item, idx) in getDynamicList(container)"
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
                            const structuredArr = getDynamicList(container);
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
                        <div v-for="(item, idx) in getDynamicList(container)" :key="idx" class="glass-card mb-3 p-3 relative glass-card-stack" :style="{ '--z-item': 50 - idx }">
                          <div class="flex justify-between mb-2 pb-2 border-b">
                            <strong class="text-accent">Элемент #{{ idx + 1 }}</strong>
                            <button class="btn-danger-icon interactive-el text-error cursor-pointer bg-transparent border-none" title="Удалить" @click="removeDynamicItem(container.dataPath || container.id || '', idx)">🗑️</button>
                          </div>
                          
                          <!-- Рендерим шаблон -->
                          <div v-if="getResolvedTemplate(container)">
                            <div v-for="tField in getResolvedTemplate(container)?.fields || []" :key="tField.id || tField.class" class="form-group mb-2">
                              <label v-if="tField.label" class="form-label text-xs">{{ tField.label }}</label>
                              
                              <textarea
                                v-if="tField.type === 'textarea'" 
                                :value="String(getProp(item, tField.id || tField.class || '') ?? '')"
                                class="input-base"
                                :rows="tField.rows || 2" 
                                :placeholder="tField.placeholder" 
                                @input="e => { setProp(item, tField.id || tField.class || '', (e.target as HTMLTextAreaElement).value); markModified(); }"></textarea>
                                    
                              <ManuscriptPointPicker
                                v-else-if="isChapterField(tField)"
                                :model-value="getProp(item, tField.id || tField.class || '') as any"
                                :allow-auto-extend="!((tField.class || tField.id || '').toLowerCase().includes('начальная'))"
                                :project="props.project"
                                @update:model-value="(val: ManuscriptPoint) => { setProp(item, tField.id || tField.class || '', val); markModified(); }" />

                              <XboxWheel
                                v-else-if="tField.type === 'select'"
                                :horizontal="wheelHorizontal"
                                :model-value="(getProp(item, tField.id || tField.class || '') as string | number) || ''"
                                :options="getOptionsFor(tField)"
                                :placeholder="tField.placeholder"
                                @update:model-value="(val: unknown) => { setProp(item, tField.id || tField.class || '', val); markModified(); }" />

                              <div v-else-if="tField.type === 'multiselect'" class="multiselect-grid">
                                <label v-for="opt in getOptionsFor(tField)" :key="opt.value" class="checkbox-item interactive-el">
                                  <input
                                    type="checkbox" 
                                    :value="opt.value" 
                                    :checked="((getProp(item, tField.id || tField.class || '') as string[]) || []).includes(opt.value)"
                                    class="checkbox-accent"
                                    @change="e => { 
                                      let arr = ((getProp(item, tField.id || tField.class || '') as string[]) || []); 
                                      if (!Array.isArray(arr)) arr = [];
                                      const target = e.target as HTMLInputElement;
                                      if (target.checked && !arr.includes(opt.value)) arr = [...arr, opt.value];
                                      else if (!target.checked) arr = arr.filter((v: string) => v !== opt.value);
                                      setProp(item, tField.id || tField.class || '', arr);
                                      markModified();
                                    }"> 
                                  <span class="text-sm text-main">{{ opt.label }}</span>
                                </label>
                              </div>
                              
                              <div v-else-if="tField.type === 'range'" class="range-wrap">
                                <input
                                  type="range"
                                  :min="tField.min ?? -100"
                                  :max="tField.max ?? 100"
                                  :value="Number(getProp(item, tField.id || tField.class || '') ?? 0)"
                                  class="flex-1 range-accent"
                                  @input="e => { setProp(item, tField.id || tField.class || '', Number((e.target as HTMLInputElement).value)); markModified(); }"
                                >
                                <span class="text-xs text-accent font-bold range-val-badge">{{ getProp(item, tField.id || tField.class || '') ?? 0 }}</span>
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
      </div>

      <!-- RIGHT SIDEBAR (HISTORY) -->
      <aside v-if="showHistory" class="schema-catalog history-drawer">
          <div class="flex justify-between items-center p-3 border-b text-xs font-bold">
              <span>История изменений</span>
              <button class="cursor-pointer text-muted" @click="showHistory = false">✕</button>
          </div>
          
          <div class="p-3 border-b">
            <label class="text-xs text-muted">Хранить последних версий:</label>
            <input v-model="maxSaves" type="number" class="input-base text-xs w-full mt-1">
          </div>
          
          <div v-if="isLoadingHistory" class="p-4 text-center text-muted text-xs">
              Загрузка истории...
          </div>
          <div v-else class="flex-1 overflow-y-auto p-3 flex-col gap-2">
              <div v-if="revisions.length === 0" class="text-xs text-muted text-center">Нет сохраненных версий</div>
              
              <div
                v-for="(rev, idx) in revisions" :key="rev.id" 
                class="catalog-item interactive-el" 
                :class="{ 'is-previewing': previewingRevId === rev.id }"
                @click="previewHistory(rev)">
                   <div class="flex justify-between items-center w-full">
                       <span class="text-xs font-bold">{{ rev.formattedDate }}</span>
                       <button class="cursor-pointer text-accent text-sm" :title="rev.is_pinned ? 'Открепить' : 'Закрепить от удаления'" @click.stop="togglePin(rev)">
                         {{ rev.is_pinned ? '📍' : '📌' }}
                       </button>
                   </div>
                   <div class="text-xs text-muted mt-1 diff-summary-text">
                       <SafeHtml v-if="getDiffSummary(rev, revisions[idx + 1])" as="span" :content="getDiffSummary(rev, revisions[idx + 1])" />
                       <span v-else>Базовая версия</span>
                   </div>
                   <div v-if="previewingRevId === rev.id" class="mt-1">
                       <span class="text-xs preview-badge-warning">Режим предпросмотра</span>
                   </div>
              </div>
          </div>
      </aside>
    </div>
  </div>
</template>

<script setup lang="ts">
import { XboxWheel, TagsField, SafeHtml } from '@worldwiki/components';
import { UniversalDatePicker, RelationshipBlock, ManuscriptPointPicker, type ManuscriptPoint } from '@/shared/ui';
import { useEntityEditor } from './useEntityEditor';
import type { EntityEditorProps } from './EntityEditor.model';

const isChapterField = (field: { class?: string; id?: string; type?: string; entityType?: string }): boolean => {
  if (field.entityType === 'chapter') return true;
  if (field.type === 'manuscript_point' || field.type === 'chapter') return true;
  const cls = (field.class || field.id || '').toLowerCase();
  return cls.includes('глава') || cls.includes('chapter') || cls === 'начальная_глава' || cls === 'конечная_глава';
};

const props = defineProps<EntityEditorProps>();
const emit = defineEmits(['update-data', 'modified', 'section-change', 'scroll-change', 'update:modelValue']);

const {
    loading,
    photoInputs,
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
    getDynamicList,
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

<style scoped src="@worldwiki/resources/styles/features/entities/EntityEditor.css"></style>
