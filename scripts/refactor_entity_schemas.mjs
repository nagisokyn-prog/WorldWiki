import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT_DIR = path.resolve(__dirname, '..');
const SCHEMAS_DIR = path.join(ROOT_DIR, 'apps', 'spa', 'public', 'struct', 'editor');

console.log('🚀 Запуск оптимизации и рефакторинга JSON-схем сущностей...');
console.log(`📁 Директория схем: ${SCHEMAS_DIR}`);

// Вспомогательная функция для измерения размера файла
function getFileSizeKb(filePath) {
  if (!fs.existsSync(filePath)) return 0;
  const stats = fs.statSync(filePath);
  return (stats.size / 1024).toFixed(1);
}

const initialSizes = {};
const files = ['character.json', 'organization.json', 'state.json', 'location.json', 'item.json', 'event.json'];
for (const file of files) {
  initialSizes[file] = getFileSizeKb(path.join(SCHEMAS_DIR, file));
}

// -----------------------------------------------------------------------------
// 1. РЕФАКТОРИНГ ORGANIZATION.JSON
// -----------------------------------------------------------------------------
function refactorOrganizationSchema() {
  const filePath = path.join(SCHEMAS_DIR, 'organization.json');
  if (!fs.existsSync(filePath)) return;
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

  // 1.1 Единый шаблон динамики отношений организаций
  const organizationRelationshipsStateTemplate = {
    type: 'timeline',
    fields: [
      {
        type: 'manuscript_point',
        class: 'начальная_глава',
        label: 'Начало в рукописи (Том / Глава)',
        placeholder: 'Выберите том и главу...'
      },
      {
        type: 'manuscript_point',
        class: 'конечная_глава',
        label: 'Окончание в рукописи (Том / Глава)',
        placeholder: 'Выберите том и главу...',
        allowAutoExtend: true
      },
      {
        type: 'select',
        class: 'статус_категория',
        label: 'Статус / Уровень',
        options: [
          { value: '', label: 'Не указано' },
          { value: 'улучшение', label: '📈 Улучшение отношений' },
          { value: 'ухудшение', label: '📉 Ухудшение отношений' },
          { value: 'разрыв', label: '❌ Разрыв отношений' },
          { value: 'эскалация', label: '⚔️ Эскалация конфликта' },
          { value: 'пакт', label: '🤝 Заключение договора/пакта' }
        ]
      },
      {
        type: 'range',
        class: 'сила_отношений',
        min: -100,
        max: 100,
        value: 0,
        label: 'Отношение (-100 вражда .. 100 союз)'
      },
      {
        type: 'textarea',
        class: 'описание_1',
        label: 'Описание события / Причина изменения',
        rows: 2
      }
    ],
    itemClass: 'relationship-state-item',
    headerTitle: 'ДИНАМИКА ОТНОШЕНИЙ'
  };

  // 1.2 Единый шаблон отношений между организациями (Org <-> Org)
  const organizationRelationshipsTemplate = {
    type: 'dynamic',
    isBidirectional: true,
    bidirectionalLinkClass: 'целевая_сущность',
    fields: [
      {
        type: 'select',
        class: 'целевая_сущность',
        label: 'Организация',
        entityType: 'organization',
        placeholder: 'Выберите организацию...'
      },
      {
        type: 'select',
        class: 'тип_отношения',
        label: 'Тип отношений',
        options: [
          { value: '', label: 'Не указано' },
          { value: 'союз', label: '🤝 Союз / Партнерство' },
          { value: 'вражда', label: '⚔️ Вражда / Вооруженный конфликт' },
          { value: 'соперничество', label: '🎯 Соперничество / Конкуренция' },
          { value: 'нейтралитет', label: '⚖️ Нейтралитет' },
          { value: 'вассал', label: '👑 Подчинение / Филиал / Вассал' },
          { value: 'патрон', label: '🏛️ Патронаж / Материнская компания' },
          { value: 'торговля', label: '💰 Торговое партнерство' }
        ]
      },
      {
        type: 'textarea',
        class: 'описание_1',
        label: 'Описание отношений и история взаимодействия',
        rows: 3
      }
    ],
    itemClass: 'dynamic-item',
    headerTitle: 'Отношения с организацией',
    dynamicContainers: [
      {
        id: 'динамика_отношений',
        type: 'dynamic',
        title: 'ДИНАМИКА ОТНОШЕНИЙ',
        emptyMessage: 'Добавьте изменения в отношениях',
        template: 'organizationRelationshipsStateTemplate',
        dataPath: 'динамика_отношений'
      }
    ]
  };

  // 1.3 Шаблон отношений с государствами (Org <-> State)
  const orgStateRelTemplate = {
    type: 'dynamic',
    isBidirectional: true,
    bidirectionalLinkClass: 'целевая_сущность',
    fields: [
      {
        type: 'select',
        class: 'целевая_сущность',
        label: 'Государство',
        entityType: 'state',
        placeholder: 'Выберите государство...'
      },
      {
        type: 'select',
        class: 'тип_отношения',
        label: 'Правовой и политический статус в государстве',
        options: [
          { value: '', label: 'Не указано' },
          { value: 'легальная', label: '🟢 Официально признана / Зарегистрирована' },
          { value: 'государственная', label: '🏛️ Государственная структура / Ведомство' },
          { value: 'субсидируемая', label: '💰 Получает субсидии / Гос. поддержка' },
          { value: 'нейтральная', label: '⚖️ Нейтральная / Частная деятельность' },
          { value: 'ограниченная', label: '🟡 Ограничена в правах / Под надзором' },
          { value: 'запрещенная', label: '🔴 Запрещена / Экстремистская' },
          { value: 'подпольная_война', label: '⚔️ Вооруженное сопротивление / Партизаны' }
        ]
      },
      {
        type: 'textarea',
        class: 'описание_1',
        label: 'Влияние на власть и законы государства',
        rows: 3
      }
    ],
    itemClass: 'dynamic-item',
    headerTitle: 'Отношения с государством',
    dynamicContainers: [
      {
        id: 'динамика_статуса_в_государстве',
        type: 'dynamic',
        title: 'ЭВОЛЮЦИЯ СТАТУСА',
        emptyMessage: 'Добавьте изменения правового или политического статуса',
        template: 'organizationRelationshipsStateTemplate',
        dataPath: 'динамика_статуса'
      }
    ]
  };

  // Заменяем шаблоны в секции templates, удаляя дублирующие alliesTemplate и enemiesTemplate
  data.templates = data.templates || {};
  data.templates.organizationRelationshipsTemplate = organizationRelationshipsTemplate;
  data.templates.organizationRelationshipsStateTemplate = organizationRelationshipsStateTemplate;
  data.templates.orgStateRelTemplate = orgStateRelTemplate;

  delete data.templates.alliesTemplate;
  delete data.templates.alliesStateTemplate;
  delete data.templates.enemiesTemplate;
  delete data.templates.enemiesStateTemplate;

  // Обновляем секцию relationships
  const relSection = data.sections.find(s => s.id === 'relationships');
  if (relSection && Array.isArray(relSection.dynamicContainers)) {
    // Перенаправляем allies и enemies на общий шаблон или убираем дублирование
    relSection.dynamicContainers.forEach(dc => {
      if (dc.id === 'allies') {
        dc.template = 'organizationRelationshipsTemplate';
        dc.emptyMessage = 'Союзники не добавлены';
      } else if (dc.id === 'enemies') {
        dc.template = 'organizationRelationshipsTemplate';
        dc.emptyMessage = 'Враждебные организации не добавлены';
      } else if (dc.id === 'organizationRelationships') {
        dc.template = 'organizationRelationshipsTemplate';
      }
    });

    // Добавляем контейнер связей с государствами, если его еще нет
    const hasStateRel = relSection.dynamicContainers.some(dc => dc.id === 'stateRelationships');
    if (!hasStateRel) {
      relSection.dynamicContainers.push({
        id: 'stateRelationships',
        type: 'dynamic',
        title: 'Юрисдикция и отношения с государствами',
        emptyMessage: 'Связи с государствами не добавлены',
        template: 'orgStateRelTemplate',
        dataPath: 'отношения_с_государствами'
      });
    }
  }

  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
  console.log('✅ organization.json успешно отрефакторен!');
}

