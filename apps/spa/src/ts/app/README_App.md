# apps/spa/src/ts/app — Архитектура Инициализации Приложения и Маршрутизации

> **Назначение**: Корневой уровень инициализации, конфигурации и загрузки (Application Bootstrap & Entry Points) WorldWiki SPA. Отвечает за создание инстанса Vue 3, регистрацию глобальных плагинов (Pinia, Vue Router), установку пользовательских директив (`v-glass`), навигационные гарды маршрутизации (`router.ts`), логику лаунчера вселенных (`project_launcher.ts`) и перехват критических ошибок приложения.

---

## 📁 Структура папок и файлов

```
apps/spa/src/ts/app/
├── README_App.md                       # 🌟 Данная всеобъемлющая документация слоя приложения
│
├── app.ts                              # 🚀 Главная точка сборки: createApp(), Pinia, Router, директивы, errorHandler
├── router.ts                           # 🗺️ Конфигурация Vue Router: маршруты экранов, навигационные гарды
├── project_launcher.ts                 # 🌌 Логика лаунчера проектов: инициализация вселенных, распаковка .world архивов
├── chapters.ts                         # 📖 Координация состояния рукописи на уровне приложения
├── ui_editor.ts                        # 🎨 Оркестрация компоновки рабочих панелей редактора
└── settings.ts                         # ⚙️ Предстартовая инициализация дизайн-системы и токенов
```

---

## 🏛️ Архитектурная модель Bootstrap-Пайплайна

```mermaid
flowchart TD
    subgraph HTML_Entry ["Точки Входа (HTML Pages)"]
        IndexHTML["index.html (Главное приложение)"]
        AiHTML["ai.html (Автономное окно AI)"]
    end

    subgraph App_Bootstrap ["Слой Инициализации (ts/app)"]
        AppTS["app.ts (createApp)"]
        SettingsInit["settings.ts (Токены до рендера)"]
        RouterTS["router.ts (Vue Router)"]
        LauncherLogic["project_launcher.ts"]
    end

    subgraph Global_Plugins ["Глобальные Плагины и Директивы"]
        PiniaInst["Pinia (Root Store)"]
        VGlassDir["v-glass.ts (Директива Glassmorphism)"]
        ErrorTrap["Vue Global Error Handler"]
    end

    subgraph SPA_Views ["Маршрутизируемые Экраны"]
        SplashView["Splash.vue (Экран загрузки)"]
        LauncherView["ProjectLauncher.vue (Лаунчер проектов)"]
        EditorView["EditorView.vue (Рабочее пространство)"]
    end

    IndexHTML --> AppTS
    AiHTML --> AppTS

    AppTS --> SettingsInit
    AppTS --> PiniaInst
    AppTS --> RouterTS
    AppTS --> VGlassDir
    AppTS --> ErrorTrap

    RouterTS --> SplashView
    RouterTS --> LauncherView
    RouterTS --> EditorView
    LauncherView <--> LauncherLogic
```

---

## 🔄 Жизненный цикл старта и инициализации (Sequence Diagram)

```mermaid
sequenceDiagram
    autonumber
    actor User as Пользователь
    participant HTML as index.html
    participant App as app.ts
    participant Set as settings.ts
    participant Router as router.ts
    participant Tauri as Tauri IPC

    User->>HTML: Запуск приложения
    HTML->>App: Вызов bootstrap()
    App->>Set: initSettingsPreRender()
    Set->>Set: Чтение темы из localStorage и мгновенная инъекция CSS-переменных в :root
    Note over Set: Предотвращение мерцания (Zero FOUC) до монтирования Vue!
    App->>App: createApp(RootApp).use(Pinia).use(Router)
    App->>App: Регистрация директивы v-glass
    App->>Router: router.isReady()
    App->>HTML: app.mount('#app')
    App->>Tauri: invoke("notify_frontend_ready")
```

---

## 🗺️ Карта Маршрутизации (`router.ts`)

| Маршрут | Компонент представления | Назначение | Навигационные проверки |
|---|---|---|---|
| `/` | `Splash.vue` | Стартовая диагностика и проверка целостности локальной БД | Автопереход на `/launcher` после инициализации |
| `/launcher` | `ProjectLauncher.vue` | Выбор или создание вселенной из шаблонов | Очистка активного состояния проекта |
| `/project/:id` | `EditorView.vue` | Главное рабочее пространство проекта (Рукопись / Лор / Календари) | Валидация существования `projectId` в БД |
| `/ai` | `FloatingWindowAI/AiApp.vue` | Автономный режим окна интеллектуального ассистента | Режим отдельного Webview-окна |

---

## ⚠️ Важные нюансы реализации (Gotchas & Best Practices)

1. **Исключение Flash of Unstyled Content (FOUC)**:
   * Вызов `settings.ts` выполняется **синхронно до** вызова `app.mount('#app')`. Это гарантирует, что темная тема или кастомный акцент применятся до первого кадра отрисовки DOM.
2. **Глобальный перехватчик необработанных исключений (`app.config.errorHandler`)**:
   * Все ошибки компонентов перехватываются, логируются в `console.ts` и при критических сбоях выводят дружелюбное диалоговое окно восстановления сессии без падения всего WebView.

---

## 🧪 Верификация и тестирование

Запуск проверки слоя приложения:
```bash
# Typecheck и юнит-тесты роутера и лаунчера
pnpm --filter @worldwiki/spa typecheck
pnpm test apps/spa/src/ts/app
```
