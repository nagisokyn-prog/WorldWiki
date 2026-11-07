<template>
  <div v-if="fields && fields.length > 0" class="glass-card mb-4 p-4">
    <div class="form-grid grid-dynamic">
      <template v-for="field in fields" :key="field.id || field.class">
        <div
          v-if="!field.hidden && !isFieldHidden(getFieldKey(field))"
          class="form-group"
          :class="{ 'full-width': field.fullWidth || field.type === 'textarea' || field.type === 'tags' || field.type === 'multiselect' }"
        >
          <div class="form-label-row flex items-center justify-between">
            <div class="form-label-title-wrap flex items-center gap-1.5">
              <span class="form-label-text">
                {{ field.label }}
                <span v-if="field.required" class="text-accent">*</span>
              </span>
              <button
                v-if="canHideField(field)"
                type="button"
                class="field-hide-btn interactive-el"
                title="Скрыть поле для этой сущности"
                @click.stop.prevent="$emit('hideField', getFieldKey(field))"
              >
                👁️‍🗨️
              </button>
            </div>
            <div class="flex items-center gap-2">
              <label
                v-if="field.allowOngoing || (field.class || field.id || '').toLowerCase().includes('конечная_дата')"
                class="ongoing-checkbox-label flex items-center gap-1 text-xs text-muted cursor-pointer select-none"
              >
                <input
                  type="checkbox"
                  class="checkbox-accent"
                  :checked="isFieldOngoing(field)"
                  @change="toggleFieldOngoing(field, $event)"
                />
                По настоящее время
              </label>
              <span v-if="isFieldChanged(getFieldKey(field))" class="changed-indicator" title="Значение отличается от текущей версии">Изменено</span>
            </div>
          </div>

          <textarea
            v-if="field.type === 'textarea'"
            :value="getFieldValue(field)"
            class="input-base interactive-el"
            :rows="field.rows || 3"
            :placeholder="field.placeholder"
            @input="handleTextareaInput(getFieldKey(field), $event)"
          ></textarea>

          <!-- Photo upload field -->
          <div
            v-else-if="field.type === 'photo'"
            class="photo-upload-zone"
            @click="triggerPhotoUpload(getFieldKey(field))"
            @dragover.prevent
            @drop.prevent="handlePhotoDrop($event, getFieldKey(field))"
          >
            <input
              :ref="el => setPhotoInput(getFieldKey(field), el)"
              type="file"
              accept="image/*"
              class="hidden"
              @change="handlePhotoFile($event, getFieldKey(field))"
            />
            <div v-if="getProp(getFieldKey(field))" class="photo-preview">
              <img :src="getPhotoUrl(String(getProp(getFieldKey(field)) ?? ''))" alt="Фото" />
              <button class="photo-remove-btn" title="Удалить фото" @click.stop="removePhoto(getFieldKey(field))">✕</button>
            </div>
            <div v-else class="photo-placeholder">
              <div class="photo-icon">🖼️</div>
              <div class="photo-hint">{{ field.placeholder || 'Нажмите или перетащите изображение' }}</div>
            </div>
          </div>

          <ManuscriptPointPicker
            v-else-if="isChapterField(field)"
            :model-value="getManuscriptPointValue(field)"
            :allow-auto-extend="!((field.class || field.id || '').toLowerCase().includes('начальная'))"
            :project="project"
            @update:model-value="handleFieldUpdate(getFieldKey(field), $event)"
          />

          <XboxWheel
            v-else-if="field.type === 'select'"
            :horizontal="wheelHorizontal"
            :model-value="getFieldValue(field)"
            :options="getOptionsFor(field)"
            @update:model-value="handleFieldUpdate(getFieldKey(field), $event)"
          />

          <div v-else-if="field.type === 'multiselect'" class="multiselect-grid">
            <label v-for="opt in getOptionsFor(field)" :key="opt.value" class="checkbox-item interactive-el">
              <input
                type="checkbox"
                :value="opt.value"
                :checked="isMultiselectChecked(field, opt.value)"
                class="checkbox-accent"
                @change="handleMultiselectEvent(getFieldKey(field), opt.value, $event)"
              >
              <span class="text-sm text-main">{{ opt.label }}</span>
            </label>
          </div>

          <template v-else-if="field.type === 'calendar_date' || field.type === 'calendar_date_base' || field.type === 'calendar_datetime'">
            <div
              v-if="(field.allowOngoing || (field.class || field.id || '').toLowerCase().includes('конечная_дата')) && isFieldOngoing(field)"
              class="text-xs text-muted ongoing-placeholder"
              style="padding: 6px 0; font-style: italic; opacity: 0.8;"
            >
              {{ (field.ongoingPlaceholder as string) || 'Событие продолжается (без даты окончания)' }}
            </div>
            <UniversalDatePicker
              v-else
              :show-time="field.type === 'calendar_datetime'"
              :model-value="getDatePickerValue(field)"
              :project="project"
              @update:model-value="handleFieldUpdate(getFieldKey(field), $event)"
            />
          </template>

          <TagsField
            v-else-if="field.type === 'tags'"
            :model-value="getTagsValue(field)"
            :project="project"
            :placeholder="field.placeholder"
            @update:model-value="handleFieldUpdate(getFieldKey(field), $event)"
            @modified="$emit('modified')"
          />

          <input
            v-else
            :type="field.type || 'text'"
            :value="getFieldValue(field)"
            class="input-base interactive-el"
            :placeholder="field.placeholder"
            @input="handleTextInput(getFieldKey(field), $event)"
          >

          <div v-if="field.hint" class="form-hint">{{ field.hint }}</div>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { XboxWheel, TagsField } from '@worldwiki/components';
import { UniversalDatePicker, ManuscriptPointPicker } from '@/shared/ui';
import type { EntitySectionFieldsProps, EntitySectionFieldsEmits } from './EntitySectionFields.model';
import { useEntitySectionFields } from './useEntitySectionFields';

const props = defineProps<EntitySectionFieldsProps>();
const emit = defineEmits<EntitySectionFieldsEmits>();

const {
  getFieldKey,
  getFieldValue,
  getManuscriptPointValue,
  getDatePickerValue,
  getTagsValue,
  isMultiselectChecked,
  setPhotoInput,
  handleTextareaInput,
  handleTextInput,
  handleMultiselectEvent,
  handleFieldUpdate,
  isFieldOngoing,
  toggleFieldOngoing,
} = useEntitySectionFields(props, emit);
</script>
