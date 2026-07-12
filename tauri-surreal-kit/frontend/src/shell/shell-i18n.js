(function (window) {
  const messages = {
    en: {
      'shell.common.appName': 'Tauri Surreal Kit',
      'shell.common.shellDemo': 'Shell Demo',
      'shell.main.pageTitle': '{appName} — Shell',
      'shell.main.openDocsAlert': 'Open docs: {url}',
      'shell.main.fullscreenError': 'Unable to toggle fullscreen mode. Make sure the app runs in Tauri.',
      'shell.main.benchmarkFailed': 'benchmark failed',
      'shell.main.runFailed': 'run failed',
      'shell.main.cpuRamCores': 'CPU {cpu}ms · RAM {ram}MB · {cores} cores',
      'shell.main.perfLevel': 'perf {level}',
      'shell.main.heroTitle': 'Ready-made Tauri + SurrealDB shell',
      'shell.main.heroDescription': 'This page demonstrates the power of `tauri-surreal-kit`: backend integration, UI shell, generic services and ready-made components for editors, trees, quick commands and history.',
      'shell.main.card.backendTitle': 'Backend & SurrealDB',
      'shell.main.card.backendDesc': 'Full Tauri + SurrealDB backend with `entity_commands!` for automatic CRUD generation.',
      'shell.main.card.shellTitle': 'Shell UI',
      'shell.main.card.shellDesc': 'Split panes, draggable tabs, hotkeys and layout persistence via `useShellApp`.',
      'shell.main.card.componentsTitle': 'Ready-made components',
      'shell.main.card.componentsDesc': 'CommandPalette, QuickOpen, ExplorerTree, WorkspaceLayout and HistorySidebar out of the box.',
      'shell.main.actions.settings': '⚙️ Settings',
      'shell.main.actions.fullscreen': '🖥️ Fullscreen',
      'shell.main.actions.benchmark': '⚡ Benchmark',
      'shell.main.actions.docs': '📖 Docs',
      'shell.main.status.tauriApi': 'Tauri API',
      'shell.main.status.backendCheck': 'Backend check',
      'shell.main.status.lastPerf': 'Last perf',
      'shell.main.status.loading': 'loading...',
      'shell.main.status.checking': 'checking…',
      'shell.main.status.notSet': 'not set',
      'shell.main.status.offline': 'offline',
      'shell.main.status.browserMode': 'browser mode',
      'shell.main.status.noNativeCommands': 'no native commands',
      'shell.main.status.available': 'available',
      'shell.main.status.settingsLoaded': 'settings loaded',
      'shell.main.status.backendReachable': 'backend reachable',
      'shell.main.status.cachedPerf': 'cached perf {level}',
      'shell.main.status.shellReady': 'shell ready',
      'shell.main.features.item1': 'CRUD via `entity_commands!`',
      'shell.main.features.item2': 'CommandPalette and QuickOpen',
      'shell.main.features.item3': 'ExplorerTree and WorkspaceLayout',
      'shell.main.features.item4': 'HistorySidebar and entity history',
      'shell.main.features.item5': 'EntityService for arbitrary models',
      'shell.main.features.item6': 'Themes, settings and localStorage via `__APP_CONFIG__`',
      'shell.main.footerNote': 'Use this page as a starter shell demo. It is already connected to Tauri system commands and shows the framework’s main capabilities.',
      'shell.settings.pageTitle': '{appName} — Settings',
      'shell.settings.title': '⚙️ Settings',
      'shell.settings.save': '💾 Save',
      'shell.settings.back': '← Back',
      'shell.splash.pageTitle': '{appName} — Loading',
      'shell.splash.initializing': 'Initializing...',
      'shell.splash.preparingDatabase': 'Preparing database...',
      'shell.splash.loadingSchemas': 'Loading schemas...',
      'shell.splash.runningBenchmark': 'Running performance benchmark...',
      'shell.splash.benchmarkResult': 'Benchmark: CPU {cpu}ms, RAM {ram}ms, {cores} cores',
      'shell.splash.readyLaunching': 'Ready! Launching...',
      'shell.splash.errorPrefix': 'Error:',
      'shell.splash.performanceLabel': '⚡ Performance:',
      'shell.splash.defaultSubtitle': 'Loading...',
      'shell.splash.perfBadge': '⚡ Performance: ---',
    },
    ru: {
      'shell.common.appName': 'Tauri Surreal Kit',
      'shell.common.shellDemo': 'Демо-оболочка',
      'shell.main.pageTitle': '{appName} — Shell',
      'shell.main.openDocsAlert': 'Откройте документацию: {url}',
      'shell.main.fullscreenError': 'Не удалось переключить полноэкранный режим. Проверьте, что приложение работает в Tauri.',
      'shell.main.benchmarkFailed': 'бенчмарк не удался',
      'shell.main.runFailed': 'запуск не удался',
      'shell.main.cpuRamCores': 'CPU {cpu}ms · RAM {ram}МБ · {cores} ядер',
      'shell.main.perfLevel': 'perf {level}',
      'shell.main.heroTitle': 'Готовая Tauri + SurrealDB оболочка',
      'shell.main.heroDescription': 'Эта страница демонстрирует возможности `tauri-surreal-kit`: backend-интеграцию, UI shell, generic-сервисы и готовые компоненты для редакторов, деревьев, быстрых команд и истории.',
      'shell.main.card.backendTitle': 'Backend & SurrealDB',
      'shell.main.card.backendDesc': 'Полный бекенд Tauri + SurrealDB с `entity_commands!` для автоматической генерации CRUD.',
      'shell.main.card.shellTitle': 'Shell UI',
      'shell.main.card.shellDesc': 'Split-панели, draggable tabs, горячие клавиши и layout persistence через `useShellApp`.',
      'shell.main.card.componentsTitle': 'Готовые компоненты',
      'shell.main.card.componentsDesc': 'CommandPalette, QuickOpen, ExplorerTree, WorkspaceLayout и HistorySidebar доступны из коробки.',
      'shell.main.actions.settings': '⚙️ Настройки',
      'shell.main.actions.fullscreen': '🖥️ Fullscreen',
      'shell.main.actions.benchmark': '⚡ Benchmark',
      'shell.main.actions.docs': '📖 Документация',
      'shell.main.status.tauriApi': 'Tauri API',
      'shell.main.status.backendCheck': 'Проверка бэкенда',
      'shell.main.status.lastPerf': 'Последний перф',
      'shell.main.status.loading': 'загрузка...',
      'shell.main.status.checking': 'проверка…',
      'shell.main.status.notSet': 'не установлено',
      'shell.main.status.offline': 'оффлайн',
      'shell.main.status.browserMode': 'режим браузера',
      'shell.main.status.noNativeCommands': 'нет нативных команд',
      'shell.main.status.available': 'доступно',
      'shell.main.status.settingsLoaded': 'настройки загружены',
      'shell.main.status.backendReachable': 'бэкенд доступен',
      'shell.main.status.cachedPerf': 'кэшированный перф {level}',
      'shell.main.status.shellReady': 'оболочка готова',
      'shell.main.features.item1': 'CRUD через `entity_commands!`',
      'shell.main.features.item2': 'CommandPalette и QuickOpen',
      'shell.main.features.item3': 'ExplorerTree и WorkspaceLayout',
      'shell.main.features.item4': 'HistorySidebar и история сущностей',
      'shell.main.features.item5': 'EntityService для любых моделей',
      'shell.main.features.item6': 'Темы, настройки и localStorage через `__APP_CONFIG__`',
      'shell.main.footerNote': 'Используйте эту страницу как стартовую демо-оболочку. Она уже подключена к системным командам Tauri и показывает основные возможности фреймворка.',
      'shell.settings.pageTitle': '{appName} — Настройки',
      'shell.settings.title': '⚙️ Настройки',
      'shell.settings.save': '💾 Сохранить',
      'shell.settings.back': '← Назад',
      'shell.splash.pageTitle': '{appName} — Загрузка',
      'shell.splash.initializing': 'Инициализация...',
      'shell.splash.preparingDatabase': 'Подготовка базы данных...',
      'shell.splash.loadingSchemas': 'Загрузка схем...',
      'shell.splash.runningBenchmark': 'Запуск бенчмарка производительности...',
      'shell.splash.benchmarkResult': 'Бенчмарк: CPU {cpu}ms, RAM {ram}мб, {cores} ядер',
      'shell.splash.readyLaunching': 'Готово! Запуск...',
      'shell.splash.errorPrefix': 'Ошибка:',
      'shell.splash.performanceLabel': '⚡ Производительность:',
      'shell.splash.defaultSubtitle': 'Загрузка...',
      'shell.splash.perfBadge': '⚡ Производительность: ---',
    },
  };

  let currentLocale = 'en';

  const interpolate = (template, vars = {}) => {
    return template.replace(/\{(.*?)\}/g, (match, key) => {
      return vars[key] != null ? vars[key] : match;
    });
  };

  const resolveLocale = (locale) => {
    if (!locale) return 'en';
    const normalized = locale.toLowerCase();
    if (normalized.startsWith('ru')) return 'ru';
    return 'en';
  };

  const t = (key, vars) => {
    const localeMessages = messages[currentLocale] || messages.en;
    const value = localeMessages[key] ?? messages.en[key] ?? key;
    return typeof value === 'string' ? interpolate(value, vars) : key;
  };

  const setText = (selector, key, vars) => {
    const el = typeof selector === 'string' ? document.querySelector(selector) : selector;
    if (!el) return;
    el.textContent = t(key, vars);
  };

  const translateDom = (root = document) => {
    root.querySelectorAll('[data-i18n]').forEach((element) => {
      const key = element.getAttribute('data-i18n');
      if (key) {
        element.textContent = t(key);
      }
    });
  };

  const getStoredLocale = () => {
    try {
      const storageKey = window.__APP_CONFIG__?.storageKey || 'app:settings';
      const saved = localStorage.getItem(storageKey);
      if (!saved) return null;
      const parsed = JSON.parse(saved);
      if (parsed && typeof parsed.locale === 'string') {
        return parsed.locale;
      }
    } catch (err) {
      console.warn('shellI18n: failed to parse saved settings locale', err);
    }
    return null;
  };

  const init = (locale) => {
    currentLocale = resolveLocale(
      locale || getStoredLocale() || window.__APP_CONFIG__?.lang || window.__APP_CONFIG__?.locale || navigator.language || 'en'
    );
    document.documentElement.lang = currentLocale;
    translateDom();
  };

  window.shellI18n = { init, t, setText, translateDom, locale: () => currentLocale };
})(window);
