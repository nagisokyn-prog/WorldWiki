<template>
  <div class="schema-field-editor" :class="{ 'is-hidden-field': item.hidden }">
    <div class="schema-field-header" :class="{ 'is-first-item': isFirst || item.isSystem }">
      <div class="flex items-center gap-2 flex-1">
        <span v-if="!isFirst && !item.isSystem" class="schema-drag-dots">⠿</span>
        <span v-else class="text-accent icon-dim-50" title="Системное защищенное поле">🔒</span>
        
        <input :value="item.label" class="form-label schema-field-title-input" placeholder="НАЗВАНИЕ ПОЛЯ" @input="updateLabel(($event.target as HTMLInputElement).value)" />
      </div>
      
      <div v-if="!isFirst && !item.isSystem && !item.preventDelete" class="flex items-center gap-2">
        <button
          v-if="!item.preventHide"
          class="schema-btn-icon text-xs" 
          :title="item.hidden ? 'Показать поле' : 'Скрыть поле'"
          @click="toggleHidden">
          {{ item.hidden ? '👁️‍🗨️' : '👁️' }}
        </button>
        <button
          class="schema-btn-delete text-xs" 
          @click="$emit('remove')">
          УДАЛИТЬ
        </button>
      </div>
    </div>
    
    <!-- PREVIEW AREA -->
    <div class="schema-field-preview">
       
       <!-- Multiselect / Tags -->
       <div v-if="item.type === 'multiselect' || item.type === 'tags'" class="tags-grid flex flex-wrap gap-2">
          <div v-for="(opt, oIdx) in (item.options || [{label: 'Опция 1'}])" :key="oIdx" class="glass-pill interactive-el text-xs p-2">{{ opt.label }}</div>
          <div v-if="item.type === 'tags'" class="glass-pill glass-pill-add-tag">+ ТЕГ</div>
       </div>

       <!-- 3D WHEEL SELECT -->
       <XboxWheel v-else-if="item.type === 'select'" :model-value="''" :options="item.options || []" :placeholder="item.placeholder || 'Выберите...'" />

       <!-- 3D WHEEL DATE -->
       <div v-else-if="item.type === 'calendar_date' || item.type === 'calendar_datetime' || item.type === 'date'" class="date-wheels-container">
          <div class="date-wheel-group">
             <div class="date-wheel-label">Год</div>
             <XboxWheel :options="[{ value: '2026', label: '2026' }, { value: '2025', label: '2025' }, { value: '2024', label: '2024' }]" placeholder="Год" />
          </div>
          <div class="date-wheel-group month">
             <div class="date-wheel-label">Месяц</div>
             <XboxWheel :options="monthsList" placeholder="Месяц" />
          </div>
          <div class="date-wheel-group day">
             <div class="date-wheel-label">День</div>
             <XboxWheel :options="Array.from({ length: 31 }, (_, i) => ({ value: String(i + 1), label: String(i + 1) }))" placeholder="День" />
          </div>
       </div>

       <!-- RANGE -->
       <div v-else-if="item.type === 'range'" class="flex items-center gap-4">
          <input :value="item._val || 0" type="range" :min="Number(item.min) || 0" :max="Number(item.max) || 100" class="flex-1 interactive-el range-accent" @input="updateVal(Number(($event.target as HTMLInputElement).value))" />
          <div class="range-badge">{{ item._val || (item.value || 0) }}</div>
       </div>

       <!-- PHOTO -->
       <div v-else-if="item.type === 'photo'" class="photo-placeholder-ui interactive-el">
          <span class="text-2xl">🖼️</span>
          <span class="photo-placeholder-title">ЗАГРУЗИТЬ ФОТО</span>
       </div>

       <textarea v-else-if="item.type === 'textarea'" class="input-base interactive-el input-textarea-tall" :placeholder="item.placeholder || 'Введите текст...'"></textarea>
       <input v-else :value="item._val || ''" class="input-base interactive-el" :placeholder="item.placeholder || 'Введите значение...'" :type="item.type === 'number' ? 'number' : 'text'" @input="updateVal(($event.target as HTMLInputElement).value)" />
    </div>

    <!-- SETTINGS AREA -->
    <div class="schema-field-settings">
       <div class="flex gap-4 mb-3">
          <div class="flex-1">
             <label class="form-label-micro">ТИП КИРПИЧА</label>
             <div class="flex gap-1 flex-wrap">
                <button v-for="t in typeOptions" :key="t.val" :class="{ active: item.type === t.val, 'is-disabled-type': (isFirst || !!item.isSystem) && item.type !== t.val }" class="type-btn-mini interactive-el" :disabled="isFirst || !!item.isSystem" @click="(!isFirst && !item.isSystem) && setType(t.val)">{{ t.icon }} {{ t.label }}</button>
             </div>
          </div>
          <div class="flex-1">
             <label class="form-label-micro">ПОДСКАЗКА</label>
             <input :value="item.placeholder" class="input-base interactive-el" placeholder="Подсказка..." @input="updatePlaceholder(($event.target as HTMLInputElement).value)" />
          </div>
       </div>

       <!-- OPTIONS EDITOR -->
       <div v-if="item.type === 'select' || item.type === 'multiselect'" class="border-t pt-3 mt-3">
          <div class="flex items-center justify-between mb-2">
             <label class="form-label-micro">ВАРИАНТЫ ВЫБОРА</label>
             <div class="options-source-toggle flex gap-1">
                <button
                  type="button"
                  class="source-toggle-btn interactive-el text-xs"
                  :class="{ active: (item.optionsSource || (item.entityTypes?.length || item.entityType ? 'entities' : 'custom')) === 'custom' }"
                  @click="setOptionsSource('custom')"
                >
                  📝 Свои варианты
                </button>
                <button
                  type="button"
                  class="source-toggle-btn interactive-el text-xs"
                  :class="{ active: (item.optionsSource || (item.entityTypes?.length || item.entityType ? 'entities' : 'custom')) === 'entities' }"
                  @click="setOptionsSource('entities')"
                >
                  🧩 Типы сущностей
                </button>
             </div>
          </div>

          <!-- Режим 1: Ручные текстовые варианты -->
          <div v-if="(item.optionsSource || (item.entityTypes?.length || item.entityType ? 'entities' : 'custom')) === 'custom'">
             <div class="multiselect-grid mb-2">
                <div v-for="(opt, oIdx) in (item.options || [])" :key="oIdx" class="option-item-row">
                   <input v-model="opt.label" class="input-base interactive-el flex-1" placeholder="Название варианта..." @input="opt.value = opt.label" />
                   <button class="btn-icon-danger-sm interactive-el" title="Удалить" @click="removeOption(Number(oIdx))">✕</button>
                </div>
             </div>
             <button class="btn-new btn-outline-new interactive-el text-xs" @click="addOption">+ ДОБАВИТЬ ВАРИАНТ</button>
          </div>

          <!-- Режим 2: Доступные типы сущностей -->
          <div v-else class="entity-types-selector">
             <div class="text-xs text-muted mb-2">Выберите один или несколько типов сущностей:</div>
             <div class="flex flex-wrap gap-1.5 mb-2">
                <button
                  v-for="t in availableTypes"
                  :key="t.value"
                  type="button"
                  class="entity-type-chip interactive-el text-xs"
                  :class="{ active: isEntityTypeSelected(t.value) }"
                  @click="toggleEntityType(t.value)"
                >
                  <span>{{ t.icon || '📄' }}</span>
                  <span>{{ t.label }}</span>
                  <span v-if="isEntityTypeSelected(t.value)" class="check-mark">✓</span>
                </button>
             </div>
             <div v-if="!item.entityTypes || item.entityTypes.length === 0" class="text-xs text-warning">
                ⚠️ Не выбрано ни одного типа. Выберите хотя бы один тип сущности.
             </div>
             <div v-else class="text-xs text-muted">
                Выбрано типов: {{ item.entityTypes.length }}
             </div>
          </div>
       </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { SchemaFieldEditorProps, SchemaFieldEditorEmits } from './SchemaFieldEditor.model';
import { XboxWheel } from '@worldwiki/components';
import { useSchemaFieldEditor } from './useSchemaFieldEditor';

const props = defineProps<SchemaFieldEditorProps>();

defineEmits<SchemaFieldEditorEmits>();

const {
  typeOptions,
  monthsList,
  availableTypes,
  updateLabel,
  toggleHidden,
  updateVal,
  setType,
  updatePlaceholder,
  addOption,
  removeOption,
  setOptionsSource,
  toggleEntityType,
  isEntityTypeSelected
} = useSchemaFieldEditor(props);
</script>

<style scoped src="@worldwiki/resources/styles/features/schemas/SchemaFieldEditor.css"></style>
