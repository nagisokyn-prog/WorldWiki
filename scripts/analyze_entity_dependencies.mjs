import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT_DIR = path.resolve(__dirname, '..');
const SCHEMAS_DIR = path.join(ROOT_DIR, 'apps', 'spa', 'public', 'struct', 'editor');
const CALENDAR_README_PATH = path.join(ROOT_DIR, 'src-tauri', 'crates', 'worldwiki-calendar-core', 'README.md');

// ==============================================================================
// 7 ВЕЧНЫХ СУЩНОСТЕЙ СИСТЕМЫ WORLDWIKI
// ==============================================================================
const CORE_7_ENTITIES = [
  { id: 'state', ruName: 'Государство', short: 'гос', icon: '🏛️', file: 'state.json' },
  { id: 'organization', ruName: 'Организация', short: 'орг', icon: '🏢', file: 'organization.json' },
  { id: 'location', ruName: 'Локация', short: 'лок', icon: '📍', file: 'location.json' },
  { id: 'event', ruName: 'Событие', short: 'соб', icon: '📜', file: 'event.json' },
  { id: 'item', ruName: 'Артефакт / Предмет', short: 'арт', icon: '🗡️', file: 'item.json' },
  { id: 'character', ruName: 'Персонаж', short: 'перс', icon: '👤', file: 'character.json' },
  { id: 'calendar', ruName: 'Календарь', short: 'кал', icon: '🪐', isCoreTimeEngine: true }
];

console.log('='.repeat(80));
console.log('🏛️ АНАЛИЗАТОР 7 ВЕЧНЫХ СУЩНОСТЕЙ И ГРАФА СВЯЗЕЙ WORLDWIKI');
console.log('='.repeat(80));

// 1. Чтение и парсинг 6 файловых сущностей редактора (без ui_editor.json)
const schemas = {};
for (const ent of CORE_7_ENTITIES) {
  if (ent.file) {
    const fullPath = path.join(SCHEMAS_DIR, ent.file);
    if (!fs.existsSync(fullPath)) {
      console.warn(`⚠️ Файл не найден: ${ent.file}`);
      continue;
    }
    const raw = fs.readFileSync(fullPath, 'utf8');
    const data = JSON.parse(raw);
    schemas[ent.id] = {
      ...ent,
      sizeBytes: raw.length,
      linesCount: raw.split('\n').length,
      sections: data.sections || [],
      systemFields: [],
      customFields: [],
      dynamicContainers: [],
      temporalContainers: []
    };
  } else if (ent.id === 'calendar') {
    // 7-я сущность: Календарь (основан на worldwiki-calendar-core)
    schemas['calendar'] = {
      ...ent,
      sizeBytes: fs.existsSync(CALENDAR_README_PATH) ? fs.readFileSync(CALENDAR_README_PATH, 'utf8').length : 0,
      linesCount: 445,
      sections: [
        { id: 'structure', title: 'Структура года и месяцев' },
        { id: 'dial', title: 'Циферблат и деление суток' },
        { id: 'leap', title: 'Високосные гармоники и дрейф' },
        { id: 'eras', title: 'Эры и летоисчисления' },
        { id: 'succession', title: 'Преемственность и реформы' },
        { id: 'astronomy', title: 'Астрономия солнца и лун' },
        { id: 'dst', title: 'Часовые пояса и сезонный перевод стрелок' }
      ],
      systemFields: [
        { id: 'calendarName', path: 'название', type: 'text', label: 'Название календаря', isSystem: true },
        { id: 'planetId', path: 'planet_id', type: 'select', label: 'Планета / Небесное тело', isSystem: true },
        { id: 'originDay', path: 'origin_world_day', type: 'number', label: 'Точка отсчета эпохи', isSystem: true },
        { id: 'isDefault', path: 'is_default', type: 'boolean', label: 'Календарь по умолчанию', isSystem: true }
      ],
      customFields: [],
      dynamicContainers: [],
      temporalContainers: []
    };
  }
}

// 2. Извлечение полей и контейнеров из 6 файловых схем
const allFieldPaths = new Map();
const edges = [];

