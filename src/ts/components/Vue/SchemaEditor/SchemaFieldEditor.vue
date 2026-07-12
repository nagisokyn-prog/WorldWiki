<template>
  <div class="schema-field-editor" :style="{ opacity: item.hidden ? 0.4 : 1 }">
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;" :style="{ cursor: isFirst ? 'default' : 'move' }">
      <div style="display: flex; align-items: center; gap: 10px; flex: 1;">
        <span v-if="!isFirst" style="opacity: 0.2; font-size: 14px;">⠿</span>
        <span v-else style="opacity: 0.5; font-size: 14px; color: var(--accent);">🔒</span>
        
        <input v-model="item.label" class="form-label" style="margin: 0; background: transparent; border: none; font-size: 11px; font-weight: 900; color: var(--text-main); text-transform: uppercase; letter-spacing: 1px; width: 100%;" placeholder="НАЗВАНИЕ ПОЛЯ" :disabled="isFirst">
      </div>
      
      <div style="display: flex; gap: 8px; align-items: center;" v-if="!isFirst">
        <button style="background: none; border: none; cursor: pointer; font-size: 12px;" 
                @click="item.hidden = !item.hidden"
                :title="item.hidden ? 'Показать поле' : 'Скрыть поле'">
          {{ item.hidden ? '👁️‍🗨️' : '👁️' }}
        </button>
        <button style="color: #f55; background: none; border: none; font-size: 10px; cursor: pointer;" 
                @click="$emit('remove')">
          УДАЛИТЬ
        </button>
      </div>
    </div>
    
    <!-- PREVIEW AREA -->
    <div style="margin-bottom: 16px; padding: 16px; background: rgba(255,255,255,0.02); border-radius: 12px; border: 1px solid var(--bg-input); pointer-events: none;">
       <div v-if="item.type === 'select'" style="display: flex; align-items: center; gap: 10px;">
          <span style="font-size: 20px;">🔽</span>
          <div style="font-size: 12px; opacity: 0.7;">{{ item.placeholder || 'Выберите...' }}</div>
       </div>
       <div v-else-if="item.type === 'multiselect' || item.type === 'tags'" style="display: flex; gap: 8px;">
          <div v-for="opt in (item.options || [{label: 'Опция 1'}])" :key="opt.value" class="glass-pill" style="padding: 4px 10px; font-size: 10px;">{{ opt.label }}</div>
       </div>
       <textarea v-else-if="item.type === 'textarea'" class="input-base" style="min-height: 40px; font-size: 12px;" :placeholder="item.placeholder || 'Введите текст...'"></textarea>
       <input v-else class="input-base" style="font-size: 12px; padding: 8px;" :placeholder="item.placeholder || 'Введите значение...'">
    </div>

    <!-- SETTINGS AREA -->
    <div style="padding: 16px; background: var(--bg-input); border-radius: 12px;">
       <div style="display: flex; gap: 20px; margin-bottom: 12px;">
          <div style="flex: 1;">
             <label class="form-label-micro">ПОДСКАЗКА (PLACEHOLDER)</label>
             <input v-model="item.placeholder" class="input-base" style="font-size: 11px; padding: 8px;" placeholder="Подсказка..." :disabled="isFirst">
          </div>
       </div>

       <!-- OPTIONS EDITOR (Требование 2) -->
       <div v-if="item.type === 'select' || item.type === 'multiselect'" style="border-top: 1px solid var(--border-color); padding-top: 12px; margin-top: 12px;">
          <label class="form-label-micro">ВАРИАНТЫ ВЫБОРА (OPTIONS)</label>
          <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 8px; margin-bottom: 8px;">
             <div v-for="(opt, oIdx) in (item.options || [])" :key="oIdx" style="display: flex; gap: 6px; align-items: center; background: rgba(0,0,0,0.2); padding: 4px 8px; border-radius: 8px;">
                <input v-model="opt.value" class="input-base" style="font-size: 10px; padding: 4px; flex: 1; font-family: monospace;" placeholder="value">
                <input v-model="opt.label" class="input-base" style="font-size: 10px; padding: 4px; flex: 2;" placeholder="Отображаемый текст">
                <button style="color: #f55; background: none; border: none; font-size: 12px; cursor: pointer;" @click="removeOption(Number(oIdx))">✕</button>
             </div>
          </div>
          <button class="btn-new btn-outline-new" style="font-size: 10px; padding: 6px;" @click="addOption">+ ДОБАВИТЬ ВАРИАНТ</button>
       </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  item: any;
  isFirst: boolean;
}>();

const emit = defineEmits(['remove']);

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
