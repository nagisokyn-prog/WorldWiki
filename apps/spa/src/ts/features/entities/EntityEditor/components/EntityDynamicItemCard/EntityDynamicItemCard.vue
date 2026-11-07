<template>
  <div class="glass-card mb-3 p-3 relative glass-card-stack" :style="{ '--z-item': 50 - idx }">
    <div
      class="flex justify-between items-center mb-2 pb-2 border-b cursor-pointer select-none"
      @click="toggleCollapse"
    >
      <div class="flex items-center gap-2 min-w-0">
        <span class="text-xs text-accent">
          {{ isCollapsed ? '▶' : '▼' }}
        </span>
        <strong class="text-accent text-xs whitespace-nowrap">Элемент #{{ idx + 1 }}</strong>
        <span
          v-if="itemSummary"
          class="text-xs text-muted truncate max-w-sm"
          :title="itemSummary"
        >
          — {{ itemSummary }}
        </span>
      </div>
      <div class="flex items-center gap-2 flex-shrink-0" @click.stop>
        <button
          type="button"
          class="btn-new btn-outline-new text-xs interactive-el py-0.5 px-2"
          :title="isCollapsed ? 'Развернуть элемент' : 'Свернуть элемент'"
          @click="toggleCollapse"
        >
          {{ isCollapsed ? 'Развернуть' : 'Свернуть' }}
        </button>
        <button class="btn-danger-icon interactive-el text-error cursor-pointer bg-transparent border-none" title="Удалить" @click="remove">🗑️</button>
      </div>
    </div>

    <!-- Рендерим шаблон -->
    <div v-if="!isCollapsed && templateFields.length > 0">
      <template v-for="tField in templateFields" :key="tField.id || tField.class">
        <!-- Скрытое поле: плашка для восстановления -->
        <div
          v-if="isFieldHidden(tField.id || tField.class || '')"
          class="hidden-field-placeholder flex items-center justify-between py-1 px-2.5 mb-2 rounded border border-dashed border-border text-xs text-muted select-none"
        >
          <span class="flex items-center gap-1.5 opacity-80">
            <span>👁️‍🗨️</span>
            <span>{{ tField.label || tField.class }} (скрыто для этой записи)</span>
          </span>
          <button
            type="button"
            class="btn-new btn-outline-new text-xs py-0.5 px-2 interactive-el"
            title="Восстановить поле"
            @click.stop="unhideField(tField.id || tField.class || '')"
          >
            Показать
          </button>
        </div>

        <div v-else class="form-group mb-2">
          <div class="flex justify-between items-center mb-1">
            <div class="form-label-title-wrap flex items-center gap-1.5">
              <span v-if="tField.label" class="form-label-text text-xs mb-0">{{ tField.label }}</span>
              <button
                v-if="canHideField(tField)"
                type="button"
                class="field-hide-btn interactive-el"
                title="Скрыть поле для этой сущности"
                @click.stop.prevent="hideField(tField.id || tField.class || '')"
              >
                👁️‍🗨️
              </button>
            </div>
            <label
              v-if="tField.allowOngoing || (tField.class || tField.id || '').toLowerCase().includes('конечная_дата')"
              class="ongoing-checkbox-label flex items-center gap-1 text-xs text-muted cursor-pointer select-none"
            >
              <input
                type="checkbox"
                class="checkbox-accent"
                :checked="isFieldOngoing(tField.id || tField.class || '')"
                @change="toggleFieldOngoing(tField.id || tField.class || '', $event)"
              />
              По настоящее время
            </label>
          </div>

        <textarea
          v-if="tField.type === 'textarea'"
          :value="getFieldValue(tField.id || tField.class || '')"
          class="input-base"
          :rows="tField.rows || 2"
          :placeholder="tField.placeholder"
          @input="onTextareaInput(tField.id || tField.class || '', $event)"
        ></textarea>

        <ManuscriptPointPicker
          v-else-if="isChapterField(tField)"
          :model-value="getFieldProp(tField.id || tField.class || '')"
          :allow-auto-extend="!((tField.class || tField.id || '').toLowerCase().includes('начальная'))"
          :project="project"
          @update:model-value="updateProp(tField.id || tField.class || '', $event)"
        />

        <XboxWheel
          v-else-if="tField.type === 'select'"
          :horizontal="wheelHorizontal"
          :model-value="getFieldValue(tField.id || tField.class || '')"
          :options="getOptionsFor(tField)"
          :placeholder="tField.placeholder"
          @update:model-value="updateProp(tField.id || tField.class || '', $event)"
        />

        <div v-else-if="tField.type === 'multiselect'" class="multiselect-grid">
          <label v-for="opt in getOptionsFor(tField)" :key="opt.value" class="checkbox-item interactive-el">
            <input
              type="checkbox"
              :value="opt.value"
              :checked="isMultiselectChecked(tField.id || tField.class || '', opt.value)"
              @change="onCheckboxChange(tField.id || tField.class || '', opt.value, $event)"
            />
            <span class="text-xs">{{ opt.label }}</span>
          </label>
        </div>

        <div v-else-if="tField.type === 'range'" class="range-wrap">
          <input
            type="range"
            :min="tField.min ?? -100"
            :max="tField.max ?? 100"
            :value="Number(getFieldValue(tField.id || tField.class || '') || 0)"
            class="flex-1 range-accent"
            @input="onNumberInput(tField.id || tField.class || '', $event)"
          >
          <span class="text-xs text-accent font-bold range-val-badge">{{ getFieldValue(tField.id || tField.class || '') || 0 }}</span>
        </div>

        <template v-else-if="tField.type === 'calendar_date' || tField.type === 'calendar_date_base' || tField.type === 'calendar_datetime'">
          <div
            v-if="(tField.allowOngoing || (tField.class || tField.id || '').toLowerCase().includes('конечная_дата')) && isFieldOngoing(tField.id || tField.class || '')"
            class="text-xs text-muted ongoing-placeholder"
            style="padding: 6px 0; font-style: italic; opacity: 0.8;"
          >
            {{ (tField.ongoingPlaceholder as string) || 'Действует по настоящее время (без даты окончания)' }}
          </div>
          <UniversalDatePicker
            v-else
            :show-time="tField.type === 'calendar_datetime'"
            :model-value="getFieldProp(tField.id || tField.class || '')"
            :project="project"
            @update:model-value="updateProp(tField.id || tField.class || '', $event)"
          />
        </template>

        <input
          v-else-if="tField.type === 'number'"
          type="number"
          :value="getFieldProp(tField.id || tField.class || '')"
          class="input-base"
          :placeholder="tField.placeholder"
          @input="onNumberInput(tField.id || tField.class || '', $event)"
        />

        <input
          v-else
          type="text"
          :value="getFieldValue(tField.id || tField.class || '')"
          class="input-base"
          :placeholder="tField.placeholder"
          @input="onTextInput(tField.id || tField.class || '', $event)"
        />
      </div>
    </template>
  </div>
</div>
</template>

<script setup lang="ts">
import { XboxWheel } from '@worldwiki/components';
import { ManuscriptPointPicker, UniversalDatePicker } from '@/shared/ui';
import type { EntityDynamicItemCardProps, EntityDynamicItemCardEmits } from './EntityDynamicItemCard.model';
import { useEntityDynamicItemCard } from './useEntityDynamicItemCard';

const props = defineProps<EntityDynamicItemCardProps>();
const emit = defineEmits<EntityDynamicItemCardEmits>();

const {
  isCollapsed,
  itemSummary,
  templateFields,
  toggleCollapse,
  remove,
  updateProp,
  getFieldValue,
  getFieldProp,
  isMultiselectChecked,
  onTextareaInput,
  onTextInput,
  onNumberInput,
  onCheckboxChange,
  isFieldOngoing,
  toggleFieldOngoing,
  isFieldHidden,
  canHideField,
  hideField,
  unhideField,
} = useEntityDynamicItemCard(props, emit);
</script>