// -----------------------------------------------------------------------------
// 2. РЕФАКТОРИНГ STATE.JSON
// -----------------------------------------------------------------------------
function refactorStateSchema() {
  const filePath = path.join(SCHEMAS_DIR, 'state.json');
  if (!fs.existsSync(filePath)) return;
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

  // 2.1 Единый шаблон динамики отношений государств
  const stateRelStateTemplate = {
    type: 'timeline',
    fields: [
      {
        type: 'manuscript_point',
        class: 'начальная_глава',
        label: 'Начало в рукописи (Том / Глава)',
        placeholder: 'Выберите том и главу...'
      },
      {
        type: 'manuscript_point',
        class: 'конечная_глава',
        label: 'Окончание в рукописи (Том / Глава)',
        placeholder: 'Выберите том и главу...',
        allowAutoExtend: true
      },
      {
        type: 'select',
        class: 'статус_категория',
        label: 'Дипломатический статус',
        options: [
          { value: '', label: 'Не указано' },
          { value: 'улучшение', label: '📈 Улучшение / Сближение' },
          { value: 'ухудшение', label: '📉 Охлаждение / Кризис' },
          { value: 'договор', label: '📜 Подписание договора / Пакта' },
          { value: 'разрыв', label: '❌ Разрыв дипотношений' },
          { value: 'война', label: '⚔️ Объявление войны' },
          { value: 'перемирие', label: '🕊️ Перемирие / Мирный договор' },
          { value: 'капитуляция', label: '🏳️ Капитуляция / Аннексия' }
        ]
      },
      {
        type: 'range',
        class: 'сила_отношений',
        min: -100,
        max: 100,
        value: 0,
        label: 'Индекс отношений (-100 война .. 100 союз)'
      },
      {
        type: 'textarea',
        class: 'описание_1',
        label: 'Описание события / Пункты соглашения',
        rows: 2
      }
    ],
    itemClass: 'relationship-state-item',
    headerTitle: 'ДИНАМИКА ОТНОШЕНИЙ'
  };

  // 2.2 Единый шаблон Государство <-> Государство (State <-> State)
  const stateStateRelTemplate = {
    type: 'dynamic',
    isBidirectional: true,
    bidirectionalLinkClass: 'целевая_сущность',
    fields: [
      {
        type: 'select',
        class: 'целевая_сущность',
        label: 'Государство',
        entityType: 'state',
        placeholder: 'Выберите государство...'
      },
      {
        type: 'select',
        class: 'тип_отношения',
        label: 'Тип отношений',
        options: [
          { value: '', label: 'Не указано' },
          { value: 'союз', label: '🤝 Военно-политический союзник' },
          { value: 'война', label: '⚔️ Состояние войны' },
          { value: 'холодная_война', label: '❄️ Противостояние / Холодная война' },
          { value: 'торговля', label: '💰 Торговый партнер / Экономический союз' },
          { value: 'нейтралитет', label: '⚖️ Нейтралитет / Пакт о ненападении' },
          { value: 'вассал', label: '👑 Вассал / Протекторат / Колония' },
          { value: 'сюзерен', label: '🏛️ Сюзерен / Метрополия' },
          { value: 'санкции', label: '🚫 Торговое эмбарго / Блокада' }
        ]
      },
      {
        type: 'textarea',
        class: 'описание_1',
        label: 'Суть соглашений и история взаимоотношений',
        rows: 3
      }
    ],
    itemClass: 'dynamic-item',
    headerTitle: 'Отношения с государством',
    dynamicContainers: [
      {
        id: 'динамика_отношений',
        type: 'dynamic',
        title: 'ДИНАМИКА ОТНОШЕНИЙ',
        emptyMessage: 'Добавьте этапы взаимоотношений',
        template: 'stateStateRelStateTemplate',
        dataPath: 'динамика_отношений'
      }
    ]
  };

  // 2.3 Единый шаблон Государство <-> Организация (State <-> Org)
  const stateOrgRelTemplate = {
    type: 'dynamic',
    isBidirectional: true,
    bidirectionalLinkClass: 'целевая_сущность',
    fields: [
      {
        type: 'select',
        class: 'целевая_сущность',
        label: 'Организация',
        entityType: 'organization',
        placeholder: 'Выберите организацию...'
      },
      {
        type: 'select',
        class: 'тип_отношения',
        label: 'Статус организации в государстве',
        options: [
          { value: '', label: 'Не указано' },
          { value: 'гос_орган', label: '🏛️ Государственное ведомство / Гос. аппарат' },
          { value: 'союзная_чвк', label: '⚔️ Союзная организация / ЧВК / Орден' },
          { value: 'корпорация', label: '🏢 Крупный налогоплательщик / Корпорация' },
          { value: 'лояльная', label: '🟢 Лояльная общественная структура' },
          { value: 'оппозиция', label: '🟡 Оппозиционная фракция' },
          { value: 'запрещенная', label: '🔴 Запрещенная / Террористическая' },
          { value: 'внешний_партнер', label: '🌐 Международная организация / Иностранная' }
        ]
      },
      {
        type: 'textarea',
        class: 'описание_1',
        label: 'Роль организации в делах государства',
        rows: 3
      }
    ],
    itemClass: 'dynamic-item',
    headerTitle: 'Отношения с организацией',
    dynamicContainers: [
      {
        id: 'динамика_отношений',
        type: 'dynamic',
        title: 'ДИНАМИКА ОТНОШЕНИЙ',
        emptyMessage: 'Добавьте изменения статуса',
        template: 'stateRelStateTemplate',
        dataPath: 'динамика_отношений'
      }
    ]
  };

  data.templates = data.templates || {};

  // Сохраняем членов правительства (Персонажи)
  const govMembersTemplate = data.templates.govMembersTemplate;
  const govMembersStateTemplate = data.templates.govMembersStateTemplate;
  // Обновляем dynamicContainers в секциях state.json
  data.sections.forEach(sec => {
    if (Array.isArray(sec.dynamicContainers)) {
      sec.dynamicContainers.forEach(dc => {
        if (dc.template === 'diplomaticRelationsTemplate' || dc.template === 'tradePartnersTemplate') {
          dc.template = 'stateStateRelTemplate';
        } else if (dc.template === 'linkedOrgsTemplate' || dc.template === 'relationsWithOrgsTemplate') {
          dc.template = 'stateOrgRelTemplate';
        }
      });
    }
  });

  // Очищаем и заменяем на унифицированные шаблоны без дубликатов
  data.templates = {
    ...(govMembersTemplate ? { govMembersTemplate } : {}),
    ...(govMembersStateTemplate ? { govMembersStateTemplate } : {}),
    stateStateRelTemplate,
    stateStateRelStateTemplate: stateRelStateTemplate,
    stateOrgRelTemplate,
    stateRelStateTemplate
  };

  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
  console.log('✅ state.json успешно отрефакторен (без дубликатов)!');
}

