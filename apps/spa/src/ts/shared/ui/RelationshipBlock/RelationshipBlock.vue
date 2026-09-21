<template>
  <div class="rel-block glass-panel" :class="linkClass">
    
    <div class="rel-header">
      <div class="flex items-center gap-3">
        <span class="text-xl">🔗</span>
        <div class="flex-col">
          <strong class="text-main text-sm">{{ templateConf.headerTitle || 'Связь' }}</strong>
          <span class="text-xs text-muted text-muted-70">
            с сущностью типа «{{ templateConf.foreign_type || (templateConf.fields?.find((f) => f.class === linkClass)?.entityType) || '?' }}»
          </span>
        </div>
      </div>
      <button class="btn-icon danger interactive-el" title="Удалить связь" @click="$emit('remove')">
        <i class="fas fa-trash-alt"></i>
      </button>
    </div>

    <!-- BIDIRECTIONAL SPLIT -->
    <div class="rel-split">
      
      <!-- СТОРОНА А -->
      <div class="rel-side rel-side-left">
        <div class="rel-side-header">
          🟣 СТОРОНА А ({{ myLabel }})
        </div>

        <div v-for="cf in templateConf.fields || []" :key="'a-' + cf.class" class="mb-3">
          <div class="field-label-row">
            <label class="form-label-micro text-accent">{{ cf.label || formatLabel(cf.class || '') }}</label>
          </div>
          
          <template v-if="cf.class === linkClass">
            <XboxWheel 
              :model-value="String(item[cf.class] || '').replace(/^entities:/, '')"
              :options="getOptions(cf).map((o: { value?: unknown; label?: string }) => ({ value: String(o.value || '').replace(/^entities:/, ''), label: o.label || String(o.value || '') }))"
              placeholder="-- Выберите сущность --"
              @update:model-value="(val: unknown) => updateItemField(cf.class, val)"
            />
          </template>
          <template v-else>
            <XboxWheel 
              v-if="cf.type === 'select'" 
              :model-value="(item[cf.class] as string | number) || ''"
              :options="(cf.options || []).map((o: { value?: unknown; label?: string }) => ({ value: String(o.value || ''), label: o.label || String(o.value || '') }))"
              placeholder="-- Не указано --"
              @update:model-value="(val: unknown) => updateItemField(cf.class, val)"
            />
            <textarea v-else-if="cf.type === 'textarea'" :value="(item[cf.class] as string) || ''" class="input-base interactive-el w-full" rows="2" :placeholder="cf.placeholder || ''" @input="(e) => updateItemField(cf.class, getInputValue(e))"></textarea>
            <input v-else-if="cf.type === 'number' || cf.type === 'range'" :value="(item[cf.class] as number) || 0" :type="cf.type" class="input-base interactive-el w-full" :placeholder="cf.placeholder || ''" @input="(e) => updateItemField(cf.class, getInputNumber(e))">
            <input v-else :value="(item[cf.class] as string) || ''" type="text" class="input-base interactive-el w-full" :placeholder="cf.placeholder || ''" @input="(e) => updateItemField(cf.class, getInputValue(e))">
          </template>
        </div>

        <!-- Dynamic Containers A -->
        <div v-for="subConf in templateConf.dynamicContainers || []" :key="'adc-' + (subConf.id || '')" class="sub-container-wrap">
          <div class="sub-header">
            <span>⏱️ {{ subConf.title }}</span>
          </div>
          <div v-auto-animate class="p-2 flex-col gap-2">
            <div v-for="(nItem, nIdx) in getNestedList(item, subConf)" :key="nIdx" class="nested-item card-secondary relative">
              <button class="btn-icon danger interactive-el absolute nested-remove-btn" title="Удалить" @click="removeNestedItem(nIdx, item, subConf)">
                <i class="fas fa-times"></i>
              </button>
              
              <div v-for="nField in getDynamicContainerFields(subConf)" :key="nField.class" class="nested-field-group">
                <template v-if="nField.class === 'начальная_глава' || nField.class === 'конечная_глава'">
                  <ManuscriptPointPicker
                    :model-value="(nItem[nField.class] as any)"
                    :label="nField.label || formatLabel(nField.class || '')"
                    :allow-auto-extend="nField.class === 'конечная_глава'"
                    :project="props.project"
                    @update:model-value="(val) => { nItem[nField.class] = val; notifyNestedItemUpdate(subConf.dataPath || subConf.id); }"
                  />
                </template>
                <template v-else>
                  <label class="nested-field-label">{{ nField.label || formatLabel(nField.class || '') }}</label>
                  <XboxWheel 
                    v-if="nField.type === 'select'" 
                    :model-value="(nItem[nField.class] as string | number) || ''" 
                    :options="getOptions(nField).map((o: { value?: unknown; label?: string }) => ({ value: String(o.value || ''), label: o.label || String(o.value || '') }))" 
                    placeholder="-- Не указано --" 
                    @update:model-value="(val: unknown) => { nItem[nField.class] = val; notifyNestedItemUpdate(subConf.dataPath || subConf.id); }" 
                  />
                  <textarea v-else-if="nField.type === 'textarea'" :value="(nItem[nField.class] as string) || ''" class="input-base interactive-el w-full" rows="2" :placeholder="nField.placeholder || ''" @input="(e) => { nItem[nField.class] = getInputValue(e); notifyNestedItemUpdate(subConf.dataPath || subConf.id); }"></textarea>
                  <input v-else-if="nField.type === 'number' || nField.type === 'range'" :value="(nItem[nField.class] as number) || 0" :type="nField.type" class="input-base interactive-el w-full" :placeholder="nField.placeholder || ''" @input="(e) => { nItem[nField.class] = getInputNumber(e); notifyNestedItemUpdate(subConf.dataPath || subConf.id); }">
                  <input v-else :value="(nItem[nField.class] as string) || ''" type="text" class="input-base interactive-el w-full" :placeholder="nField.placeholder || ''" @input="(e) => { nItem[nField.class] = getInputValue(e); notifyNestedItemUpdate(subConf.dataPath || subConf.id); }">
                </template>
              </div>
            </div>
            
            <button class="btn-new btn-outline-new interactive-el w-full text-xs btn-add-nested" @click="addNestedItem(item, subConf)">
              ➕ Добавить
            </button>
            <div v-if="getNestedList(item, subConf).length === 0" class="sub-empty">
              {{ subConf.emptyMessage || 'Динамика не добавлена' }}
            </div>
          </div>
        </div>
      </div>

      <!-- СТОРОНА Б -->
      <div class="rel-side rel-side-right">
        <div class="rel-side-header">
          🔵 СТОРОНА Б ({{ foreignLabel }})
        </div>

        <div v-if="foreignLoading" class="text-xs text-center p-4 text-info">
          Загрузка...
        </div>
        <div v-else-if="!foreignItem || !item[linkClass]" class="rel-side-empty">
          Сначала выберите сущность
        </div>
        <div v-else>
          <div v-for="cf in templateConf.fields || []" :key="'b-' + cf.class" class="mb-3">
            <div class="field-label-row">
              <label class="form-label-micro text-info">{{ cf.label || formatLabel(cf.class || '') }}</label>
            </div>
            
            <template v-if="cf.class === linkClass">
               <!-- Зеркально это будет наша сущность (симметрично по высоте с левой стороной) -->
               <XboxWheel 
                 :model-value="myLabel"
                 :options="[{ value: myLabel, label: myLabel }]"
                 :disabled="true"
                 :placeholder="myLabel"
               />
            </template>
            <template v-else>
              <XboxWheel 
                v-if="cf.type === 'select'" 
                :model-value="foreignItem ? String(foreignItem[cf.class] || '') : ''"
                :options="(cf.options || []).map((o: { value?: unknown; label?: string }) => ({ value: String(o.value || ''), label: o.label || String(o.value || '') }))"
                placeholder="-- Не указано --"
                @update:model-value="(val) => updateForeignField(cf.class, val)"
              />
              <textarea v-else-if="cf.type === 'textarea'" :value="foreignItem ? (String(foreignItem[cf.class] || '')) : ''" class="input-base interactive-el w-full" rows="2" @input="(e) => updateForeignField(cf.class, getInputValue(e))"></textarea>
              <input v-else-if="cf.type === 'number' || cf.type === 'range'" :value="foreignItem ? (Number(foreignItem[cf.class]) || 0) : 0" :type="cf.type" class="input-base interactive-el w-full" @input="(e) => updateForeignField(cf.class, getInputNumber(e))">
              <input v-else :value="foreignItem ? (String(foreignItem[cf.class] || '')) : ''" type="text" class="input-base interactive-el w-full" @input="(e) => updateForeignField(cf.class, getInputValue(e))">
            </template>
          </div>

          <!-- Dynamic Containers B (Mirror) -->
          <div v-for="subConf in templateConf.dynamicContainers || []" :key="'bdc-' + (subConf.id || '')" class="sub-container-wrap">
            <div class="sub-header">
              <span>⏱️ {{ subConf.title }}</span>
            </div>
            <div class="p-2 flex-col gap-2">
              <div v-for="(nItem, nIdx) in getNestedList(foreignItem, subConf)" :key="nIdx" class="nested-item card-secondary relative">
                <button class="btn-icon danger interactive-el absolute nested-remove-btn" title="Удалить" @click="removeNestedItem(nIdx, foreignItem, subConf)">
                  <i class="fas fa-times"></i>
                </button>
                <div v-for="nField in getDynamicContainerFields(subConf)" :key="nField.class" class="nested-field-group">
                  <template v-if="nField.class === 'начальная_глава' || nField.class === 'конечная_глава'">
                    <ManuscriptPointPicker
                      :model-value="(nItem[nField.class] as any)"
                      :label="nField.label || formatLabel(nField.class || '')"
                      :allow-auto-extend="nField.class === 'конечная_глава'"
                      :project="props.project"
                      @update:model-value="(val) => updateForeignNestedField(nItem, nField.class, val)"
                    />
                  </template>
                  <template v-else>
                    <label class="nested-field-label text-info">{{ nField.label || formatLabel(nField.class || '') }}</label>
                    <XboxWheel 
                      v-if="nField.type === 'select'" 
                      :model-value="(nItem[nField.class] as string | number) || ''" 
                      :options="getOptions(nField).map((o: { value?: unknown; label?: string }) => ({ value: String(o.value || ''), label: o.label || String(o.value || '') }))" 
                      placeholder="-- Не указано --" 
                      @update:model-value="(val: unknown) => updateForeignNestedField(nItem, nField.class, val)" 
                    />
                    <textarea v-else-if="nField.type === 'textarea'" :value="(nItem[nField.class] as string) || ''" class="input-base interactive-el w-full text-xs p-1" rows="2" :placeholder="nField.placeholder || ''" @input="(e) => updateForeignNestedField(nItem, nField.class, getInputValue(e))"></textarea>
                    <input v-else-if="nField.type === 'number' || nField.type === 'range'" :value="(nItem[nField.class] as number) || 0" :type="nField.type" class="input-base interactive-el w-full text-xs p-1" :placeholder="nField.placeholder || ''" @input="(e) => updateForeignNestedField(nItem, nField.class, getInputNumber(e))">
                    <input v-else :value="(nItem[nField.class] as string) || ''" type="text" class="input-base interactive-el w-full text-xs p-1" :placeholder="nField.placeholder || ''" @input="(e) => updateForeignNestedField(nItem, nField.class, getInputValue(e))">
                  </template>
                </div>
              </div>
              
              <button class="btn-new btn-outline-new interactive-el w-full text-xs btn-add-nested-info" @click="addNestedItem(foreignItem, subConf)">
                ➕ Добавить
              </button>
              
              <div v-if="getNestedList(foreignItem, subConf).length === 0" class="sub-empty">
                {{ subConf.emptyMessage || 'Динамика не добавлена' }}
              </div>
            </div>
          </div>
        </div>

      </div>

    </div>
  </div>
