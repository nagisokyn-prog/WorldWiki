<template>
  <div class="rel-block" :style="{ zIndex: 50 - idx }">

    <!-- Шапка элемента -->
    <div class="rel-header">
      <strong class="rel-title">{{ templateConf.headerTitle || 'Связь' }} #{{ idx + 1 }}</strong>
      <button class="btn-icon-danger" @click="$emit('remove', idx)" title="Удалить">🗑️</button>
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
              @click="tField._editingOptions = !tField._editingOptions"
              title="Изменить варианты выбора"
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
          <XboxWheel :horizontal="wheelHorizontal"
            v-if="tField.class === linkClass"
            :model-value="String(item[tField.class] || '')"
            @update:modelValue="val => onLinkChange(tField.class, val)"
            :options="getOptions(tField)"
            :placeholder="tField.placeholder"
          />

          <XboxWheel :horizontal="wheelHorizontal"
            v-else-if="tField.type === 'select'"
            :key="tField.class + '-select'"
            :model-value="String(item[tField.class] || '')"
            @update:modelValue="val => { item[tField.class] = val; notifyItemUpdate(); }"
            :options="getOptions(tField)"
            :placeholder="tField.placeholder"
          />

          <div v-else-if="tField.type === 'range'" class="range-wrap-vertical">
            <div class="range-display">{{ item[tField.class] ?? 0 }}</div>
            <input
              type="range"
              :min="tField.min ?? -100"
              :max="tField.max ?? 100"
              :value="item[tField.class] ?? 0"
              @input="e => { const input = e.target as HTMLInputElement; item[tField.class] = Number(input.value); notifyItemUpdate(); }"
              class="range-input"
            >
          </div>

          <textarea
            v-else-if="tField.type === 'textarea'"
            :value="item[tField.class] || ''"
            @input="e => { item[tField.class] = (e.target as HTMLTextAreaElement).value; notifyItemUpdate(); }"
            class="input-base"
            :placeholder="tField.placeholder"
            rows="3"
          ></textarea>

          <input
            v-else
            :type="tField.type || 'text'"
            :value="item[tField.class] || ''"
            @input="e => { item[tField.class] = (e.target as HTMLInputElement).value; notifyItemUpdate(); }"
            class="input-base"
            :placeholder="tField.placeholder"
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
            <div class="sub-header">
              <span>{{ subConf.title }}</span>
              <button class="btn-small-add" @click="addNestedItem(item, subConf)">➕</button>
            </div>

            <div v-if="!getNestedList(item, subConf).length" class="sub-empty">{{ subConf.emptyMessage || 'Пусто' }}</div>

            <div
              v-for="(nItem, nIdx) in getNestedList(item, subConf)"
              :key="nIdx"
              class="nested-item"
              :style="{ zIndex: 30 - nIdx }"
            >
              <div class="nested-item-header">
                <span class="nested-item-title">{{ allTemplates[subConf.template]?.headerTitle || 'Состояние' }} {{ nIdx + 1 }}</span>
                <button class="btn-icon-danger-sm" @click="removeNestedItem(item, subConf, nIdx)">✕</button>
              </div>

              <div v-for="nField in getResolvedFields(subConf)" :key="nField.class" class="nested-field-group">
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

                <XboxWheel :horizontal="wheelHorizontal"
                  v-if="nField.type === 'select'"
                  :model-value="String(nItem[nField.class] || '')"
                  @update:modelValue="val => { 
                    console.log('[RelationshipBlock.nested] select в контейнере:', { nFieldClass: nField.class, val, nItemBefore: nItem[nField.class] });
                    nItem[nField.class] = val;
                    notifyNestedItemUpdate(subConf.dataPath || subConf.id);
                    console.log('[RelationshipBlock.nested] nItem обновлен:', { nItemAfter: nItem[nField.class] });
                  }"
                  :options="getOptions(nField)"
                  :placeholder="nField.placeholder"
                />

                <div v-else-if="nField.type === 'range'" class="range-wrap">
                  <input type="range"
                    :min="nField.min ?? -100"
                    :max="nField.max ?? 100"
                    :value="nItem[nField.class] ?? 0"
                    @input="e => { const input = e.target as HTMLInputElement; nItem[nField.class] = Number(input.value); notifyNestedItemUpdate(subConf.dataPath || subConf.id); }"
                    class="range-input"
                  >
                  <span class="range-label">{{ nItem[nField.class] ?? 0 }}</span>
                </div>

                <textarea
                  v-else-if="nField.type === 'textarea'"
                  :value="nItem[nField.class] || ''"
                  @input="e => { const input = e.target as HTMLTextAreaElement; nItem[nField.class] = input.value; notifyNestedItemUpdate(subConf.dataPath || subConf.id); }"
                  class="input-base"
                  :rows="nField.rows || 2"
                  :placeholder="nField.placeholder"
                ></textarea>

                <input
                  v-else
                  :type="nField.type || 'text'"
                  :value="nItem[nField.class] || ''"
                  @input="e => { const input = e.target as HTMLInputElement; nItem[nField.class] = input.value; notifyNestedItemUpdate(subConf.dataPath || subConf.id); }"
                  class="input-base"
                  :placeholder="nField.placeholder"
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

            <XboxWheel :horizontal="wheelHorizontal"
              v-if="tField.class === linkClass"
              :model-value="String(entityId)"
              :options="[{ value: String(entityId), label: myLabel }]"
              :disabled="true"
              :placeholder="myLabel"
            />

            <XboxWheel :horizontal="wheelHorizontal"
              v-else-if="tField.type === 'select'"
              :model-value="String(foreignItem[tField.class] || '')"
              @update:modelValue="val => { (foreignItem as any)[tField.class] = val; $emit('modified'); }"
              :options="getOptions(tField)"
              :placeholder="tField.placeholder"
            />

            <div v-else-if="tField.type === 'range'" class="range-wrap">
              <input type="range"
                :min="tField.min ?? -100"
                :max="tField.max ?? 100"
                :value="foreignItem[tField.class] ?? 0"
                @input="e => { const input = e.target as HTMLInputElement; (foreignItem as any)[tField.class] = Number(input.value); $emit('modified'); }"
                class="range-input"
              >
              <span class="range-label">{{ foreignItem[tField.class] ?? 0 }}</span>
            </div>

            <input
              v-else-if="tField.type !== 'range'"
              :type="tField.type || 'text'"
              :value="foreignItem[tField.class] || ''"
              @input="e => { const input = e.target as HTMLInputElement; (foreignItem as any)[tField.class] = input.value; $emit('modified'); }"
              class="input-base"
              :placeholder="tField.placeholder"
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

                  <XboxWheel :horizontal="wheelHorizontal"
                    v-if="nField.type === 'select'"
                    :model-value="String(nItem[nField.class] || '')"
                    @update:modelValue="val => { nItem[nField.class] = val; foreignModified = true; $emit('modified'); }"
                    :options="getOptions(nField)"
                    :placeholder="nField.placeholder"
                  />

                  <div v-else-if="nField.type === 'range'" class="range-wrap">
                    <input type="range"
                      :min="nField.min ?? -100"
                      :max="nField.max ?? 100"
                      :value="nItem[nField.class] ?? 0"
                      @input="e => { const input = e.target as HTMLInputElement; nItem[nField.class] = Number(input.value); foreignModified = true; $emit('modified'); }"
                      class="range-input"
                    >
                    <span class="range-label">{{ nItem[nField.class] ?? 0 }}</span>
                  </div>

                  <textarea
                    v-else-if="nField.type === 'textarea'"
                    :value="nItem[nField.class] || ''"
                    @input="e => { const input = e.target as HTMLTextAreaElement; nItem[nField.class] = input.value; foreignModified = true; $emit('modified'); }"
                    class="input-base"
                    :rows="nField.rows || 2"
                    :placeholder="nField.placeholder"
                  ></textarea>

                  <input
                    v-else
                    :type="nField.type || 'text'"
                    :value="nItem[nField.class] || ''"
                    @input="e => { const input = e.target as HTMLInputElement; nItem[nField.class] = input.value; foreignModified = true; $emit('modified'); }"
                    class="input-base"
                    :placeholder="nField.placeholder"
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
import { ref, computed, watch, onMounted } from 'vue';
import XboxWheel from './XboxWheel.vue';
import { settingsService } from '../../services/settings.service';
import { apiService } from '../../services/api.service';