// -----------------------------------------------------------------------------
// 3. РЕФАКТОРИНГ CHARACTER.JSON
// -----------------------------------------------------------------------------
function refactorCharacterSchema() {
  const filePath = path.join(SCHEMAS_DIR, 'character.json');
  if (!fs.existsSync(filePath)) return;
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

  data.templates = data.templates || {};

  // 3.1 Шаблон Членство в Организациях (Character <-> Organization)
  const characterOrganizationTemplate = {
    type: 'dynamic',
    isBidirectional: true,
    bidirectionalLinkClass: 'целевая_сущность',
    fields: [
      {
        type: 'select',
        class: 'целевая_сущность',
        label: 'Организация',
        entityType: 'organization',
        placeholder: 'Выберите организацию...'
      },
      {
        type: 'text',
        class: 'должность_ранг',
        label: 'Должность / Звание / Ранг',
        placeholder: 'Например: Капитан стражи, Архимаг, Рядовой...'
      },
      {
        type: 'select',
        class: 'тип_отношения',
        label: 'Роль и членство',
        options: [
          { value: '', label: 'Не указано' },
          { value: 'лидер', label: '👑 Лидер / Глава' },
          { value: 'член', label: '👤 Полноправный участник' },
          { value: 'новобранец', label: '🔰 Новобранец / Стажер' },
          { value: 'агент', label: '🕵️ Тайный агент / Информатор' },
          { value: 'союзник', label: '🤝 Внештатный союзник' },
          { value: 'бывший_член', label: '🚪 Бывший участник / В отставке' },
          { value: 'дезертир_враг', label: '⚔️ Дезертир / Изменник' }
        ]
      },
      {
        type: 'textarea',
        class: 'описание_1',
        label: 'Обязанности и влияние в организации',
        rows: 3
      }
    ],
    itemClass: 'dynamic-item',
    headerTitle: 'Членство в организации',
    dynamicContainers: [
      {
        id: 'карьера_в_организации',
        type: 'timeline',
        title: 'КАРЬЕРА И ИСТОРИЯ ЧЛЕНСТВА',
        emptyMessage: 'Добавьте этапы службы или смены рангов',
        template: 'characterOrganizationStateTemplate',
        dataPath: 'история_членства'
      }
    ]
  };

  const characterOrganizationStateTemplate = {
    type: 'timeline',
    fields: [
      {
        type: 'manuscript_point',
        class: 'начальная_глава',
        label: 'Начало в рукописи (Том / Глава)',
        placeholder: 'Выберите том и главу...'
      },
      {
        type: 'manuscript_point',
        class: 'конечная_глава',
        label: 'Окончание в рукописи (Том / Глава)',
        placeholder: 'Выберите том и главу...',
        allowAutoExtend: true
      },
      {
        type: 'select',
        class: 'статус_категория',
        label: 'Событие карьеры',
        options: [
          { value: '', label: 'Не указано' },
          { value: 'вступление', label: '🟢 Вступление / Присяга' },
          { value: 'повышение', label: '📈 Повышение в звании' },
          { value: 'награда', label: '🎖️ Награда / Орден' },
          { value: 'понижение', label: '📉 Разжалование' },
          { value: 'увольнение', label: '🟡 Почетная отставка' },
          { value: 'изгнание', label: '🔴 Исключение / Трибунал' }
        ]
      },
      {
        type: 'textarea',
        class: 'описание_1',
        label: 'Подробности события',
        rows: 2
      }
    ],
    itemClass: 'relationship-state-item',
    headerTitle: 'ЭТАП СЛУЖБЫ'
  };

  // 3.2 Шаблон Подданство / Гражданство (Character <-> State)
  const characterStateTemplate = {
    type: 'dynamic',
    isBidirectional: true,
    bidirectionalLinkClass: 'целевая_сущность',
    fields: [
      {
        type: 'select',
        class: 'целевая_сущность',
        label: 'Государство',
        entityType: 'state',
        placeholder: 'Выберите государство...'
      },
      {
        type: 'select',
        class: 'тип_отношения',
        label: 'Правовой статус и подданство',
        options: [
          { value: '', label: 'Не указано' },
          { value: 'гражданин', label: '🟢 Гражданин / Подданный' },
          { value: 'правитель', label: '👑 Монарх / Глава государства' },
          { value: 'госслужащий', label: '🏛️ Чиновник / Министр' },
          { value: 'дворянин', label: '⚜️ Аристократ / Дворянин' },
          { value: 'иностранец', label: '⚪ Иностранец / Гость' },
          { value: 'беженец', label: '🟡 Беженец / Проситель убежища' },
          { value: 'изгнанник', label: '🟠 Изгнанник / Лишен прав' },
          { value: 'враг_народа', label: '🔴 Государственный преступник / В розыске' }
        ]
      },
      {
        type: 'textarea',
        class: 'описание_1',
        label: 'Статус перед законом и отношение властей',
        rows: 3
      }
    ],
    itemClass: 'dynamic-item',
    headerTitle: 'Отношения с государством',
    dynamicContainers: [
      {
        id: 'динамика_подданства',
        type: 'timeline',
        title: 'ЭВОЛЮЦИЯ СТАТУСА В ГОСУДАРСТВЕ',
        emptyMessage: 'Добавьте изменения статуса (розыск, амнистия, награды)',
        template: 'characterStateStateTemplate',
        dataPath: 'динамика_подданства'
      }
    ]
  };

  const characterStateStateTemplate = {
    type: 'timeline',
    fields: [
      {
        type: 'manuscript_point',
        class: 'начальная_глава',
        label: 'Начало в рукописи (Том / Глава)',
        placeholder: 'Выберите том и главу...'
      },
      {
        type: 'manuscript_point',
        class: 'конечная_глава',
        label: 'Окончание в рукописи (Том / Глава)',
        placeholder: 'Выберите том и главу...',
        allowAutoExtend: true
      },
      {
        type: 'select',
        class: 'статус_категория',
        label: 'Событие статуса',
        options: [
          { value: '', label: 'Не указано' },
          { value: 'получение_прав', label: '🟢 Получение подданства' },
          { value: 'госнаграда', label: '🎖️ Государственная награда' },
          { value: 'объявлен_розыск', label: '🔴 Объявлен в розыск' },
          { value: 'амнистия', label: '🕊️ Амнистия / Помилование' },
          { value: 'лишение_прав', label: '❌ Лишение титула / Изгнание' }
        ]
      },
      {
        type: 'textarea',
        class: 'описание_1',
        label: 'Описание указа или инцидента',
        rows: 2
      }
    ],
    itemClass: 'relationship-state-item',
    headerTitle: 'ИЗМЕНЕНИЕ СТАТУСА'
  };

  data.templates.characterOrganizationTemplate = characterOrganizationTemplate;
  data.templates.characterOrganizationStateTemplate = characterOrganizationStateTemplate;
  data.templates.characterStateTemplate = characterStateTemplate;
  data.templates.characterStateStateTemplate = characterStateStateTemplate;

  // Добавляем новые контейнеры в секцию relationships
  const relSection = data.sections.find(s => s.id === 'relationships');
  if (relSection) {
    relSection.dynamicContainers = relSection.dynamicContainers || [];

    const hasOrg = relSection.dynamicContainers.some(dc => dc.id === 'characterOrganizations');
    if (!hasOrg) {
      relSection.dynamicContainers.push({
        id: 'characterOrganizations',
        type: 'dynamic',
        title: 'Организации и фракции',
        emptyMessage: 'Связи с организациями не добавлены',
        template: 'characterOrganizationTemplate',
        dataPath: 'состоит_в_организациях'
      });
    }

    const hasState = relSection.dynamicContainers.some(dc => dc.id === 'characterStates');
    if (!hasState) {
      relSection.dynamicContainers.push({
        id: 'characterStates',
        type: 'dynamic',
        title: 'Государственная принадлежность и подданство',
        emptyMessage: 'Подданство или статус в государствах не указаны',
        template: 'characterStateTemplate',
        dataPath: 'подданство_и_статус'
      });
    }
  }

  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
  console.log('✅ character.json успешно отрефакторен со связями Org/State!');
}

