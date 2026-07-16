<template>
  <div class="rel-block" :style="{ zIndex: 50 - idx }">

    <!-- Шапка элемента -->
    <div class="rel-header">
      <strong class="rel-title">{{ templateConf.headerTitle || 'Связь' }} #{{ idx + 1 }}</strong>
      <button class="btn-icon-danger" title="Удалить" @click="$emit('remove', idx)">🗑️</button>
    </div>

    <!-- ======= Split-view: Я / Он ======= -->
    <div class="rel-split">

      <!-- ЛЕВАЯ ПАНЕЛЬ — «моя» запись -->
      <div class="rel-side rel-side-left">
        <div class="rel-side-header">{{ myLabel }}</div>

        <!-- Поля основного шаблона -->
        <div v-for="tField in templateConf.fields" :key="tField.class" class="nested-field-group" style="margin-bottom:16px;">
          <div class="field-label-row">
            <label v-if="tField.label" class="nested-field-label">{{ tField.label }}</label>
            <!-- Кнопка редактирования вариантов (только в режиме конструктора) -->
            <button 
              v-if="sandboxMode && tField.type === 'select' && !tField.entityType" 
              class="btn-edit-options-tiny"
              title="Изменить варианты выбора"
              @click="tField._editingOptions = !tField._editingOptions"
            >
              {{ tField._editingOptions ? '✅' : '✏️' }}
            </button>
          </div>

          <!-- Редактор опций (только в sandboxMode) -->
          <div v-if="sandboxMode && tField._editingOptions && tField.type === 'select'" class="options-editor-mini">
             <div class="options-grid">
                <div v-for="(opt, oIdx) in tField.options" :key="oIdx" class="option-row">
                   <input v-model="opt.label" type="text" placeholder="Текст" class="input-base opt-input" />
                   <button class="btn-icon-danger-sm" @click="tField.options.splice(oIdx, 1)">✕</button>
                </div>
             </div>
             <button class="btn-small-add" style="margin-top:8px; width: 100%;" @click="tField.options.push({label: 'Новый вариант', value: 'new_val'})">➕ Добавить</button>
          </div>

          <!-- Поле линка (персонаж/родственник) -->
          <XboxWheel
v-if="tField.class === linkClass"
            :horizontal="wheelHorizontal"
            :model-value="String(item[tField.class] || '')"
            :options="getOptions(tField)"
            :placeholder="tField.placeholder"
            @update:model-value="val => onLinkChange(tField.class, val)"
          />

          <XboxWheel
v-else-if="tField.type === 'select'"
            :key="tField.class + '-select'"
            :horizontal="wheelHorizontal"
            :model-value="String(item[tField.class] || '')"
            :options="getOptions(tField)"
            :placeholder="tField.placeholder"
            @update:model-value="val => { item[tField.class] = val; notifyItemUpdate(); }"
          />

          <div v-else-if="tField.type === 'range'" class="range-wrap-vertical">
            <div class="range-display">{{ item[tField.class] ?? 0 }}</div>
            <input
              type="range"
              :min="tField.min ?? -100"
              :max="tField.max ?? 100"
              :value="item[tField.class] ?? 0"
              class="range-input"
              @input="e => { const input = e.target as HTMLInputElement; item[tField.class] = Number(input.value); notifyItemUpdate(); }"
            >
          </div>

          <textarea
            v-else-if="tField.type === 'textarea'"
            :value="item[tField.class] || ''"
            class="input-base"
            :placeholder="tField.placeholder"
            rows="3"
            @input="e => { item[tField.class] = (e.target as HTMLTextAreaElement).value; notifyItemUpdate(); }"
          ></textarea>

          <input
            v-else
            :type="tField.type || 'text'"
            :value="item[tField.class] || ''"
            class="input-base"
            :placeholder="tField.placeholder"
            @input="e => { item[tField.class] = (e.target as HTMLInputElement).value; notifyItemUpdate(); }"
          >
        </div>

        <!-- Вложенные динамические контейнеры (динамика отношений) -->
        <div v-if="templateConf.dynamicContainers" style="margin-top:20px;">
          <div class="sub-container-title">ДИНАМИКА ОТНОШЕНИЙ</div>
          <div
            v-for="subConf in templateConf.dynamicContainers"
            :key="subConf.id"
            class="sub-container-wrap"
          >
            <!-- Заголовок подконтейнера (Я) -->
            <div class="sub-header">
              <span>{{ subConf.title }}</span>
              <button class="btn-small-add" @click="addNestedItem(item, subConf)">➕</button>
            </div>

            <div v-if="!getNestedList(item, subConf).length" class="sub-empty">{{ subConf.emptyMessage || 'Пусто' }}</div>

            <!-- Список элементов подконтейнера (Я) -->
            <div v-for="(nItem, nIdx) in getNestedList(item, subConf)" :key="nIdx" class="nested-item" :style="{ zIndex: 30 - nIdx }">
              <div class="nested-item-header">
                <span class="nested-item-title">{{ allTemplates[subConf.template]?.headerTitle || 'Состояние' }} {{ nIdx + 1 }}</span>
                <button class="btn-icon-danger-sm" @click="removeNestedItem(item, subConf, nIdx)">✕</button>
              </div>

              <!-- Поля вложенного элемента -->
              <div v-for="nField in getResolvedFields(subConf)" :key="'nf-'+nField.class" class="nested-field-group">
                <div class="field-label-row">
                  <label v-if="nField.label" class="nested-field-label">{{ nField.label }}</label>
                  <button 
                    v-if="sandboxMode && nField.type === 'select' && !nField.entityType" 
                    class="btn-edit-options-tiny"
                    @click="nField._editingOptions = !nField._editingOptions"
                  >
                    {{ nField._editingOptions ? '✅' : '✏️' }}
                  </button>
                </div>

                <div v-if="sandboxMode && nField._editingOptions && nField.type === 'select'" class="options-editor-mini">
                   <div class="options-grid">
                      <div v-for="(opt, oIdx) in nField.options" :key="oIdx" class="option-row">
                         <input v-model="opt.label" type="text" placeholder="Текст" class="input-base opt-input" />
                         <button class="btn-icon-danger-sm" @click="nField.options.splice(oIdx, 1)">✕</button>
                      </div>
                   </div>
                   <button class="btn-small-add" style="margin-top:8px; width: 100%;" @click="nField.options.push({label: 'Новый вариант', value: 'new_val'})">➕ Добавить</button>
                </div>

                <XboxWheel
