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
      <div v-for="tField in templateFields" :key="tField.id || tField.class" class="form-group mb-2">
        <label v-if="tField.label" class="form-label text-xs">{{ tField.label }}</label>

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

        <UniversalDatePicker
          v-else-if="tField.type === 'calendar_date' || tField.type === 'calendar_date_base' || tField.type === 'calendar_datetime'"
          :show-time="tField.type === 'calendar_datetime'"
          :model-value="getFieldProp(tField.id || tField.class || '')"
          :project="project"
          @update:model-value="updateProp(tField.id || tField.class || '', $event)"
        />

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
} = useEntityDynamicItemCard(props, emit);
</script>
