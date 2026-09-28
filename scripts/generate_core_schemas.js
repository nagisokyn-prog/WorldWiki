import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT_DIR = path.resolve(__dirname, '..');
const SCHEMAS_DIR = path.join(ROOT_DIR, 'apps', 'spa', 'public', 'struct', 'editor');

console.log('🚀 Запуск генератора и валидатора системных схем WorldWiki...');

// Хелперы построения полей
function createField(cfg) {
  const f = {
    id: cfg.id,
    type: cfg.type,
    label: cfg.label,
    placeholder: cfg.placeholder || '',
    path: cfg.path || cfg.id
  };
  if (cfg.required) f.required = true;
  if (cfg.hint) f.hint = cfg.hint;
  if (cfg.rows) f.rows = cfg.rows;
  if (cfg.min !== undefined) f.min = cfg.min;
  if (cfg.max !== undefined) f.max = cfg.max;
  if (cfg.value !== undefined) f.value = cfg.value;
  if (cfg.options) f.options = cfg.options;
  if (cfg.entityType) f.entityType = cfg.entityType;
  if (cfg.isSystem) {
    f.isSystem = true;
    f.preventDelete = true;
    f.preventHide = true;
  }
  return f;
}

// -----------------------------------------------------------------------------
// 1. Патчинг и обновление существующих схем: Character, Organization, State
// -----------------------------------------------------------------------------

function patchCharacterSchema() {
  const filePath = path.join(SCHEMAS_DIR, 'character.json');
  if (!fs.existsSync(filePath)) return;
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

  data.name = 'Персонаж';
  data.icon = 'fa-user';
  data.iconEmoji = '👤';
  data.entityType = 'character';
  data.titleField = 'название';
  data.photoField = 'фото';
  data.tagsField = 'теги';

  const basicSec = data.sections.find(s => s.id === 'basic') || data.sections[0];
  if (basicSec) {
    // 1. Обновляем Имя
    const nameField = basicSec.fields.find(f => f.path === 'название' || f.id === 'characterName');
    if (nameField) {
      nameField.id = 'characterName';
      nameField.label = 'Полное имя';
      nameField.path = 'название';
      nameField.isSystem = true;
      nameField.preventDelete = true;
      nameField.preventHide = true;
      nameField.required = true;
    }

    // 2. Обновляем Псевдоним
    const aliasField = basicSec.fields.find(f => f.path === 'прозвище' || f.id === 'characterAlias');
    if (aliasField) {
      aliasField.id = 'characterAlias';
      aliasField.label = 'Прозвище / Псевдоним';
      aliasField.path = 'прозвище';
      aliasField.isSystem = true;
      aliasField.preventDelete = true;
      aliasField.hint = 'Алиасы для авто-поиска меншенов ((Имя)) в рукописи';
    }

    // 3. Обновляем Роль в истории
    const roleField = basicSec.fields.find(f => f.path === 'роль_в_истории' || f.id === 'characterRole');
    if (roleField) {
      roleField.id = 'characterRole';
      roleField.path = 'роль_в_истории';
      roleField.isSystem = true;
      roleField.preventDelete = true;
      roleField.options = [
        { value: '', label: 'Не указано' },
        { value: 'главный', label: '⭐ Главный герой' },
        { value: 'антагонист', label: '⚔️ Антагонист' },
        { value: 'второстепенный', label: '👥 Второстепенный' },
        { value: 'вспомогательный', label: '엑 Вспомогательный / Эпизодический' }
      ];
    }

    // 4. Обновляем статус_категория
    let statusField = basicSec.fields.find(f => f.path === 'статус_категория' || f.path === 'статус' || f.id === 'characterStatus');
    if (statusField) {
      statusField.id = 'characterStatus';
      statusField.path = 'статус_категория';
      statusField.label = 'Статус';
      statusField.required = true;
      statusField.isSystem = true;
      statusField.preventDelete = true;
      statusField.preventHide = true;
      statusField.options = [
        { value: 'Не указано', label: 'Не указано' },
        { value: 'Жив', label: '🟢 Жив' },
        { value: 'Мёртв', label: '🔴 Мёртв' },
        { value: 'Пропал без вести', label: '🟡 Пропал без вести' }
      ];
    }

    // 5. Дата рождения
    const birthField = basicSec.fields.find(f => f.path === 'дата_рождения' || f.id === 'characterBirthdate');
    if (birthField) {
      birthField.id = 'characterBirthdate';
      birthField.path = 'дата_рождения';
      birthField.type = 'calendar_datetime';
      birthField.isSystem = true;
      birthField.preventDelete = true;
    }

    // 6. Дата смерти (добавляем после даты рождения, если нет)
    let deathField = basicSec.fields.find(f => f.path === 'дата_смерти' || f.id === 'characterDeathdate');
    if (!deathField) {
      deathField = createField({
        id: 'characterDeathdate',
        type: 'calendar_datetime',
        label: 'Дата смерти',
        placeholder: 'Выберите дату гибели по календарю мира',
        hint: 'Критично для аудита непротиворечивости (исключает действия после смерти)',
        path: 'дата_смерти',
        isSystem: true
      });
      const birthIdx = basicSec.fields.findIndex(f => f.path === 'дата_рождения');
      if (birthIdx >= 0) {
        basicSec.fields.splice(birthIdx + 1, 0, deathField);
      } else {
        basicSec.fields.push(deathField);
      }
    } else {
      deathField.id = 'characterDeathdate';
      deathField.path = 'дата_смерти';
      deathField.type = 'calendar_datetime';
      deathField.isSystem = true;
      deathField.preventDelete = true;
    }
  }

  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
  console.log('✅ character.json успешно обновлен со всеми системными полями!');
}

