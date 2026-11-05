<template>
  <div class="glass-card mb-3 p-3 relative">
    <div class="flex justify-between mb-2 pb-2 border-b">
      <strong class="text-accent">Элемент #1</strong>
      <button class="btn-danger-icon pointer-events-none text-error cursor-pointer bg-transparent border-none" title="Удалить">🗑️</button>
    </div>

    <!-- Рендерим шаблон с реальными полями сущности -->
    <div>
      <div v-for="field in example.fields" :key="field.id || field.class" class="form-group mb-2">
        <label v-if="field.label" class="form-label text-xs">{{ field.label }}</label>
        
        <ManuscriptPointPicker v-if="isChapterField(field)" :model-value="null" :disabled="true" />
        <!-- Select: кликабелен только если не ссылается на главы и сущности -->
        <XboxWheel 
          v-else-if="field.type === 'select'" 
          :options="getSelectOptions(field)" 
          :placeholder="field.placeholder || 'Выберите...'" 
          :disabled="isEntityOrChapterSelect(field)" 
          :class="{ 'pointer-events-none': isEntityOrChapterSelect(field) }"
        />

        <!-- Textarea (некликабельно, чистый показ) -->
        <textarea 
          v-else-if="field.type === 'textarea'" 
          class="input-base text-xs pointer-events-none" 
          :rows="field.rows || 2" 
          :placeholder="field.placeholder || ''" 
          tabindex="-1"
          readonly
        ></textarea>

        <!-- Date / Time (некликабельно, чистый показ) -->
        <div v-else-if="field.type === 'calendar_date' || field.type === 'date' || field.type === 'calendar_datetime'" class="date-wheels-preview pointer-events-none">
          <div class="date-wheel-preview-col"><div class="date-wheel-preview-label">ГОД</div><XboxWheel :options="[{value: '2026', label: '2026'}]" model-value="2026" :disabled="true" /></div>
          <div class="date-wheel-preview-col flex-1-5"><div class="date-wheel-preview-label">МЕСЯЦ</div><XboxWheel :options="[{value: 'Май', label: 'Май'}]" model-value="Май" :disabled="true" /></div>
          <div class="date-wheel-preview-col flex-0-8"><div class="date-wheel-preview-label">ДЕНЬ</div><XboxWheel :options="[{value: '14', label: '14'}]" model-value="14" :disabled="true" /></div>
        </div>

        <!-- Range (некликабельно, чистый показ) -->
        <div v-else-if="field.type === 'range'" class="range-wrap flex items-center gap-3 pointer-events-none">
          <input 
            type="range" 
            class="flex-1 range-accent" 
            :min="field.min ?? 0" 
            :max="field.max ?? 100" 
            :value="field.min ? field.min + (field.max ? (field.max - field.min) / 2 : 50) : 50" 
            tabindex="-1"
            readonly
          />
          <span class="text-xs text-accent font-bold">{{ field.min ? field.min + (field.max ? (field.max - field.min) / 2 : 50) : 50 }}</span>
        </div>

        <!-- Text / Number input (некликабельно, чистый показ) -->
        <input 
          v-else 
          type="text" 
          class="input-base text-xs pointer-events-none" 
          :placeholder="field.placeholder || ''" 
          value="" 
          tabindex="-1"
          readonly 
        />

        <div v-if="field.hint" class="form-hint text-micro text-muted mt-1">{{ field.hint }}</div>
      </div>

      <!-- Вложенные динамические контейнеры -->
      <div v-for="sub in (example.dynamicContainers || [])" :key="'sub_dyn_' + sub.id" class="sub-container-wrap dashed mt-3 p-2">
        <div class="text-xs font-bold text-muted mb-2">⏱️ {{ sub.title }}</div>
        <div class="nested-item card-secondary p-2 mb-1">
          <div v-for="subField in (sub.fields || [])" :key="'sf_dyn_' + subField.class" class="form-group mb-2">
            <label v-if="subField.label" class="form-label text-xs">{{ subField.label }}</label>
            <XboxWheel 
              v-if="subField.type === 'select'" 
              :options="getSelectOptions(subField)" 
              :placeholder="subField.placeholder || 'Выберите...'" 
              :disabled="isEntityOrChapterSelect(subField)" 
              :class="{ 'pointer-events-none': isEntityOrChapterSelect(subField) }"
            />
            <input v-else type="text" class="input-base text-xs pointer-events-none" :placeholder="subField.placeholder || ''" value="" tabindex="-1" readonly />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ModuleHelpDynamicCardProps } from './ModuleHelpDynamicCard.model';
import { XboxWheel } from '@worldwiki/components';
import { ManuscriptPointPicker } from '@/shared/ui';

defineProps<ModuleHelpDynamicCardProps>();
</script>