const wheelHorizontal = ref(settingsService.getSettings()?.dropdowns?.wheelOrientation === 'horizontal');

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

const foreignItem = ref<any>(null);
const foreignLoading = ref(false);
const foreignError = ref('');
const foreignModified = ref(false);

const getResolvedFields = (subConf: any) => {
  let tpl: any = null;
  if (subConf.fields && !subConf.template) {
    tpl = subConf;
  } else {
    tpl = props.allTemplates[subConf.template];
  }
  if (!tpl || !tpl.fields) return [];
  if (!subConf.fieldOverrides) return tpl.fields;
  
  return tpl.fields.map((f: any) => {
    const override = subConf.fieldOverrides[f.class];
    if (override) {
      if (override.hidden) return null;
      return { ...f, ...override };
    }
    return f;
  }).filter((f: any) => f !== null);
};

// Имя поля-ссылки (персонаж / родственник)
const linkClass = computed(() => props.templateConf.bidirectionalLinkClass || '');

// Подпись "моей" стороны
const myLabel = computed(() => {
  const myList = props.referenceData[props.entityType] || [];
  return myList.find((o: any) => String(o.value) === String(props.entityId))?.label || 'Эта запись';
});

// Подпись чужой
const foreignLabel = computed(() => {
  if (!props.item[linkClass.value]) return 'Взаимное отношение';
  const entityType = props.templateConf.fields.find((f: any) => f.class === linkClass.value)?.entityType;
  const list = entityType ? (props.referenceData[entityType] || []) : [];
  return list.find((o: any) => String(o.value) === String(props.item[linkClass.value]))?.label || 'Выбранная запись';
});

