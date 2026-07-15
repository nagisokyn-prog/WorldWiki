<template>
  <div class="glass-panel schema-container" :style="{ opacity: item.hidden ? 0.4 : 1 }" style="padding: 24px; background: var(--bg-panel); border-radius: 20px; border: 1px solid var(--border-color);">
    <div style="display: flex; justify-content: space-between; align-items: flex-start; cursor: move;">
      <div style="display: flex; align-items: center; gap: 16px;">
        <span style="opacity: 0.2;">⠿</span>
        <span style="font-size: 24px;">{{ isTimeline ? '⏱️' : '📋' }}</span>
        <div style="display: flex; flex-direction: column; gap: 4px; flex: 1;">
          <input v-model="item.title" class="input-base" style="background: transparent; border: none; font-weight: 900; font-size: 18px; color: var(--text-main); padding: 0;" placeholder="НАЗВАНИЕ МОДУЛЯ">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 10px; color: var(--text-muted); opacity: 0.5;">Текст при пустоте:</span>
            <input v-model="item.emptyMessage" class="input-base" style="background: transparent; border: none; border-bottom: 1px dashed rgba(255,255,255,0.2); font-size: 10px; color: var(--text-muted); padding: 0; width: 300px;" placeholder="Пусто...">
          </div>
        </div>
      </div>
      <div style="display: flex; gap: 12px; align-items: flex-start; margin-top: 4px;">
        <button
