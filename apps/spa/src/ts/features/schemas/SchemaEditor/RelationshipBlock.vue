<template>
  <div class="relationship-block glass-panel" :class="{ 'is-modified': foreignModified, [linkClass]: true }">
    
    <div class="rel-header">
      <div class="rel-header-left">
        <div class="link-type-badge interactive-el" :class="linkClass" @click="$emit('item-updated', item)">
          <i class="fas fa-link"></i> {{ linkClass === 'one-to-many' ? '1:N' : linkClass === 'many-to-many' ? 'N:M' : linkClass === 'many-to-one' ? 'N:1' : '1:1' }}
        </div>
        <div class="rel-title">
          <span class="rel-direction">Связь:</span>
          <strong>{{ templateConf.name }}</strong>
        </div>
      </div>
      
      <div class="rel-header-actions">
        <button class="btn-icon danger interactive-el" title="Удалить связь" @click="$emit('remove')">
          <i class="fas fa-trash-alt"></i>
        </button>
      </div>
    </div>

    <!-- labels -->
    <div class="rel-labels grid-2">
      <div class="label-box">
        <label>Как {{ myLabel }} видит это:</label>
        <div class="label-val">{{ item.my_label || templateConf.default_my_label }}</div>
      </div>
      <div class="label-box">
        <label>Как {{ foreignLabel }} видит это:</label>
        <div class="label-val">{{ item.foreign_label || templateConf.default_foreign_label }}</div>
      </div>
    </div>

    <!-- content -->
    <div class="rel-body">
      
      <div v-if="foreignLoading" class="rel-loading">Загрузка данных...</div>
      <div v-else-if="foreignError" class="rel-error">{{ foreignError }}</div>
      <div v-else>
        <!-- For single relations -->
        <div v-if="linkClass === 'one-to-one' || linkClass === 'many-to-one'" class="rel-single">
          <label class="block-label">Выбранная сущность ({{ templateConf.foreign_type }}):</label>
          <div class="select-wrapper">
            <select class="input-base interactive-el" v-model="item.foreign_id" @change="notifyItemUpdate">
              <option value="">-- Не выбрано --</option>
              <option v-for="opt in getOptions()" :key="opt.id" :value="opt.id">{{ opt.name }}</option>
            </select>
            <i class="fas fa-chevron-down select-arrow"></i>
          </div>

          <div v-if="foreignItem && item.foreign_id" class="foreign-data-panel">
            <div class="foreign-header">
              <i class="fas fa-database"></i> Данные связанной сущности ({{ foreignItem.type_name || templateConf.foreign_type }})
            </div>
            
            <!-- Показываем все поля из foreignItem, для которых есть customFields в шаблоне, ПЛЮС все поля, которые уже есть в item.link_data -->
            <div v-if="getResolvedFields().length > 0" class="foreign-fields-grid grid-2">
              <div v-for="cf in getResolvedFields()" :key="cf.class" class="foreign-field-wrapper">
                <label>{{ cf.label }}</label>
                
                <!-- Если это поле связи, редактируем его в item.link_data -->
                <template v-if="cf.isLinkField">
                  <input 
                    v-if="cf.type === 'text'" 
                    v-model="(item.link_data || {})[cf.class]" 
                    type="text" 
                    class="input-base interactive-el" 
                    :placeholder="cf.placeholder"
                    @input="onLinkChange(cf.class)($event)"
                  >
                  <textarea 
                    v-else-if="cf.type === 'textarea'" 
                    v-model="(item.link_data || {})[cf.class]" 
                    class="input-base interactive-el" 
                    rows="2" 
                    :placeholder="cf.placeholder"
                    @input="onLinkChange(cf.class)($event)"
                  ></textarea>
                  <input 
                    v-else-if="cf.type === 'number'" 
                    v-model.number="(item.link_data || {})[cf.class]" 
                    type="number" 
                    class="input-base interactive-el" 
                    :placeholder="cf.placeholder"
                    @input="onLinkChange(cf.class)($event)"
                  >
                </template>
                
                <!-- Иначе это поле чужой сущности (readonly или редактируемое) -->
                <template v-else>
                  <!-- Если песочница или двустороннее редактирование запрещено, показываем как readonly -->
                  <div v-if="sandboxMode" class="readonly-val">
                    {{ getDeepProp(foreignItem, cf.class) || '—' }}
                  </div>
                  
                  <template v-else>
                    <input 
                      v-if="cf.type === 'text'" 
                      v-model="foreignItem.data[cf.class]" 
                      type="text" 
                      class="input-base interactive-el" 
                      :placeholder="cf.placeholder"
                      @input="notifyItemUpdate"
                    >
                    <textarea 
                      v-else-if="cf.type === 'textarea'" 
                      v-model="foreignItem.data[cf.class]" 
                      class="input-base interactive-el" 
                      rows="2" 
                      :placeholder="cf.placeholder"
                      @input="notifyItemUpdate"
                    ></textarea>
                    
                    <select 
                      v-else-if="cf.type === 'select'" 
                      v-model="foreignItem.data[cf.class]" 
                      class="input-base interactive-el"
                      @change="notifyItemUpdate"
                    >
                      <option value="">-- Выберите --</option>
                      <option v-for="opt in cf.options" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
                    </select>

                    <input 
                      v-else-if="cf.type === 'number'" 
                      v-model.number="foreignItem.data[cf.class]" 
                      type="number" 
                      class="input-base interactive-el" 
                      :placeholder="cf.placeholder"
                      @input="notifyItemUpdate"
                    >
                    
                    <input 
                      v-else-if="cf.type === 'range'" 
                      v-model.number="foreignItem.data[cf.class]" 
                      type="range" 
                      min="0" max="100" 
                      class="input-range interactive-el"
                      @input="notifyItemUpdate"
                    >
                    
                    <!-- Date wheels for date fields -->
                    <div v-else-if="cf.type === 'calendar_date' || cf.type === 'calendar_datetime'" style="background: rgba(0,0,0,0.2); padding: 4px; border-radius: 8px;">
                      <XboxWheel
                        v-if="foreignItem.data[cf.class]"
                        v-model="foreignItem.data[cf.class].год"
                        :options="Array.from({length: 200}, (_, i) => ({ value: 1900 + i, label: `${1900 + i} г.` }))"
                        :horizontal="wheelHorizontal"
                        placeholder="Год"
                        @update:model-value="notifyItemUpdate"
                      />
                      <div v-else class="text-muted" style="font-size: 11px; padding: 4px;">Дата не установлена</div>
                    </div>

                    <div v-else class="readonly-val">
                      {{ getDeepProp(foreignItem, cf.class) || '—' }} ({{ cf.type }})
                    </div>
                  </template>
                </template>

              </div>
            </div>
            <div v-else class="text-muted" style="font-size: 12px; padding: 10px;">
              Нет доступных полей для отображения
            </div>
          </div>
        </div>

        <!-- For array relations -->
        <div v-else class="rel-multi">
          <label class="block-label">Связанные сущности ({{ templateConf.foreign_type }}):</label>
          
          <div class="nested-list" v-auto-animate>
            <div v-for="(nItem, nIdx) in getNestedList()" :key="nItem.id || nIdx" class="nested-item interactive-el">
              
              <div class="nested-header grid-2" style="align-items: center; margin-bottom: 8px;">
                <div class="select-wrapper">
                  <select class="input-base" :value="nItem.foreign_id" @change="makeSelectHandler(nIdx)($event)">
                    <option value="">-- Выберите --</option>
                    <option v-for="opt in getOptions()" :key="opt.id" :value="opt.id">{{ opt.name }}</option>
                  </select>
                  <i class="fas fa-chevron-down select-arrow"></i>
                </div>
                
                <div style="display: flex; gap: 8px; justify-content: flex-end;">
                  <button class="btn-icon danger" title="Удалить" @click="removeNestedItem(nIdx)">
                    <i class="fas fa-times"></i>
                  </button>
                </div>
              </div>

              <!-- Поля связи для конкретного элемента массива -->
              <div v-if="nItem.foreign_id && templateConf.customFields?.length > 0" class="foreign-fields-grid grid-2" style="background: rgba(0,0,0,0.1); padding: 10px; border-radius: 8px; margin-top: 8px;">
                <template v-for="cf in templateConf.customFields" :key="cf.class">
                  <div v-if="cf.isLinkField" class="foreign-field-wrapper">
                    <label>{{ cf.label }}</label>
                    <input 
                      v-if="cf.type === 'text'" 
                      v-model="(nItem.link_data || {})[cf.class]" 
                      type="text" 
                      class="input-base" 
                      :placeholder="cf.placeholder"
                      @input="notifyNestedItemUpdate"
                    >
                    <textarea 
                      v-else-if="cf.type === 'textarea'" 
                      v-model="(nItem.link_data || {})[cf.class]" 
                      class="input-base" 
                      rows="2" 
                      :placeholder="cf.placeholder"
                      @input="notifyNestedItemUpdate"
                    ></textarea>
                    <input 
                      v-else-if="cf.type === 'number'" 
                      v-model.number="(nItem.link_data || {})[cf.class]" 
                      type="number" 
                      class="input-base" 
                      :placeholder="cf.placeholder"
                      @input="notifyNestedItemUpdate"
                    >
                  </div>
                </template>
              </div>

            </div>
          </div>
          
          <button class="btn btn-outline interactive-el" style="width: 100%; margin-top: 8px; border-style: dashed;" @click="addNestedItem">
            <i class="fas fa-plus"></i> Добавить связь
          </button>
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

const emit = defineEmits(['remove', 'modified', 'foreign-update', 'item-updated']);

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
  addNestedItem,
  removeNestedItem,
  getDeepProp
} = useRelationshipBlock(props, emit);
</script>

<style scoped src="@worldwiki/components/css/modules/relationship-block.css"></style>
