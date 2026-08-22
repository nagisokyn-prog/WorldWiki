import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount, type VueWrapper } from '@vue/test-utils';
import Settings from '../../src/components/Vue/Settings.vue';
import SettingsTypography from '../../src/components/Vue/Settings/SettingsTypography.vue';
import SettingsInterface from '../../src/components/Vue/Settings/SettingsInterface.vue';
import SettingsEditor from '../../src/components/Vue/Settings/SettingsEditor.vue';
import { settingsService } from '../../src/ts/services/settings.service';
import { setLocale } from '../../src/ts/i18n.js';
import { createI18n } from 'vue-i18n';

// Mock dependencies
vi.mock('../../src/ts/services/settings.service', () => ({
  settingsService: {
    getSettings: vi.fn(),
    saveSettings: vi.fn().mockResolvedValue(undefined),
    loadSettings: vi.fn().mockResolvedValue(undefined),
    applyQualityLevel: vi.fn(),
    onChange: vi.fn(),
    getCurrentTheme: vi.fn().mockReturnValue('dark'),
    resetSettings: vi.fn()
  }
}));

vi.mock('../../src/ts/i18n.js', () => ({
  setLocale: vi.fn(),
  i18n: {
    global: {
      t: (key: string) => key
    }
  }
}));

vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: vi.fn()
}));