// Helper для синхронизации item с родителем
const notifyItemUpdate = (): void => {
  console.log('[RelationshipBlock] notifyItemUpdate: отправляю modified для idx:', props.idx);
  emit('modified');
};

// Helper для синхронизации вложенного контейнера (динамика_отношений и т.д.)
const notifyNestedItemUpdate = (containerKey: string): void => {
  console.log('[RelationshipBlock] notifyNestedItemUpdate: пересоздаю контейнер:', containerKey);
  // Пересоздаем контейнер чтобы Vue заметил изменение внутри
  if (props.item[containerKey] && Array.isArray(props.item[containerKey])) {
    const containerBefore = props.item[containerKey] as any[];
    console.log('[RelationshipBlock] ДО пересоздания:', {
      containerKey,
      length: containerBefore.length,
      firstItem: containerBefore[0]
    });
    
    const newArray = [];
    for (let i = 0; i < containerBefore.length; i++) {
      newArray.push(containerBefore[i]);
    }
    props.item[containerKey] = newArray;
    
    const containerAfter = props.item[containerKey] as any[];
    console.log('[RelationshipBlock] ПОСЛЕ пересоздания:', {
      containerKey,
      length: containerAfter.length,
      firstItem: containerAfter[0]
    });
  }
  emit('modified');
};

// Обработчик для select полей
const onSelectChange = (fieldClass: string, val: any): void => {
  console.log('[RelationshipBlock.onSelectChange] новое значение:', { fieldClass, val, itemBefore: props.item[fieldClass] });
  props.item[fieldClass] = val;
  console.log('[RelationshipBlock.onSelectChange] item обновлен:', { itemAfter: props.item[fieldClass] });
  notifyItemUpdate();
};

// Фабрика для создания обработчика каждого поля (чтобы Vue правильно привязал)
const makeSelectHandler = (fieldClass: string) => {
  return (val: any) => {
    console.log('[RelationshipBlock.makeSelectHandler] вызван обработчик:', { fieldClass, val });
    onSelectChange(fieldClass, val);
  };
};

const fetchForeignItem = async () => {
  const targetId = props.item[linkClass.value];
  console.log('[RelationshipBlock] fetchForeignItem: targetId =', targetId);
  
  if (!targetId) {
    foreignItem.value = null;
    return;
  }

  // В РЕЖИМЕ КОНСТРУКТОРА: показываем фейковые данные для зеркалки
  if (props.sandboxMode) {
    console.log('[RelationshipBlock] sandboxMode: создаю фейковую зеркалку');
    foreignItem.value = {
      [linkClass.value]: props.entityId,
      динамика_отношений: []
    };
    return;
  }

  await loadForeignItem(targetId);
};