function patchOrganizationSchema() {
  const filePath = path.join(SCHEMAS_DIR, 'organization.json');
  if (!fs.existsSync(filePath)) return;
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

  data.name = 'Организация';
  data.icon = 'fa-building';
  data.iconEmoji = '🏢';
  data.entityType = 'organization';
  data.titleField = 'название';
  data.photoField = 'фото';
  data.tagsField = 'теги';

  const basicSec = data.sections.find(s => s.id === 'basic') || data.sections[0];
  if (basicSec) {
    const nameField = basicSec.fields.find(f => f.path === 'название' || f.id === 'orgName');
    if (nameField) {
      nameField.isSystem = true;
      nameField.preventDelete = true;
      nameField.preventHide = true;
      nameField.required = true;
    }

    const statusField = basicSec.fields.find(f => f.path === 'статус_категория' || f.path === 'статус' || f.id === 'orgStatus');
    if (statusField) {
      statusField.id = 'orgStatus';
      statusField.path = 'статус_категория';
      statusField.label = 'Статус';
      statusField.isSystem = true;
      statusField.preventDelete = true;
      statusField.preventHide = true;
      statusField.options = [
        { value: 'Не указано', label: 'Не указано' },
        { value: 'Действует', label: '🟢 Действует' },
        { value: 'Неактивна', label: '🟡 Неактивна' },
        { value: 'Распущена / Уничтожена', label: '🔴 Распущена / Уничтожена' },
        { value: 'Подпольная', label: '🟣 Подпольная' }
      ];
    }
  }

  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
  console.log('✅ organization.json успешно обновлен со всеми системными полями!');
}

function patchStateSchema() {
  const filePath = path.join(SCHEMAS_DIR, 'state.json');
  if (!fs.existsSync(filePath)) return;
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

  data.name = 'Государство';
  data.icon = 'fa-flag';
  data.iconEmoji = '🗺️';
  data.entityType = 'state';
  data.titleField = 'название';
  data.photoField = 'фото';
  data.tagsField = 'теги';

  const basicSec = data.sections.find(s => s.id === 'basic') || data.sections[0];
  if (basicSec) {
    const nameField = basicSec.fields.find(f => f.path === 'название' || f.id === 'stateName');
    if (nameField) {
      nameField.isSystem = true;
      nameField.preventDelete = true;
      nameField.preventHide = true;
      nameField.required = true;
    }

    const statusField = basicSec.fields.find(f => f.path === 'статус_категория' || f.path === 'статус' || f.id === 'stateStatus');
    if (statusField) {
      statusField.id = 'stateStatus';
      statusField.path = 'статус_категория';
      statusField.label = 'Статус';
      statusField.isSystem = true;
      statusField.preventDelete = true;
      statusField.preventHide = true;
      statusField.options = [
        { value: 'Не указано', label: 'Не указано' },
        { value: 'Суверенное', label: '🟢 Суверенное государство' },
        { value: 'Зависимое / Колония', label: '🟡 Зависимое / Колония' },
        { value: 'Исчезнувшее / Пало', label: '🔴 Исчезнувшее / Пало' },
        { value: 'Оспариваемое', label: '🟠 Оспариваемое' },
        { value: 'Автономное', label: '⚪ Автономное образование' }
      ];
    }
  }

  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
  console.log('✅ state.json успешно обновлен со всеми системными полями!');
}