style="background: none; border: none; cursor: pointer; font-size: 16px;" 
                :title="item.hidden ? 'Показать модуль' : 'Скрыть модуль'"
                @click="item.hidden = !item.hidden">
          {{ item.hidden ? '👁️‍🗨️' : '👁️' }}
        </button>
        <button style="color: #f55; background: none; border: none; font-size: 16px; cursor: pointer;" @click="$emit('remove')">✕</button>
      </div>
    </div>
    
    <!-- BIDIRECTIONAL SPLIT CONFIGURATOR -->
    <template v-if="fullConfig.templates?.[item.template]?.isBidirectional">
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 16px;">
        <!-- СТОРОНА А -->
        <div style="background: rgba(167,139,250,0.04); border: 1px solid rgba(167,139,250,0.2); border-radius: 12px; padding: 14px;">
          <div style="font-size: 10px; font-weight: 900; color: #a78bfa; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 12px; border-bottom: 1px solid rgba(167,139,250,0.15); padding-bottom: 8px;">🟣 СТОРОНА А (эта сущность)</div>
          <div v-for="(bField, fIdx) in getRawTemplateFields(item.template)" :key="'la-'+fIdx" style="margin-bottom: 14px;" :style="{ opacity: getFieldOverride(item, bField.class).hidden ? 0.3 : 1 }">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
              <label class="form-label-micro" style="color: #a78bfa;">{{ getFieldOverride(item, bField.class).label || bField.label || bField.class }}</label>
              <button style="background:none;border:none;cursor:pointer;font-size:9px;color:var(--text-muted);opacity:0.7;" @click="toggleFieldOverride(item, bField.class)">{{ getFieldOverride(item, bField.class).hidden ? '👁️‍🗨️ скрыто' : '👁️ видимо' }}</button>
            </div>
            <XboxWheel v-if="(getFieldOverride(item, bField.class).type || bField.type) === 'select'" :model-value="''" :options="getFieldOverride(item, bField.class).options || bField.options || []" :placeholder="getFieldOverride(item, bField.class).placeholder || bField.placeholder || '...'" />
            <input v-else class="input-base" style="font-size:12px;pointer-events:none;" :placeholder="getFieldOverride(item, bField.class).placeholder || bField.placeholder || '...'">
            <div style="margin-top:6px;padding:8px;background:rgba(0,0,0,0.3);border-radius:6px;border:1px solid rgba(255,255,255,0.04);">
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:6px;">
                <div><label class="form-label-micro">Название</label><input v-model="ensureFieldOverride(item, bField.class).label" class="input-base" style="font-size:10px;padding:4px;" :placeholder="bField.label || bField.class"></div>
                <div><label class="form-label-micro">Подсказка</label><input v-model="ensureFieldOverride(item, bField.class).placeholder" class="input-base" style="font-size:10px;padding:4px;" :placeholder="bField.placeholder || '...'"></div>
              </div>
              <template v-if="bField.entityType !== undefined">
                <label class="form-label-micro">ТИП СУЩНОСТИ А</label>
                <select v-model="ensureFieldOverride(item, bField.class).entityType" class="input-base" style="font-size:10px;padding:4px;width:100%;">
                  <option value="">— любая —</option>
                  <option v-for="t in availableEntityTypes" :key="t.value" :value="t.value">{{ t.label }}</option>
                </select>
              </template>
              <template v-else-if="(getFieldOverride(item, bField.class).type || bField.type) === 'select'">
                <label class="form-label-micro">Варианты</label>
                <div style="display:flex;flex-direction:column;gap:4px;margin-top:4px;">
                  <div v-for="(opt, oIdx) in (ensureFieldOverride(item, bField.class).options || [])" :key="oIdx" style="display:flex;gap:4px;align-items:center;">
                    <input v-model="opt.value" class="input-base" style="font-size:10px;padding:3px;flex:1;font-family:monospace;" placeholder="value">
                    <input v-model="opt.label" class="input-base" style="font-size:10px;padding:3px;flex:2;" placeholder="Label">
                    <button style="color:#f55;background:none;border:none;font-size:11px;" @click="ensureFieldOverride(item, bField.class).options.splice(Number(oIdx),1)">✕</button>
                  </div>
                  <button class="btn-new btn-outline-new" style="font-size:9px;padding:4px;" @click="addFieldOption(item, bField.class)">+ вариант</button>
                </div>
              </template>
            </div>
          </div>
          <!-- dynamicContainers LEFT -->
          <div v-for="subConf in (fullConfig.templates?.[item.template]?.dynamicContainers || [])" :key="'ldc-'+subConf.id" style="margin-top:12px;border:1px solid rgba(167,139,250,0.25);border-radius:8px;overflow:hidden;">
            <div style="background:rgba(167,139,250,0.12);padding:8px 12px;font-size:10px;font-weight:900;color:#a78bfa;letter-spacing:0.5px;text-transform:uppercase;">⏱️ {{ subConf.title }}</div>
            <div style="padding:10px;display:flex;flex-direction:column;gap:8px;">
              <div v-for="(nField, nIdx) in (subConf.fields || [])" :key="'lnf-'+nIdx" style="padding:8px;background:rgba(0,0,0,0.2);border-radius:6px;">
                <label class="form-label-micro" style="color:rgba(167,139,250,0.8);margin-bottom:4px;">{{ nField.label || nField.class }}</label>
                <XboxWheel v-if="nField.type === 'select'" :model-value="''" :options="nField.options || []" :placeholder="nField.placeholder || '...'" />
                <input v-else class="input-base" style="font-size:11px;pointer-events:none;" :placeholder="nField.placeholder || '...'">
              </div>
              <div style="text-align:center;padding:8px;opacity:0.25;font-size:10px;border:1px dashed rgba(167,139,250,0.2);border-radius:6px;">{{ subConf.emptyMessage || 'Пусто' }}</div>
            </div>
          </div>
        </div>
        <!-- СТОРОНА Б -->
        <div style="background:rgba(96,165,250,0.04);border:1px solid rgba(96,165,250,0.2);border-radius:12px;padding:14px;">
          <div style="font-size:10px;font-weight:900;color:#60a5fa;letter-spacing:1px;text-transform:uppercase;margin-bottom:12px;border-bottom:1px solid rgba(96,165,250,0.15);padding-bottom:8px;">🔵 СТОРОНА Б (связанная сущность)</div>
          <div v-for="(bField, fIdx) in getRawTemplateFields(item.template)" :key="'rb-'+fIdx" style="margin-bottom:14px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
              <label class="form-label-micro" style="color:#60a5fa;">{{ bField.label || bField.class }}</label>
              <span style="font-size:9px;color:var(--text-muted);opacity:0.4;">зеркало</span>
            </div>
            <XboxWheel v-if="bField.type === 'select'" :model-value="''" :options="bField.options || []" :placeholder="bField.placeholder || '...'" :disabled="true" />
            <input v-else class="input-base" style="font-size:12px;pointer-events:none;opacity:0.5;" :placeholder="bField.placeholder || '...'">
            <template v-if="bField.entityType !== undefined">
              <div style="margin-top:6px;padding:8px;background:rgba(0,0,0,0.3);border-radius:6px;border:1px solid rgba(96,165,250,0.08);">
                <label class="form-label-micro">ТИП СУЩНОСТИ Б</label>
                <select v-model="ensureFieldOverride(item, bField.class + '__b').entityType" class="input-base" style="font-size:10px;padding:4px;width:100%;">
                  <option value="">— любая —</option>
                  <option v-for="t in availableEntityTypes" :key="t.value" :value="t.value">{{ t.label }}</option>
                </select>
              </div>
            </template>
          </div>
          <!-- dynamicContainers RIGHT mirror -->
          <div v-for="subConf in (fullConfig.templates?.[item.template]?.dynamicContainers || [])" :key="'rdc-'+subConf.id" style="margin-top:12px;border:1px solid rgba(96,165,250,0.25);border-radius:8px;overflow:hidden;">
            <div style="background:rgba(96,165,250,0.12);padding:8px 12px;font-size:10px;font-weight:900;color:#60a5fa;letter-spacing:0.5px;text-transform:uppercase;">⏱️ {{ subConf.title }}</div>
            <div style="padding:10px;display:flex;flex-direction:column;gap:8px;">
              <div v-for="(nField, nIdx) in (subConf.fields || [])" :key="'rnf-'+nIdx" style="padding:8px;background:rgba(0,0,0,0.2);border-radius:6px;">
                <label class="form-label-micro" style="color:rgba(96,165,250,0.8);margin-bottom:4px;">{{ nField.label || nField.class }}</label>
                <XboxWheel v-if="nField.type === 'select'" :model-value="''" :options="nField.options || []" :placeholder="nField.placeholder || '...'" :disabled="true" />
                <input v-else class="input-base" style="font-size:11px;pointer-events:none;opacity:0.5;" :placeholder="nField.placeholder || '...'">
              </div>
              <div style="text-align:center;padding:8px;opacity:0.25;font-size:10px;border:1px dashed rgba(96,165,250,0.2);border-radius:6px;">{{ subConf.emptyMessage || 'Пусто' }}</div>
            </div>
          </div>
        </div>
      </div>
    </template>
    <template v-else>
      <!-- NON-BIDIRECTIONAL UNIFIED MODULE CONFIGURATOR -->
      <div class="glass-grid-2" style="gap: 20px; padding: 16px; background: rgba(255,255,255,0.02); border-radius: 12px; border: 1px solid var(--border-color); margin-top: 16px;">
        <div v-for="(bField, fIdx) in getRawTemplateFields(item.template)" :key="fIdx" :style="{ opacity: getFieldOverride(item, bField.class).hidden ? 0.3 : 1 }">
          
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <label class="form-label-micro" style="color: var(--accent); opacity: 0.8;">{{ getFieldOverride(item, bField.class).label || bField.label || bField.class }}</label>
            <button style="background: none; border: none; cursor: pointer; font-size: 10px; opacity: 0.8;" @click="toggleFieldOverride(item, bField.class)">
              {{ getFieldOverride(item, bField.class).hidden ? 'Скрыто 👁️‍🗨️' : 'Видимо 👁️' }}
            </button>
          </div>

          <XboxWheel v-if="(getFieldOverride(item, bField.class).type || bField.type) === 'select'" :model-value="''" :options="getFieldOverride(item, bField.class).options || bField.options || []" :placeholder="getFieldOverride(item, bField.class).placeholder || bField.placeholder || '...'" />
          <input v-else class="input-base" style="font-size: 12px; pointer-events: none;" :placeholder="getFieldOverride(item, bField.class).placeholder || bField.placeholder || '...'">

          <!-- INLINE SETTINGS -->
          <div style="margin-top: 8px; padding: 12px; background: rgba(0,0,0,0.3); border-radius: 8px; border: 1px solid rgba(255,255,255,0.05);">
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
              <div>
                <label class="form-label-micro">Название (Label)</label>
                <input v-model="ensureFieldOverride(item, bField.class).label" class="input-base" style="font-size: 10px; padding: 4px;" :placeholder="bField.label || bField.class">
              </div>
              <div>
                <label class="form-label-micro">Подсказка</label>
                <input v-model="ensureFieldOverride(item, bField.class).placeholder" class="input-base" style="font-size: 10px; padding: 4px;" :placeholder="bField.placeholder || '...'">
              </div>
            </div>
            
            <div style="margin-top: 8px;">
              <label class="form-label-micro">Переопределить тип</label>
              <XboxWheel :model-value="ensureFieldOverride(item, bField.class).type || ''" :options="[{ value: '', label: '(Как в базе: ' + bField.type + ')' }, ...atomicBricks]" @update:model-value="val => ensureFieldOverride(item, bField.class).type = val" />
            </div>
            
            <div v-if="(ensureFieldOverride(item, bField.class).type || bField.type) === 'select' || (ensureFieldOverride(item, bField.class).type || bField.type) === 'multiselect'" style="margin-top: 8px; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 8px;">
              <label class="form-label-micro">Варианты (Options)</label>
              <div style="display: flex; flex-direction: column; gap: 6px; margin-top: 4px;">
                <div v-for="(opt, oIdx) in (ensureFieldOverride(item, bField.class).options || [])" :key="oIdx" style="display: flex; gap: 6px; align-items: center;">
                  <input v-model="opt.value" class="input-base" style="font-size: 10px; padding: 4px; flex: 1; font-family: monospace;" placeholder="value">
                  <input v-model="opt.label" class="input-base" style="font-size: 10px; padding: 4px; flex: 2;" placeholder="Label">
                  <button style="color: #f55; background: none; border: none; font-size: 12px;" @click="ensureFieldOverride(item, bField.class).options.splice(Number(oIdx), 1)">✕</button>
                </div>
                <button class="btn-new btn-outline-new" style="font-size: 10px; padding: 6px;" @click="addFieldOption(item, bField.class)">+ ДОБАВИТЬ ВАРИАНТ</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import uiEditorData from '../../../../struct/editor/ui_editor.json';