// -----------------------------------------------------------------------------
// 4. РЕФАКТОРИНГ ITEM.JSON
// -----------------------------------------------------------------------------
function refactorItemSchema() {
  const filePath = path.join(SCHEMAS_DIR, 'item.json');
  if (!fs.existsSync(filePath)) return;
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

  // Добавим собственный типизированный шаблон двунаправленной связи предмета
  data.templates = data.templates || {};
  data.templates.itemRelationshipTemplate = {
    type: 'dynamic',
    isBidirectional: true,
    bidirectionalLinkClass: 'целевая_сущность',
    fields: [
      {
        type: 'select',
        class: 'целевая_сущность',
        label: 'Связанная сущность',
        entityType: 'generic',
        placeholder: 'Выберите персонажа, организацию или государство...'
      },
      {
        type: 'select',
        class: 'тип_отношения',
        label: 'Тип связи с предметом',
        options: [
          { value: '', label: 'Не указано' },
          { value: 'владелец', label: '👤 Законный владелец / Носитель' },
          { value: 'создатель', label: '⚒️ Создатель / Кузнец / Автор' },
          { value: 'ищет', label: '🔍 Охотится за предметом / Ищет' },
          { value: 'хранитель', label: '🛡️ Охраняет / Сторожит артефакт' },
          { value: 'уничтожитель', label: '💥 Пытается уничтожить' },
          { value: 'символ_власти', label: '👑 Государственный символ власти' }
        ]
      },
      {
        type: 'textarea',
        class: 'описание_1',
        label: 'История связи и роль предмета',
        rows: 2
      }
    ],
    itemClass: 'dynamic-item',
    headerTitle: 'Связь с предметом',
    dynamicContainers: [
      {
        id: 'динамика_связи',
        type: 'timeline',
        title: 'ИСТОРИЯ СВЯЗИ',
        emptyMessage: 'Добавьте этапы взаимодействия',
        template: 'itemRelationshipStateTemplate',
        dataPath: 'динамика_связи'
      }
    ]
  };

  data.templates.itemRelationshipStateTemplate = {
    type: 'timeline',
    fields: [
      {
        type: 'manuscript_point',
        class: 'начальная_глава',
        label: 'Начало в рукописи (Том / Глава)',
        placeholder: 'Выберите том и главу...'
      },
      {
        type: 'manuscript_point',
        class: 'конечная_глава',
        label: 'Окончание в рукописи (Том / Глава)',
        placeholder: 'Выберите том и главу...',
        allowAutoExtend: true
      },
      {
        type: 'select',
        class: 'статус_категория',
        label: 'Статус связи',
        options: [
          { value: '', label: 'Не указано' },
          { value: 'обретение', label: '✨ Находка / Получение' },
          { value: 'потеря', label: '❌ Потеря / Кража' },
          { value: 'передача', label: '🤝 Добровольная передача' },
          { value: 'применение', label: '⚡ Ключевое применение' }
        ]
      },
      {
        type: 'textarea',
        class: 'описание_1',
        label: 'Обстоятельства',
        rows: 2
      }
    ],
    itemClass: 'relationship-state-item',
    headerTitle: 'ЭТАП ВЛАДЕНИЯ'
  };

  // Обновляем секцию origins
  const originsSec = data.sections.find(s => s.id === 'origins');
  if (originsSec && Array.isArray(originsSec.dynamicContainers)) {
    originsSec.dynamicContainers.forEach(dc => {
      if (dc.id === 'itemRelations') {
        dc.template = 'itemRelationshipTemplate';
      }
    });
  }

  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
  console.log('✅ item.json успешно отрефакторен!');
}