for (const [sourceType, schema] of Object.entries(schemas)) {
  if (sourceType === 'calendar') continue;

  for (const section of schema.sections) {
    const secTitle = section.title || section.id;

    if (Array.isArray(section.fields)) {
      for (const field of section.fields) {
        const fieldInfo = {
          id: field.id,
          label: field.label || field.id,
          path: field.path || field.id,
          type: field.type,
          isSystem: !!(field.isSystem || field.preventDelete),
          required: !!field.required,
          sectionTitle: secTitle,
          sourceType
        };

        if (fieldInfo.isSystem) {
          schema.systemFields.push(fieldInfo);
        } else {
          schema.customFields.push(fieldInfo);
        }

        const pathKey = fieldInfo.path.toLowerCase();
        if (!allFieldPaths.has(pathKey)) {
          allFieldPaths.set(pathKey, []);
        }
        allFieldPaths.get(pathKey).push({ sourceType, fieldId: fieldInfo.id, label: fieldInfo.label });

        if (field.entityType) {
          edges.push({
            from: sourceType,
            to: field.entityType,
            kind: 'field',
            fieldId: field.id,
            label: field.label,
            type: field.type,
            section: secTitle,
            isTemporal: field.type === 'calendar_datetime' || field.type === 'manuscript_point'
          });
        }
      }
    }

    if (Array.isArray(section.dynamicContainers)) {
      for (const dc of section.dynamicContainers) {
        const isTemporal = dc.type === 'timeline' || dc.template === 'Базовая хронология' || dc.template === 'Динамический элемент';
        const dcInfo = {
          id: dc.id,
          title: dc.title || dc.id,
          type: dc.type,
          template: dc.template,
          dataPath: dc.dataPath,
          sectionTitle: secTitle,
          sourceType,
          isTemporal,
          fieldOverrides: dc.fieldOverrides || {}
        };

        schema.dynamicContainers.push(dcInfo);
        if (isTemporal) {
          schema.temporalContainers.push(dcInfo);
        }

        if (dc.fieldOverrides) {
          for (const [fName, fOverride] of Object.entries(dc.fieldOverrides)) {
            if (fOverride.entityType) {
              edges.push({
                from: sourceType,
                to: fOverride.entityType,
                kind: 'dynamicContainer',
                containerId: dc.id,
                containerTitle: dc.title,
                overrideField: fName,
                label: fOverride.label || dc.title,
                section: secTitle,
                template: dc.template,
                isTemporal
              });
            }
          }
        }
      }
    }
  }
}