const onLinkChange = async (fieldClass: string, val: any): Promise<void> => {
  props.item[fieldClass] = val;
  emit('modified');
  await fetchForeignItem();
};

const loadForeignItem = async (targetId: any): Promise<void> => {
  const tpl = props.templateConf;
  const linkField = tpl.fields.find((f: any) => f.class === linkClass.value);
  const targetEntityType = linkField?.entityType;
  if (!targetEntityType) return;

  foreignLoading.value = true;
  foreignError.value = '';
  foreignModified.value = false;

  try {
    console.log('[RelationshipBlock] loadForeignItem: загружаю данные для', { targetEntityType, targetId, currentEntityId: props.entityId, linkClass: linkClass.value });
    
    const targetData = await apiService.getEntity(props.project, targetEntityType, String(targetId));
    if (!targetData) {
      throw new Error(`Entity ${targetId} not found or returned null`);
    }

    // Ищем в данных чужого персонажа запись, ссылающуюся на нас
    const containerConf = tpl; // шаблон = контейнер
    let relArray: any[] = [];
    const tData = (targetData as any).data || targetData;

    // Пробуем найти контейнер в данных
    if (tpl.dynamicContainers) {
      for (const sub of tpl.dynamicContainers) {
        const key = sub.dataPath || sub.id;
        const arr = getDeepProp(tData, key);
        console.log('[RelationshipBlock] проверяю контейнер', key, ':', Array.isArray(arr) ? arr.length + ' элементов' : 'не массив');
        if (Array.isArray(arr)) { relArray = arr; break; }
      }
    }
    
    // Также проверяем плоский путь
    if (relArray.length === 0 && tData.characterRelationships) {
      console.log('[RelationshipBlock] используем плоский путь characterRelationships:', tData.characterRelationships.length);
      relArray = tData.characterRelationships;
    }

    console.log('[RelationshipBlock] найден массив отношений:', relArray.length, 'элементов');
    relArray.forEach((r: any, idx: number) => {
      console.log('[RelationshipBlock]   [' + idx + ']', { [linkClass.value]: r[linkClass.value], базовый_тип_связи: r['базовый_тип_связи'] });
    });

    // Ищем запись где linkClass === наш id
    let matched: any = relArray.find((r: any) => String(r[linkClass.value]) === String(props.entityId));
    console.log('[RelationshipBlock] найдено встречное отношение:', matched);
    
    if (!matched) {
      console.log('[RelationshipBlock] встречное отношение не найдено, создаю пустое');
      matched = { [linkClass.value]: props.entityId };
      
      // Инициализируем пустые вложенные контейнеры
      if (props.templateConf.dynamicContainers) {
        props.templateConf.dynamicContainers.forEach((sub: any) => {
          const key = sub.dataPath || sub.id;
          matched[key] = [];
        });
        console.log('[RelationshipBlock] инициализированы пустые вложенные контейнеры:', Object.keys(matched));
      }
      
      // УДАЛЯЕМ лишние дублирующие ключи (relationshipStates если есть динамика_отношений)
      if (matched['динамика_отношений'] !== undefined && matched['relationshipStates'] !== undefined) {
        delete matched['relationshipStates'];
      }
    }

    // ГЛУБОКОЕ КОПИРОВАНИЕ встречного отношения (включая вложенные контейнеры!)
    const deepCopied = JSON.parse(JSON.stringify(matched));
    console.log('[RelationshipBlock] встречное отношение после deep copy:', deepCopied);
    foreignItem.value = deepCopied;
  } catch(e) {
    console.error('[RelationshipBlock] loadForeignItem error:', e);
    foreignError.value = 'Ошибка загрузки: ' + String(e);
  } finally {
    foreignLoading.value = false;
  }
};

// Восстановить когда пропс уже содержит данные (при открытии существующей записи)
watch(() => props.item[linkClass.value], (newVal) => {
  console.log('[RelationshipBlock] 👁️ watch props.item изменился:', {
    linkClass: linkClass.value,
    newVal,
    itemKeys: Object.keys(props.item),
    item: props.item
  });
  if (newVal && !foreignItem.value) {
    loadForeignItem(String(newVal));
  }
}, { immediate: true });

