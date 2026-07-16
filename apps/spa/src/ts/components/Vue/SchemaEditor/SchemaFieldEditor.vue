<template>
  <div class="schema-field-editor" :style="{ opacity: item.hidden ? 0.4 : 1 }">
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;" :style="{ cursor: isFirst ? 'default' : 'move' }">
      <div style="display: flex; align-items: center; gap: 10px; flex: 1;">
        <span v-if="!isFirst" style="opacity: 0.2; font-size: 14px;">⠿</span>
        <span v-else style="opacity: 0.5; font-size: 14px; color: var(--accent);">🔒</span>
        
        <input v-model="item.label" class="form-label" style="margin: 0; background: transparent; border: none; font-size: 11px; font-weight: 900; color: var(--text-main); text-transform: uppercase; letter-spacing: 1px; width: 100%;" placeholder="НАЗВАНИЕ ПОЛЯ" :disabled="isFirst" />
      </div>
      
      <div v-if="!isFirst" style="display: flex; gap: 8px; align-items: center;">
        <button
style="background: none; border: none; cursor: pointer; font-size: 12px;" 
                :title="item.hidden ? 'Показать поле' : 'Скрыть поле'"
                @click="item.hidden = !item.hidden">
          {{ item.hidden ? '👁️‍🗨️' : '👁️' }}
        </button>
        <button
style="color: #f55; background: none; border: none; font-size: 10px; cursor: pointer;" 
                @click="$emit('remove')">
          УДАЛИТЬ
        </button>
      </div>
    </div>
    
    <!-- PREVIEW AREA -->
    <div style="margin-bottom: 16px; padding: 16px; background: rgba(255,255,255,0.02); border-radius: 12px; border: 1px solid var(--bg-input);">
       
       <!-- Multiselect / Tags -->
       <div v-if="item.type === 'multiselect' || item.type === 'tags'" class="tags-grid" style="display: flex; flex-wrap: wrap; gap: 8px;">
          <div v-for="(opt, oIdx) in (item.options || [{label: 'Опция 1'}])" :key="oIdx" class="glass-pill interactive-el" style="padding: 6px 14px; font-size: 11px;">{{ opt.label }}</div>
          <div v-if="item.type === 'tags'" class="glass-pill" style="opacity: 0.3; border-style: dashed;">+ ТЕГ</div>
       </div>

       <!-- 3D WHEEL SELECT -->
       <XboxWheel v-else-if="item.type === 'select'" :model-value="''" :options="item.options || []" :placeholder="item.placeholder || 'Выберите...'" />

       <!-- 3D WHEEL DATE -->
       <div v-else-if="item.type === 'calendar_date' || item.type === 'date'" style="display: flex; gap: 12px; align-items: flex-end;">
          <div style="flex: 1;"><label class="form-label-micro">ГОД</label><input type="number" class="input-base" style="text-align: center; font-size: 13px;" placeholder="2026" /></div>
          <div style="flex: 2;"><label class="form-label-micro">МЕСЯЦ</label><XboxWheel :options="monthsList" /></div>
          <div style="flex: 1;"><label class="form-label-micro">ДЕНЬ</label><input type="number" class="input-base" style="text-align: center; font-size: 13px;" placeholder="1" /></div>
       </div>

       <!-- RANGE -->
       <div v-else-if="item.type === 'range'" style="display: flex; align-items: center; gap: 20px;">
          <input v-model.number="item._val" type="range" :min="item.min || 0" :max="item.max || 100" style="flex: 1; accent-color: var(--accent);" />
          <div style="background: var(--accent); color: var(--text-main); padding: 4px 12px; border-radius: 8px; font-family: monospace; font-weight: 900; font-size: 16px; min-width: 60px; text-align: center; box-shadow: 0 0 15px var(--accent-glow);">{{ item._val || (item.value || 0) }}</div>
       </div>

       <!-- PHOTO -->
       <div v-else-if="item.type === 'photo'" class="photo-placeholder-ui" style="height: 140px; background: var(--bg-panel); border: 1px dashed var(--border-color); border-radius: 12px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; color: var(--text-muted);">
          <span style="font-size: 32px;">🖼️</span>
          <span style="font-size: 10px; font-weight: 900; letter-spacing: 2px;">ЗАГРУЗИТЬ ФОТО</span>
       </div>

       <textarea v-else-if="item.type === 'textarea'" class="input-base" style="min-height: 80px; font-size: 13px;" :placeholder="item.placeholder || 'Введите текст...'"></textarea>
       <input v-else v-model="item._val" class="input-base" style="font-size: 13px; padding: 10px;" :placeholder="item.placeholder || 'Введите значение...'" :type="item.type === 'number' ? 'number' : 'text'" />
    </div>

    <!-- SETTINGS AREA -->
    <div style="padding: 16px; background: var(--bg-input); border-radius: 12px;">
       <div style="display: flex; gap: 20px; margin-bottom: 12px;">
          <div style="flex: 1;">
             <label class="form-label-micro">ТИП КИРПИЧА</label>
             <div style="display: flex; gap: 4px; flex-wrap: wrap;">
                <button v-for="t in typeOptions" :key="t.val" :class="{ active: item.type === t.val }" class="type-btn-mini" :disabled="isFirst" :style="{ padding: '4px 8px', fontSize: '10px', opacity: isFirst && item.type !== t.val ? 0.2 : 1, cursor: isFirst ? 'not-allowed' : 'pointer', background: item.type === t.val ? 'var(--accent)' : 'var(--bg-panel)', border: '1px solid ' + (item.type === t.val ? 'var(--accent)' : 'var(--border-color)'), color: 'var(--text-main)', borderRadius: '4px' }" @click="!isFirst && (item.type = t.val)">{{ t.icon }} {{ t.label }}</button>
             </div>
          </div>
          <div style="flex: 1;">
             <label class="form-label-micro">ПОДСКАЗКА (PLACEHOLDER)</label>
             <input v-model="item.placeholder" class="input-base" style="font-size: 11px; padding: 8px;" placeholder="Подсказка..." :disabled="isFirst" />
          </div>
       </div>

       <!-- OPTIONS EDITOR (Требование 2) -->
       <div v-if="item.type === 'select' || item.type === 'multiselect'" style="border-top: 1px solid var(--border-color); padding-top: 12px; margin-top: 12px;">
          <label class="form-label-micro">ВАРИАНТЫ ВЫБОРА (OPTIONS)</label>
          <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 8px; margin-bottom: 8px;">
             <div v-for="(opt, oIdx) in (item.options || [])" :key="oIdx" style="display: flex; gap: 6px; align-items: center; background: rgba(0,0,0,0.2); padding: 4px 8px; border-radius: 8px;">
                <input v-model="opt.value" class="input-base" style="font-size: 10px; padding: 4px; flex: 1; font-family: monospace;" placeholder="value" />
                <input v-model="opt.label" class="input-base" style="font-size: 10px; padding: 4px; flex: 2;" placeholder="Отображаемый текст" />
                <button style="color: #f55; background: none; border: none; font-size: 12px; cursor: pointer;" @click="removeOption(Number(oIdx))">✕</button>
             </div>
          </div>
          <button class="btn-new btn-outline-new" style="font-size: 10px; padding: 6px;" @click="addOption">+ ДОБАВИТЬ ВАРИАНТ</button>
       </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { XboxWheel } from '@worldwiki/components';

