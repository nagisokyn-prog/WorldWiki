<template>
  <div class="schema-field-editor" :style="{ opacity: item.hidden ? 0.4 : 1 }">
    <div class="schema-field-header" :style="{ cursor: isFirst ? 'default' : 'move' }">
      <div class="flex items-center gap-2 flex-1">
        <span v-if="!isFirst" class="schema-drag-dots">⠿</span>
        <span v-else class="text-accent" style="opacity: 0.5;">🔒</span>
        
        <input :value="item.label" class="form-label schema-field-title-input" placeholder="НАЗВАНИЕ ПОЛЯ" :disabled="isFirst" @input="updateLabel(($event.target as HTMLInputElement).value)" />
      </div>
      
      <div v-if="!isFirst" class="flex items-center gap-2">
        <button
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
          <div v-if="item.type === 'tags'" class="glass-pill" style="opacity: 0.3; border-style: dashed;">+ ТЕГ</div>
       </div>

       <!-- 3D WHEEL SELECT -->
       <XboxWheel v-else-if="item.type === 'select'" :model-value="''" :options="item.options || []" :placeholder="item.placeholder || 'Выберите...'" />

       <!-- 3D WHEEL DATE -->
       <div v-else-if="item.type === 'calendar_date' || item.type === 'calendar_datetime' || item.type === 'date'" class="flex gap-3 items-end">
          <div class="flex-1"><label class="form-label-micro">ГОД</label><input type="number" class="input-base text-center text-sm" placeholder="2026" /></div>
          <div style="flex: 2;"><label class="form-label-micro">МЕСЯЦ</label><XboxWheel :options="monthsList" /></div>
          <div class="flex-1"><label class="form-label-micro">ДЕНЬ</label><input type="number" class="input-base text-center text-sm" placeholder="1" /></div>
       </div>

       <!-- RANGE -->
       <div v-else-if="item.type === 'range'" class="flex items-center gap-4">
          <input :value="item._val || 0" type="range" :min="Number(item.min) || 0" :max="Number(item.max) || 100" class="flex-1" style="accent-color: var(--accent);" @input="updateVal(Number(($event.target as HTMLInputElement).value))" />
          <div class="range-badge">{{ item._val || (item.value || 0) }}</div>
       </div>

       <!-- PHOTO -->
       <div v-else-if="item.type === 'photo'" class="photo-placeholder-ui">
          <span class="text-2xl">🖼️</span>
          <span class="text-xs font-bold" style="letter-spacing: 2px;">ЗАГРУЗИТЬ ФОТО</span>
       </div>

       <textarea v-else-if="item.type === 'textarea'" class="input-base text-sm" style="min-height: 80px;" :placeholder="item.placeholder || 'Введите текст...'"></textarea>
       <input v-else :value="item._val || ''" class="input-base text-sm p-2" :placeholder="item.placeholder || 'Введите значение...'" :type="item.type === 'number' ? 'number' : 'text'" @input="updateVal(($event.target as HTMLInputElement).value)" />
    </div>

    <!-- SETTINGS AREA -->
    <div class="schema-field-settings">
       <div class="flex gap-4 mb-3">
          <div class="flex-1">
             <label class="form-label-micro">ТИП КИРПИЧА</label>
             <div class="flex gap-1 flex-wrap">
                <button v-for="t in typeOptions" :key="t.val" :class="{ active: item.type === t.val }" class="type-btn-mini" :disabled="isFirst" :style="{ opacity: isFirst && item.type !== t.val ? 0.2 : 1, cursor: isFirst ? 'not-allowed' : 'pointer' }" @click="!isFirst && setType(t.val)">{{ t.icon }} {{ t.label }}</button>
             </div>
          </div>
          <div class="flex-1">
             <label class="form-label-micro">ПОДСКАЗКА (PLACEHOLDER)</label>
             <input :value="item.placeholder" class="input-base text-xs p-2" placeholder="Подсказка..." :disabled="isFirst" @input="updatePlaceholder(($event.target as HTMLInputElement).value)" />
          </div>
       </div>

       <!-- OPTIONS EDITOR (Требование 2) -->
       <div v-if="item.type === 'select' || item.type === 'multiselect'" class="border-t pt-3 mt-3">
          <label class="form-label-micro">ВАРИАНТЫ ВЫБОРА (OPTIONS)</label>
          <div class="multiselect-grid mb-2">
             <div v-for="(opt, oIdx) in (item.options || [])" :key="oIdx" class="option-item-row">
                <input v-model="opt.value" class="input-base text-xs flex-1 font-mono p-1" placeholder="value" />
                <input v-model="opt.label" class="input-base text-xs flex-auto p-1" placeholder="Отображаемый текст" />
                <button class="text-error cursor-pointer text-xs" @click="removeOption(Number(oIdx))">✕</button>
             </div>
          </div>
          <button class="btn-new btn-outline-new text-xs" @click="addOption">+ ДОБАВИТЬ ВАРИАНТ</button>
       </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { XboxWheel } from '@worldwiki/components';
import { useSchemaFieldEditor } from './useSchemaFiledEditor';
import type { SchemaFieldItem } from './useSchemaFiledEditor';

const props = defineProps<{
  item: SchemaFieldItem;
  isFirst: boolean;
}>();

defineEmits<{
  remove: [];
}>();

const {
  typeOptions,
  monthsList,
  updateLabel,
  toggleHidden,
  updateVal,
  setType,
  updatePlaceholder,
  addOption,
  removeOption
} = useSchemaFieldEditor(props);
</script>
