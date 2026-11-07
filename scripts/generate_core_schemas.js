import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT_DIR = path.resolve(__dirname, '..');
const SCHEMAS_DIRS = [
  path.join(ROOT_DIR, 'apps', 'spa', 'public', 'struct', 'editor'),
  path.join(ROOT_DIR, 'apps', 'spa', 'src', 'ts', 'struct', 'editor')
];
const SCHEMAS_DIR = SCHEMAS_DIRS[0];

function readSchema(fileName) {
  for (const dir of SCHEMAS_DIRS) {
    const p = path.join(dir, fileName);
    if (fs.existsSync(p)) {
      return JSON.parse(fs.readFileSync(p, 'utf8'));
    }
  }
  return null;
}

function writeSchema(fileName, data) {
  const content = JSON.stringify(data, null, 2) + '\n';
  for (const dir of SCHEMAS_DIRS) {
    if (fs.existsSync(dir)) {
      fs.writeFileSync(path.join(dir, fileName), content, 'utf8');
    }
  }
}

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
  if (cfg.class) f.class = cfg.class;
  if (cfg.allowAutoExtend) f.allowAutoExtend = cfg.allowAutoExtend;
  if (cfg.allowOngoing) f.allowOngoing = cfg.allowOngoing;
  if (cfg.ongoingPlaceholder) f.ongoingPlaceholder = cfg.ongoingPlaceholder;
  if (cfg.required) f.required = true;
  if (cfg.hint) f.hint = cfg.hint;
  if (cfg.rows) f.rows = cfg.rows;
  if (cfg.min !== undefined) f.min = cfg.min;
  if (cfg.max !== undefined) f.max = cfg.max;
  if (cfg.value !== undefined) f.value = cfg.value;
  if (cfg.options) f.options = cfg.options;
  if (cfg.entityType) f.entityType = cfg.entityType;
  if (cfg.entityTypes) f.entityTypes = cfg.entityTypes;
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
  const data = readSchema('character.json');
  if (!data) return;

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
      aliasField.hint = 'Второе имя или прозвище персонажа';
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

  writeSchema('character.json', data);
  console.log('✅ character.json успешно обновлен со всеми системными полями!');
}

function patchOrganizationSchema() {
  const data = readSchema('organization.json');
  if (!data) return;

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

  writeSchema('organization.json', data);
  console.log('✅ organization.json успешно обновлен со всеми системными полями!');
}