const props = defineProps<{
  item: any;
  isFirst: boolean;
}>();

const emit = defineEmits(['remove']);

const typeOptions = [
  { val: 'text', icon: '📝', label: 'Текст' },
  { val: 'textarea', icon: '📄', label: 'Абзац' },
  { val: 'select', icon: '🔽', label: 'Список' },
  { val: 'multiselect', icon: '☑️', label: 'Мульти' },
  { val: 'calendar_date', icon: '📅', label: 'Дата' },
  { val: 'range', icon: '🎚️', label: 'Шкала' },
  { val: 'number', icon: '🔢', label: 'Число' },
  { val: 'tags', icon: '🏷️', label: 'Теги' },
  { val: 'photo', icon: '🖼️', label: 'Фото' }
];

const monthsList = [
  { value: '1', label: 'Январь' },
  { value: '2', label: 'Февраль' },
  { value: '3', label: 'Март' },
  { value: '4', label: 'Апрель' },
  { value: '5', label: 'Май' },
  { value: '6', label: 'Июнь' },
  { value: '7', label: 'Июль' },
  { value: '8', label: 'Август' },
  { value: '9', label: 'Сентябрь' },
  { value: '10', label: 'Октябрь' },
  { value: '11', label: 'Ноябрь' },
  { value: '12', label: 'Декабрь' }
];

const addOption = () => {
  if (!props.item.options) props.item.options = [];
  const val = `opt_${Date.now()}`;
  props.item.options.push({ value: val, label: 'Новый вариант' });
};

const removeOption = (idx: number) => {
  if (props.item.options) {
    props.item.options.splice(idx, 1);
  }
};
</script>
