import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT_DIR = path.resolve(__dirname, '..');
const SCHEMAS_DIR = path.join(ROOT_DIR, 'apps', 'spa', 'public', 'struct', 'editor');
const SKILL_PATH = path.join(ROOT_DIR, 'apps', 'spa', 'public', 'skills', 'Конструктор_типов_сущностей.md');

console.log('🔄 Начинаем обновление схем и руководства навыка...');

// 1. Обновление ui_editor.json
const uiEditorPath = path.join(SCHEMAS_DIR, 'ui_editor.json');
if (fs.existsSync(uiEditorPath)) {
    const uiData = JSON.parse(fs.readFileSync(uiEditorPath, 'utf8'));

    // Обновляем шаблоны
    if (uiData.templates) {
        // Базовая хронология
        if (uiData.templates['Базовая хронология'] && uiData.templates['Базовая хронология'].fields) {
            uiData.templates['Базовая хронология'].fields = uiData.templates['Базовая хронология'].fields.map(f => {
                if (f.class === 'начальная_глава' || f.id === 'начальная_глава') {
                    return {
                        type: 'manuscript_point',
                        class: 'начальная_глава',
                        label: 'Начало в рукописи (Том / Арка / Глава)',
                        placeholder: 'Выберите том, арку и главу...'
                    };
                }
                if (f.class === 'конечная_глава' || f.id === 'конечная_глава') {
                    return {
                        type: 'manuscript_point',
                        class: 'конечная_глава',
                        label: 'Окончание в рукописи (Том / Арка / Глава)',
                        placeholder: 'Выберите том, арку и главу...',
                        allowAutoExtend: true
                    };
                }
                return f;
            });
        }

        // Двунаправленная связь -> relationshipStates
        if (uiData.templates['Двунаправленная связь'] && uiData.templates['Двунаправленная связь'].dynamicContainers) {
            uiData.templates['Двунаправленная связь'].dynamicContainers.forEach(dc => {
                if (dc.fields) {
                    dc.fields = dc.fields.map(f => {
                        if (f.class === 'начальная_глава' || f.id === 'начальная_глава') {
                            return {
                                type: 'manuscript_point',
                                class: 'начальная_глава',
                                label: 'Начало в рукописи (Том / Арка / Глава)',
                                placeholder: 'Выберите том, арку и главу...'
                            };
                        }
                        if (f.class === 'конечная_глава' || f.id === 'конечная_глава') {
                            return {
                                type: 'manuscript_point',
                                class: 'конечная_глава',
                                label: 'Окончание в рукописи (Том / Арка / Глава)',
                                placeholder: 'Выберите том, арку и главу...',
                                allowAutoExtend: true
                            };
                        }
                        return f;
                    });
                }
            });
        }
    }

    fs.writeFileSync(uiEditorPath, JSON.stringify(uiData, null, 2) + '\n', 'utf8');
    console.log('✅ ui_editor.json успешно обновлен!');
}

// 2. Рекурсивное обновление всех файлов схем (character, organization, state)
const schemaFiles = ['character.json', 'organization.json', 'state.json'];

function upgradeField(f) {
    if (!f || typeof f !== 'object') return f;
    
    // Приведение дат
    if (f.type === 'calendar_date' || f.type === 'calendar_date_base' || f.type === 'date') {
        f.type = 'calendar_datetime';
        if (!f.hint) f.hint = 'Многоуровневый выбор по календарю мира';
        if (!f.placeholder) f.placeholder = 'Выберите дату и время по календарю';
    }

    // Приведение точек рукописи
    const cls = (f.class || f.id || '').toLowerCase();
    if (cls === 'начальная_глава') {
        f.type = 'manuscript_point';
        f.label = f.label || 'Начало в рукописи (Том / Арка / Глава)';
        f.placeholder = f.placeholder || 'Выберите том, арку и главу...';
        delete f.entityType;
    } else if (cls === 'конечная_глава') {
        f.type = 'manuscript_point';
        f.label = f.label || 'Окончание в рукописи (Том / Арка / Глава)';
        f.placeholder = f.placeholder || 'Выберите том, арку и главу...';
        f.allowAutoExtend = true;
        delete f.entityType;
    }

    return f;
}

