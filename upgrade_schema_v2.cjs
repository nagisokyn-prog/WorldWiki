const fs = require('fs');
const path = require('path');

const UI_EDITOR_PATH = 'src/struct/editor/ui_editor.json';
const ENTITY_PATHS = [
  'src/struct/editor/character.json',
  'src/struct/editor/organization.json',
  'src/struct/editor/state.json'
];

// 1. ОПРЕДЕЛЯЕМ НОВЫЕ БАЗОВЫЕ ШАБЛОНЫ
const baseTemplates = {
  "Базовая хронология": {
    "type": "timeline",
    "description": "Универсальный модуль хронологии.",
    "headerTitle": "Запись",
    "fields": [
      { "type": "select", "class": "начальная_глава", "label": "Начальная глава", "entityType": "chapter", "placeholder": "Выберите главу..." },
      { "type": "select", "class": "конечная_глава", "label": "Конечная глава", "entityType": "chapter", "placeholder": "Выберите главу..." },
      { "type": "select", "class": "статус_категория", "label": "Статус / Категория", "options": [{ "value": "", "label": "Не указано" }], "placeholder": "Выберите..." },
      { "type": "text", "class": "название", "label": "Название", "placeholder": "Введите название..." },
      { "type": "textarea", "class": "описание_1", "label": "Описание", "rows": 2, "placeholder": "..." },
      { "type": "textarea", "class": "описание_2", "label": "Дополнительно", "rows": 2, "placeholder": "..." },
      { "type": "textarea", "class": "описание_3", "label": "Дополнительно 2", "rows": 2, "placeholder": "..." },
      { "type": "range", "class": "числовой_показатель", "label": "Показатель", "placeholder": "0", "min": 0, "max": 100 }
    ],
    "itemClass": "timeline-item"
  },
  "Динамический элемент": {
    "type": "dynamic",
    "description": "Универсальный модуль без привязки к главам.",
    "headerTitle": "Элемент",
    "fields": [
      { "type": "text", "class": "название", "label": "Название", "placeholder": "..." },
      { "type": "select", "class": "статус_категория", "label": "Статус / Категория", "options": [{ "value": "", "label": "Не указано" }], "placeholder": "Выберите..." },
      { "type": "textarea", "class": "описание_1", "label": "Описание", "rows": 2, "placeholder": "..." },
      { "type": "textarea", "class": "описание_2", "label": "Дополнительно", "rows": 2, "placeholder": "..." },
      { "type": "textarea", "class": "описание_3", "label": "Дополнительно 2", "rows": 2, "placeholder": "..." },
      { "type": "calendar_date", "class": "дата", "label": "Дата", "placeholder": "Выберите дату..." },
      { "type": "range", "class": "числовой_показатель", "label": "Показатель", "placeholder": "0" }
    ],
    "itemClass": "dynamic-item"
  },
  "Двунаправленная связь": {
    "type": "dynamic",
    "isBidirectional": true,
    "description": "Универсальная связь с другой сущностью.",
    "headerTitle": "Связь",
    "fields": [
      { "type": "select", "class": "целевая_сущность", "label": "Связанная сущность", "entityType": "generic", "placeholder": "Выберите сущность..." },
      { "type": "select", "class": "тип_отношения", "label": "Тип связи", "options": [{ "value": "", "label": "Не указано" }], "placeholder": "Выберите тип..." },
      { "type": "text", "class": "название", "label": "Название/Роль", "placeholder": "..." },
      { "type": "calendar_date", "class": "дата", "label": "Дата", "placeholder": "Выберите дату..." },
      { "type": "textarea", "class": "описание_1", "label": "Детали", "rows": 2, "placeholder": "..." },
      { "type": "textarea", "class": "описание_2", "label": "Дополнительно", "rows": 2, "placeholder": "..." },
      { "type": "range", "class": "числовой_показатель", "label": "Показатель", "placeholder": "0" }
    ],
    "itemClass": "dynamic-item"
  },
  "Одиночный параметр": {
    "type": "dynamic",
    "headerTitle": "Параметр",
    "fields": [
      { "type": "calendar_date", "class": "значение_дата", "label": "Дата", "placeholder": "Выберите дату..." },
      { "type": "text", "class": "значение_текст", "label": "Значение", "placeholder": "..." }
    ],
    "itemClass": "dynamic-item"
  }
};

// 2. ОБНОВЛЯЕМ ui_editor.json
let uiData = JSON.parse(fs.readFileSync(UI_EDITOR_PATH, 'utf8'));
uiData.templates = baseTemplates; // Перезаписываем глобальные шаблоны
fs.writeFileSync(UI_EDITOR_PATH, JSON.stringify(uiData, null, 2));
console.log('ui_editor.json updated with unified base templates.');