import { XboxWheel } from '@worldwiki/components';

const props = defineProps<{
  item: any;
}>();

const emit = defineEmits<{
  remove: [];
}>();

const fullConfig = ref<any>(uiEditorData);

const availableEntityTypes = computed(() => {
  const rawSchemas = (import.meta as any).glob('../../../../struct/editor/*.json', { eager: true });
  const types = [];
  for (const path in rawSchemas) {
    if (path.includes('ui_editor')) continue;
    const data = (rawSchemas[path] as any).default || rawSchemas[path];
    if (data && data.name) {
      types.push({ value: data.entityType || data.name, label: data.name });
    }
  }
  return types;
});

const atomicBricks = [
  { value: 'text', label: 'Текст' },
  { value: 'textarea', label: 'Абзац' },
  { value: 'select', label: 'Список' },
  { value: 'multiselect', label: 'Мульти' },
  { value: 'calendar_date', label: 'Дата' },
  { value: 'range', label: 'Шкала' },
  { value: 'number', label: 'Число' },
  { value: 'tags', label: 'Теги' },
  { value: 'photo', label: 'Фото' }
];

const getRawTemplateFields = (templateName: string) => {
  return fullConfig.value.templates?.[templateName]?.fields || [];
};

const ensureFieldOverride = (item: any, fieldClass: string) => {
  if (!item.fieldOverrides) item.fieldOverrides = {};
  if (!item.fieldOverrides[fieldClass]) {
    item.fieldOverrides[fieldClass] = {};
  }
  return item.fieldOverrides[fieldClass];
};

const getFieldOverride = (item: any, fieldClass: string) => {
  return item.fieldOverrides?.[fieldClass] || {};
};

const toggleFieldOverride = (item: any, fieldClass: string) => {
  const override = ensureFieldOverride(item, fieldClass);
  override.hidden = !override.hidden;
};

const addFieldOption = (item: any, fieldClass: string) => {
  const override = ensureFieldOverride(item, fieldClass);
  if (!override.options) override.options = [];
  override.options.push({ value: 'new_val', label: 'Новый вариант' });
};

const isTimeline = computed(() => {
  return props.item.template && (props.item.template.includes('timeline') || props.item.template.includes('events'));
});
</script>

<style scoped>
.schema-container {
  transition: all 0.2s ease;
}
</style>
