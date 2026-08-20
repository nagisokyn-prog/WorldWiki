<template>
  <div class="schema-container schema-container-card card-panel" :style="{ opacity: item.hidden ? 0.4 : 1 }">
    <div class="schema-header-row">
      <div class="schema-title-group">
        <span class="schema-drag-dots">⠿</span>
        <span class="schema-icon">{{ isTimeline ? '⏱️' : '📋' }}</span>
        <div class="flex-col gap-1 flex-1">
          <input :value="item.title" class="input-base schema-title-input" placeholder="НАЗВАНИЕ МОДУЛЯ" @input="updateTitle(($event.target as HTMLInputElement).value)">
          <div class="flex items-center gap-2">
            <span class="text-xs text-muted" style="opacity: 0.5;">Текст при пустоте:</span>
            <input :value="item.emptyMessage" class="input-base schema-empty-msg-input" placeholder="Пусто..." @input="updateEmptyMessage(($event.target as HTMLInputElement).value)">
          </div>
        </div>
      </div>
      <div class="schema-header-actions">
        <button
          class="schema-btn-icon"
          :title="item.hidden ? 'Показать модуль' : 'Скрыть модуль'"
          @click="toggleHidden">
          {{ item.hidden ? '👁️‍🗨️' : '👁️' }}
        </button>
        <button class="schema-btn-delete" @click="$emit('remove')">✕</button>
      </div>
    </div>
    
    <!-- BIDIRECTIONAL SPLIT CONFIGURATOR -->
    <template v-if="item.template && fullConfig.templates?.[item.template]?.isBidirectional">
      <div class="bidirectional-grid">
        <!-- СТОРОНА А -->
        <div class="side-panel-a">
          <div class="side-header-a">🟣 СТОРОНА А (эта сущность)</div>
          <div v-for="(bField, fIdx) in getRawTemplateFields(item.template)" :key="'la-'+fIdx" class="mb-3" :style="{ opacity: getFieldOverride(item, bField.class).hidden ? 0.3 : 1 }">
            <div class="flex justify-between items-center mb-1">
              <label class="form-label-micro text-accent-light">{{ getFieldOverride(item, bField.class).label || bField.label || bField.class }}</label>
              <button class="text-xs text-muted cursor-pointer" @click="toggleFieldOverride(item, bField.class)">{{ getFieldOverride(item, bField.class).hidden ? '👁️‍🗨️ скрыто' : '👁️ видимо' }}</button>
            </div>
            <XboxWheel v-if="(getFieldOverride(item, bField.class).type || bField.type) === 'select'" :model-value="''" :options="getFieldOverride(item, bField.class).options || bField.options || []" :placeholder="getFieldOverride(item, bField.class).placeholder || bField.placeholder || '...'" />
            <input v-else class="input-base text-sm pointer-events-none" :placeholder="getFieldOverride(item, bField.class).placeholder || bField.placeholder || '...'">
            <div class="side-override-box">
              <div class="flex gap-2 mb-1">
                <div class="flex-1"><label class="form-label-micro">Название</label><input v-model="ensureFieldOverride(item, bField.class).label" class="input-base text-xs" :placeholder="bField.label || bField.class"></div>
                <div class="flex-1"><label class="form-label-micro">Подсказка</label><input v-model="ensureFieldOverride(item, bField.class).placeholder" class="input-base text-xs" :placeholder="bField.placeholder || '...'"></div>
              </div>
              <template v-if="bField.entityType !== undefined">
                <label class="form-label-micro">ТИП СУЩНОСТИ А</label>
                <select v-model="ensureFieldOverride(item, bField.class).entityType" class="input-base text-xs w-full">
                  <option value="">— любая —</option>
                  <option v-for="t in availableEntityTypes" :key="t.value" :value="t.value">{{ t.label }}</option>
                </select>
              </template>
              <template v-else-if="(getFieldOverride(item, bField.class).type || bField.type) === 'select'">
                <label class="form-label-micro">Варианты</label>
                <div class="flex-col gap-1 mt-1">
                  <div v-for="(opt, oIdx) in (ensureFieldOverride(item, bField.class).options || [])" :key="oIdx" class="flex gap-1 items-center">
                    <input v-model="opt.value" class="input-base text-xs flex-1 font-mono" placeholder="value">
                    <input v-model="opt.label" class="input-base text-xs flex-auto" placeholder="Label">
                    <button class="text-error text-xs cursor-pointer" @click="ensureFieldOverride(item, bField.class).options?.splice(Number(oIdx),1)">✕</button>
                  </div>
                  <button class="btn-new btn-outline-new text-xs" @click="addFieldOption(item, bField.class)">+ вариант</button>
                </div>
              </template>
            </div>
          </div>
          <!-- dynamicContainers LEFT -->
          <div v-for="subConf in (item.template ? fullConfig.templates?.[item.template]?.dynamicContainers || [] : [])" :key="'ldc-'+subConf.id" class="side-dynamic-container-a">
            <div class="side-dynamic-header-a">⏱️ {{ subConf.title }}</div>
            <div class="flex-col gap-2 p-2">
              <div v-for="(nField, nIdx) in (subConf.fields || [])" :key="'lnf-'+nIdx" class="card-secondary">
                <label class="form-label-micro text-accent-light mb-1">{{ nField.label || nField.class }}</label>
                <XboxWheel v-if="nField.type === 'select'" :model-value="''" :options="nField.options || []" :placeholder="nField.placeholder || '...'" />
                <input v-else class="input-base text-xs pointer-events-none" :placeholder="nField.placeholder || '...'">
              </div>
              <div class="dynamic-empty-box">{{ subConf.emptyMessage || 'Пусто' }}</div>
            </div>
          </div>
        </div>
        <!-- СТОРОНА Б -->
        <div class="side-panel-b">
          <div class="side-header-b">🔵 СТОРОНА Б (связанная сущность)</div>
          <div v-for="(bField, fIdx) in getRawTemplateFields(item.template)" :key="'rb-'+fIdx" class="mb-3">
            <div class="flex justify-between items-center mb-1">
              <label class="form-label-micro" style="color:#60a5fa;">{{ bField.label || bField.class }}</label>
              <span class="text-xs text-muted" style="opacity:0.4;">зеркало</span>
            </div>
            <XboxWheel v-if="bField.type === 'select'" :model-value="''" :options="bField.options || []" :placeholder="bField.placeholder || '...'" :disabled="true" />
            <input v-else class="input-base text-sm pointer-events-none" style="opacity:0.5;" :placeholder="bField.placeholder || '...'">
            <template v-if="bField.entityType !== undefined">
              <div class="side-override-box">
                <label class="form-label-micro">ТИП СУЩНОСТИ Б</label>
                <select v-model="ensureFieldOverride(item, bField.class + '__b').entityType" class="input-base text-xs w-full">
                  <option value="">— любая —</option>
                  <option v-for="t in availableEntityTypes" :key="t.value" :value="t.value">{{ t.label }}</option>
                </select>
              </div>
            </template>
          </div>
          <!-- dynamicContainers RIGHT mirror -->
          <div v-for="subConf in (item.template ? fullConfig.templates?.[item.template]?.dynamicContainers || [] : [])" :key="'rdc-'+subConf.id" class="side-dynamic-container-b">
            <div class="side-dynamic-header-b">⏱️ {{ subConf.title }}</div>
            <div class="flex-col gap-2 p-2">
              <div v-for="(nField, nIdx) in (subConf.fields || [])" :key="'rnf-'+nIdx" class="card-secondary">
                <label class="form-label-micro mb-1" style="color:rgba(96,165,250,0.8);">{{ nField.label || nField.class }}</label>
                <XboxWheel v-if="nField.type === 'select'" :model-value="''" :options="nField.options || []" :placeholder="nField.placeholder || '...'" :disabled="true" />
                <input v-else class="input-base text-xs pointer-events-none" style="opacity:0.5;" :placeholder="nField.placeholder || '...'">
              </div>
              <div class="dynamic-empty-box">{{ subConf.emptyMessage || 'Пусто' }}</div>
            </div>
          </div>
        </div>
      </div>
    </template>
    <template v-else>
      <!-- NON-BIDIRECTIONAL UNIFIED MODULE CONFIGURATOR -->
      <div class="card-secondary mt-3">
        <div v-for="(bField, fIdx) in getRawTemplateFields(item.template)" :key="fIdx" :style="{ opacity: getFieldOverride(item, bField.class).hidden ? 0.3 : 1 }">
          <div class="flex justify-between items-center mb-2">
            <label class="form-label-micro text-accent">{{ getFieldOverride(item, bField.class).label || bField.label || bField.class }}</label>
            <button class="text-xs cursor-pointer" @click="toggleFieldOverride(item, bField.class)">
              {{ getFieldOverride(item, bField.class).hidden ? 'Скрыто 👁️‍🗨️' : 'Видимо 👁️' }}
            </button>
          </div>

          <XboxWheel v-if="(getFieldOverride(item, bField.class).type || bField.type) === 'select'" :model-value="''" :options="getFieldOverride(item, bField.class).options || bField.options || []" :placeholder="getFieldOverride(item, bField.class).placeholder || bField.placeholder || '...'" />
          <input v-else class="input-base text-sm pointer-events-none" :placeholder="getFieldOverride(item, bField.class).placeholder || bField.placeholder || '...'">

          <!-- INLINE SETTINGS -->
          <div class="side-override-box mt-2">
            <div class="flex gap-2">
              <div class="flex-1">
                <label class="form-label-micro">Название (Label)</label>
                <input v-model="ensureFieldOverride(item, bField.class).label" class="input-base text-xs" :placeholder="bField.label || bField.class">
              </div>
              <div class="flex-1">
                <label class="form-label-micro">Подсказка</label>
                <input v-model="ensureFieldOverride(item, bField.class).placeholder" class="input-base text-xs" :placeholder="bField.placeholder || '...'">
              </div>
            </div>
            
            <div class="mt-2">
              <label class="form-label-micro">Переопределить тип</label>
              <XboxWheel :model-value="String(ensureFieldOverride(item, bField.class).type || '')" :options="[{ value: '', label: '(Как в базе: ' + bField.type + ')' }, ...atomicBricks]" @update:model-value="val => ensureFieldOverride(item, bField.class).type = val" />
            </div>
            
            <div v-if="(ensureFieldOverride(item, bField.class).type || bField.type) === 'select' || (ensureFieldOverride(item, bField.class).type || bField.type) === 'multiselect'" class="mt-2 border-t pt-2">
              <label class="form-label-micro">Варианты (Options)</label>
              <div class="flex-col gap-1 mt-1">
                <div v-for="(opt, oIdx) in (ensureFieldOverride(item, bField.class).options || [])" :key="oIdx" class="flex gap-2 items-center">
                  <input v-model="opt.value" class="input-base text-xs flex-1 font-mono" placeholder="value">
                  <input v-model="opt.label" class="input-base text-xs flex-auto" placeholder="Label">
                  <button class="text-error text-xs cursor-pointer" @click="ensureFieldOverride(item, bField.class).options?.splice(Number(oIdx), 1)">✕</button>
                </div>
                <button class="btn-new btn-outline-new text-xs" @click="addFieldOption(item, bField.class)">+ ДОБАВИТЬ ВАРИАНТ</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- CUSTOM FIELDS -->
    <div v-for="(cField, cIdx) in (item.customFields || [])" :key="'cf_'+cIdx" class="mt-2">
      <div class="flex justify-between items-center mb-2">
        <label class="form-label-micro text-accent">{{ cField.label || 'Новое поле' }} (Кастомное)</label>
        <button class="text-error text-xs cursor-pointer" @click="removeCustomField(Number(cIdx))">
            Удалить ✕
        </button>
      </div>

      <XboxWheel v-if="cField.type === 'select'" :model-value="''" :options="cField.options || []" :placeholder="cField.placeholder || '...'" />
      <input v-else class="input-base text-sm pointer-events-none" :placeholder="cField.placeholder || '...'">

      <!-- INLINE SETTINGS -->
      <div class="side-override-box mt-2">
        <div class="flex gap-2">
          <div class="flex-1">
            <label class="form-label-micro">Название (Label)</label>
            <input v-model="cField.label" class="input-base text-xs" placeholder="Название поля">
          </div>
          <div class="flex-1">
            <label class="form-label-micro">Тип</label>
            <XboxWheel :model-value="cField.type || ''" :options="atomicBricks" @update:model-value="(val: any) => cField.type = val" />
          </div>
        </div>
        
        <div v-if="cField.type === 'select' || cField.type === 'multiselect'" class="mt-2 border-t pt-2">
            <template v-if="item.template && fullConfig.templates?.[item.template]?.isBidirectional">
              <div class="flex gap-2 justify-between">
                  <div class="flex-1">
                    <label class="form-label-micro">ИСТОЧНИК (SOURCE)</label>
                    <select v-model="cField.sourceType" class="input-base text-xs w-full">
                      <option v-for="t in availableEntityTypes" :key="t.value" :value="t.value">{{ t.label }}</option>
                    </select>
                  </div>
                  <div class="flex-1">
                    <label class="form-label-micro">ЦЕЛЬ (TARGET)</label>
                    <select v-model="cField.targetType" class="input-base text-xs w-full">
                      <option v-for="t in availableEntityTypes" :key="t.value" :value="t.value">{{ t.label }}</option>
                    </select>
                  </div>
              </div>
            </template>
            <template v-else>
              <label class="form-label-micro">Варианты (Options)</label>
              <div class="flex-col gap-1 mt-1">
                  <div v-for="(opt, oIdx) in (cField.options || [])" :key="oIdx" class="flex gap-2 items-center">
                    <input v-model="opt.value" class="input-base text-xs flex-1 font-mono" placeholder="value" />
                    <input v-model="opt.label" class="input-base text-xs flex-auto" placeholder="Label" />
                    <button class="text-error text-xs cursor-pointer" @click="cField.options?.splice(Number(oIdx), 1)">✕</button>
                  </div>
                  <button class="btn-new btn-outline-new text-xs" @click="() => { if(!cField.options) cField.options=[]; cField.options.push({label:'', value:''}) }">+ ДОБАВИТЬ ВАРИАНТ</button>
              </div>
            </template>
        </div>
      </div>
    </div>

    <!-- DROP ZONE FOR CUSTOM FIELDS -->
    <div
      v-if="['dynamic', 'timeline'].includes(String(item.type))"
      class="dynamic-empty-box cursor-pointer mt-3 p-4"
      :style="{ borderColor: isDraggedOver ? 'var(--accent)' : 'rgba(255,165,0,0.3)', background: isDraggedOver ? 'rgba(255,165,0,0.1)' : 'rgba(255,165,0,0.05)' }"
      @dragenter.prevent="isDraggedOver = true"
      @dragover.prevent="isDraggedOver = true"
      @dragleave="isDraggedOver = false"
      @drop.stop="isDraggedOver = false; $emit('drop-custom')">
      <div class="text-sm font-bold" style="color: rgba(255,165,0,0.8);">🎯 СЮДА КИДАЙ ПОЛЯ</div>
      <div class="text-xs text-muted mt-1">Захвати поле из левой панели</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { XboxWheel } from '@worldwiki/components';
import { useSchemaContainer } from './useSchemaContainer';
import type { SchemaContainerItem } from './useSchemaContainer';

const props = defineProps<{
  item: SchemaContainerItem;
}>();

defineEmits<{
  remove: [];
  'drop-custom': [];
}>();

const {
  isDraggedOver,
  fullConfig,
  availableEntityTypes,
  atomicBricks,
  getRawTemplateFields,
  ensureFieldOverride,
  getFieldOverride,
  toggleFieldOverride,
  addFieldOption,
  isTimeline,
  updateTitle,
  updateEmptyMessage,
  toggleHidden,
  removeCustomField
} = useSchemaContainer(props);
</script>

<style scoped src="@worldwiki/resources/styles/features/schemas/SchemaContainer.css"></style>
