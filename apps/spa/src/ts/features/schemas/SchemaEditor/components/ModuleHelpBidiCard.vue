<template>
  <div class="rel-block glass-panel">
    <div class="rel-header flex justify-between items-center mb-2 pb-2 border-b">
      <div class="flex items-center gap-2">
        <span class="text-lg">🔗</span>
        <strong class="text-main text-xs font-bold">{{ example.containerTitle }}</strong>
      </div>
      <button class="btn-icon danger interactive-el pointer-events-none bg-transparent border-none text-error cursor-pointer">🗑️</button>
    </div>

    <div class="mock-rel-split">
      <!-- СТОРОНА А -->
      <div class="mock-rel-side mock-side-left">
        <div class="mock-side-header text-accent">🟣 СТОРОНА А ({{ example.entityName }})</div>
        <div v-for="field in example.fields" :key="'fa_' + (field.class || field.id)" class="form-group mb-2">
          <label v-if="field.label" class="form-label text-xs text-accent-light">{{ field.label }}</label>
          <ManuscriptPointPicker v-if="isChapterField(field)" :model-value="null" :disabled="true" />
          <XboxWheel 
            v-else-if="field.type === 'select'" 
            :options="getSelectOptions(field)" 
            :placeholder="field.placeholder || 'Выберите...'" 
            :disabled="isEntityOrChapterSelect(field)" 
            :class="{ 'pointer-events-none': isEntityOrChapterSelect(field) }"
          />
          <textarea 
            v-else-if="field.type === 'textarea'" 
            class="input-base text-xs pointer-events-none" 
            :rows="field.rows || 2" 
            :placeholder="field.placeholder || ''" 
            tabindex="-1"
            readonly
          ></textarea>
          <input 
            v-else 
            type="text" 
            class="input-base text-xs pointer-events-none" 
            :placeholder="field.placeholder || ''" 
            value="" 
            tabindex="-1" 
            readonly 
          />
          <div v-if="field.hint" class="form-hint text-micro text-muted">{{ field.hint }}</div>
        </div>

        <!-- Вложенные таймлайн-контейнеры Стороны А -->
        <div v-for="sub in (example.dynamicContainers || [])" :key="'sub_a_' + sub.id" class="sub-container-wrap mt-2 p-2">
          <div class="flex justify-between items-center mb-1">
            <span class="text-micro font-bold text-muted">⏱️ {{ sub.title }}</span>
          </div>
          <div class="nested-item card-secondary p-2 mb-1">
            <div v-for="subField in (sub.fields || [])" :key="'sfa_' + subField.class" class="form-group mb-2">
              <label v-if="subField.label" class="form-label text-xs">{{ subField.label }}</label>
              <ManuscriptPointPicker v-if="isChapterField(subField)" :model-value="null" :disabled="true" />
              <XboxWheel 
                v-else-if="subField.type === 'select'" 
                :options="getSelectOptions(subField)" 
                :placeholder="subField.placeholder || 'Выберите...'" 
                :disabled="isEntityOrChapterSelect(subField)" 
                :class="{ 'pointer-events-none': isEntityOrChapterSelect(subField) }"
              />
              <textarea v-else-if="subField.type === 'textarea'" class="input-base text-xs pointer-events-none" :rows="subField.rows || 2" :placeholder="subField.placeholder || ''" tabindex="-1" readonly></textarea>
              <input v-else type="text" class="input-base text-xs pointer-events-none" :placeholder="subField.placeholder || ''" value="" tabindex="-1" readonly />
            </div>
          </div>
        </div>
      </div>

      <!-- СТОРОНА Б -->
      <div class="mock-rel-side mock-side-right">
        <div class="mock-side-header mock-side-header-b">🔵 СТОРОНА Б (Зеркало)</div>
        <div v-for="field in example.fields" :key="'fb_' + (field.class || field.id)" class="form-group mb-2">
          <label v-if="field.label" class="form-label form-label-b text-xs">{{ field.label }}</label>
          <ManuscriptPointPicker v-if="isChapterField(field)" :model-value="null" :disabled="true" />
          <XboxWheel 
            v-else-if="field.type === 'select'" 
            :options="getSelectOptions(field)" 
            :placeholder="field.placeholder || 'Выберите...'" 
            :disabled="isEntityOrChapterSelect(field)" 
            :class="{ 'pointer-events-none': isEntityOrChapterSelect(field) }"
          />
          <textarea 
            v-else-if="field.type === 'textarea'" 
            class="input-base text-xs pointer-events-none" 
            :rows="field.rows || 2" 
            :placeholder="field.placeholder || ''" 
            tabindex="-1"
            readonly
          ></textarea>
          <input 
            v-else 
            type="text" 
            class="input-base text-xs pointer-events-none" 
            :placeholder="field.placeholder || ''" 
            value="" 
            tabindex="-1" 
            readonly 
          />
          <div v-if="field.hint" class="form-hint text-micro text-muted">{{ field.hint }}</div>
        </div>

        <!-- Вложенные таймлайн-контейнеры Стороны Б -->
        <div v-for="sub in (example.dynamicContainers || [])" :key="'sub_b_' + sub.id" class="sub-container-wrap mt-2 p-2">
          <div class="flex justify-between items-center mb-1">
            <span class="text-micro font-bold text-muted">⏱️ {{ sub.title }}</span>
          </div>
          <div class="nested-item card-secondary p-2 mb-1">
            <div v-for="subField in (sub.fields || [])" :key="'sfb_' + subField.class" class="form-group mb-2">
              <label v-if="subField.label" class="form-label text-xs">{{ subField.label }}</label>
              <ManuscriptPointPicker v-if="isChapterField(subField)" :model-value="null" :disabled="true" />
              <XboxWheel 
                v-else-if="subField.type === 'select'" 
                :options="getSelectOptions(subField)" 
                :placeholder="subField.placeholder || 'Выберите...'" 
                :disabled="isEntityOrChapterSelect(subField)" 
                :class="{ 'pointer-events-none': isEntityOrChapterSelect(subField) }"
              />
              <textarea v-else-if="subField.type === 'textarea'" class="input-base text-xs pointer-events-none" :rows="subField.rows || 2" :placeholder="subField.placeholder || ''" tabindex="-1" readonly></textarea>
              <input v-else type="text" class="input-base text-xs pointer-events-none" :placeholder="subField.placeholder || ''" value="" tabindex="-1" readonly />
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ModuleHelpBidiCardProps } from './ModuleHelpBidiCard.model';
import { XboxWheel } from '@worldwiki/components';
import { ManuscriptPointPicker } from '@/shared/ui';

defineProps<ModuleHelpBidiCardProps>();
</script>
