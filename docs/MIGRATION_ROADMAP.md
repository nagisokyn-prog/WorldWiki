# 🗺️ Дорожная карта: JS → TypeScript Migration

## 📊 Анализ проекта

### Структура JS файлов (30+ файлов)

```
src/js/
├── app/                    # Основные приложения
│   ├── chapters.js         # Редактор глав
│   ├── ui_editor.js        # UI редактора
│   ├── ui_menu.js          # UI меню
│   └── project_launcher.js # Лаунчер проектов
├── components/             # Vue компоненты (15 файлов)
│   ├── CalendarBuilder.js
│   ├── ChapterEditorUI.js
│   ├── ChaptersListUI.js
│   ├── ChaptersManager.js
│   ├── EntityEditor.js
│   ├── EntityMenu.js
│   ├── EntityNavigator.js
│   ├── FloatingEntityEditor.js
│   ├── FloatingWindow.js
│   ├── FormBuilder.js
│   ├── PhotoUploader.js
│   ├── SettingsModal.js
│   ├── TimelineManager.js
│   ├── TimelineUI.js
│   ├── UnifiedAutocomplete.js
│   └── WowilonPanel.js
├── services/               # Сервисы (13 файлов)
│   ├── api.service.js
│   ├── calendar.service.js
│   ├── chapter.service.js
│   ├── connections.service.js
│   ├── dynamic.service.js
│   ├── editor.service.js
│   ├── entity.service.js
│   ├── export.service.js
│   ├── footnote.service.js
│   ├── form.service.js
│   ├── project.service.js
│   ├── settings.service.js
│   └── tags.service.js
├── utils/                  # Утилиты
│   ├── dom-utils.js
│   └── ui-helpers.js
├── libs/                   # Библиотеки (не трогаем)
└── toastui/                # Toast UI Editor (не трогаем)
```

---

## 🎯 Приоритеты миграции

### Фаза 1: Foundation (1-2 дня)
- [x] Настроить TypeScript конфигурацию
- [x] Создать типы для Tauri API
- [x] Создать типы для настроек
- [x] Настроить ESLint + Prettier для TS
- [x] Настроить Vitest для unit тестов (v3.0.0, 6 тестов проходят)

### Фаза 2: Services (3-5 дней)
Services — чистая логика, легче всего мигрировать

| Файл | Строк | Сложность | Rust-ready |
|------|-------|-----------|------------|
| `settings.service.js` | 183 | Низкая | ✅ loadSettings, saveSettings, calculateLoad |
| `api.service.js` | ~200 | Средняя | ✅ Все Tauri invoke вызовы |
| `project.service.js` | ~150 | Средняя | ✅ CRUD операции с проектами |
| `calendar.service.js` | ~100 | Низкая | ✅ Расчёт дат |
| `chapter.service.js` | ~120 | Средняя | ✅ CRUD глав |
| `entity.service.js` | ~150 | Средняя | ✅ CRUD сущностей |
| `tags.service.js` | ~80 | Низкая | ✅ Работа с тегами |
| `connections.service.js` | ~100 | Средняя | ✅ Связи между сущностями |
| `export.service.js` | ~200 | Высокая | ⚠️ Экспорт в форматы |
| `editor.service.js` | ~150 | Высокая | ❌ DOM-зависимый |
| `form.service.js` | ~100 | Средняя | ❌ DOM-зависимый |
| `footnote.service.js` | ~80 | Низкая | ✅ Работа с сносками |
| `dynamic.service.js` | ~120 | Средняя | ❌ DOM-зависимый |

### Фаза 3: Utils (1 день)
| Файл | Строк | Сложность | Rust-ready |
|------|-------|-----------|------------|
| `dom-utils.js` | ~100 | Низкая | ❌ DOM-зависимый |
| `ui-helpers.js` | ~80 | Низкая | ❌ DOM-зависимый |

### Фаза 4: Components (5-7 дней)
Компоненты Vue — требуют Vue 3 + TS setup

| Файл | Строк | Сложность | Rust-ready |
|------|-------|-----------|------------|
| `SettingsModal.js` | ~470 | Высокая | ✅ calculateLoadMeter, autoDetectFPS |
| `FormBuilder.js` | ~300 | Высокая | ❌ DOM-зависимый |
| `CalendarBuilder.js` | ~250 | Высокая | ✅ Логика календаря |
| `EntityEditor.js` | ~400 | Высокая | ❌ DOM-зависимый |
| `ChaptersManager.js` | ~350 | Высокая | ✅ Логика управления |
| `TimelineManager.js` | ~200 | Средняя | ✅ Логика таймлайна |
| `FloatingWindow.js` | ~150 | Средняя | ❌ DOM-зависимый |
| `EntityMenu.js` | ~100 | Низкая | ❌ DOM-зависимый |
| `PhotoUploader.js` | ~120 | Средняя | ❌ DOM-зависимый |
| `UnifiedAutocomplete.js` | ~180 | Высокая | ❌ DOM-зависимый |
| `WowilonPanel.js` | ~100 | Низкая | ❌ DOM-зависимый |
| `ChapterEditorUI.js` | ~250 | Высокая | ❌ DOM-зависимый |
| `ChaptersListUI.js` | ~150 | Средняя | ❌ DOM-зависимый |
| `EntityNavigator.js` | ~120 | Средняя | ❌ DOM-зависимый |
| `TimelineUI.js` | ~180 | Средняя | ❌ DOM-зависимый |

