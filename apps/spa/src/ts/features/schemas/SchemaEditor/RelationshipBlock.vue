<template>
  <div class="relationship-block glass-panel" :class="linkClass" style="padding: 0; background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 12px; overflow: hidden; margin-bottom: 24px;">
    
    <div style="padding: 16px; background: var(--bg-panel); border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center;">
      <div style="display: flex; align-items: center; gap: 12px;">
        <span style="font-size: 20px;">🔗</span>
        <div style="display: flex; flex-direction: column;">
          <strong style="color: var(--text-main); font-size: 14px;">{{ templateConf.headerTitle || 'Связь' }}</strong>
          <span style="font-size: 11px; color: var(--text-muted); opacity: 0.7;">
            с сущностью типа «{{ templateConf.foreign_type || (templateConf.fields.find((f: any) => f.class === linkClass)?.entityType) || '?' }}»
          </span>
        </div>
      </div>
      <button class="btn-icon danger interactive-el" title="Удалить связь" @click="$emit('remove')">
        <i class="fas fa-trash-alt"></i>
      </button>
    </div>

    <!-- BIDIRECTIONAL SPLIT -->
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; padding: 16px;">
      
      <!-- СТОРОНА А -->
      <div style="background: rgba(167, 139, 250, 0.04); border: 1px solid rgba(167, 139, 250, 0.2); border-radius: 12px; padding: 14px;">
        <div style="font-size: 10px; font-weight: 900; color: rgb(167, 139, 250); letter-spacing: 1px; text-transform: uppercase; margin-bottom: 12px; border-bottom: 1px solid rgba(167, 139, 250, 0.15); padding-bottom: 8px;">
          🟣 СТОРОНА А ({{ myLabel }})
        </div>

        <div v-for="cf in templateConf.fields" :key="'a-' + cf.class" style="margin-bottom: 14px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
            <label class="form-label-micro" style="color: rgb(167, 139, 250);">{{ cf.label || formatLabel(cf.class) }}</label>
          </div>
          
          <template v-if="cf.class === linkClass">
            <XboxWheel 
              :model-value="item[cf.class] || ''"
              @update:model-value="(val: any) => { item[cf.class] = val; notifyItemUpdate(); }"
              :options="getOptions(cf).map((o: any) => ({ value: o.value || o.id, label: o.label || o.name || o.value || o.id }))"
              placeholder="-- Выберите сущность --"
            />
          </template>
          <template v-else>
            <XboxWheel 
              v-if="cf.type === 'select'" 
              :model-value="item[cf.class] || ''"
              @update:model-value="(val: any) => { item[cf.class] = val; notifyItemUpdate(); }"
              :options="(cf.options || []).map((o: any) => ({ value: o.value || o.id, label: o.label || o.name || o.value || o.id }))"
              placeholder="-- Не указано --"
            />
            <textarea v-else-if="cf.type === 'textarea'" v-model="item[cf.class]" class="input-base interactive-el" rows="2" style="font-size: 12px; padding: 6px; width: 100%;" :placeholder="cf.placeholder" @input="notifyItemUpdate"></textarea>
            <input v-else-if="cf.type === 'number' || cf.type === 'range'" v-model.number="item[cf.class]" :type="cf.type" class="input-base interactive-el" style="font-size: 12px; padding: 6px; width: 100%;" :placeholder="cf.placeholder" @input="notifyItemUpdate">
            <input v-else v-model="item[cf.class]" type="text" class="input-base interactive-el" style="font-size: 12px; padding: 6px; width: 100%;" :placeholder="cf.placeholder" @input="notifyItemUpdate">
          </template>
        </div>

        <!-- Dynamic Containers A -->
        <div v-for="subConf in templateConf.dynamicContainers" :key="'adc-' + subConf.id" style="margin-top: 12px; border: 1px solid rgba(167, 139, 250, 0.25); border-radius: 8px; overflow: hidden;">
          <div style="background: rgba(167, 139, 250, 0.12); padding: 8px 12px; font-size: 10px; font-weight: 900; color: rgb(167, 139, 250); letter-spacing: 0.5px; text-transform: uppercase;">
            ⏱️ {{ subConf.title }}
          </div>
          <div style="padding: 10px; display: flex; flex-direction: column; gap: 8px;" v-auto-animate>
            <div v-for="(nItem, nIdx) in getNestedList(item, subConf)" :key="nIdx" style="padding: 8px; background: rgba(0, 0, 0, 0.2); border-radius: 6px; position: relative;">
              <button class="btn-icon danger interactive-el" style="position: absolute; top: 4px; right: 4px; padding: 2px; font-size: 10px; z-index: 10;" title="Удалить" @click="removeNestedItem(nIdx, item, subConf)">
                <i class="fas fa-times"></i>
              </button>
              
              <div v-for="nField in getDynamicContainerFields(subConf)" :key="nField.class" style="margin-bottom: 6px;">
                <label class="form-label-micro" style="color: rgba(167, 139, 250, 0.8); margin-bottom: 2px;">{{ nField.label || formatLabel(nField.class) }}</label>
                <XboxWheel 
                  v-if="nField.type === 'select'" 
                  :model-value="nItem[nField.class] || ''"
                  @update:model-value="(val: any) => { nItem[nField.class] = val; notifyNestedItemUpdate(subConf.dataPath || subConf.id); }"
                  :options="getOptions(nField).map((o: any) => ({ value: o.value || o.id, label: o.label || o.name || o.value || o.id }))"
                  placeholder="-- Не указано --"
                />
                <textarea v-else-if="nField.type === 'textarea'" v-model="nItem[nField.class]" class="input-base interactive-el" rows="2" style="font-size: 11px; padding: 4px; width: 100%;" :placeholder="nField.placeholder" @input="notifyNestedItemUpdate(subConf.dataPath || subConf.id)"></textarea>
                <input v-else-if="nField.type === 'number' || nField.type === 'range'" v-model.number="nItem[nField.class]" :type="nField.type" class="input-base interactive-el" style="font-size: 11px; padding: 4px; width: 100%;" :placeholder="nField.placeholder" @input="notifyNestedItemUpdate(subConf.dataPath || subConf.id)">
                <input v-else v-model="nItem[nField.class]" type="text" class="input-base interactive-el" style="font-size: 11px; padding: 4px; width: 100%;" :placeholder="nField.placeholder" @input="notifyNestedItemUpdate(subConf.dataPath || subConf.id)">
              </div>
            </div>
            
            <button class="btn-new btn-outline-new interactive-el" style="width: 100%; padding: 6px; font-size: 10px; border-style: dashed; border-color: rgba(167, 139, 250, 0.4); color: rgb(167, 139, 250);" @click="addNestedItem(item, subConf)">
              ➕ Добавить
            </button>
            <div v-if="getNestedList(item, subConf).length === 0" style="text-align: center; padding: 8px; opacity: 0.25; font-size: 10px; border-radius: 6px;">
              {{ subConf.emptyMessage || 'Динамика не добавлена' }}
            </div>
          </div>
        </div>
      </div>

      <!-- СТОРОНА Б -->
      <div style="background: rgba(96, 165, 250, 0.04); border: 1px solid rgba(96, 165, 250, 0.2); border-radius: 12px; padding: 14px;">
        <div style="font-size: 10px; font-weight: 900; color: rgb(96, 165, 250); letter-spacing: 1px; text-transform: uppercase; margin-bottom: 12px; border-bottom: 1px solid rgba(96, 165, 250, 0.15); padding-bottom: 8px;">
          🔵 СТОРОНА Б ({{ foreignLabel }})
        </div>

        <div v-if="foreignLoading" style="color: #60a5fa; font-size: 11px; text-align: center; padding: 20px;">
          Загрузка...
        </div>
        <div v-else-if="!foreignItem || !item[linkClass]" style="color: rgba(96, 165, 250, 0.4); font-size: 11px; text-align: center; padding: 20px; border: 1px dashed rgba(96,165,250,0.2); border-radius: 8px;">
          Сначала выберите сущность
        </div>
        <div v-else>
          <div v-for="cf in templateConf.fields" :key="'b-' + cf.class" style="margin-bottom: 14px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
              <label class="form-label-micro" style="color: rgb(96, 165, 250);">{{ cf.label || formatLabel(cf.class) }}</label>
            </div>
            
            <template v-if="cf.class === linkClass">
               <!-- Зеркально это будет наша сущность -->
              <input class="input-base" style="font-size: 12px; padding: 6px; width: 100%; pointer-events: none; opacity: 0.5;" :value="myLabel" readonly>
            </template>
            <template v-else>
              <XboxWheel 
                v-if="cf.type === 'select'" 
                :model-value="foreignItem[cf.class] || ''"
                @update:model-value="(val: any) => { foreignItem[cf.class] = val; }"
                :options="(cf.options || []).map((o: any) => ({ value: o.value || o.id, label: o.label || o.name || o.value || o.id }))"
                placeholder="-- Не указано --"
              />
              <textarea v-else-if="cf.type === 'textarea'" v-model="foreignItem[cf.class]" class="input-base interactive-el" rows="2" style="font-size: 12px; padding: 6px; width: 100%;"></textarea>
              <input v-else-if="cf.type === 'number' || cf.type === 'range'" v-model.number="foreignItem[cf.class]" :type="cf.type" class="input-base interactive-el" style="font-size: 12px; padding: 6px; width: 100%;">
              <input v-else v-model="foreignItem[cf.class]" type="text" class="input-base interactive-el" style="font-size: 12px; padding: 6px; width: 100%;">
            </template>
          </div>

          <!-- Dynamic Containers B (Mirror) -->
          <div v-for="subConf in templateConf.dynamicContainers" :key="'bdc-' + subConf.id" style="margin-top: 12px; border: 1px solid rgba(96, 165, 250, 0.25); border-radius: 8px; overflow: hidden;">
            <div style="background: rgba(96, 165, 250, 0.12); padding: 8px 12px; font-size: 10px; font-weight: 900; color: rgb(96, 165, 250); letter-spacing: 0.5px; text-transform: uppercase;">
              ⏱️ {{ subConf.title }}
            </div>
            <div style="padding: 10px; display: flex; flex-direction: column; gap: 8px;">
              <div v-for="(nItem, nIdx) in getNestedList(foreignItem, subConf)" :key="nIdx" style="padding: 8px; background: rgba(0, 0, 0, 0.2); border-radius: 6px; position: relative;">
                <button class="btn-icon danger interactive-el" style="position: absolute; top: 4px; right: 4px; padding: 2px; font-size: 10px; z-index: 10;" title="Удалить" @click="removeNestedItem(nIdx, foreignItem, subConf)">
                  <i class="fas fa-times"></i>
                </button>
                <div v-for="nField in getDynamicContainerFields(subConf)" :key="nField.class" style="margin-bottom: 6px;">
                  <label class="form-label-micro" style="color: rgba(96, 165, 250, 0.8); margin-bottom: 2px;">{{ nField.label || formatLabel(nField.class) }}</label>
                  <XboxWheel 
                    v-if="nField.type === 'select'" 
                    :model-value="nItem[nField.class] || ''"
                    @update:model-value="(val: any) => { nItem[nField.class] = val; }"
                    :options="getOptions(nField).map((o: any) => ({ value: o.value || o.id, label: o.label || o.name || o.value || o.id }))"
                    placeholder="-- Не указано --"
                  />
                  <textarea v-else-if="nField.type === 'textarea'" v-model="nItem[nField.class]" class="input-base interactive-el" rows="2" style="font-size: 11px; padding: 4px; width: 100%;"></textarea>
                  <input v-else-if="nField.type === 'number' || nField.type === 'range'" v-model.number="nItem[nField.class]" :type="nField.type" class="input-base interactive-el" style="font-size: 11px; padding: 4px; width: 100%;">
                  <input v-else v-model="nItem[nField.class]" type="text" class="input-base interactive-el" style="font-size: 11px; padding: 4px; width: 100%;">
                </div>
              </div>
              
              <button class="btn-new btn-outline-new interactive-el" style="width: 100%; padding: 6px; font-size: 10px; border-style: dashed; border-color: rgba(96, 165, 250, 0.4); color: rgb(96, 165, 250);" @click="addNestedItem(foreignItem, subConf)">
                ➕ Добавить
              </button>
              
              <div v-if="getNestedList(foreignItem, subConf).length === 0" style="text-align: center; padding: 8px; opacity: 0.25; font-size: 10px; border-radius: 6px;">
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
import { useRelationshipBlock } from '../../../services/Entity/useRelationshipBlock';
import { XboxWheel } from '@worldwiki/components';

const props = defineProps({
    item: { type: Object, required: true },
    idx: { type: Number, required: true },
    templateConf: { type: Object, required: true },
    allTemplates: { type: Object, required: true },
    referenceData: { type: Object, required: true },
    entityId: { type: String, required: true },
    entityType: { type: String, required: true },
    project: { type: String, required: true },
    sandboxMode: { type: Boolean, default: false }
});

const emit = defineEmits(['remove', 'modified', 'foreign-update', 'item-updated', 'update:modelValue']);

const formatLabel = (str: string) => {
  if (!str) return '';
  return str.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
};

const {
  wheelHorizontal,
  foreignItem,
  foreignLoading,
  foreignError,
  foreignModified,
  linkClass,
  myLabel,
  foreignLabel,
  getResolvedFields,
  notifyItemUpdate,
  notifyNestedItemUpdate,
  onSelectChange,
  makeSelectHandler,
  onLinkChange,
  getOptions,
  getNestedList,
  getDynamicContainerFields,
  addNestedItem,
  removeNestedItem,
  getDeepProp
} = useRelationshipBlock(props, emit);
</script>

<style scoped src="@worldwiki/components/css/modules/relationship-block.css"></style>