</template>

<script setup lang="ts">
import { useRelationshipBlock } from './useRelationshipBlock';
import type { RelationshipBlockProps } from './RelationshipBlock.model';
import { XboxWheel } from '@worldwiki/components';
import ManuscriptPointPicker from '../ManuscriptPointPicker/ManuscriptPointPicker.vue';

const props = withDefaults(defineProps<RelationshipBlockProps>(), {
    sandboxMode: false
});

const emit = defineEmits(['remove', 'modified', 'foreign-update', 'item-updated', 'update:modelValue']);

const formatLabel = (str: string) => {
  if (!str) return '';
  return str.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
};

const getInputValue = (event: Event): string =>
  (event.target as HTMLInputElement | HTMLTextAreaElement).value;

const getInputNumber = (event: Event): number =>
  Number((event.target as HTMLInputElement).value);

const {
  foreignItem,
  foreignLoading,
  linkClass,
  myLabel,
  foreignLabel,
  notifyNestedItemUpdate,
  getOptions,
  getNestedList,
  getDynamicContainerFields,
  addNestedItem,
  removeNestedItem,
  updateItemField,
  updateForeignField,
  updateForeignNestedField
} = useRelationshipBlock(props, emit as (event: string, ...args: unknown[]) => void);
</script>

<style scoped src="@worldwiki/resources/styles/features/schemas/RelationshipBlock.css"></style>
