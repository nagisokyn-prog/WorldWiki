/**
 * @file settings.d.ts
 * @description Типы для настроек приложения
 * @rust-ready ✅ calculateLoadMeter, autoDetectFPS могут быть перенесены на Rust
 */

export {};

// Цветовая схема
export interface ColorSettings {
  bgBase: string;           // Основной фон
  bgSecondary: string;      // Вторичный фон
  bgPanel: string;          // Фон панелей
  bgInput: string;          // Фон инпутов
  textMain: string;         // Основной текст
  textMuted: string;        // Второстепенный текст
  textHeading: string;      // Заголовки
  accent: string;           // Цвет акцента
  accentHover: string;      // Акцент при наведении
  accentActive: string;     // Акцент при нажатии
  accentDisabled: string;   // Акцент для disabled
  accentGlow: string;       // Свечение акцента
  borderColor: string;      // Цвет границ
  borderActive: string;     // Активные границы
  shadowColor: string;      // Цвет теней
}

// Glass эффекты
export interface GlassSettings {
  islandAlpha: number;      // Прозрачность островков (0-1)
  cardAlpha: number;        // Прозрачность карточек (0-0.5)
  blur: number;             // Размытие (0-100px)
  borderAlpha: number;      // Прозрачность границ (0-1)
  highlight: string;        // Подсветка стекла
}

// Скругления
export interface RadiiSettings {
  island: number;           // Скругление островков
  card: number;             // Скругление карточек
  btn: number;              // Скругление кнопок
  input: number;            // Скругление инпутов
  dropdown: number;         // Скругление выпадающих меню
}

// Тени
export interface ShadowSettings {
  islandY: number;          // Смещение теней по Y
  islandBlur: number;       // Размытие теней
  useInset: boolean;        // Внутренние тени
}

// Анимации
export interface AnimationSettings {
  enabled: boolean;         // Включение анимаций
  speed: number;            // Скорость (0.1-1.0s)
  ease: string;             // Easing функция
  entrance: number;         // Анимация появления
  pulse: boolean;           // Пульсация
  scalePush: number;        // Сила нажатия
  scalePull: number;        // Сила наведения
}

// Шрифты
export interface FontSettings {
  family: string;           // Семейство шрифта
  size: number;             // Размер (12-24px)
  weight: number;           // Толщина обычного
  weightBold: number;       // Толщина жирного
  lineHeight: number;       // Межстрочный интервал
  letterSpacing: number;    // Межбуквенный интервал
}

// Отступы
export interface SpacingSettings {
  density: number;          // Множитель плотности (0.5-2.0)
  sidebarWidth: number;     // Ширина сайдбара
  panelHeight: number;      // Высота панели
  activityBarWidth: number; // Ширина activity bar
  toolbarHeight: number;    // Высота тулбара
  gap: number;              // Отступ между элементами
}

// Компоновка
export interface LayoutSettings {
  columns: number;          // Количество колонок (1-4)
  sidebarPos: 'row' | 'row-reverse';  // Позиция сайдбара
  tabPos: 'row' | 'column';           // Позиция вкладок
  focusMode: boolean;       // Режим фокуса
}

// Инпуты
export interface InputSettings {
  style: 'outline' | 'filled';  // Стиль инпутов
  focusAnim: boolean;           // Анимация фокуса
}

// Кнопки
export interface ButtonSettings {
  hoverScale: boolean;    // Эффект при наведении
  clickPress: boolean;    // Эффект при нажатии
}

// Вкладки
export interface TabSettings {
  pos: 'row' | 'column';  // Позиция вкладок
}

// Выпадающие списки
export interface DropdownSettings {
  use3DWheel: boolean;    // 3D эффект колеса
  wheelOrientation?: 'vertical' | 'horizontal'; // Ориентация 3D колеса
}

// Карточки
export interface CardSettings {
  compactList: boolean;   // Компактный режим списка
  showIcons: boolean;     // Показ иконок
}

// Редактор
export interface EditorSettings {
  showWordCount: boolean; // Показ счётчика слов
  requireCtrlForLinks: boolean; // Открывать ссылки только с Ctrl
}

// Уведомления
export interface NotificationSettings {
  duration: number;       // Длительность (мс)
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
}

// Производительность
// @rust-ready ✅ loadMeter calculation, fpsLimit, level detection
export interface PerfSettings {
  level: 'auto' | 'high' | 'medium' | 'low';  // Уровень производительности
  fpsLimit: number;  // Лимит FPS: 30, 60, 90, 120, 144, 165, 240
  loadMeter: number;      // Нагрузка на систему (0-100%)
}

// Полные настройки приложения
export interface AppSettings {
  theme?: 'dark' | 'light' | string;  // Текущая выбранная тема
  colors: ColorSettings;
  glass: GlassSettings;
  radii: RadiiSettings;
  shadows: ShadowSettings;
  animations: AnimationSettings;
  fonts: FontSettings;
  spacing: SpacingSettings;
  layout: LayoutSettings;
  inputs: InputSettings;
  buttons: ButtonSettings;
  tabs: TabSettings;
  dropdowns: DropdownSettings;
  cards: CardSettings;
  editor: EditorSettings;
  notifications: NotificationSettings;
  perf: PerfSettings;
}

// Результат расчёта нагрузки
// @rust-ready ✅
export interface LoadMeterResult {
  load: number;           // Нагрузка 0-100%
  color: string;          // Цвет индикатора
  label: string;          // Текстовая метка
}

// Результат автоопределения FPS
// @rust-ready ✅
export interface AutoFPSResult {
  fpsLimit: number;       // Рекомендуемый FPS
  reason: string;         // Причина выбора
}