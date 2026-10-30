/**
 * @file planet.presets.ts
 * @description Библиотека пресетов астрофизических систем планет (100% русский язык)
 */
import type { PlanetDto } from '../PlanetEditor.model';

export interface PlanetPreset {
  id: string;
  name: string;
  icon: string;
  tag: string;
  description: string;
  dayHours: number;
  dayMinutes: number;
  orbitDays: number;
  axialTilt: number;
  rotationDirection: 'direct' | 'retrograde';
  data: Partial<PlanetDto>;
}

export const PLANET_PRESETS: PlanetPreset[] = [
  {
    id: 'earth',
    name: 'Земля (Терра)',
    icon: '🌍',
    tag: 'Реальный мир',
    description: 'Родной эталон Солнечной системы: 24-часовые сутки, год 365.2422 дней, наклон оси 23.44°, прямое вращение, 24 часовых пояса по 15° и 1 естественный спутник Луна (период 29.53 сут).',
    dayHours: 24,
    dayMinutes: 0,
    orbitDays: 365.2422,
    axialTilt: 23.44,
    rotationDirection: 'direct',
    data: {
      name: 'Земля (Терра)',
      icon: '🌍',
      ticks_per_day: 1440,
      day_hours: 24,
      day_minutes: 0,
      day_seconds: 0,
      orbit_days: 365.2422,
      orbit_days_num: 3652422,
      orbit_days_den: 10000,
      axial_tilt_mdeg: 23440,
      rotation_direction: 'direct',
      solstices: { winter: 355, spring: 80, summer: 172, autumn: 265 },
      timezones: [
        { name: 'Гринвич (UTC+0)', code: 'UTC+0', offset_hours: 0, dst_rule: 'eu' },
        { name: 'Центральная Европа (UTC+1)', code: 'UTC+1', offset_hours: 1, dst_rule: 'eu' },
        { name: 'Восточная Европа (UTC+2)', code: 'UTC+2', offset_hours: 2, dst_rule: 'eu' },
        { name: 'Московское время (UTC+3)', code: 'UTC+3', offset_hours: 3, dst_rule: 'none' },
        { name: 'Самара (UTC+4)', code: 'UTC+4', offset_hours: 4, dst_rule: 'none' },
        { name: 'Екатеринбург (UTC+5)', code: 'UTC+5', offset_hours: 5, dst_rule: 'none' },
        { name: 'Омск (UTC+6)', code: 'UTC+6', offset_hours: 6, dst_rule: 'none' },
        { name: 'Красноярск (UTC+7)', code: 'UTC+7', offset_hours: 7, dst_rule: 'none' },
        { name: 'Иркутск, Пекин (UTC+8)', code: 'UTC+8', offset_hours: 8, dst_rule: 'none' },
        { name: 'Якутск, Токио (UTC+9)', code: 'UTC+9', offset_hours: 9, dst_rule: 'none' },
        { name: 'Владивосток, Сидней (UTC+10)', code: 'UTC+10', offset_hours: 10, dst_rule: 'none' },
        { name: 'Магадан (UTC+11)', code: 'UTC+11', offset_hours: 11, dst_rule: 'none' },
        { name: 'Камчатка, Фиджи (UTC+12)', code: 'UTC+12', offset_hours: 12, dst_rule: 'none' },
        { name: 'Восточное побережье США (UTC-5)', code: 'UTC-5', offset_hours: -5, dst_rule: 'us' },
        { name: 'Центральное время США (UTC-6)', code: 'UTC-6', offset_hours: -6, dst_rule: 'us' },
        { name: 'Горное время США (UTC-7)', code: 'UTC-7', offset_hours: -7, dst_rule: 'us' },
        { name: 'Тихоокеанское побережье США (UTC-8)', code: 'UTC-8', offset_hours: -8, dst_rule: 'us' },
      ],
      regions: [
        { name: 'Москва', timezone_code: 'UTC+3', latitude: 55.75, longitude: 37.61 },
        { name: 'Лондон', timezone_code: 'UTC+0', latitude: 51.5, longitude: -0.12 },
        { name: 'Токио', timezone_code: 'UTC+9', latitude: 35.68, longitude: 139.69 },
        { name: 'Нью-Йорк', timezone_code: 'UTC-5', latitude: 40.71, longitude: -74.0 },
      ],
      moons: [
        { name: 'Луна', orbital_period: 29.530588, start_phase: 0.0 }
      ]
    }
  },
  {
    id: 'mars',
    name: 'Марс (Арес)',
    icon: '🔴',
    tag: 'Реальный мир',
    description: 'Красная планета: марсианский сол 24 ч 37 мин, год длится 668.6 солов, наклон оси 25.19° (4 выраженных сезона), две быстрые луны: стремительный Фобос (период 0.319 сола — восходит на западе и садится на востоке 3 раза в день!) и Деймос (1.262 сола).',
    dayHours: 24,
    dayMinutes: 37,
    orbitDays: 668.6,
    axialTilt: 25.19,
    rotationDirection: 'direct',
    data: {
      name: 'Марс (Арес)',
      icon: '🔴',
      ticks_per_day: 1477,
      day_hours: 24,
      day_minutes: 37,
      day_seconds: 22,
      orbit_days: 668.6,
      orbit_days_num: 6686,
      orbit_days_den: 10,
      axial_tilt_mdeg: 25190,
      rotation_direction: 'direct',
      solstices: { winter: 650, spring: 140, summer: 310, autumn: 480 },
      timezones: [
        { name: 'Кратер Гейл (Нулевой меридиан / MTC)', code: 'MTC+0', offset_hours: 0, dst_rule: 'none' },
        { name: 'Равнина Элизий (MTC+4)', code: 'MTC+4', offset_hours: 4, dst_rule: 'none' },
        { name: 'Долина Маринер (MTC+8)', code: 'MTC+8', offset_hours: 8, dst_rule: 'none' },
        { name: 'Плато Фарсида / Вулкан Олимп (MTC+12)', code: 'MTC+12', offset_hours: 12, dst_rule: 'none' },
        { name: 'Равнина Утопия (MTC-8)', code: 'MTC-8', offset_hours: -8, dst_rule: 'none' },
      ],
      regions: [
        { name: 'База «Олимп»', timezone_code: 'MTC+12', latitude: 18.65, longitude: 226.2 },
        { name: 'Купол долины Маринер', timezone_code: 'MTC+8', latitude: -14.0, longitude: 300.0 },
      ],
      moons: [
        { name: 'Фобос (Сверхбыстрый спутник)', orbital_period: 0.3189, start_phase: 0.0 },
        { name: 'Деймос', orbital_period: 1.2624, start_phase: 0.5 },
      ]
    }
  },
  {
    id: 'venus',
    name: 'Венера (Ретроградное вращение)',
    icon: '🟡',
    tag: 'Астрономия',
    description: 'Сестра Земли с обратным суточным вращением: Солнце восходит на западе и садится на востоке! Медленное вращение делает солнечные сутки равными 116.75 земных дней при орбитальном периоде 224.7 дней. Наклон оси 177.36°, спутников нет.',
    dayHours: 2802,
    dayMinutes: 0,
    orbitDays: 224.7,
    axialTilt: 177.36,
    rotationDirection: 'retrograde',
    data: {
      name: 'Венера (Афродита)',
      icon: '🟡',
      ticks_per_day: 168120,
      day_hours: 2802,
      day_minutes: 0,
      day_seconds: 0,
      orbit_days: 224.7,
      orbit_days_num: 2247,
      orbit_days_den: 10,
      axial_tilt_mdeg: 177360,
      rotation_direction: 'retrograde',
      solstices: { winter: 220, spring: 50, summer: 110, autumn: 165 },
      timezones: [
        { name: 'Земля Афродиты', code: 'VTC+0', offset_hours: 0, dst_rule: 'none' },
        { name: 'Земля Иштар', code: 'VTC+60', offset_hours: 60, dst_rule: 'none' },
      ],
      regions: [
        { name: 'Аэростатный город «Иштар»', timezone_code: 'VTC+60', latitude: 65.0, longitude: 0.0 },
      ],
      moons: []
    }
  },
  {
    id: 'australis',
    name: 'Аустралис («Чем южнее — тем холоднее»)',
    icon: '❄️',
    tag: 'Фэнтези',
    description: 'Обитаемый континент расположен целиком в южном полушарии мира: на севере плещется знойный экваториальный океан, а продвижение на юг ведёт в ледяную погибель вечной мерзлоты. Солнцестояние инвертировано: лето в декабре, пик морозов в июне.',
    dayHours: 24,
    dayMinutes: 0,
    orbitDays: 360,
    axialTilt: 23.5,
    rotationDirection: 'direct',
    data: {
      name: 'Аустралис (Южный Мир)',
      icon: '❄️',
      ticks_per_day: 1440,
      day_hours: 24,
      day_minutes: 0,
      day_seconds: 0,
      orbit_days: 360,
      orbit_days_num: 360,
      orbit_days_den: 1,
      axial_tilt_mdeg: 23500,
      rotation_direction: 'direct',
      solstices: { winter: 175, spring: 265, summer: 355, autumn: 85 },
      timezones: [
        { name: 'Прибрежный Меридиан (UTC+0)', code: 'UTC+0', offset_hours: 0, dst_rule: 'none' },
        { name: 'Южные Рубежи (UTC+2)', code: 'UTC+2', offset_hours: 2, dst_rule: 'none' },
      ],
      regions: [
        { name: 'Тёплая Гавань (Северный экватор)', timezone_code: 'UTC+0', latitude: -10.0, longitude: 0.0 },
        { name: 'Ледяной Предел (Крайний Юг)', timezone_code: 'UTC+2', latitude: -75.0, longitude: 30.0 },
      ],
      moons: [
        { name: 'Серебряный Страж', orbital_period: 28.0, start_phase: 0.0 }
      ]
    }
  },
  {
    id: 'tidally_locked',
    name: 'Приливно Захваченный Мир (Вечные Сумерки)',
    icon: '🌓',
    tag: 'Научная фантастика',
    description: 'Планета всегда повернута к звезде одной стороной: дневное полушарие вечно раскалено, ночное сковано абсолютным льдом. Вся цивилизация живёт в узком кольце терминатора — крае вечных багровых сумерек.',
    dayHours: 8760,
    dayMinutes: 0,
    orbitDays: 365,
    axialTilt: 0,
    rotationDirection: 'direct',
    data: {
      name: 'Синхронный Мир (Вечные Сумерки)',
      icon: '🌓',
      ticks_per_day: 525600,
      day_hours: 8760,
      day_minutes: 0,
      day_seconds: 0,
      orbit_days: 365,
      orbit_days_num: 365,
      orbit_days_den: 1,
      axial_tilt_mdeg: 0,
      rotation_direction: 'direct',
      solstices: { winter: 0, spring: 91, summer: 182, autumn: 273 },
      timezones: [
        { name: 'Кольцо Сумерек (Обитаемый Терминатор)', code: 'TERM+0', offset_hours: 0, dst_rule: 'none' },
        { name: 'Дневное Пекло', code: 'DAY+6', offset_hours: 6, dst_rule: 'none' },
        { name: 'Ночная Ледяная Бездна', code: 'NIGHT-6', offset_hours: -6, dst_rule: 'none' },
      ],
      regions: [
        { name: 'Цитадель Терминатора', timezone_code: 'TERM+0', latitude: 0.0, longitude: 0.0 },
      ],
      moons: []
    }
  },
  {
    id: 'three_moons',
    name: 'Мир Трёх Лун (Трилуние)',
    icon: '✨',
    tag: 'Магический реализм',
    description: 'Планета под сводом трёх разных лун: стремительная Алая Луна (период 7 дней), Серебряная Луна (28 дней) и величественная Лазурная Луна (84 дня). Раз в 84 дня наступает ночь Великого Схождения Трёх Лун — время высочайших магических приливов.',
    dayHours: 24,
    dayMinutes: 0,
    orbitDays: 336,
    axialTilt: 18.0,
    rotationDirection: 'direct',
    data: {
      name: 'Трилуние (Мир Трёх Спутников)',
      icon: '✨',
      ticks_per_day: 1440,
      day_hours: 24,
      day_minutes: 0,
      day_seconds: 0,
      orbit_days: 336,
      orbit_days_num: 336,
      orbit_days_den: 1,
      axial_tilt_mdeg: 18000,
      rotation_direction: 'direct',
      solstices: { winter: 330, spring: 80, summer: 168, autumn: 250 },
      timezones: [
        { name: 'Храмовый Пояс (UTC+0)', code: 'UTC+0', offset_hours: 0, dst_rule: 'none' },
        { name: 'Восточный Архипелаг (UTC+4)', code: 'UTC+4', offset_hours: 4, dst_rule: 'none' },
        { name: 'Западный Континент (UTC-4)', code: 'UTC-4', offset_hours: -4, dst_rule: 'none' },
      ],
      regions: [
        { name: 'Обсерватория Трёх Лун', timezone_code: 'UTC+0', latitude: 33.0, longitude: 0.0 },
      ],
      moons: [
        { name: 'Алая Луна (Быстрая)', orbital_period: 7.0, start_phase: 0.0 },
        { name: 'Серебряная Луна (Срединная)', orbital_period: 28.0, start_phase: 0.25 },
        { name: 'Лазурная Луна (Великая)', orbital_period: 84.0, start_phase: 0.5 },
      ]
    }
  },
  {
    id: 'urania',
    name: 'Лежащий Мир (Экстремальный наклон 98°)',
    icon: '🪐',
    tag: 'Экстремальный космос',
    description: 'Планета «катится на боку» вокруг своей звезды (наклон оси 98°). Полярный день на одном полюсе длится четверть года подряд (непрерывный палящий зной), сменяясь четвертью года кромешной ледяной ночи. Умеренная смена суток бывает только в дни равноденствий.',
    dayHours: 18,
    dayMinutes: 0,
    orbitDays: 420,
    axialTilt: 98.0,
    rotationDirection: 'retrograde',
    data: {
      name: 'Урания (Лежащий Мир)',
      icon: '🪐',
      ticks_per_day: 1080,
      day_hours: 18,
      day_minutes: 0,
      day_seconds: 0,
      orbit_days: 420,
      orbit_days_num: 420,
      orbit_days_den: 1,
      axial_tilt_mdeg: 98000,
      rotation_direction: 'retrograde',
      solstices: { winter: 410, spring: 105, summer: 210, autumn: 315 },
      timezones: [
        { name: 'Экваториальный Пояс (UTC+0)', code: 'UTC+0', offset_hours: 0, dst_rule: 'none' },
        { name: 'Северный Полярный Бассейн (UTC+6)', code: 'UTC+6', offset_hours: 6, dst_rule: 'none' },
      ],
      regions: [
        { name: 'Экваториальное Кольцо Жизни', timezone_code: 'UTC+0', latitude: 0.0, longitude: 0.0 },
      ],
      moons: [
        { name: 'Исида', orbital_period: 14.0, start_phase: 0.0 }
      ]
    }
  }
];

export function getPlanetPresetById(id: string): PlanetPreset | undefined {
  return PLANET_PRESETS.find((p) => p.id === id);
}