v-if="nField.type === 'select'"
                  :horizontal="wheelHorizontal"
                  :model-value="String(nItem[nField.class] || '')"
                  :options="getOptions(nField)"
                  :placeholder="nField.placeholder"
                  @update:model-value="val => { 
                    console.log('[RelationshipBlock.nested] select в контейнере:', { nFieldClass: nField.class, val, nItemBefore: nItem[nField.class] });
                    nItem[nField.class] = val;
                    notifyNestedItemUpdate(subConf.dataPath || subConf.id);
                    console.log('[RelationshipBlock.nested] nItem обновлен:', { nItemAfter: nItem[nField.class] });
                  }"
                />

                <div v-else-if="nField.type === 'range'" class="range-wrap">
                  <input
type="range"
                    :min="nField.min ?? -100"
                    :max="nField.max ?? 100"
                    :value="nItem[nField.class] ?? 0"
                    class="range-input"
                    @input="e => { const input = e.target as HTMLInputElement; nItem[nField.class] = Number(input.value); notifyNestedItemUpdate(subConf.dataPath || subConf.id); }"
                  >
                  <span class="range-label">{{ nItem[nField.class] ?? 0 }}</span>
                </div>

                <textarea
                  v-else-if="nField.type === 'textarea'"
                  :value="nItem[nField.class] || ''"
                  class="input-base"
                  :rows="nField.rows || 2"
                  :placeholder="nField.placeholder"
                  @input="e => { const input = e.target as HTMLTextAreaElement; nItem[nField.class] = input.value; notifyNestedItemUpdate(subConf.dataPath || subConf.id); }"
                ></textarea>

                <input
                  v-else
                  :type="nField.type || 'text'"
                  :value="nItem[nField.class] || ''"
                  class="input-base"
                  :placeholder="nField.placeholder"
                  @input="e => { const input = e.target as HTMLInputElement; nItem[nField.class] = input.value; notifyNestedItemUpdate(subConf.dataPath || subConf.id); }"
                >
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ПРАВАЯ ПАНЕЛЬ — данные «другой» стороны -->
      <div class="rel-side rel-side-right">
        <div class="rel-side-header">{{ foreignLabel }}</div>

        <div v-if="!item[linkClass]" class="rel-side-empty">
          Выберите {{ templateConf.fields.find((f: any) => f.class === linkClass)?.label || 'запись' }} слева
        </div>

        <div v-else-if="foreignLoading" class="rel-side-empty">⏳ Загрузка...</div>
        <div v-else-if="foreignError" class="rel-side-empty" style="color:#ef4444;">{{ foreignError }}</div>

        <div v-else-if="foreignItem">
          <!-- Те же поля шаблона, но данные из foreignItem, поле линка заблокировано -->
          <div v-for="tField in templateConf.fields" :key="'f-'+tField.class" class="form-group" style="margin-bottom:10px;">
            <label v-if="tField.label" class="form-label" style="font-size:11px;">{{ tField.label }}</label>

            <XboxWheel
v-if="tField.class === linkClass"
              :horizontal="wheelHorizontal"
              :model-value="String(entityId)"
              :options="[{ value: String(entityId), label: myLabel }]"
              :disabled="true"
              :placeholder="myLabel"
            />

            <XboxWheel
v-else-if="tField.type === 'select'"
              :horizontal="wheelHorizontal"
              :model-value="String(foreignItem[tField.class] || '')"
              :options="getOptions(tField)"
              :placeholder="tField.placeholder"
              @update:model-value="val => { (foreignItem as any)[tField.class] = val; $emit('modified'); }"
            />

            <div v-else-if="tField.type === 'range'" class="range-wrap">
              <input