// 3. ФУНКЦИЯ ДЛЯ МАППИНГА СТАРЫХ ПОЛЕЙ В НОВЫЕ С fieldOverrides
const mapFields = (oldFields, targetBaseTemplate) => {
  const overrides = {};
  const baseFields = baseTemplates[targetBaseTemplate].fields;
  
  // Доступные слоты
  const slots = {
    select: ['статус_категория', 'тип_отношения'],
    textarea: ['описание_1', 'описание_2', 'описание_3'],
    text: ['название', 'значение_текст'],
    calendar_date: ['дата', 'значение_дата'],
    range: ['числовой_показатель'],
    entity_select: ['целевая_сущность']
  };
  
  const usedSlots = new Set();
  
  oldFields.forEach(oldField => {
    // Пропускаем дефолтные для таймлайнов
    if (oldField.class === 'начальная_глава' || oldField.class === 'конечная_глава') return;
    
    let targetClass = null;
    
    // Определяем тип нужного слота
    if (targetBaseTemplate === 'Двунаправленная связь' && oldField.entityType) {
      targetClass = 'целевая_сущность';
    } else if (oldField.type === 'select' && oldField.options) {
      targetClass = slots.select.find(c => !usedSlots.has(c));
    } else if (oldField.type === 'textarea') {
      targetClass = slots.textarea.find(c => !usedSlots.has(c));
    } else if (oldField.type === 'calendar_date') {
      targetClass = slots.calendar_date.find(c => !usedSlots.has(c));
    } else if (oldField.type === 'range') {
      targetClass = slots.range.find(c => !usedSlots.has(c));
    } else {
      // Для text, multiselect, или fallback
      targetClass = slots.text.find(c => !usedSlots.has(c));
    }
    
    // Если слота подходящего типа не нашлось, запихнем в описание
    if (!targetClass) targetClass = slots.textarea.find(c => !usedSlots.has(c));
    
    if (targetClass) {
      usedSlots.add(targetClass);
      
      const override = {
        label: oldField.label || oldField.placeholder || oldField.class,
        placeholder: oldField.placeholder,
        type: oldField.type
      };
      
      if (oldField.options) override.options = oldField.options;
      if (oldField.entityType) override.entityType = oldField.entityType;
      
      overrides[targetClass] = override;
    }
  });
  
  // Все базовые поля, которые НЕ были использованы, скрываем!
  baseFields.forEach(bf => {
    if (bf.class !== 'начальная_глава' && bf.class !== 'конечная_глава' && !usedSlots.has(bf.class)) {
      overrides[bf.class] = { hidden: true };
    }
  });
  
  return overrides;
};

// 4. ОБРАБОТКА СУЩНОСТЕЙ
ENTITY_PATHS.forEach(filepath => {
  if (!fs.existsSync(filepath)) return;
  
  let data = JSON.parse(fs.readFileSync(filepath, 'utf8'));
  let localTemplates = data.templates || {};
  
  // У персонажей исторически шаблоны могли лежать в ui_editor, но если они есть локально - парсим.
  // Если их нет, мы не сможем перенести опции. Но я только что сделал git restore, так что они там.
  
  if (data.sections) {
    data.sections.forEach(sec => {
      if (sec.dynamicContainers) {
        sec.dynamicContainers.forEach(cont => {
          const oldTplName = cont.template;
          const oldTpl = localTemplates[oldTplName];
          
          if (oldTpl) {
            let targetBase = 'Динамический элемент';
            if (oldTpl.type === 'timeline') targetBase = 'Базовая хронология';
            
            const nLower = oldTplName.toLowerCase();
            if (nLower.includes('relation') || nLower.includes('ally') || nLower.includes('enemy') || nLower.includes('member') || nLower.includes('partner') || nLower.includes('linked')) {
              targetBase = 'Двунаправленная связь';
            }
            if (nLower.includes('disband') || nLower.includes('collapse') || nLower.includes('enddate')) {
              targetBase = 'Одиночный параметр';
            }
            
            cont.fieldOverrides = mapFields(oldTpl.fields || [], targetBase);
            cont.template = targetBase;
            
            // Если были вложенные контейнеры
            if (oldTpl.dynamicContainers) {
               // Мы пока просто оставим их как customChildContainers (EntityEditor придется доработать)
               cont.customChildContainers = oldTpl.dynamicContainers;
               cont.customChildContainers.forEach(sub => {
                  const subOld = localTemplates[sub.template];
                  if (subOld) {
                     sub.fieldOverrides = mapFields(subOld.fields || [], 'Динамический элемент');
                     sub.template = 'Динамический элемент';
                  }
               });
            }
          }
        });
      }
    });
  }
  
  delete data.templates;
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
  console.log('Migrated ' + filepath);
});