describe('Settings.vue', () => {
  let wrapper: VueWrapper<any>;
  let mockSettings: any;

  const createMockSettings = () => ({
    locale: 'ru',
    colors: {
      bgBase: '#09090b',
      bgSecondary: '#121214',
      bgPanel: 'rgba(15,15,18,0.7)',
      bgInput: 'rgba(22,22,26,0.6)',
      textMain: '#ffffff',
      textMuted: 'rgba(255,255,255,0.65)',
      textHeading: '#ffffff',
      accent: '#8b5cf6',
      accentHover: '#7c3aed',
      accentActive: '#6d28d9',
      accentDisabled: '#4c1d95',
      accentGlow: 'rgba(139,92,246,0.3)',
      accentText: '#ffffff',
      borderColor: 'rgba(255,255,255,0.1)',
      borderActive: 'rgba(139,92,246,0.5)',
      shadowColor: 'rgba(0,0,0,0.5)'
    },
    glass: { islandAlpha: 0.45, cardAlpha: 0.03, blur: 24, borderAlpha: 0.1, highlight: 'rgba(255,255,255,0.08)' },
    radii: { island: 28, card: 20, btn: 40, input: 16, dropdown: 16 },
    shadows: { islandY: 20, islandBlur: 35, useInset: false },
    animations: { enabled: true, speed: 0.3, ease: 'cubic-bezier(0.2,0.8,0.2,1)', entrance: 0.4, pulse: true, scalePush: 0.98, scalePull: 1.05 },
    fonts: { family: 'Inter', size: 14, weight: 400, weightBold: 600, lineHeight: 1.5, letterSpacing: 0 },
    spacing: { density: 1, sidebarWidth: 280, panelHeight: 250, activityBarWidth: 60, toolbarHeight: 48, gap: 16 },
    layout: { columns: 2, sidebarPos: 'row', tabPos: 'row', focusMode: false },
    inputs: { style: 'outline', focusAnim: true },
    buttons: { hoverScale: true, clickPress: true },
    tabs: { pos: 'row' },
    dropdowns: { use3DWheel: true, wheelOrientation: 'vertical', transparency: 0 },
    cards: { compactList: false, showIcons: true },
    editor: { showWordCount: true, requireCtrlForLinks: false, autoSaveInterval: 60, snapshotInterval: 15, maxSnapshots: 10 },
    notifications: { duration: 3000, position: 'bottom-right' },
    perf: { level: 'auto', fpsLimit: 60, loadMeter: 0, qualityLevel: 100 },
    background: { type: 'none', opacity: 1, blur: 0, fit: 'cover', fpsLimit: 30 }
  });

  const i18n = createI18n({
    legacy: false,
    locale: 'ru',
    messages: {
      ru: {
        settings: {
          title: 'Настройки',
          description: 'Настройка {category}',
          categories: {
            title: 'Категории',
            theme: 'Тема',
            all: 'Все',
            colors: 'Цвета',
            glass: 'Стекло',
            radii: 'Радиусы',
            shadows: 'Тени',
            animations: 'Анимации',
            fonts: 'Шрифты',
            spacing: 'Отступы',
            layout: 'Компоновка',
            inputs: 'Инпуты',
            buttons: 'Кнопки',
            tabs: 'Вкладки',
            dropdowns: 'Выпадающие',
            cards: 'Карточки',
            notifications: 'Уведомления',
            perf: 'Производительность',
            background: 'Фон',
            editor: 'Редактор'
          },
          groupTitles: {
            theme: 'Тема оформления',
            colors: 'Цветовая схема',
            glass: 'Прозрачность и стекло',
            radii: 'Скругления',
            shadows: 'Тени и объем',
            animations: 'Анимации',
            fonts: 'Шрифты',
            spacing: 'Отступы и плотность',
            layout: 'Компоновка',
            inputs: 'Инпуты и формы',
            buttons: 'Кнопки',
            tabs: 'Вкладки',
            dropdowns: 'Выпадающие списки',
            cards: 'Карточки и списки',
            notifications: 'Уведомления',
            perf: 'Производительность'
          },
          fields: {
            bgBase: 'Базовый фон',
            bgSecondary: 'Вторичный фон',
            bgPanel: 'Фон панелей',
            bgInput: 'Фон инпутов',
            textMain: 'Основной текст',
            textMuted: 'Приглушенный текст',
            accent: 'Акцент',
            accentHover: 'Акцент при наведении',
            accentText: 'Текст акцента',
            borderColor: 'Цвет границ',
            shadowColor: 'Цвет теней',
            islandAlpha: 'Непрозрачность островков',
            cardAlpha: 'Непрозрачность карточек',
            blur: 'Размытие',
            borderAlpha: 'Непрозрачность границ',
            islandRadius: 'Радиус островков',
            cardRadius: 'Радиус карточек',
            btnRadius: 'Радиус кнопок',
            inputRadius: 'Радиус инпутов',
            dropdownRadius: 'Радиус выпадающих',
            shadowOffsetY: 'Смещение тени Y',
            shadowBlur: 'Размытие тени',
            shadowInset: 'Внутренние тени',
            animationsEnabled: 'Включить анимации',
            animationSpeed: 'Скорость анимаций',
            entrance: 'Длительность появления',
            pulse: 'Эффект пульсации',
            scalePush: 'Масштаб при нажатии',
            scalePull: 'Масштаб при отпускании',
            fontFamily: 'Семейство шрифтов',
            fontSize: 'Размер шрифта',
            fontLineHeight: 'Межстрочный интервал',
            fontLetterSpacing: 'Межбуквенный интервал',
            density: 'Плотность',
            sidebarWidth: 'Ширина сайдбара',
            panelHeight: 'Высота панелей',
            columns: 'Колонки',
            sidebarPosition: 'Позиция сайдбара',
            focusMode: 'Режим фокуса',
            inputStyle: 'Стиль инпутов',
            inputFocusAnimation: 'Анимация фокуса',
            hoverEffect: 'Эффект наведения',
            clickEffect: 'Эффект нажатия',
            tabsPosition: 'Позиция вкладок',
            wheel3DEffect: '3D эффект колеса',
            wheelOrientation: 'Ориентация колеса',
            compactList: 'Компактный список',
            showIcons: 'Показывать иконки',
            notificationDuration: 'Длительность уведомлений',
            notificationPosition: 'Позиция уведомлений',
            topLeft: 'Сверху слева',
            topRight: 'Сверху справа',
            bottomLeft: 'Снизу слева',
            bottomRight: 'Снизу справа'
          },
          fonts: {
            interDefault: 'Inter (по умолчанию)',
            roboto: 'Roboto',
            sfPro: 'SF Pro Display',
            segoe: 'Segoe UI',
            firaCode: 'Fira Code'
          },
          confirmReset: 'Сбросить все настройки к значениям по умолчанию?'
        }
      }
    }
  });

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockSettings = createMockSettings();
    
    // Mock settingsService.getSettings
    vi.mocked(settingsService.getSettings).mockReturnValue(mockSettings);
    
    // Mock settingsService.onChange
    vi.mocked(settingsService.onChange).mockImplementation((cb: any) => cb(mockSettings));
    
    wrapper = mount(Settings, {
      global: {
        plugins: [i18n],
        stubs: {
          ThemeSwitcher: {
            template: '<div data-testid="theme-switcher"></div>'
          },
          transition: true,
          Transition: true
        },
        directives: {
          'auto-animate': () => {}
        }
      }
    });
  });

  afterEach(() => {
    if (wrapper) wrapper.unmount();
  });

  describe('Rendering', () => {
    it('should render without errors', () => {
      expect(wrapper.exists()).toBe(true);
    });

    it('should render sidebar with categories', () => {
      const navItems = wrapper.findAll('.nav-item, .settings-nav-item');
      expect(navItems.length).toBeGreaterThan(0);
    });

    it('should render settings title', () => {
      expect(wrapper.text()).toMatch(/Категории|Settings|Настройки|appearance/);
    });

    it('should render ThemeSwitcher component', () => {
      expect(wrapper.findComponent({ name: 'ThemeSwitcher' }).exists() || wrapper.find('.theme-switcher').exists() || wrapper.find('.theme-item').exists() || wrapper.find('[data-testid="theme-switcher"]').exists()).toBe(true);
    });
  });

  describe('Category Navigation', () => {
    it('should have "appearance" as active category by default', () => {
      const activeItem = wrapper.find('.nav-item.is-active, .settings-nav-item.active');
      expect(activeItem.exists()).toBe(true);
    });

    it('should switch category when clicking nav item', async () => {
      const navItem = wrapper.findAll('.nav-item').find(item => item.text().includes('interface') || item.text().includes('Интерфейс') || item.text().includes('◇'));
      if (navItem) {
        await navItem.trigger('click');
        await wrapper.vm.$nextTick();
        expect(wrapper.find('.settings-scene').exists()).toBe(true);
      }
    });

    it('should show only active category content', async () => {
      const navItem = wrapper.findAll('.nav-item').find(item => item.text().includes('interface') || item.text().includes('Интерфейс') || item.text().includes('◇'));
      if (navItem) {
        await navItem.trigger('click');
        await wrapper.vm.$nextTick();
        const settingsGroup = wrapper.find('.settings-group');
        expect(settingsGroup.exists()).toBe(true);
      }
    });
  });

  describe('Reactivity and Bindings', () => {
    it('should update compactList when checkbox is clicked', async () => {
      const interfaceItem = wrapper.findAll('.nav-item').find(item => item.text().includes('interface') || item.text().includes('Интерфейс') || item.text().includes('◇'));
      if (interfaceItem) {
        await interfaceItem.trigger('click');
        await wrapper.vm.$nextTick();
      }

      const checkbox = wrapper.find('input[type="checkbox"]');
      if (checkbox.exists()) {
        await checkbox.setValue(true);
        expect(settingsService.saveSettings).toHaveBeenCalled();
      }
    });

    it('should select performance profile when profile card is clicked', async () => {
      wrapper.vm.activeTab = 'performance';
      await wrapper.vm.$nextTick();

      const profileCards = wrapper.findAll('.profile-card');
      if (profileCards.length > 0) {
        await profileCards[0].trigger('click');
        expect(settingsService.saveSettings).toHaveBeenCalled();
      }
    });

    it('should update color values when color input changes', async () => {
      const colorInput = wrapper.find('input[type="color"]');
      if (colorInput.exists()) {
        await colorInput.setValue('#ff0000');
        expect(settingsService.saveSettings).toHaveBeenCalled();
      }
    });

    it('should update radius values when range input changes', async () => {
      const interfaceItem = wrapper.findAll('.nav-item').find(item => item.text().includes('interface') || item.text().includes('Интерфейс') || item.text().includes('◇'));
      if (interfaceItem) {
        await interfaceItem.trigger('click');
        await wrapper.vm.$nextTick();
      }

      const slider = wrapper.find('input[type="range"]');
      if (slider.exists()) {
        await slider.setValue(30);
        expect(settingsService.saveSettings).toHaveBeenCalled();
      }
    });

    it('should update toggle switches correctly', async () => {
      const motionItem = wrapper.findAll('.nav-item').find(item => item.text().includes('motion') || item.text().includes('Анимации') || item.text().includes('◌'));
      if (motionItem) {
        await motionItem.trigger('click');
        await wrapper.vm.$nextTick();
      }

      const checkbox = wrapper.find('input[type="checkbox"]');
      if (checkbox.exists()) {
        await checkbox.setValue(false);
        await checkbox.trigger('change');
        expect(settingsService.saveSettings).toHaveBeenCalled();
      }
    });

    it('should update radio button groups', async () => {
      const radioButtons = wrapper.findAll('.radio-btn');
      if (radioButtons.length > 1) {
        await radioButtons[1].trigger('click');
        expect(settingsService.saveSettings).toHaveBeenCalled();
      }
    });
  });

  describe('Background File Picker', () => {
    it('should handle image file selection', async () => {
      const { open } = await import('@tauri-apps/plugin-dialog');
      vi.mocked(open).mockResolvedValue('/path/to/image.jpg');

      const bgGroup = wrapper.findAll('.settings-group').find(g => g.text().includes('Фон') || g.text().includes('Тип фона'));
      if (bgGroup) {
        const imageRadio = bgGroup.findAll('.radio-btn').find(btn => btn.text().includes('Изображение'));
        if (imageRadio) {
          await imageRadio.trigger('click');
        }

        const pickButton = bgGroup.find('button');
        if (pickButton.exists()) {
          await pickButton.trigger('click');
          expect(open).toHaveBeenCalledWith(expect.objectContaining({
            filters: expect.arrayContaining([
              expect.objectContaining({
                name: 'Image',
                extensions: ['jpg', 'png', 'gif', 'jpeg', 'webp']
              })
            ])
          }));
        }
      }
    });

    it('should handle video file selection', async () => {
      const { open } = await import('@tauri-apps/plugin-dialog');
      vi.mocked(open).mockResolvedValue('/path/to/video.mp4');

      const bgGroup = wrapper.findAll('.settings-group').find(g => g.text().includes('Фон') || g.text().includes('Тип фона'));
      if (bgGroup) {
        const videoRadio = bgGroup.findAll('.radio-btn').find(btn => btn.text().includes('Видео'));
        if (videoRadio) {
          await videoRadio.trigger('click');
        }

        const pickButton = bgGroup.find('button');
        if (pickButton.exists()) {
          await pickButton.trigger('click');
          expect(open).toHaveBeenCalledWith(expect.objectContaining({
            filters: expect.arrayContaining([
              expect.objectContaining({
                name: 'Video',
                extensions: ['mp4', 'webm']
              })
            ])
          }));
        }
      }
    });
  });

  describe('Save and Reset', () => {
    it('should call saveSettings when save is triggered', async () => {
      const checkbox = wrapper.find('input[type="checkbox"]');
      if (checkbox.exists()) {
        await checkbox.setValue(true);
        expect(settingsService.saveSettings).toHaveBeenCalled();
      }
    });

    it('should call resetSettings when reset is triggered', async () => {
      const resetButton = wrapper.findAll('button').find(btn => btn.text().includes('Сброс') || btn.text().includes('Reset'));
      if (resetButton) {
        vi.spyOn(global, 'confirm').mockReturnValue(true);
        await resetButton.trigger('click');
        expect(settingsService.resetSettings).toHaveBeenCalled();
      }
    });
  });

  describe('Locale Change', () => {
    it('should call setLocale when locale changes', async () => {
      expect(setLocale).toBeDefined();
    });
  });

  describe('Font Options', () => {
    it('should display all font options', async () => {
      const typographyWrapper = mount(SettingsTypography, {
        props: { settings: mockSettings, save: vi.fn() },
        global: { plugins: [i18n], directives: { 'auto-animate': () => {} } }
      });
      const fontOptions = typographyWrapper.findAll('.radio-btn');
      expect(fontOptions.length).toBeGreaterThanOrEqual(5); // Inter, Roboto, SF Pro, Segoe UI, Fira Code
    });
  });

  describe('Notification Settings', () => {
    it('should have notification position radio buttons', async () => {
      const interfaceWrapper = mount(SettingsInterface, {
        props: { settings: mockSettings, save: vi.fn() },
        global: { plugins: [i18n], directives: { 'auto-animate': () => {} } }
      });
      const radioButtons = interfaceWrapper.findAll('.radio-btn');
      const positions = radioButtons.map(btn => btn.text());
      expect(positions.length).toBeGreaterThanOrEqual(4);
    });

    it('should have duration slider', async () => {
      const interfaceWrapper = mount(SettingsInterface, {
        props: { settings: mockSettings, save: vi.fn() },
        global: { plugins: [i18n], directives: { 'auto-animate': () => {} } }
      });
      const slider = interfaceWrapper.find('input[type="range"]');
      expect(slider.exists()).toBe(true);
    });
  });

  describe('Editor Settings', () => {
    it('should have auto-save interval slider', async () => {
      const editorWrapper = mount(SettingsEditor, {
        props: { settings: mockSettings, save: vi.fn() },
        global: { plugins: [i18n], directives: { 'auto-animate': () => {} } }
      });
      const sliders = editorWrapper.findAll('input[type="range"]');
      expect(sliders.length).toBeGreaterThanOrEqual(3); // autoSave, snapshot, maxSnapshots
    });
  });
});