type="range"
                :min="tField.min ?? -100"
                :max="tField.max ?? 100"
                :value="foreignItem[tField.class] ?? 0"
                class="range-input"
                @input="e => { const input = e.target as HTMLInputElement; (foreignItem as any)[tField.class] = Number(input.value); $emit('modified'); }"
              >
              <span class="range-label">{{ foreignItem[tField.class] ?? 0 }}</span>
            </div>

            <input
              v-else-if="tField.type !== 'range'"
              :type="tField.type || 'text'"
              :value="foreignItem[tField.class] || ''"
              class="input-base"
              :placeholder="tField.placeholder"
              @input="e => { const input = e.target as HTMLInputElement; (foreignItem as any)[tField.class] = input.value; $emit('modified'); }"
            >
          </div>

          <!-- Вложенные контейнеры для «чужой» стороны -->
          <div v-if="templateConf.dynamicContainers" style="margin-top:14px;">
            <div v-for="subConf in templateConf.dynamicContainers" :key="'fs-'+subConf.id" class="sub-container">
              <div class="sub-header">
                <span>{{ subConf.title }}</span>
                <button class="btn-small-add" @click="addNestedItem(foreignItem, subConf)">➕</button>
              </div>

              <div v-if="!getNestedList(foreignItem, subConf).length" class="sub-empty">{{ subConf.emptyMessage || 'Пусто' }}</div>

              <div v-for="(nItem, nIdx) in getNestedList(foreignItem, subConf)" :key="nIdx" class="nested-item" :style="{ zIndex: 30 - nIdx }">
                <div class="nested-item-header">
                  <span class="nested-item-title">{{ allTemplates[subConf.template]?.headerTitle || 'Состояние' }} {{ nIdx + 1 }}</span>
                  <button class="btn-icon-danger-sm" @click="removeNestedItem(foreignItem, subConf, nIdx)">✕</button>
                </div>

                <div v-for="nField in getResolvedFields(subConf)" :key="'nff-'+nField.class" class="nested-field-group">
                  <div class="field-label-row">
                    <label v-if="nField.label" class="nested-field-label">{{ nField.label }}</label>
                    <button 
                      v-if="sandboxMode && nField.type === 'select' && !nField.entityType" 
                      class="btn-edit-options-tiny"
                      @click="nField._editingOptions = !nField._editingOptions"
                    >
                      {{ nField._editingOptions ? '✅' : '✏️' }}
                    </button>
                  </div>

                  <!-- Редактор опций для вложенных полей -->
                  <div v-if="sandboxMode && nField._editingOptions && nField.type === 'select'" class="options-editor-mini">
                     <div class="options-grid">
                        <div v-for="(opt, oIdx) in nField.options" :key="oIdx" class="option-row">
                           <input v-model="opt.label" type="text" placeholder="Текст" class="input-base opt-input" />
                           <button class="btn-icon-danger-sm" @click="nField.options.splice(oIdx, 1)">✕</button>
                        </div>
                     </div>
                     <button class="btn-small-add" style="margin-top:8px; width: 100%;" @click="nField.options.push({label: 'Новый вариант', value: 'new_val'})">➕ Добавить</button>
                  </div>

                  <XboxWheel
v-if="nField.type === 'select'"
                    :horizontal="wheelHorizontal"
                    :model-value="String(nItem[nField.class] || '')"
                    :options="getOptions(nField)"
                    :placeholder="nField.placeholder"
                    @update:model-value="val => { nItem[nField.class] = val; foreignModified = true; $emit('modified'); }"
                  />

                  <div v-else-if="nField.type === 'range'" class="range-wrap">
                    <input
type="range"
                      :min="nField.min ?? -100"
                      :max="nField.max ?? 100"
                      :value="nItem[nField.class] ?? 0"
                      class="range-input"
                      @input="e => { const input = e.target as HTMLInputElement; nItem[nField.class] = Number(input.value); foreignModified = true; $emit('modified'); }"
                    >
                    <span class="range-label">{{ nItem[nField.class] ?? 0 }}</span>
                  </div>

                  <textarea
                    v-else-if="nField.type === 'textarea'"
                    :value="nItem[nField.class] || ''"
                    class="input-base"
                    :rows="nField.rows || 2"
                    :placeholder="nField.placeholder"
                    @input="e => { const input = e.target as HTMLTextAreaElement; nItem[nField.class] = input.value; foreignModified = true; $emit('modified'); }"
                  ></textarea>

                  <input
                    v-else
                    :type="nField.type || 'text'"
                    :value="nItem[nField.class] || ''"
                    class="input-base"
                    :placeholder="nField.placeholder"
                    @input="e => { const input = e.target as HTMLInputElement; nItem[nField.class] = input.value; foreignModified = true; $emit('modified'); }"
                  >
                </div>
              </div>
            </div>
          </div>

          <!-- Инфо о несохранённых изменениях на той стороне -->
          <div v-if="foreignModified" class="foreign-modified-badge">
            ⚠️ Изменения на стороне "{{ foreignLabel }}" — будут сохранены при сохранении этой записи
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