### Фаза 5: App files (3-5 дней)
| Файл | Строк | Сложность | Rust-ready |
|------|-------|-----------|------------|
| `project_launcher.js` | ~350 | Высокая | ✅ FPS мониторинг, бенчмарк |
| `ui_editor.js` | ~500 | Высокая | ❌ DOM-зависимый |
| `ui_menu.js` | ~200 | Средняя | ❌ DOM-зависимый |
| `chapters.js` | ~300 | Высокая | ❌ DOM-зависимый |

---

## 🦀 Функции для переноса на Rust

### ✅ Готово к переносу (чистая логика)

**1. Settings**
- `loadSettings()` → `load_settings()` (уже есть)
- `saveSettings()` → `save_settings()` (уже есть)
- `calculateLoadMeter()` → `calculate_load_meter(settings)`
- `autoDetectFPS()` → `auto_detect_fps(cpu_score, cores)`

**2. FPS Monitoring**
- FPS счётчик → Rust thread с `std::time::Instant`
- `get_fps_stats()` → возвращает `{fps, fps_limit, perf_level}`

**3. Performance Benchmark**
- `run_performance_benchmark()` (уже есть)
- Расширить: добавить GPU тест

**4. Calendar Logic**
- Расчёт дат → Rust
- Конвертация календарей → Rust

**5. Entity/Chapter CRUD**
- Все операции с БД → Rust (уже частично есть)

### ❌ Не переносить (DOM-зависимые)

- Анимации (GSAP)
- Vue реактивность
- DOM манипуляции
- Обработчики событий
- Рендеринг компонентов

---

## 📝 TypeScript конфигурация

### tsconfig.json
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "outDir": "./dist",
    "rootDir": "./src/js",
    "declaration": true,
    "sourceMap": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"]
  },
  "include": ["src/js/**/*.ts"],
  "exclude": ["src/js/libs/**", "src/js/toastui/**"]
}
```

### Типы для Tauri
```typescript
// types/tauri.d.ts
interface TauriAPI {
  core: {
    invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T>;
  };
}

interface Window {
  __TAURI__: TauriAPI;
}
```

### Типы для настроек
```typescript
// types/settings.d.ts
interface ColorSettings {
  bgBase: string;
  bgSecondary: string;
  bgPanel: string;
  // ... etc
}

interface GlassSettings {
  islandAlpha: number;
  cardAlpha: number;
  blur: number;
  borderAlpha: number;
  highlight: string;
}

interface PerfSettings {
  level: 'auto' | 'high' | 'medium' | 'low';
  fpsLimit: 30 | 60 | 90 | 120 | 144 | 165 | 240;
  loadMeter: number;
}

interface AppSettings {
  colors: ColorSettings;
  glass: GlassSettings;
  perf: PerfSettings;
  // ... etc
}
```

---

## 🧪 Unit тесты (Vitest)

### Структура тестов
```
src/js/__tests__/
├── services/
│   ├── settings.service.test.ts
│   ├── api.service.test.ts
│   └── ...
├── utils/
│   ├── dom-utils.test.ts
│   └── ui-helpers.test.ts
└── components/
    └── SettingsModal.test.ts
```

### Пример теста
```typescript
// __tests__/services/settings.service.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { settingsService } from '../../services/settings.service';

describe('SettingsService', () => {
  beforeEach(() => {
    settingsService.resetSettings();
  });

  it('should load default settings', () => {
    const settings = settingsService.getSettings();
    expect(settings.perf.fpsLimit).toBe(60);
  });

  it('should calculate load meter correctly', () => {
    // Test load calculation
  });

  it('should auto-detect FPS based on benchmark', () => {
    // Test auto-detection
  });
});
```

---

## 🚀 План миграции (пошагово)

### Неделя 1: Foundation + Services
- [ ] День 1: TS конфиг + типы
- [ ] День 2: settings.service.ts + тесты
- [ ] День 3: api.service.ts + тесты
- [ ] День 4: project.service.ts + тесты
- [ ] День 5: calendar.service.ts + chapter.service.ts

### Неделя 2: Services + Utils
- [ ] День 6: entity.service.ts + tags.service.ts
- [ ] День 7: connections.service.ts + footnote.service.js
- [ ] День 8: export.service.ts
- [ ] День 9: utils/*.ts
- [ ] День 10: Тестирование всех сервисов

### Неделя 3: Components (простые)
- [ ] День 11: SettingsModal.ts
- [ ] День 12: CalendarBuilder.ts
- [ ] День 13: TimelineManager.ts + TimelineUI.ts
- [ ] День 14: EntityMenu.ts + PhotoUploader.ts
- [ ] День 15: FloatingWindow.ts

### Неделя 4: Components (сложные) + App
- [ ] День 16: FormBuilder.ts
- [ ] День 17: EntityEditor.ts
- [ ] День 18: ChaptersManager.ts
- [ ] День 19: project_launcher.ts
- [ ] День 20: ui_menu.ts + chapters.ts

### Неделя 5: Финализация
- [ ] День 21: ui_editor.ts
- [ ] День 22: Интеграционные тесты
- [ ] День 23: Оптимизация производительности
- [ ] День 24: Документация
- [ ] День 25: Финальное тестирование

---

## 📊 Метрики успеха

| Метрика | Цель |
|---------|------|
| Покрытие тестами | >80% |
| TypeScript strict mode | ✅ |
| ESLint без ошибок | ✅ |
| Производительность | Не хуже текущей |
| Функциональность | 100% сохранена |

---

## 🔧 Инструменты

- **TypeScript** — типизация
- **Vitest** — unit тесты
- **ESLint** — линтинг
- **Prettier** — форматирование
- **vue-tsc** — проверка типов Vue
- **Tauri** — backend (Rust)

---

**Готов начать с настройки TypeScript конфигурации?**