// Отдать чужие данные наружу при каждом изменении foreignItem
watch(foreignItem, (val: any) => {
  if (val) {
    // ОЧИЩАЕМ лишние ключи перед отправкой
    const cleanedData = { ...(val || {}) };
    if (cleanedData['динамика_отношений'] !== undefined) {
      delete cleanedData['relationshipStates'];
    }
    if (cleanedData['семейные_отношения'] !== undefined) {
      delete cleanedData['familyRelationshipStates'];
    }
    
    const entityTypeVal = props.templateConf.fields.find((f: any) => f.class === linkClass.value)?.entityType;
    const targetEntityId = String(props.item[linkClass.value]);
    
    console.log('[RelationshipBlock] emit foreign-update с данными:', {
      entityType: entityTypeVal,
      entityId: targetEntityId,
      dataKeys: Object.keys(cleanedData),
      dataWithContainers: cleanedData
    });
    emit('foreign-update', {
      entityType: entityTypeVal,
      entityId: targetEntityId,
      data: cleanedData,
      linkClass: linkClass.value,
      backLinkValue: props.entityId
    });
  }
}, { deep: true, flush: 'sync' });

// Получить опции для поля
const getOptions = (field: any): any[] => {
  if (field.options?.length) return field.options;
  if (field.entityType && props.referenceData[field.entityType]) return props.referenceData[field.entityType];
  return [];
};

// Вложенный список
const getNestedList = (sourceItem: any, subConf: any): any[] => {
  const key = subConf.dataPath || subConf.id;
  const val = getDeepProp(sourceItem, key);
  const result = Array.isArray(val) ? val : [];
  console.log('[RelationshipBlock] getNestedList:', { 
    key, 
    hasValue: val !== undefined,
    isArray: Array.isArray(val),
    length: result.length,
    value: val
  });
  return result;
};

const addNestedItem = (sourceItem: any, subConf: any): void => {
  const key = subConf.dataPath || subConf.id;
  console.log('[RelationshipBlock] addNestedItem вызван:', { key, sourceItemKeys: Object.keys(sourceItem), hasKey: key in sourceItem });
  
  if (!sourceItem[key]) {
    console.log(`[RelationshipBlock] Создаю массив для ключа "${key}"`);
    sourceItem[key] = [];
  }
  
  let tpl: any = null;
  if (subConf.fields && !subConf.template) {
    tpl = subConf;
  } else {
    tpl = props.allTemplates[subConf.template];
  }
  const newEntry: any = {};
  tpl?.fields?.forEach((f: any) => { newEntry[f.class] = f.value ?? ''; });
  
  const beforeLen = sourceItem[key].length;
  console.log('[RelationshipBlock] Добавляю новый элемент:', { 
    key, 
    newEntry,
    arrayBefore: beforeLen,
    sourceItemKeys: Object.keys(sourceItem)
  });
  
  sourceItem[key].push(newEntry);
  
  const afterLen = sourceItem[key].length;
  console.log('[RelationshipBlock] После добавления:', {
    key,
    arrayAfter: afterLen,
    arrayContents: sourceItem[key],
    fullItem: sourceItem
  });
  
  // ВАЖНО: явно отправляем обновлённый item при добавлении вложенного элемента
  console.log('[RelationshipBlock] emit modified после addNestedItem, sourceItem:', sourceItem);
  notifyItemUpdate();
};

const removeNestedItem = (sourceItem: any, subConf: any, nIdx: number): void => {
  const key = subConf.dataPath || subConf.id;
  if (Array.isArray(sourceItem[key])) {
    sourceItem[key].splice(nIdx, 1);
    notifyItemUpdate();
  }
};

const getDeepProp = (obj: any, path: string): any => {
  if (!path || !obj) return undefined;
  return path.split('.').reduce((cur: any, k: string) => (cur && cur[k] !== undefined ? cur[k] : undefined), obj);
};
</script>

<style scoped>
.rel-block {
  position: relative;
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 16px;
  padding: 16px;
  margin-bottom: 16px;
  background: rgba(255,255,255,0.02);
}

.rel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 14px;
  padding-bottom: 10px;
  border-bottom: 1px solid rgba(255,255,255,0.05);
}