// -----------------------------------------------------------------------------
// 5. РЕФАКТОРИНГ EVENT.JSON
// -----------------------------------------------------------------------------
function refactorEventSchema() {
  const filePath = path.join(SCHEMAS_DIR, 'event.json');
  if (!fs.existsSync(filePath)) return;
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

  data.templates = data.templates || {};
  data.templates.eventEventRelTemplate = {
    type: 'dynamic',
    isBidirectional: true,
    bidirectionalLinkClass: 'целевая_сущность',
    fields: [
      {
        type: 'select',
        class: 'целевая_сущность',
        label: 'Связанное историческое событие',
        entityType: 'event',
        placeholder: 'Выберите событие...'
      },
      {
        type: 'select',
        class: 'тип_отношения',
        label: 'Причинно-следственная связь',
        options: [
          { value: '', label: 'Не указано' },
          { value: 'причина', label: '⬅️ Причина / Предпосылка (предшествует этому)' },
          { value: 'следствие', label: '➡️ Прямое следствие (порождено этим)' },
          { value: 'эскалация', label: '🔥 Эскалация / Обострение другого конфликта' },
          { value: 'параллельное', label: '⚡ Параллельное / Синхронное событие' },
          { value: 'реакция', label: '🛡️ Ответная реакция / Возмездие' }
        ]
      },
      {
        type: 'textarea',
        class: 'описание_1',
        label: 'Как именно эти события связаны',
        rows: 3
      }
    ],
    itemClass: 'dynamic-item',
    headerTitle: 'Связь событий (Причинно-следственная цепь)'
  };

  // Добавляем секцию или контейнер причинно-следственных связей
  const causesSec = data.sections.find(s => s.id === 'causes_and_stages');
  if (causesSec) {
    causesSec.dynamicContainers = causesSec.dynamicContainers || [];
    const hasChain = causesSec.dynamicContainers.some(dc => dc.id === 'eventChain');
    if (!hasChain) {
      causesSec.dynamicContainers.push({
        id: 'eventChain',
        type: 'dynamic',
        title: 'Причинно-следственные связи с другими событиями',
        emptyMessage: 'Связанные события не добавлены',
        template: 'eventEventRelTemplate',
        dataPath: 'связанные_события'
      });
    }
  }

  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
  console.log('✅ event.json успешно отрефакторен!');
}

