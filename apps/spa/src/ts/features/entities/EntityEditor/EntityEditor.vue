<template>
  <div class="entity-editor-wrapper">
    <div v-if="loading" class="loading-overlay">
      <div class="spinner"></div>
      <div class="mt-2 text-xs text-muted">Загрузка сущности...</div>
    </div>

    <EntityHistoryBanner
      :is-previewing="isPreviewingHistory"
      :is-sandbox="props.entityId === 'preview'"
      :formatted-date="revisions.find((r) => r.id === previewingRevId)?.formattedDate"
      @restore="restoreHistory"
      @exit="exitHistoryPreview"
    />

    <div class="entity-editor-layout" :class="{ 'with-history': showHistory }">
      <div class="entity-main-pane flex-1 flex-col overflow-hidden min-h-0">
        <div v-if="(visibleSections && visibleSections.length > 1) || totalHiddenCount > 0" class="sections-nav flex justify-between items-center border-b flex-shrink-0 pr-2">
          <div class="flex gap-2 overflow-x-auto flex-1 py-1">
            <div v-for="(sec, sIdx) in visibleSections" :key="sec.id" class="section-tab-wrapper relative flex items-center">
              <button class="section-tab-btn interactive-el" :class="{ active: activeSection === sec.id }" @click="activeSection = sec.id">
                <span>{{ sec.icon || '📄' }}</span>
                <span>{{ sec.title }}</span>
              </button>
              <button
                v-if="canHideSection(sec, sIdx)"
                type="button"
                class="tab-hide-btn interactive-el"
                title="Скрыть страницу для этой сущности"
                @click.stop="hideSection(sec.id)"
              >👁️‍🗨️</button>
            </div>
          </div>

          <EntityHiddenManager
            :is-open="showHiddenManager" :total-hidden-count="totalHiddenCount"
            :hidden-sections="hiddenConfig.sections" :hidden-fields="hiddenConfig.fields" :hidden-containers="hiddenConfig.containers"
            :sections="config?.sections" :get-field-label="getFieldLabel" :get-container-title="getContainerTitle"
            @toggle-open="showHiddenManager = !showHiddenManager" @close="showHiddenManager = false"
            @unhide-all="unhideAll" @unhide-section="unhideSection" @unhide-field="unhideField" @unhide-container="unhideContainer"
          />
        </div>

        <div ref="scrollContainer" class="form-container">
          <transition name="fade-fast" mode="out-in">
            <div v-if="config && config.sections" :key="activeSection" class="active-section-content">
              <template v-for="section in visibleSections" :key="section.id">
                <div v-if="section.id === activeSection">
                  <LocationAstronomyWidget
                    v-if="props.entityType === 'location' && section.id === 'geography'"
                    :project="props.project" :entity-id="props.entityId" :form-data="formData"
                    @apply-timezone="(val) => { setProp('часовой_пояс', val); markModified(); }"
                  />

                  <EntitySectionFields
                    v-if="section.fields && section.fields.length > 0"
                    :fields="section.fields" :project="props.project" :wheel-horizontal="wheelHorizontal" :photo-inputs="photoInputs"
                    :is-field-hidden="isFieldHidden" :can-hide-field="canHideField" :is-field-changed="isFieldChanged"
                    :get-prop="getProp" :set-prop="setProp" :get-photo-url="getPhotoUrl" :trigger-photo-upload="triggerPhotoUpload"
                    :handle-photo-file="handlePhotoFile" :handle-photo-drop="handlePhotoDrop" :remove-photo="removePhoto"
                    :is-chapter-field="isChapterField" :get-options-for="getOptionsFor"
                    @hide-field="hideField" @modified="markModified"
                  />

                  <EntityDynamicContainers
                    v-if="section.dynamicContainers && section.dynamicContainers.length > 0"
                    :containers="section.dynamicContainers" :config="config" :project="props.project"
                    :entity-id="props.entityId" :entity-type="props.entityType" :reference-data="referenceData" :wheel-horizontal="wheelHorizontal"
                    :is-container-hidden="isContainerHidden" :is-field-changed="isFieldChanged" :can-hide-container="canHideContainer"
                    :get-dynamic-list="getDynamicList" :are-all-collapsed="areAllCollapsed" :get-resolved-template="getResolvedTemplate"
                    :get-item-summary="getItemSummary" :get-prop="getProp" :set-prop="setProp" :get-options-for="getOptionsFor"
                    :is-chapter-field="isChapterField" :is-item-collapsed="isItemCollapsed"
                    @toggle-all-collapse="toggleAllCollapse" @hide-container="hideContainer" @add-dynamic-item="addDynamicItem"
                    @remove-dynamic-item="removeDynamicItem" @toggle-item-collapse="toggleItemCollapse"
                    @modified="markModified" @foreign-update="handleForeignUpdate"
                  />
                </div>
              </template>
            </div>
          </transition>
        </div>
      </div>

      <EntityHistoryAside
        v-if="showHistory"
        v-model:max-saves="maxSaves" :is-loading="isLoadingHistory" :revisions="revisions"
        :previewing-rev-id="previewingRevId" :get-diff-summary="getDiffSummary"
        @close="showHistory = false" @preview="previewHistory" @toggle-pin="togglePin"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import EntityHistoryBanner from './components/EntityHistoryBanner/EntityHistoryBanner.vue';
import LocationAstronomyWidget from './components/LocationAstronomyWidget/LocationAstronomyWidget.vue';
import EntityHiddenManager from './components/EntityHiddenManager/EntityHiddenManager.vue';
import EntityHistoryAside from './components/EntityHistoryAside/EntityHistoryAside.vue';
import EntitySectionFields from './components/EntitySectionFields/EntitySectionFields.vue';
import EntityDynamicContainers from './components/EntityDynamicContainers/EntityDynamicContainers.vue';
import { useEntityEditor } from './useEntityEditor';
import type { EntityEditorProps } from './EntityEditor.model';

const props = defineProps<EntityEditorProps>();
const emit = defineEmits(['update-data', 'modified', 'section-change', 'scroll-change', 'update:modelValue']);

const {
  loading, photoInputs, wheelHorizontal, config, visibleSections, formData, foreignUpdates, activeSection,
  referenceData, scrollContainer, showHistory, isLoadingHistory, revisions, isPreviewingHistory, previewingRevId,
  maxSaves, togglePin, toggleHistory, previewHistory, exitHistoryPreview, restoreHistory, getDiffSummary,
  isFieldChanged, getPhotoUrl, getProp, setProp, getDynamicList, getResolvedTemplate, getItemSummary,
  getFieldLabel, getContainerTitle, getOptionsFor, markModified, handleForeignUpdate, addDynamicItem,
  removeDynamicItem, isItemCollapsed, toggleItemCollapse, areAllCollapsed, toggleAllCollapse, triggerPhotoUpload,
  handlePhotoFile, handlePhotoDrop, removePhoto, isChapterField, showHiddenManager, hiddenConfig, canHideSection,
  canHideField, canHideContainer, hideSection, unhideSection, hideField, unhideField, hideContainer,
  unhideContainer, unhideAll, totalHiddenCount, isFieldHidden, isContainerHidden,
} = useEntityEditor(props, emit as (event: string, ...args: unknown[]) => void);

defineExpose({
  toggleHistory,
  getFormData: () => formData.value,
  getForeignUpdates: () => foreignUpdates.value
});
</script>

<style scoped src="@worldwiki/resources/styles/features/entities/EntityEditor.css"></style>