function processContainerOrSection(obj) {
    if (!obj || typeof obj !== 'object') return;

    if (Array.isArray(obj.fields)) {
        obj.fields = obj.fields.map(upgradeField);
    }

    if (Array.isArray(obj.dynamicContainers)) {
        obj.dynamicContainers.forEach(dc => {
            processContainerOrSection(dc);
        });
    }

    if (Array.isArray(obj.sections)) {
        obj.sections.forEach(sec => {
            processContainerOrSection(sec);
        });
    }

    if (obj.templates && typeof obj.templates === 'object') {
        Object.values(obj.templates).forEach(tpl => {
            processContainerOrSection(tpl);
        });
    }
}

for (const sFile of schemaFiles) {
    const sPath = path.join(SCHEMAS_DIR, sFile);
    if (fs.existsSync(sPath)) {
        const data = JSON.parse(fs.readFileSync(sPath, 'utf8'));
        processContainerOrSection(data);
        fs.writeFileSync(sPath, JSON.stringify(data, null, 2) + '\n', 'utf8');
        console.log(`✅ ${sFile} успешно проверен и обновлен!`);
    }
}

// 3. Обновление Конструктор_типов_сущностей.md
const updatedSkillContent = `# Навык: Конструктор типов сущностей (Schema Studio)

## Назначение

Помогай автору проектировать типы сущностей WorldWiki — структуру карточки, набор страниц (секций), поля и неатомарные контейнеры.

Используй актуальный каталог блоков Schema Editor как единственный источник допустимых элементов. Не придумывай типы полей и свойства, которых нет в текущем каталоге.

Навык отвечает за **проектирование структуры**, а не за самостоятельное изменение уже существующих типов без явного запроса автора.

---

## 🏛️ Двухуровневая Архитектура Схемы

Карточка любой сущности в WorldWiki организована строго по двухуровневой модели:

\`\`\`
┌─────────────────────────────────────────────────────────────────────────────┐
│ УРОВЕНЬ 1: КОРНЕВАЯ СХЕМА КАРТОЧКИ (Страницы / Sections)                    │
│ Метаданные: entityType, name, icon, iconEmoji, titleField, photoField       │
│ sections: [ Страница "Основное", Страница "Хронология", Страница "Связи" ]  │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
            ┌──────────────────────────┴──────────────────────────┐
            ▼                                                     ▼
┌────────────────────────────────────────┐  ┌────────────────────────────────────────┐
│ УРОВЕНЬ 2: СТРАНИЦА "Основное"         │  │ УРОВЕНЬ 2: СТРАНИЦА "Хронология"       │
│                                        │  │                                        │
│ 1. Атомарные скалярные поля (fields):  │  │ 1. Атомарные поля (fields): []         │
│    - название (text, required)         │  │                                        │
│    - фото (photo)                      │  │ 2. Неатомарные контейнеры              │
│    - дата_рождения (calendar_datetime) │  │    (dynamicContainers):                │
│    - теги (tags)                       │  │    ├─ "Эволюция возраста"              │
│    - описание (textarea)               │  │    │   template: "Базовая хронология"  │
│                                        │  │    │   fieldOverrides:                 │
│ 2. Неатомарные контейнеры: []          │  │    │     - название: label "Возраст"   │
│                                        │  │    │     - статус_категория: hidden    │
│                                        │  │    │     - описание_1..3: hidden       │
│                                        │  │    │     - числовой_показ.: hidden     │
│                                        │  │    └─ "Эволюция занятий"               │
│                                        │  │        template: "Базовая хронология"  │
│                                        │  │        fieldOverrides:                 │
│                                        │  │          - название: label "Профессия" │
│                                        │  │          - описание_1: label "Детали"  │
└────────────────────────────────────────┘  └────────────────────────────────────────┘
\`\`\`

### Уровень 1: Корневая схема карточки (Страницы)
- **Метаданные**:
  - \`entityType\`: уникальный латинский идентификатор в snake_case (например \`artifact\`, \`magic_spell\`).
  - \`name\`: человекочитаемое название на русском (например \`Артефакт\`).
  - \`icon\` / \`iconEmoji\`: иконка FontAwesome и Emoji.
  - \`titleField\`: всегда \`"название"\`.
  - \`photoField\`: всегда \`"фото"\`.
  - \`tagsField\`: всегда \`"теги"\`.
- **Массив страниц (\`sections\`)**:
  Каждый элемент массива \`sections\` формирует отдельную вкладку-страницу в боковом меню карточки сущности (\`id\`, \`title\`, \`icon\`, \`fields\`, \`dynamicContainers\`).

---

### Уровень 2: Внутренности страницы (Поля и Контейнеры)
На каждой странице находятся два типа компонентов:

#### 1. Атомарные скалярные поля (\`fields: SchemaField[]\`)
Одиночные поля ввода:
- \`text\`: короткая строка.
- \`textarea\`: многострочный текст (свойство \`rows: 2..6\`).
- \`number\`: числовое значение (\`min\`, \`max\`).
- \`range\`: ползунок со шкалой (\`min: 0\`, \`max: 100\`, \`value\`).
- \`select\`: одиночный выбор из \`options\` (\`[{ value: "...", label: "..." }]\`).
- \`multiselect\`: множественный выбор из \`options\` или привязка к сущностям (\`entityType: "character"\`).
- \`photo\`: загрузка и предпросмотр изображения.
- \`boolean\`: чекбокс Да/Нет.
- \`tags\`: поле тегов через Enter.

---

## ⚡ Составные (Неатомарные) Контролы в UI

В отличие от простых полей, следующие типы являются **сложными составными структурами**:

### 1. Точка рукописи: Том — Арка — Глава (\`type: "manuscript_point"\`)
Используется в хронологиях и динамике отношений. В UI рендерится как 3 независимых барабана прокрутки:
- **Барабан 1**: Том (\`volume_id\`)
- **Барабан 2**: Арка (\`arc_id\`)
- **Барабан 3**: Глава (\`chapter_id\`)
- **Автопродление (⚡ По наст. время)**: Для конечной точки (\`конечная_глава\`) активируется свойство \`allowAutoExtend: true\`. При его включении конечная граница автоматически привязывается к последней написанной главе произведения (\`is_auto_extend: true\`).

**Формат в данных:**
\`\`\`json
{
  "volume_id": "volumes:vol_1",
  "arc_id": "arcs:arc_1",
  "chapter_id": "chapters:ch_12",
  "is_auto_extend": false,
  "display_label": "Том 1 / Арка 1 / Глава 12"
}
\`\`\`

---

### 2. Календарь мира (\`type: "calendar_datetime"\`)
Используется для всех дат вселенной. В UI управляется универсальным селектором даты \`UniversalDatePicker\`:
- Выбор календаря мира (\`calendar_id\`).
- Выбор эпохи / летоисчисления (\`epoch_id\`).
- Выбор года (\`year\`), месяца (\`month_index\`), дня (\`day\`) с динамическим расчетом високосных дней под конкретный календарь.
- Выбор времени (\`hour\`, \`minute\`).
- Расчет и конвертация в Абсолютную Минуту ($M_{\\text{abs}} \\in \\mathbb{Z}$).

---

## 🧩 Неатомарные контейнеры и переиспользование шаблонов (\`fieldOverrides\`)

В \`ui_editor.json\` объявлены базовые шаблоны:
1. **\`"Базовая хронология"\`**: содержит \`начальная_глава\`, \`конечная_глава\`, \`статус_категория\`, \`название\`, \`описание_1\`, \`описание_2\`, \`описание_3\`, \`числовой_показатель\`.
2. **\`"Динамический элемент"\`**: содержит \`название\`, \`статус_категория\`, \`описание_1..3\`, \`дата\` (\`calendar_datetime\`), \`числовой_показатель\`.
3. **\`"Двунаправленная связь"\`**: содержит \`целевая_сущность\`, \`тип_отношения\` и вложенный контейнер \`relationshipStates\` (с привязкой к главам, силой связи \`-100..100\` и описанием причины).

### Правило сокрытия полей через \`fieldOverrides\`:
ИИ **НЕ ДОЛЖЕН** создавать новые уникальные шаблоны, если задачу можно решить базовым шаблоном со скрытием лишних полей:
\`\`\`json
{
  "id": "ageTimeline",
  "type": "timeline",
  "title": "Эволюция возраста",
  "template": "Базовая хронология",
  "dataPath": "эволюция_возраста",
  "fieldOverrides": {
    "название": { "label": "Возраст (лет)", "placeholder": "Например, 16 лет", "type": "text" },
    "статус_категория": { "hidden": true },
    "описание_1": { "hidden": true },
    "описание_2": { "hidden": true },
    "описание_3": { "hidden": true },
    "числовой_показатель": { "hidden": true }
  }
}
\`\`\`

---

## 🗺️ Эталонные образцы Mermaid-диаграмм

### Образец 1: Уровень 1 (Карточка сущности по страницам)
\`\`\`mermaid
mindmap
  root((Сущность: Артефакт))
    Страница 1: Основное
      название (text, обязательное)
      фото (photo)
      статус (select)
      дата_создания (calendar_datetime: Мировой календарь)
      теги (tags)
      описание (textarea)
    Страница 2: Свойства и Магия
      тип_артефакта (select)
      магическая_сила (range: 0-100)
      материал (text)
    Страница 3: Хронология владения
      история_владельцев (timeline: Базовая хронология)
      ключевые_события (timeline: Динамический элемент)
    Страница 4: Связи
      создатель (select: character)
      место_хранения (select: location)
      связанные_фракции (dynamic: Двунаправленная связь)
\`\`\`

### Образец 2: Уровень 2 (Детализация страницы с контейнерами и fieldOverrides)
\`\`\`mermaid
graph TD
    subgraph Page_Timeline ["Страница 3: Хронология владения (Уровень 2)"]
        direction TB
        
        subgraph Dyn_Owners ["Контейнер: История владельцев (timeline: Базовая хронология)"]
            direction TB
            O1["начальная_глава (Том / Арка / Глава) [Защищено]"]
            O2["конечная_глава (Том / Арка / Глава + ⚡ Автопродление) [Защищено]"]
            O3["название -> Label: 'Имя владельца' (text)"]
            O4["описание_1 -> Label: 'Обстоятельства получения / утраты' (textarea)"]
            O5["❌ статус_категория, описание_2..3, числовой_показатель (hidden: true)"]
        end

        subgraph Dyn_Events ["Контейнер: Ключевые события (timeline: Динамический элемент)"]
            direction TB
            E1["дата (Календарь / Эпоха / Год / Месяц / День / Время)"]
            E2["название -> Label: 'Название события' (text)"]
            E3["описание_1 -> Label: 'Что произошло' (textarea)"]
            E4["❌ статус_категория, описание_2..3, числовой_показатель (hidden: true)"]
        end
    end
\`\`\`

---

## Железные инварианты

- \`titleField\` всегда равен \`"название"\`.
- \`photoField\` всегда равен \`"фото"\`.
- \`tagsField\` всегда равен \`"теги"\`.
- В первой секции первым элементом \`fields\` всегда является:
  - \`id: "название"\`, \`type: "text"\`, \`required: true\`, \`path: "название"\`.
- \`entityType\` — уникальный латинский идентификатор в \`snake_case\`.
- Любая дата вселенной — **СТРОГО \`calendar_datetime\`**.
- Любая привязка к тексту книги — **СТРОГО \`manuscript_point\` (Том / Арка / Глава с автопродлением на конечной точке)**.
- Ненужные поля базовых шаблонов — **СТРОГО гасить через \`"fieldOverrides": { "поле": { "hidden": true } }\`**.
`;

fs.writeFileSync(SKILL_PATH, updatedSkillContent, 'utf8');
console.log('✅ Конструктор_типов_сущностей.md успешно обновлен!');

console.log('🎉 Все схемы и документация навыка успешно приведены к единому стандарту!');
