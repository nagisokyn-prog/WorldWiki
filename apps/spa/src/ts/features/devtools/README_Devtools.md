# 🛠️ apps/spa/src/ts/features/devtools — Инструменты Разработчика и SurrealDB REPL

> **Назначение**: Встроенные инструменты диагностики и отладки базы данных WorldWiki. Содержит интерактивную SQL/SurrealQL консоль (`SurrealConsole`) с пресетами запросов к проекту, историей выполнения и инспекцией результатов.

---

## 📁 Структура папок и файлов

```
apps/spa/src/ts/features/devtools/
├── README_Devtools.md                  # Данная документация инструментов разработчика
│
└── SurrealConsole/                     # Интерактивная SurrealQL REPL-консоль
    ├── SurrealConsole.vue              # Основной интерфейс консоли ввода и навигации по истории
    ├── SurrealConsole.model.ts         # Типы QueryHistoryItem, PresetQuery, SurrealConsoleProps
    ├── SurrealConsole.css              # Стили консоли
    ├── useSurrealConsole.ts            # Выполнение запросов через api.client.ts, история (localStorage, до 50 записей), пресеты
    ├── useSurrealConsole.spec.ts       # Юнит-тесты хука консоли
    └── components/
        ├── SurrealConsolePresets/      # Панель быстрых пресетов (projects, chapters, volumes, contains, entities, fn::get_chapter_hierarchy, INFO FOR DB)
        └── SurrealConsoleOutput/       # Панель вывода JSON-результата, времени выполнения и ошибок
```

---

## ⚙️ Возможности `useSurrealConsole`

- **Пресеты с контекстом проекта**: автоматическая подстановка `cleanProject` в `projects:⟨...⟩` для инспекции глав, томов, сущностей и графа `contains`.
- **История запросов**: сохраняется в `localStorage` под ключом `surreal_console_history_v1` (лимит `MAX_HISTORY_ITEMS = 50`), поддерживается навигация по истории и замер длительности (`durationMs`).

---

## 🧪 Тестирование

```bash
pnpm test apps/spa/src/ts/features/devtools
```