// 3. 6 КЛЮЧЕВЫХ ПАРНЫХ БЛОКОВ ВЗАИМООТНОШЕНИЙ + 7-Й БЛОК КАЛЕНДАРЯ
const RELATION_BLOCKS = [
  {
    blockId: 1,
    title: '1) ГОСУДАРСТВО (гос-*)',
    primary: 'state',
    pairs: [
      { target: 'state', name: 'гос — гос', desc: 'Дипломатические отношения, границы, союзы, войны, договоры, признание' },
      { target: 'organization', name: 'гос — орг', desc: 'Законы, лицензии, признание/запрет организаций, партии, конфессии' },
      { target: 'event', name: 'гос — соб', desc: 'Основание, падение, реформы, революции, битвы, подписание пактов' },
      { target: 'location', name: 'гос — лок', desc: 'Столичные регионы, административные границы, аннексии, провинции' },
      { target: 'character', name: 'гос — перс', desc: 'Правители, монархи, министры, послы, почетные граждане, изменники' }
    ]
  },
  {
    blockId: 2,
    title: '2) ОРГАНИЗАЦИЯ (орг-*)',
    primary: 'organization',
    pairs: [
      { target: 'organization', name: 'орг — орг', desc: 'Альянсы гильдий, материнские/дочерние структуры, слияния, конкуренция' },
      { target: 'character', name: 'орг — перс', desc: 'Лидеры, основатели, рядовые члены, агенты, изгнанники' },
      { target: 'event', name: 'орг — соб', desc: 'Основание, тайные спецоперации, внутренние расколы, банкротства' },
      { target: 'item', name: 'орг — арт', desc: 'Священные реликвии, арсеналы, владение артефактами, производство' },
      { target: 'location', name: 'орг — лок', desc: 'Штаб-квартиры, филиалы, тайные убежища, контрольные точки' }
    ]
  },
  {
    blockId: 3,
    title: '3) ПЕРСОНАЖ (перс-*)',
    primary: 'character',
    pairs: [
      { target: 'character', name: 'перс — перс', desc: 'Родство, романтика, брак, вражда, дружба, наставничество, соперничество' },
      { target: 'event', name: 'перс — соб', desc: 'Участие в ключевых битвах, гибель, коронация, подвиги, суд' },
      { target: 'item', name: 'перс — арт', desc: 'Создатель артефакта, текущий владелец, ношение экипировки, похищение' },
      { target: 'location', name: 'перс — лок', desc: 'Место рождения, проживание, место гибели, посещенные локации' }
    ]
  },
  {
    blockId: 4,
    title: '4) АРТЕФАКТ / ПРЕДМЕТ (арт-*)',
    primary: 'item',
    pairs: [
      { target: 'item', name: 'арт — арт', desc: 'Составные части комплекта, парное оружие, родственные артефакты' },
      { target: 'location', name: 'арт — лок', desc: 'Место сокрытия/хранения, кузница создания, место утраты/захоронения' },
      { target: 'event', name: 'арт — соб', desc: 'Применение в решающих битвах, активация, кража, уничтожение' }
    ]
  },
  {
    blockId: 5,
    title: '5) ЛОКАЦИЯ (лок-*)',
    primary: 'location',
    pairs: [
      { target: 'location', name: 'лок — лок', desc: 'Топологическая вложенность (комната ⊂ замок ⊂ город), границы, тракты' },
      { target: 'event', name: 'лок — соб', desc: 'Место исторических битв, катастроф, мирных конференций, оснований' }
    ]
  },
  {
    blockId: 6,
    title: '6) СОБЫТИЕ (соб-*)',
    primary: 'event',
    pairs: [
      { target: 'event', name: 'соб — соб', desc: 'Причинно-следственные связи (причина ➔ следствие), декомпозиция на микро-события' }
    ]
  },
  {
    blockId: 7,
    title: '7) КАЛЕНДАРЬ И ВСЕОБЩЕЕ ВРЕМЯ (worldwiki-calendar-core) — ПРОНИЗЫВАЕТ ВСЕ СУЩНОСТИ',
    primary: 'calendar',
    pairs: [
      { target: 'state', name: 'кал — гос', desc: 'Государственные календари, эры правления (CoreEra), реформы (CalendarSuccession: DiscontinuousGap, TransitionalYear)' },
      { target: 'organization', name: 'кал — орг', desc: 'Культовые циклы, литургические годы, праздники через рубеж года (holidays), паузы недели (weekdays_with_pause)' },
      { target: 'character', name: 'кал — перс', desc: 'Культурный расчет возраста (src/age.rs: western/eastern/year), проверка непротиворечивости (Consistency Engine: смерть, билокация)' },
      { target: 'location', name: 'кал — лок', desc: 'Планетарная астрономия (astronomy.rs: восход, закат, белые ночи), часовые пояса и сезонный перевод стрелок (DstPolicy, PlanetTimezone)' },
      { target: 'item', name: 'кал — арт', desc: 'Циклы лунных фаз (moons.rs: двойные полнолуния), перезарядка в дни солнцестояний (seasons.rs)' },
      { target: 'event', name: 'кал — соб', desc: 'Точная координата абсолютной минуты (M_abs / t_abs), интервальная алгебра Аллена (src/allen.rs: 13 отношений)' },
      { target: 'calendar', name: 'кал — кал', desc: 'Связывание календарей метрополии и колоний (src/sync.rs: anchor_world_day), взаимная конвертация через t_abs (src/conversion.rs)' }
    ]
  }
];

// 4. Построение отчета
const reportData = {
  timestamp: new Date().toISOString(),
  core7Summary: CORE_7_ENTITIES.map(e => ({
    id: e.id,
    ruName: e.ruName,
    short: e.short,
    file: e.file || 'worldwiki-calendar-core',
    lines: schemas[e.id]?.linesCount || 0,
    sizeKb: schemas[e.id]?.sizeBytes ? (schemas[e.id].sizeBytes / 1024).toFixed(1) : '0',
    sectionsCount: schemas[e.id]?.sections?.length || 0,
    containersCount: schemas[e.id]?.dynamicContainers?.length || 0,
    temporalContainersCount: schemas[e.id]?.temporalContainers?.length || 0
  })),
  relationBlocks: RELATION_BLOCKS,
  detectedEdgesCount: edges.length,
  temporalEdgesCount: edges.filter(e => e.isTemporal).length,
  staticEdgesCount: edges.filter(e => !e.isTemporal).length,
  allEdges: edges
};

const reportPath = path.join(ROOT_DIR, 'scripts', 'entity_dependency_report.json');
fs.writeFileSync(reportPath, JSON.stringify(reportData, null, 2), 'utf8');

console.log('✅ Анализ успешно выполнен!');
console.log(`💾 Отчет сохранен в: ${reportPath}`);
console.log(`Обнаружено 7 вечных сущностей, 6 парных блоков связей и фундаментальный темпоральный базис calendar-core.`);