// -----------------------------------------------------------------------------
// 2. Генерация новых богатых схем: Location, Item, Event
// -----------------------------------------------------------------------------

function generateLocationSchema() {
  const schema = {
    name: 'Локация',
    icon: 'fa-map-marker-alt',
    iconEmoji: '📍',
    photoField: 'фото',
    tagsField: 'теги',
    titleField: 'название',
    entityType: 'location',
    sections: [
      {
        id: 'basic',
        title: 'Основные данные',
        icon: '📝',
        fields: [
          createField({
            id: 'locName',
            type: 'text',
            label: 'Название локации',
            required: true,
            placeholder: 'Например, Замок Драконий Камень, Трактир "Пьяный Дракон"',
            path: 'название',
            isSystem: true
          }),
          createField({
            id: 'locPhoto',
            type: 'photo',
            label: 'Изображение / Карта места',
            placeholder: 'Загрузите изображение',
            path: 'фото'
          }),
          createField({
            id: 'locType',
            type: 'select',
            label: 'Тип локации (Масштаб сцены)',
            required: true,
            path: 'тип_локации',
            isSystem: true,
            options: [
              { value: 'интерьер', label: '🚪 Помещение / Интерьер (комната, тронный зал, каюта)' },
              { value: 'здание', label: '🏰 Здание / Сооружение (замок, трактир, бункер, маяк)' },
              { value: 'микро_точка', label: '📍 Точка на местности (мост, перекресток, площадь, поляна)' },
              { value: 'поселение', label: '🏘️ Поселение / Город (деревня, мегаполис, станция)' },
              { value: 'природная_зона', label: '🌲 Природный ландшафт (лес, перевал, болото, пещера)' },
              { value: 'гео_регион', label: '🗺️ Географический регион (остров, долина, архипелаг, пустошь)' },
              { value: 'макро_объект', label: '🪐 Планета / Астрономический объект / Сектор' }
            ]
          }),
          createField({
            id: 'locParent',
            type: 'select',
            label: 'Входит в локацию (Родитель)',
            placeholder: 'Выберите родительскую локацию...',
            entityType: 'location',
            hint: 'Формирует географическую иерархию (Комната ⊂ Здание ⊂ Город ⊂ Регион)',
            path: 'родительская_локация',
            isSystem: true
          }),
          createField({
            id: 'locStatus',
            type: 'select',
            label: 'Статус локации',
            required: true,
            path: 'статус_категория',
            isSystem: true,
            options: [
              { value: 'Существует', label: '🟢 Существует / Доступна' },
              { value: 'Разрушена / Руины', label: '🔴 Разрушена / В руинах' },
              { value: 'Заброшена', label: '🟡 Заброшена' },
              { value: 'Скрыта / Затоплена', label: '⚪ Скрыта / Затоплена / Недоступна' }
            ]
          }),
          createField({
            id: 'locState',
            type: 'select',
            label: 'Государство / Держава (Юрисдикция)',
            placeholder: 'Выберите государство...',
            entityType: 'state',
            path: 'принадлежность_государству',
            isSystem: true
          }),
          createField({
            id: 'locFaction',
            type: 'select',
            label: 'Фактический контроль (Фракция / Гарнизон)',
            placeholder: 'Выберите контролирующую организацию...',
            entityType: 'organization',
            path: 'контролирующая_фракция',
            isSystem: true
          }),
          createField({
            id: 'locTags',
            type: 'tags',
            label: 'Теги',
            placeholder: 'Введите теги через Enter',
            path: 'теги'
          }),
          createField({
            id: 'locDescription',
            type: 'textarea',
            label: 'Краткое описание места',
            rows: 4,
            placeholder: 'Общее визуальное и смысловое описание...',
            path: 'описание'
          })
        ],
        dynamicContainers: []
      },
      {
        id: 'geography',
        title: 'География и природа',
        icon: '🌲',
        fields: [
          createField({ id: 'locClimate', type: 'text', label: 'Климат и погода', placeholder: 'Например, суровый северный, тропический влажный', path: 'климат' }),
          createField({ id: 'locLandscape', type: 'text', label: 'Ландшафт и рельеф', placeholder: 'Например, скалистые горы, густые хвойные леса', path: 'ландшафт' }),
          createField({ id: 'locArea', type: 'text', label: 'Площадь / Протяженность', placeholder: 'Например, 150 кв. км', path: 'площадь' }),
          createField({ id: 'locCoordinates', type: 'text', label: 'Координаты / Положение на карте', placeholder: 'Например, 54°N, 12°E или Сектор 7G', path: 'координаты' }),
          createField({ id: 'locDangerLevel', type: 'range', label: 'Уровень опасности (0-100)', min: 0, max: 100, value: 10, path: 'уровень_опасности' }),
          createField({ id: 'locResources', type: 'textarea', label: 'Природные ресурсы и флора/фауна', rows: 3, placeholder: 'Добываемые минералы, редкие травы, опасные хищники...', path: 'ресурсы' })
        ],
        dynamicContainers: []
      },
      {
        id: 'culture',
        title: 'Население и общество',
        icon: '👥',
        fields: [
          createField({ id: 'locPopulation', type: 'text', label: 'Численность населения', placeholder: 'Например, 50 000 жителей', path: 'население' }),
          createField({ id: 'locDemographics', type: 'textarea', label: 'Демографический состав и расы', rows: 3, placeholder: '70% людей, 20% гномов, 10% эльфов...', path: 'демография' }),
          createField({ id: 'locLanguages', type: 'text', label: 'Основные языки и диалекты', placeholder: 'Например, Всеобщий, Древний нордский', path: 'языки' }),
          createField({ id: 'locTraditions', type: 'textarea', label: 'Культура, праздники и обычаи', rows: 3, placeholder: 'Местные законы, празднества, религиозные культы...', path: 'культура' })
        ],
        dynamicContainers: []
      },
      {
        id: 'architecture',
        title: 'Архитектура и объекты',
        icon: '🏰',
        fields: [
          createField({ id: 'locArchStyle', type: 'text', label: 'Архитектурный стиль', placeholder: 'Например, готика, киберпанк, древний монолит', path: 'архитектурный_стиль' }),
          createField({ id: 'locKeyBuildings', type: 'textarea', label: 'Ключевые сооружения и достопримечательности', rows: 4, placeholder: 'Главная ратуша, часовая башня, рынок, казармы...', path: 'ключевые_объекты' }),
          createField({ id: 'locDefenses', type: 'textarea', label: 'Оборона и укрепления', rows: 3, placeholder: 'Крепостные стены, защитные магические барьеры, гарнизон...', path: 'оборона' })
        ],
        dynamicContainers: []
      },
      {
        id: 'history',
        title: 'Хронология и эволюция',
        icon: '⏳',
        fields: [],
        dynamicContainers: [
          {
            id: 'controlTimeline',
            type: 'timeline',
            title: 'Эволюция контроля и владельцев',
            emptyMessage: 'Смены власти не зафиксированы',
            template: 'Базовая хронология',
            dataPath: 'эволюция_контроля',
            fieldOverrides: {
              название: { label: 'Владелец / Фракция у власти', type: 'select', entityType: 'organization' },
              описание_1: { label: 'Обстоятельства смены власти / Осада / Договор' },
              статус_категория: { hidden: true },
              описание_2: { hidden: true },
              описание_3: { hidden: true },
              числовой_показатель: { hidden: true }
            }
          },
          {
            id: 'locationEvents',
            type: 'timeline',
            title: 'Ключевые исторические события места',
            emptyMessage: 'Исторические события не добавлены',
            template: 'Динамический элемент',
            dataPath: 'исторические_события',
            fieldOverrides: {
              название: { label: 'Название битвы / события' },
              описание_1: { label: 'Последствия для локации' },
              статус_категория: { hidden: true },
              описание_2: { hidden: true },
              описание_3: { hidden: true },
              числовой_показатель: { hidden: true }
            }
          }
        ]
      },
      {
        id: 'relations',
        title: 'Связи и маршруты',
        icon: '🕸️',
        fields: [],
        dynamicContainers: [
          {
            id: 'locationConnections',
            type: 'dynamic',
            title: 'Торговые и стратегические связи',
            emptyMessage: 'Связи не добавлены',
            template: 'Двунаправленная связь',
            dataPath: 'связанные_локации'
          }
        ]
      }
    ]
  };

  const filePath = path.join(SCHEMAS_DIR, 'location.json');
  fs.writeFileSync(filePath, JSON.stringify(schema, null, 2) + '\n', 'utf8');
  console.log('✅ location.json успешно создан со всеми секциями и системными полями!');
}

