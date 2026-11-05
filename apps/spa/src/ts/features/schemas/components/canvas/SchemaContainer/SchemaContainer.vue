<template>
  <div class="schema-container schema-container-card card-panel" :class="{ 'is-hidden-container': item.hidden }">
    <div class="schema-header-row">
      <div class="schema-title-group">
        <span class="schema-drag-dots">⠿</span>
        <span class="schema-icon">{{ isTimeline ? '⏱️' : '📋' }}</span>
        <div class="flex-col gap-1 flex-1">
          <input :value="item.title" class="input-base schema-title-input" placeholder="НАЗВАНИЕ МОДУЛЯ" @input="updateTitle(($event.target as HTMLInputElement).value)">
          <div class="flex items-center gap-2">
            <span class="text-xs text-muted empty-msg-label">Текст при пустоте:</span>
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
          <div v-for="(bField, fIdx) in getRawTemplateFields(item.template)" :key="'la-'+fIdx" class="mb-3" :class="{ 'is-hidden-field': !isProtectedField(bField.class) && getFieldOverride(item, bField.class).hidden }">
            <div class="flex justify-between items-center mb-1">
              <div class="flex items-center gap-1.5">
                <span v-if="isProtectedField(bField.class)" class="text-xs" title="Системное поле">🔒</span>
                <label class="form-label-micro text-accent-light">{{ getFieldOverride(item, bField.class).label || bField.label || bField.class }}</label>
              </div>
              <span v-if="isProtectedField(bField.class)" class="text-xs text-muted font-medium protected-badge">Системное</span>
              <button v-else class="text-xs text-muted cursor-pointer" @click="toggleFieldOverride(item, bField.class)">{{ getFieldOverride(item, bField.class).hidden ? '👁️‍🗨️ скрыто' : '👁️ видимо' }}</button>
            </div>
            <div v-show="!getFieldOverride(item, bField.class).hidden">
              <ManuscriptPointPicker v-if="isChapterField(bField)" :model-value="null" :disabled="true" />
              <XboxWheel v-else-if="(getFieldOverride(item, bField.class).type || bField.type) === 'select'" :model-value="''" :options="getFieldOverride(item, bField.class).options || bField.options || []" :placeholder="getFieldOverride(item, bField.class).placeholder || bField.placeholder || '...'" />
              <input v-else class="input-base text-sm pointer-events-none" :placeholder="getFieldOverride(item, bField.class).placeholder || bField.placeholder || '...'">
              <div v-if="!isProtectedField(bField.class)" class="side-override-box">
                <div class="flex gap-2 mb-2">
                  <div class="flex-1"><label class="form-label-micro">Название</label><input v-model="ensureFieldOverride(item, bField.class).label" class="input-base interactive-el" :placeholder="bField.label || bField.class"></div>
                  <div class="flex-1"><label class="form-label-micro">Подсказка</label><input v-model="ensureFieldOverride(item, bField.class).placeholder" class="input-base interactive-el" :placeholder="bField.placeholder || '...'"></div>
                </div>
                <template v-if="bField.entityType !== undefined">
                  <label class="form-label-micro">ТИП СУЩНОСТИ А</label>
                  <XboxWheel :model-value="String(ensureFieldOverride(item, bField.class).entityType || '')" :options="[{ value: '', label: '— любая —' }, ...availableEntityTypes]" placeholder="— любая —" @update:model-value="val => ensureFieldOverride(item, bField.class).entityType = val" />
                </template>
                <template v-else-if="(getFieldOverride(item, bField.class).type || bField.type) === 'select'">
                  <label class="form-label-micro">Варианты выбора</label>
                  <div class="flex-col gap-1 mt-1">
                    <div v-for="(opt, oIdx) in (ensureFieldOverride(item, bField.class).options || [])" :key="oIdx" class="option-item-row">
                      <input v-model="opt.label" class="input-base interactive-el flex-1" placeholder="Название варианта..." @input="opt.value = opt.label">
                      <button class="btn-icon-danger-sm interactive-el" title="Удалить" @click="ensureFieldOverride(item, bField.class).options?.splice(Number(oIdx),1)">✕</button>
                    </div>
                    <button class="btn-new btn-outline-new interactive-el text-xs" @click="addFieldOption(item, bField.class)">+ ДОБАВИТЬ ВАРИАНТ</button>
                  </div>
                </template>
              </div>
            </div>
          </div>
          <!-- dynamicContainers LEFT -->
          <div v-for="subConf in (item.template ? fullConfig.templates?.[item.template]?.dynamicContainers || [] : [])" :key="'ldc-'+subConf.id" class="side-dynamic-container-a">
            <div class="side-dynamic-header-a">⏱️ {{ subConf.title }}</div>
            <div class="flex-col gap-2 p-2">
              <div v-for="(nField, nIdx) in (subConf.fields || [])" :key="'lnf-'+nIdx" class="card-secondary">
                <label class="form-label-micro text-accent-light mb-1">{{ nField.label || nField.class }}</label>
                <ManuscriptPointPicker v-if="isChapterField(nField)" :model-value="null" :disabled="true" />
                <XboxWheel v-else-if="nField.type === 'select'" :model-value="''" :options="nField.options || []" :placeholder="nField.placeholder || '...'" />
                <input v-else class="input-base interactive-el text-xs pointer-events-none" :placeholder="nField.placeholder || '...'">
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
              <label class="form-label-micro form-label-info">{{ bField.label || bField.class }}</label>
              <span class="text-xs text-muted mirror-badge">зеркало</span>
            </div>
            <ManuscriptPointPicker v-if="isChapterField(bField)" :model-value="null" :disabled="true" />
            <XboxWheel v-else-if="bField.type === 'select'" :model-value="''" :options="bField.options || []" :placeholder="bField.placeholder || '...'" :disabled="true" />
            <input v-else class="input-base interactive-el text-sm pointer-events-none input-muted" :placeholder="bField.placeholder || '...'">
            <div class="side-override-box">
              <div class="flex gap-2 mb-2">
                <div class="flex-1"><label class="form-label-micro">Название</label><input v-model="ensureFieldOverride(item, bField.class + '__b').label" class="input-base interactive-el" :placeholder="bField.label || bField.class"></div>
                <div class="flex-1"><label class="form-label-micro">Подсказка</label><input v-model="ensureFieldOverride(item, bField.class + '__b').placeholder" class="input-base interactive-el" :placeholder="bField.placeholder || '...'"></div>
              </div>
              <template v-if="bField.entityType !== undefined">
                <label class="form-label-micro">ТИП СУЩНОСТИ Б</label>
                <XboxWheel :model-value="String(ensureFieldOverride(item, bField.class + '__b').entityType || '')" :options="[{ value: '', label: '— любая —' }, ...availableEntityTypes]" placeholder="— любая —" @update:model-value="val => ensureFieldOverride(item, bField.class + '__b').entityType = val" />
              </template>
            </div>
          </div>
          <!-- dynamicContainers RIGHT mirror -->
          <div v-for="subConf in (item.template ? fullConfig.templates?.[item.template]?.dynamicContainers || [] : [])" :key="'rdc-'+subConf.id" class="side-dynamic-container-b">
            <div class="side-dynamic-header-b">⏱️ {{ subConf.title }}</div>
            <div class="flex-col gap-2 p-2">
              <div v-for="(nField, nIdx) in (subConf.fields || [])" :key="'rnf-'+nIdx" class="card-secondary">
                <label class="form-label-micro mb-1 form-label-info">{{ nField.label || nField.class }}</label>
                <ManuscriptPointPicker v-if="isChapterField(nField)" :model-value="null" :disabled="true" />
                <XboxWheel v-else-if="nField.type === 'select'" :model-value="''" :options="nField.options || []" :placeholder="nField.placeholder || '...'" :disabled="true" />
                <input v-else class="input-base interactive-el pointer-events-none input-muted" :placeholder="nField.placeholder || '...'">
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
        <div v-for="(bField, fIdx) in getRawTemplateFields(item.template)" :key="fIdx" :class="{ 'is-hidden-field': !isProtectedField(bField.class) && getFieldOverride(item, bField.class).hidden }">
          <div class="flex justify-between items-center mb-2">
            <div class="flex items-center gap-1.5">
              <span v-if="isProtectedField(bField.class)" class="text-xs" title="Системное поле хронологии — защищено от изменений">🔒</span>
              <label class="form-label-micro text-accent">{{ getFieldOverride(item, bField.class).label || bField.label || bField.class }}</label>
            </div>
            <span v-if="isProtectedField(bField.class)" class="text-xs text-muted font-medium icon-dim-60">
              Системное
            </span>
            <button v-else class="text-xs cursor-pointer" @click="toggleFieldOverride(item, bField.class)">
              {{ getFieldOverride(item, bField.class).hidden ? 'Скрыто 👁️‍🗨️' : 'Видимо 👁️' }}
            </button>
          </div>

          <div v-show="!getFieldOverride(item, bField.class).hidden">
            <ManuscriptPointPicker v-if="isChapterField(bField)" :model-value="null" :disabled="true" />
            <XboxWheel v-else-if="(getFieldOverride(item, bField.class).type || bField.type) === 'select'" :model-value="''" :options="getFieldOverride(item, bField.class).options || bField.options || []" :placeholder="getFieldOverride(item, bField.class).placeholder || bField.placeholder || '...'" />
            <input v-else class="input-base interactive-el pointer-events-none" :placeholder="getFieldOverride(item, bField.class).placeholder || bField.placeholder || '...'">

            <!-- INLINE SETTINGS (для незащищенных полей) -->
            <div v-if="!isProtectedField(bField.class)" class="side-override-box mt-2">
              <div class="flex gap-2">
                <div class="flex-1">
                  <label class="form-label-micro">Название</label>
                  <input v-model="ensureFieldOverride(item, bField.class).label" class="input-base interactive-el" :placeholder="bField.label || bField.class">
                </div>
                <div class="flex-1">
                  <label class="form-label-micro">Подсказка</label>
                  <input v-model="ensureFieldOverride(item, bField.class).placeholder" class="input-base interactive-el" :placeholder="bField.placeholder || '...'">
                </div>
              </div>
              
              <div class="mt-2">
                <label class="form-label-micro">Переопределить тип</label>
                <XboxWheel :model-value="String(ensureFieldOverride(item, bField.class).type || '')" :options="[{ value: '', label: '(Как в базе: ' + bField.type + ')' }, ...atomicBricks]" @update:model-value="val => ensureFieldOverride(item, bField.class).type = val" />
              </div>
              
              <div v-if="(ensureFieldOverride(item, bField.class).type || bField.type) === 'select' || (ensureFieldOverride(item, bField.class).type || bField.type) === 'multiselect'" class="mt-2 border-t pt-2">
                <div class="flex items-center justify-between mb-2">
                  <label class="form-label-micro">Варианты выбора</label>
                  <div class="options-source-toggle flex gap-1">
                    <button
                      type="button"
                      class="source-toggle-btn interactive-el text-xs"
                      :class="{ active: (ensureFieldOverride(item, bField.class).optionsSource || (ensureFieldOverride(item, bField.class).entityTypes?.length || ensureFieldOverride(item, bField.class).entityType ? 'entities' : 'custom')) === 'custom' }"
                      @click="setFieldOptionsSource(ensureFieldOverride(item, bField.class), 'custom')"
                    >
                      📝 Свои
                    </button>
                    <button
                      type="button"
                      class="source-toggle-btn interactive-el text-xs"
                      :class="{ active: (ensureFieldOverride(item, bField.class).optionsSource || (ensureFieldOverride(item, bField.class).entityTypes?.length || ensureFieldOverride(item, bField.class).entityType ? 'entities' : 'custom')) === 'entities' }"
                      @click="setFieldOptionsSource(ensureFieldOverride(item, bField.class), 'entities')"
                    >
                      🧩 Сущности
                    </button>
                  </div>
                </div>

                <!-- Custom text options -->
                <div v-if="(ensureFieldOverride(item, bField.class).optionsSource || (ensureFieldOverride(item, bField.class).entityTypes?.length || ensureFieldOverride(item, bField.class).entityType ? 'entities' : 'custom')) === 'custom'">
                  <div class="flex-col gap-1 mt-1">
                    <div v-for="(opt, oIdx) in (ensureFieldOverride(item, bField.class).options || [])" :key="oIdx" class="option-item-row">
                      <input v-model="opt.label" class="input-base interactive-el flex-1" placeholder="Название варианта..." @input="opt.value = opt.label">
                      <button class="btn-icon-danger-sm interactive-el" title="Удалить" @click="ensureFieldOverride(item, bField.class).options?.splice(Number(oIdx), 1)">✕</button>
                    </div>
                    <button class="btn-new btn-outline-new interactive-el text-xs" @click="addFieldOption(item, bField.class)">+ ДОБАВИТЬ ВАРИАНТ</button>
                  </div>
                </div>

                <!-- Entity types selector -->
                <div v-else class="entity-types-selector">
                  <div class="text-xs text-muted mb-2">Выберите типы сущностей:</div>
                  <div class="flex flex-wrap gap-1.5 mb-1">
                    <button
                      v-for="t in availableEntityTypes"
                      :key="t.value"
                      type="button"
                      class="entity-type-chip interactive-el text-xs"
                      :class="{ active: isFieldEntityTypeSelected(ensureFieldOverride(item, bField.class), t.value) }"
                      @click="toggleFieldEntityType(ensureFieldOverride(item, bField.class), t.value)"
                    >
                      <span>{{ t.icon || '📄' }}</span>
                      <span>{{ t.label }}</span>
                      <span v-if="isFieldEntityTypeSelected(ensureFieldOverride(item, bField.class), t.value)" class="check-mark">✓</span>
                    </button>
                  </div>
                </div>
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
      <input v-else class="input-base interactive-el pointer-events-none" :placeholder="cField.placeholder || '...'">

      <!-- INLINE SETTINGS -->
      <div class="side-override-box mt-2">
        <div class="flex gap-2">
          <div class="flex-1">
            <label class="form-label-micro">Название</label>
            <input v-model="cField.label" class="input-base interactive-el" placeholder="Название поля">
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
                    <label class="form-label-micro">ИСТОЧНИК</label>
                    <XboxWheel :model-value="String(cField.sourceType || '')" :options="availableEntityTypes" placeholder="Выберите источник..." @update:model-value="(val: any) => cField.sourceType = val" />
                  </div>
                  <div class="flex-1">
                    <label class="form-label-micro">ЦЕЛЬ</label>
                    <XboxWheel :model-value="String(cField.targetType || '')" :options="availableEntityTypes" placeholder="Выберите цель..." @update:model-value="(val: any) => cField.targetType = val" />
                  </div>
              </div>
            </template>
            <template v-else>
              <div class="flex items-center justify-between mb-2">
                <label class="form-label-micro">Варианты выбора</label>
                <div class="options-source-toggle flex gap-1">
                  <button
                    type="button"
                    class="source-toggle-btn interactive-el text-xs"
                    :class="{ active: (cField.optionsSource || (cField.entityTypes?.length || cField.entityType ? 'entities' : 'custom')) === 'custom' }"
                    @click="setFieldOptionsSource(cField, 'custom')"
                  >
                    📝 Свои
                  </button>
                  <button
                    type="button"
                    class="source-toggle-btn interactive-el text-xs"
                    :class="{ active: (cField.optionsSource || (cField.entityTypes?.length || cField.entityType ? 'entities' : 'custom')) === 'entities' }"
                    @click="setFieldOptionsSource(cField, 'entities')"
                  >
                    🧩 Сущности
                  </button>
                </div>
              </div>

              <!-- Custom text options -->
              <div v-if="(cField.optionsSource || (cField.entityTypes?.length || cField.entityType ? 'entities' : 'custom')) === 'custom'">
                <div class="flex-col gap-1 mt-1">
                    <div v-for="(opt, oIdx) in (cField.options || [])" :key="oIdx" class="option-item-row">
                      <input v-model="opt.label" class="input-base interactive-el flex-1" placeholder="Название варианта..." @input="opt.value = opt.label" />
                      <button class="btn-icon-danger-sm interactive-el" title="Удалить" @click="cField.options?.splice(Number(oIdx), 1)">✕</button>
                    </div>
                    <button class="btn-new btn-outline-new interactive-el text-xs" @click="() => { if(!cField.options) cField.options=[]; cField.options.push({label:'Новый вариант', value:'Новый вариант'}) }">+ ДОБАВИТЬ ВАРИАНТ</button>
                </div>
              </div>

              <!-- Entity types selector -->
              <div v-else class="entity-types-selector">
                <div class="text-xs text-muted mb-2">Выберите типы сущностей:</div>
                <div class="flex flex-wrap gap-1.5 mb-1">
                  <button
                    v-for="t in availableEntityTypes"
                    :key="t.value"
                    type="button"
                    class="entity-type-chip interactive-el text-xs"
                    :class="{ active: isFieldEntityTypeSelected(cField, t.value) }"
                    @click="toggleFieldEntityType(cField, t.value)"
                  >
                    <span>{{ t.icon || '📄' }}</span>
                    <span>{{ t.label }}</span>
                    <span v-if="isFieldEntityTypeSelected(cField, t.value)" class="check-mark">✓</span>
                  </button>
                </div>
              </div>
            </template>
        </div>
      </div>
    </div>

    <!-- DROP ZONE FOR CUSTOM FIELDS -->
    <div
      v-if="['dynamic', 'timeline'].includes(String(item.type))"
      class="dynamic-empty-box cursor-pointer mt-3 p-4"
      :class="{ 'is-drag-active': isDraggedOver }"
      @dragenter.prevent="isDraggedOver = true"
      @dragover.prevent="isDraggedOver = true"
      @dragleave="isDraggedOver = false"
      @drop.stop="isDraggedOver = false; $emit('drop-custom')">
      <div class="text-sm font-bold text-accent">🎯 СЮДА КИДАЙ ПОЛЯ</div>
      <div class="text-xs text-muted mt-1">Захвати поле из левой панели</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { SchemaContainerProps, SchemaContainerEmits } from './SchemaContainer.model';
import { XboxWheel } from '@worldwiki/components';
import { ManuscriptPointPicker } from '@/shared/ui';
import { useSchemaContainer } from './useSchemaContainer';

const props = defineProps<SchemaContainerProps>();
defineEmits<SchemaContainerEmits>();

const {
  isDraggedOver,
  fullConfig,
  availableEntityTypes,
  atomicBricks,
  getRawTemplateFields,
  ensureFieldOverride,
  getFieldOverride,
  toggleFieldOverride,
  isProtectedField,
  addFieldOption,
  setFieldOptionsSource,
  toggleFieldEntityType,
  isFieldEntityTypeSelected,
  isTimeline,
  updateTitle,
  updateEmptyMessage,
  toggleHidden,
  removeCustomField,
  isChapterField
} = useSchemaContainer(props);
</script>

<style scoped src="@worldwiki/resources/styles/features/schemas/SchemaContainer.css"></style>