// -----------------------------------------------------------------------------
// 6. РЕФАКТОРИНГ LOCATION.JSON
// -----------------------------------------------------------------------------
function refactorLocationSchema() {
  const filePath = path.join(SCHEMAS_DIR, 'location.json');
  if (!fs.existsSync(filePath)) return;
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

  data.templates = data.templates || {};
  data.templates.locationRelTemplate = {
    type: 'dynamic',
    isBidirectional: true,
    bidirectionalLinkClass: 'целевая_сущность',
    fields: [
      {
        type: 'select',
        class: 'целевая_сущность',
        label: 'Смежная локация',
        entityType: 'location',
        placeholder: 'Выберите локацию...'
      },
      {
        type: 'select',
        class: 'тип_отношения',
        label: 'Тип маршрута / Связи',
        options: [
          { value: '', label: 'Не указано' },
          { value: 'соседство', label: '🗺️ Граничит / Смежная территория' },
          { value: 'торговый_тракт', label: '🛣️ Торговый тракт / Дорога' },
          { value: 'водный_путь', label: '⛵ Речной / Морской путь' },
          { value: 'тайный_проход', label: '🗝️ Тайный ход / Подземный тоннель' },
          { value: 'портал', label: '🌀 Магический портал / Телепорт' },
          { value: 'космический_маршрут', label: '🚀 Гиперпространственный маршрут' }
        ]
      },
      {
        type: 'text',
        class: 'время_в_пути',
        label: 'Время в пути / Расстояние',
        placeholder: 'Например: 3 дня на лошадях, 2 часа пешком'
      },
      {
        type: 'textarea',
        class: 'описание_1',
        label: 'Опасности на маршруте и особенности перехода',
        rows: 2
      }
    ],
    itemClass: 'dynamic-item',
    headerTitle: 'Связь между локациями'
  };

  const relSec = data.sections.find(s => s.id === 'relations');
  if (relSec && Array.isArray(relSec.dynamicContainers)) {
    relSec.dynamicContainers.forEach(dc => {
      if (dc.id === 'locationConnections') {
        dc.template = 'locationRelTemplate';
      }
    });
  }

  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
  console.log('✅ location.json успешно отрефакторен!');
}

// -----------------------------------------------------------------------------
// ИСПОЛНЕНИЕ ВСЕХ ЭТАПОВ
// -----------------------------------------------------------------------------
try {
  refactorOrganizationSchema();
  refactorStateSchema();
  refactorCharacterSchema();
  refactorItemSchema();
  refactorEventSchema();
  refactorLocationSchema();

  console.log('\n📊 ИТОГОВЫЙ ОТЧЕТ ПО РАЗМЕРАМ ФАЙЛОВ:');
  console.log('--------------------------------------------------');
  for (const file of files) {
    const newSize = getFileSizeKb(path.join(SCHEMAS_DIR, file));
    const oldSize = initialSizes[file];
    const diff = (parseFloat(newSize) - parseFloat(oldSize)).toFixed(1);
    const sign = diff > 0 ? `+${diff}` : `${diff}`;
    console.log(`${file.padEnd(20)} ${oldSize.padStart(7)} KB  ->  ${newSize.padStart(7)} KB  (${sign} KB)`);
  }
  console.log('--------------------------------------------------');
  console.log('🎉 Рефакторинг всех JSON-схем успешно завершён!');
} catch (err) {
  console.error('❌ Ошибка рефакторинга:', err);
  process.exit(1);
}