function generateItemSchema() {
  const schema = {
    name: 'Предмет / Артефакт',
    icon: 'fa-magic',
    iconEmoji: '🗡️',
    photoField: 'фото',
    tagsField: 'теги',
    titleField: 'название',
    entityType: 'item',
    sections: [
      {
        id: 'basic',
        title: 'Основные данные',
        icon: '📝',
        fields: [
          createField({
            id: 'itemName',
            type: 'text',
            label: 'Название предмета',
            required: true,
            placeholder: 'Например, Меч Экскалибур, Кольцо Всевластья, Свиток Огня',
            path: 'название',
            isSystem: true
          }),
          createField({
            id: 'itemPhoto',
            type: 'photo',
            label: 'Изображение предмета',
            placeholder: 'Загрузите изображение',
            path: 'фото'
          }),
          createField({
            id: 'itemType',
            type: 'select',
            label: 'Тип предмета',
            required: true,
            path: 'тип_предмета',
            isSystem: true,
            options: [
              { value: 'оружие', label: '⚔️ Оружие' },
              { value: 'артефакт', label: '🔮 Магический артефакт' },
              { value: 'улика_документ', label: '📜 Документ / Улика' },
              { value: 'реликвия', label: '👑 Реликвия / Символ власти' },
              { value: 'транспорт', label: '🚀 Транспорт / Техника' },
              { value: 'зелье_вещество', label: '🧪 Зелье / Вещество' },
              { value: 'снаряжение', label: '🛡️ Снаряжение / Доспех' },
              { value: 'бытовой', label: '📦 Бытовой предмет / Инструмент' }
            ]
          }),
          createField({
            id: 'itemStatus',
            type: 'select',
            label: 'Статус / Состояние',
            required: true,
            path: 'статус_категория',
            isSystem: true,
            options: [
              { value: 'Не указано', label: 'Не указано' },
              { value: 'Цел / Активен', label: '🟢 Цел / Активен' },
              { value: 'Поврежден', label: '🟡 Поврежден' },
              { value: 'Уничтожен', label: '🔴 Уничтожен' },
              { value: 'Утерян', label: '⚪ Утерян / Местонахождение неизвестно' }
            ]
          }),
          createField({
            id: 'itemOwner',
            type: 'select',
            label: 'Текущий владелец',
            placeholder: 'Выберите текущего держателя...',
            entityType: 'character',
            path: 'текущий_владелец',
            isSystem: true
          }),
          createField({
            id: 'itemTags',
            type: 'tags',
            label: 'Теги',
            placeholder: 'Введите теги через Enter',
            path: 'теги'
          }),
          createField({
            id: 'itemDescription',
            type: 'textarea',
            label: 'Краткое описание',
            rows: 4,
            placeholder: 'Внешний вид и назначение предмета...',
            path: 'описание'
          })
        ],
        dynamicContainers: []
      },
      {
        id: 'properties',
        title: 'Свойства и магия',
        icon: '✨',
        fields: [
          createField({ id: 'itemMaterial', type: 'text', label: 'Материал изготовления', placeholder: 'Например, валирийская сталь, мифрил, титан', path: 'материал' }),
          createField({ id: 'itemPowerLevel', type: 'range', label: 'Мощь / Редкость (0-100)', min: 0, max: 100, value: 50, path: 'мощь_редкость' }),
          createField({ id: 'itemMagicEffects', type: 'textarea', label: 'Магические / Технические эффекты', rows: 4, placeholder: 'Свойства, ауры, заклинания, даруемые владельцу...', path: 'эффекты' }),
          createField({ id: 'itemCurse', type: 'textarea', label: 'Проклятие / Побочные эффекты', rows: 3, placeholder: 'Цена использования, безумие, вытягивание сил...', path: 'проклятие' }),
          createField({ id: 'itemWeight', type: 'text', label: 'Вес и габариты', placeholder: 'Например, 1.5 кг, длина 90 см', path: 'габариты' })
        ],
        dynamicContainers: []
      },
      {
        id: 'history',
        title: 'Хронология и владение',
        icon: '⏳',
        fields: [],
        dynamicContainers: [
          {
            id: 'ownershipTimeline',
            type: 'timeline',
            title: 'Хронология передачи и владения (Чеховское ружьё)',
            emptyMessage: 'История передачи не добавлена',
            template: 'Базовая хронология',
            dataPath: 'история_владения',
            fieldOverrides: {
              название: { label: 'Владелец / Держатель', type: 'select', entityType: 'character' },
              описание_1: { label: 'Обстоятельства получения / передачи' },
              статус_категория: { hidden: true },
              описание_2: { hidden: true },
              описание_3: { hidden: true },
              числовой_показатель: { hidden: true }
            }
          }
        ]
      },
      {
        id: 'origins',
        title: 'Происхождение и связи',
        icon: '📜',
        fields: [
          createField({ id: 'itemCreator', type: 'select', label: 'Создатель / Мастер', placeholder: 'Выберите создателя...', entityType: 'character', path: 'создатель' }),
          createField({ id: 'itemOriginLocation', type: 'select', label: 'Место создания', placeholder: 'Выберите локацию...', entityType: 'location', path: 'место_создания' }),
          createField({ id: 'itemCreationDate', type: 'calendar_datetime', label: 'Дата создания / ковки', path: 'дата_создания' })
        ],
        dynamicContainers: [
          {
            id: 'itemRelations',
            type: 'dynamic',
            title: 'Связи с фракциями и персонажами',
            emptyMessage: 'Связи не добавлены',
            template: 'Двунаправленная связь',
            dataPath: 'двунаправленные_связи'
          }
        ]
      }
    ]
  };

  const filePath = path.join(SCHEMAS_DIR, 'item.json');
  fs.writeFileSync(filePath, JSON.stringify(schema, null, 2) + '\n', 'utf8');
  console.log('✅ item.json успешно создан со всеми секциями и системными полями!');
}