.rel-title {
  color: var(--accent, #a78bfa);
  font-size: 13px;
}

.rel-split {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

@media (max-width: 700px) {
  .rel-split { grid-template-columns: 1fr; }
}

.rel-side {
  border-radius: 12px;
  padding: 14px;
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.06);
  overflow: visible;
}

.rel-side-header {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.8px;
  color: var(--text-muted, rgba(255,255,255,0.4));
  margin-bottom: 12px;
  font-weight: 600;
}

.rel-side-left .rel-side-header { color: var(--accent, #a78bfa); }
.rel-side-right .rel-side-header { color: #60a5fa; }

.rel-side-empty {
  color: var(--text-muted, rgba(255,255,255,0.3));
  text-align: center;
  padding: 30px 10px;
  font-size: 13px;
}

.field-label-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.btn-edit-options-tiny {
  background: rgba(167, 139, 250, 0.1);
  border: 1px solid rgba(167, 139, 250, 0.2);
  color: #a78bfa;
  border-radius: 4px;
  cursor: pointer;
  font-size: 10px;
  padding: 0 4px;
  transition: all 0.2s;
}
.btn-edit-options-tiny:hover { background: rgba(167, 139, 250, 0.2); }

.options-editor-mini {
  background: rgba(0,0,0,0.25);
  border: 1px dashed rgba(255,255,255,0.1);
  border-radius: 8px;
  padding: 10px;
  margin-bottom: 12px;
}

.sub-container-title {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: rgba(255,255,255,0.5);
  margin-bottom: 14px;
  text-align: center;
}

.sub-container-wrap {
  margin-top: 12px;
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 12px;
  background: rgba(255,255,255,0.01);
  overflow: visible;
}

.range-wrap-vertical {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px 0;
}

.range-display {
  font-size: 14px;
  font-weight: 600;
  color: var(--accent, #a78bfa);
  text-align: center;
}

.sub-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 16px;
  border-bottom: 1px solid rgba(255,255,255,0.05);
}

.sub-header span {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.8px;
  color: rgba(255,255,255,0.4);
}

.sub-empty {
  padding: 12px;
  text-align: center;
  font-size: 12px;
  color: rgba(255,255,255,0.2);
}

.nested-item {
  position: relative;
  padding: 16px;
  border-bottom: 1px solid rgba(255,255,255,0.06);
  overflow: visible;
  display: flex;
  flex-direction: column;
  gap: 0;
}
.nested-item:last-child { border-bottom: none; }

.nested-item-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 14px;
}

.nested-item-title {
  font-size: 12px;
  font-weight: 600;
  color: rgba(255,255,255,0.7);
}

.nested-field-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 12px;
  width: 100%;
}

.nested-field-label {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.8px;
  color: rgba(255,255,255,0.45);
}

.btn-icon-danger {
  background: transparent;
  border: none;
  color: #ef4444;
  cursor: pointer;
  font-size: 16px;
  padding: 2px 4px;
  transition: opacity 0.2s;
}
.btn-icon-danger:hover { opacity: 0.7; }

.btn-icon-danger-sm {
  background: transparent;
  border: none;
  color: #ef4444;
  cursor: pointer;
  font-size: 12px;
  padding: 0 4px;
}

.btn-small-add {
  background: transparent;
  border: 1px solid rgba(255,255,255,0.1);
  color: var(--text-muted, rgba(255,255,255,0.5));
  cursor: pointer;
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 6px;
  transition: all 0.2s;
}
.btn-small-add:hover {
  border-color: var(--accent, #a78bfa);
  color: var(--accent, #a78bfa);
}

.range-wrap {
  display: flex;
  align-items: center;
  gap: 10px;
}
.range-input {
  flex: 1;
  accent-color: var(--accent, #a78bfa);
}
.range-label {
  min-width: 36px;
  text-align: right;
  font-size: 12px;
  color: var(--accent, #a78bfa);
  font-weight: 600;
}

.foreign-modified-badge {
  margin-top: 10px;
  padding: 8px 12px;
  border-radius: 8px;
  font-size: 11px;
  background: rgba(251,191,36,0.08);
  border: 1px solid rgba(251,191,36,0.2);
  color: #fbbf24;
}
</style>