function patchStateSchema() {
  const data = readSchema('state.json');
  if (!data) return;

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

    // 1. Столица как сущность location (Issue #49)
    let capitalField = basicSec.fields.find(f => f.path === 'столица' || f.id === 'stateCapital');
    if (capitalField) {
      capitalField.id = 'stateCapital';
      capitalField.type = 'select';
      capitalField.entityType = 'location';
      capitalField.label = 'Столица государства';
      capitalField.placeholder = 'Выберите город-столицу...';
      capitalField.hint = 'Связывает государство со столичной локацией, часовым поясом и координатами';
    } else {
      basicSec.fields.push(createField({
        id: 'stateCapital',
        type: 'select',
        entityType: 'location',
        label: 'Столица государства',
        placeholder: 'Выберите город-столицу...',
        hint: 'Связывает государство со столичной локацией, часовым поясом и координатами',
        path: 'столица'
      }));
    }

    // 2. Государственное летоисчисление / Календарь (Issue #49) - СТРОГО перед датой основания!
    let calendarField = basicSec.fields.find(f => f.path === 'официальный_календарь' || f.id === 'stateOfficialCalendar');
    if (!calendarField) {
      calendarField = createField({
        id: 'stateOfficialCalendar',
        type: 'select',
        entityType: 'calendar',
        label: 'Государственное летоисчисление / Календарь',
        placeholder: 'Выберите официальный календарь...',
        path: 'официальный_календарь',
        hint: 'Официальная календарная система для датировок законов и хроник'
      });
      const foundedIdx = basicSec.fields.findIndex(f => f.path === 'дата_основания');
      if (foundedIdx >= 0) {
        basicSec.fields.splice(foundedIdx, 0, calendarField);
      } else {
        basicSec.fields.push(calendarField);
      }
    } else {
      calendarField.type = 'select';
      calendarField.entityType = 'calendar';
      calendarField.label = 'Государственное летоисчисление / Календарь';
      // Перемещаем перед датой основания, если она есть
      const curIdx = basicSec.fields.indexOf(calendarField);
      const foundedIdx = basicSec.fields.findIndex(f => f.path === 'дата_основания');
      if (foundedIdx >= 0 && curIdx > foundedIdx) {
        basicSec.fields.splice(curIdx, 1);
        basicSec.fields.splice(foundedIdx, 0, calendarField);
      }
    }

    // 3. Столичное / Официальное время (Issue #49)
    let tzField = basicSec.fields.find(f => f.path === 'официальный_часовой_пояс' || f.id === 'stateOfficialTimezone');
    if (!tzField) {
      basicSec.fields.push(createField({
        id: 'stateOfficialTimezone',
        type: 'select',
        entityType: 'timezone',
        label: 'Официальное столичное время (Часовой пояс)',
        placeholder: 'Выберите часовой пояс...',
        path: 'официальный_часовой_пояс',
        hint: 'Часовой пояс правительства и госаппарата'
      }));
    } else {
      tzField.type = 'select';
      tzField.entityType = 'timezone';
      tzField.placeholder = 'Выберите часовой пояс...';
    }

    // 4. Территориальные регионы / Провинции (Issue #49) - multiselect на location
    let regionsField = basicSec.fields.find(f => f.path === 'территориальные_регионы' || f.id === 'stateTerritorialRegions');
    if (!regionsField) {
      basicSec.fields.push(createField({
        id: 'stateTerritorialRegions',
        type: 'multiselect',
        entityType: 'location',
        label: 'Административно-территориальное деление (Регионы / Провинции)',
        path: 'территориальные_регионы',
        hint: 'Провинции, области и волости под юрисдикцией государства'
      }));
    } else {
      regionsField.type = 'multiselect';
      regionsField.entityType = 'location';
      delete regionsField.rows;
    }
  }

  // Удаляем дублирующий блок adminDivisions из секции governance (так как локации закрывают регионы)
  const govSec = data.sections.find(s => s.id === 'governance');
  if (govSec && govSec.dynamicContainers) {
    govSec.dynamicContainers = govSec.dynamicContainers.filter(dc => dc.id !== 'adminDivisions');
  }

  // Удаляем дублирующую страницу regions из государства
  data.sections = data.sections.filter(s => s.id !== 'regions');

  writeSchema('state.json', data);
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
            label: 'Масштаб и тип локации',
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
            id: 'locBuildingSubtype',
            type: 'select',
            label: 'Специализация здания / заведения',
            path: 'тип_заведения',
            options: [
              { value: 'residential', label: '🏡 Жилое (частный дом, усадьба, поместье, вилла)' },
              { value: 'hospitality', label: '🍺 Общепит и ночлег (бар, таверна, гостиница, ресторан, трактир)' },
              { value: 'medical', label: '🏥 Медицинское (больница, лечебница, лазарет, аптека)' },
              { value: 'educational', label: '🎓 Образовательное (школа, академия, университет, пансион)' },
              { value: 'administrative', label: '🏛️ Административное / Государственное (ратуша, суд, полиция, посольство)' },
              { value: 'military', label: '⚔️ Военное / Оборонительное (казарма, форт, сторожевая башня, бункер)' },
              { value: 'religious', label: '⛪ Религиозное (храм, святилище, монастырь, часовня)' },
              { value: 'commercial', label: '💰 Торговое (рынок, лавка, торговый центр, фактория)' },
              { value: 'industrial', label: '⚒️ Производственное (кузница, шахта, верфь, завод, фабрика)' }
            ]
          }),
          createField({
            id: 'locParent',
            type: 'select',
            label: 'Входит в локацию (Родитель)',
            placeholder: 'Выберите родительскую локацию...',
            entityType: 'location',
            hint: 'Формирует географическую иерархию (Комната ⊂ Здание ⊂ Город ⊂ Регион). Координаты и время наследуются вверх!',
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
              { value: 'Действует', label: '🟢 Действует / Существует / Доступна' },
              { value: 'Разрушена / Руины', label: '🔴 Разрушена / В руинах' },
              { value: 'Заброшена', label: '🟡 Заброшена' },
              { value: 'Закрыта на карантин', label: '🟠 Закрыта на карантин' },
              { value: 'Строится', label: '⚪ Строится / В процессе возведения' },
              { value: 'Скрыта / Затоплена', label: '🟣 Скрыта / Затоплена / Недоступна' }
            ]
          }),
          createField({
            id: 'locState',
            type: 'select',
            label: 'Государство / Держава (Юрисдикция)',
            placeholder: 'Выберите государство...',
            entityType: 'state',
            hint: 'Наследуется от родительской локации, если не указано явно',
            path: 'принадлежность_государству',
            isSystem: true
          }),
          createField({
            id: 'locOwner',
            type: 'select',
            label: 'Владелец / Управляющий / Директор',
            placeholder: 'Выберите персонажа...',
            entityType: 'character',
            path: 'владелец_управляющий',
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
        id: 'building_details',
        title: 'Специфика здания и заведения',
        icon: '🚪',
        fields: [
          createField({ id: 'locAddress', type: 'text', label: 'Почтовый адрес / Ориентир', placeholder: 'Например, ул. Вязов, д. 13 или Северный тракт у развилки', path: 'адрес' }),
          createField({ id: 'locCapacity', type: 'number', label: 'Вместимость (человек / мест / коек)', min: 0, placeholder: 'Например, 120', path: 'вместимость' }),
          createField({
            id: 'locAccessMode',
            type: 'select',
            label: 'Режим доступа',
            path: 'режим_доступа',
            options: [
              { value: 'public', label: '🟢 Публичный доступ' },
              { value: 'service', label: '🟡 Служебный доступ' },
              { value: 'private', label: '🔵 Приватный / Частный' },
              { value: 'secret', label: '🟣 Секретный объект' },
              { value: 'closed', label: '🔴 Закрыто' }
            ]
          }),
          createField({ id: 'locOperatingHours', type: 'text', label: 'Часы работы / Режим дня', placeholder: 'Например, Круглосуточно или с 08:00 до 20:00 или От заката до рассвета', path: 'режим_работы' })
        ],
        dynamicContainers: []
      },
      {
        id: 'geography',
        title: 'География, Координаты и Астрономия',
        icon: '🌲',
        fields: [
          createField({ id: 'locPlanetId', type: 'select', entityType: 'planet', label: 'Планета размещения', placeholder: 'Автоопределение (Главная планета мира)', path: 'планета_id', hint: 'Планета размещения локации (по умолчанию главная планета мира)' }),
          createField({ id: 'locTimezone', type: 'select', entityType: 'timezone', label: 'Часовой пояс локации', placeholder: 'Выберите часовой пояс...', path: 'часовой_пояс', hint: 'При пустом значении наследуется от родительского города или государства' }),
          createField({ id: 'locLatitude', type: 'number', label: 'Широта (градусы -90 .. +90)', min: -90, max: 90, placeholder: '54.5', path: 'широта' }),
          createField({ id: 'locLongitude', type: 'number', label: 'Долгота (градусы -180 .. +180)', min: -180, max: 180, placeholder: '37.6', path: 'долгота' }),
          createField({
            id: 'locClimateZone',
            type: 'select',
            label: 'Климатический пояс',
            path: 'климатический_пояс',
            options: [
              { value: 'equatorial', label: '🌴 Экваториальный' },
              { value: 'tropical', label: '☀️ Тропический' },
              { value: 'temperate', label: '🍂 Умеренный' },
              { value: 'subarctic', label: '❄️ Субарктический' },
              { value: 'polar', label: '🧊 Полярный / Арктический' }
            ]
          }),
          createField({ id: 'locClimate', type: 'text', label: 'Особенности климата и погоды', placeholder: 'Например, суровый северный, частые дожди', path: 'климат' }),
          createField({ id: 'locLandscape', type: 'text', label: 'Ландшафт и рельеф', placeholder: 'Например, скалистые горы, густые хвойные леса', path: 'ландшафт' }),
          createField({ id: 'locArea', type: 'text', label: 'Площадь / Протяженность', placeholder: 'Например, 150 кв. км', path: 'площадь' }),
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

  writeSchema('location.json', schema);
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

  writeSchema('item.json', schema);
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
            placeholder: 'Выберите организации или государства...',
            entityTypes: ['organization', 'state'],
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
        dynamicContainers: [
          {
            id: 'eventTimelineStages',
            type: 'timeline',
            title: 'Линия жизни и статуса',
            emptyMessage: 'Этапы события не добавлены (по умолчанию событие считается одномоментным)',
            template: 'eventTimelineStageTemplate',
            dataPath: 'хронология_события'
          }
        ]
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
    ],
    templates: {
      eventTimelineStageTemplate: {
        type: 'timeline',
        headerTitle: 'Этап',
        fields: [
          {
            type: 'select',
            class: 'статус_категория',
            label: 'Статус / Фаза события',
            options: [
              { value: 'Активно / В процессе', label: '🟢 Активно / В процессе' },
              { value: 'Кульминация / Разгар', label: '🔥 Кульминация / Разгар' },
              { value: 'Завершено / В прошлом', label: '🛑 Завершено / В прошлом' },
              { value: 'Завязка / Предпосылки', label: '🌱 Завязка / Предпосылки' },
              { value: 'Последствия / Лоро-эхо', label: '🍂 Последствия / Лоро-эхо' }
            ],
            default: 'Активно / В процессе'
          },
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
            type: 'calendar_datetime',
            class: 'начальная_дата',
            label: 'Дата и время начала (по календарю мира)',
            placeholder: 'Выберите дату...'
          },
          {
            type: 'calendar_datetime',
            class: 'конечная_дата',
            label: 'Дата и время окончания (по календарю мира)',
            placeholder: 'Выберите дату...',
            allowOngoing: true
          },
          {
            type: 'textarea',
            class: 'описание_1',
            label: 'Обстоятельства / Причина смены статуса',
            placeholder: 'Например, подписание мирного договора, штурм крепости...',
            rows: 2
          }
        ],
        itemClass: 'timeline-item'
      }
    }
  };

  writeSchema('event.json', schema);
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