function generateEventSchema() {
  const schema = {
    name: 'Историческое событие',
    icon: 'fa-calendar-star',
    iconEmoji: '📜',
    photoField: 'фото',
    tagsField: 'теги',
    titleField: 'название',
    entityType: 'event',
    sections: [
      {
        id: 'basic',
        title: 'Основные данные',
        icon: '📝',
        fields: [
          createField({
            id: 'eventName',
            type: 'text',
            label: 'Название события',
            required: true,
            placeholder: 'Например, Битва у Красных Полей, Ночь Длинных Кинжалов',
            path: 'название',
            isSystem: true
          }),
          createField({
            id: 'eventPhoto',
            type: 'photo',
            label: 'Иллюстрация события',
            placeholder: 'Загрузите изображение',
            path: 'фото'
          }),
          createField({
            id: 'eventDate',
            type: 'calendar_datetime',
            label: 'Дата начала события',
            required: true,
            path: 'дата_события',
            isSystem: true
          }),
          createField({
            id: 'eventDuration',
            type: 'number',
            label: 'Длительность (в абсолютных минутах / днях)',
            placeholder: 'Длительность...',
            path: 'длительность',
            isSystem: true
          }),
          createField({
            id: 'eventScale',
            type: 'select',
            label: 'Масштаб события',
            required: true,
            path: 'масштаб_важность',
            isSystem: true,
            options: [
              { value: 'локальное', label: '🟢 Локальное событие' },
              { value: 'региональное', label: '🟡 Региональный масштаб' },
              { value: 'мировое', label: '🟠 Мировой масштаб' },
              { value: 'эпохальное', label: '🔴 Эпохальный сдвиг (Новая эра)' }
            ]
          }),
          createField({
            id: 'eventLocation',
            type: 'select',
            label: 'Место действия (Локация)',
            placeholder: 'Выберите место события...',
            entityType: 'location',
            path: 'место_действия',
            isSystem: true
          }),
          createField({
            id: 'eventParticipants',
            type: 'multiselect',
            label: 'Ключевые участники (Персонажи)',
            placeholder: 'Выберите персонажей...',
            entityType: 'character',
            path: 'участники',
            isSystem: true
          }),
          createField({
            id: 'eventFactions',
            type: 'multiselect',
            label: 'Затронутые фракции и стороны',
            placeholder: 'Выберите организации...',
            entityType: 'organization',
            path: 'затронутые_фракции',
            isSystem: true
          }),
          createField({
            id: 'eventTags',
            type: 'tags',
            label: 'Теги',
            placeholder: 'Введите теги через Enter',
            path: 'теги'
          }),
          createField({
            id: 'eventDescription',
            type: 'textarea',
            label: 'Краткое описание',
            rows: 4,
            placeholder: 'Суть и хроника события...',
            path: 'описание'
          })
        ],
        dynamicContainers: []
      },
      {
        id: 'causes_and_stages',
        title: 'Причины и хроника',
        icon: '⚔️',
        fields: [
          createField({ id: 'eventCauses', type: 'textarea', label: 'Предпосылки и коренные причины', rows: 3, placeholder: 'Что привело к событию...', path: 'причины' }),
          createField({ id: 'eventTrigger', type: 'textarea', label: 'Повод / Триггер', rows: 2, placeholder: 'Непосредственный повод...', path: 'триггер' }),
          createField({ id: 'eventKeyStages', type: 'textarea', label: 'Ход события и ключевые фазы', rows: 5, placeholder: 'Этап 1, кульминация, развязка...', path: 'ход_события' })
        ],
        dynamicContainers: []
      },
      {
        id: 'consequences',
        title: 'Итоги и лоро-эхо',
        icon: '💥',
        fields: [
          createField({ id: 'eventResults', type: 'textarea', label: 'Итоги и результаты', rows: 4, placeholder: 'Кто победил, какие договоры заключены...', path: 'итоги' }),
          createField({ id: 'eventCasualties', type: 'textarea', label: 'Потери и разрушения', rows: 3, placeholder: 'Погибшие герои, разрушенные города...', path: 'потери' }),
          createField({ id: 'eventLoreEcho', type: 'textarea', label: 'Историческое влияние (Лоро-эхо)', rows: 4, placeholder: 'Как событие изменило мир, законы и отношение потомков...', path: 'историческое_влияние' })
        ],
        dynamicContainers: []
      }
    ]
  };

  const filePath = path.join(SCHEMAS_DIR, 'event.json');
  fs.writeFileSync(filePath, JSON.stringify(schema, null, 2) + '\n', 'utf8');
  console.log('✅ event.json успешно создан со всеми секциями и системными полями!');
}

// -----------------------------------------------------------------------------
// Запуск всех этапов
// -----------------------------------------------------------------------------
try {
  patchCharacterSchema();
  patchOrganizationSchema();
  patchStateSchema();
  generateLocationSchema();
  generateItemSchema();
  generateEventSchema();

  console.log('\n🎉 Все 6 базовых схем WorldWiki успешно синхронизированы и готовы к аналитике!');
} catch (err) {
  console.error('❌ Ошибка при генерации схем:', err);
  process.exit(1);
}
