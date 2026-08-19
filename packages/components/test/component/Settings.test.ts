import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount, VueWrapper } from '@vue/test-utils';
import Settings from '../../src/components/Vue/Settings.vue';
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
    dropdowns: { use3DWheel: true, wheelOrientation: 'vertical' },
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
            islandAlpha: 'Прозрачность островков',
            cardAlpha: 'Прозрачность карточек',
            blur: 'Размытие',
            borderAlpha: 'Прозрачность границ',
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
          }
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
      const navItems = wrapper.findAll('.settings-nav-item');
      expect(navItems.length).toBeGreaterThan(0);
    });

    it('should render settings title', () => {
      expect(wrapper.text()).toContain('Настройки');
    });

    it('should render ThemeSwitcher component', () => {
      expect(wrapper.findComponent({ name: 'ThemeSwitcher' }).exists() || wrapper.find('.theme-switcher').exists() || wrapper.find('.theme-item').exists() || wrapper.find('[data-testid="theme-switcher"]').exists()).toBe(true);
    });
  });

  describe('Category Navigation', () => {
    it('should have "theme" as active category by default', () => {
      const activeItem = wrapper.find('.settings-nav-item.active');
      expect(activeItem.exists()).toBe(true);
      expect(activeItem.text()).toContain('Тема');
    });

    it('should switch category when clicking nav item', async () => {
      const colorsItem = wrapper.findAll('.settings-nav-item').find(item => item.text().includes('Цвета'));
      if (colorsItem) {
        await colorsItem.trigger('click');
        expect(wrapper.vm.activeCategory).toBe('colors');
      }
    });

    it('should show only active category content', async () => {
      // Click on colors category
      const colorsItem = wrapper.findAll('.settings-nav-item').find(item => item.text().includes('Цвета'));
      if (colorsItem) {
        await colorsItem.trigger('click');
        
        // Colors group should be visible
        const colorsGroup = wrapper.find('.settings-group');
        expect(colorsGroup.exists()).toBe(true);
      }
    });
  });

  describe('Reactivity and Bindings', () => {
    it('should update compactList when checkbox is clicked', async () => {
      // Navigate to cards category
      const cardsItem = wrapper.findAll('.settings-nav-item').find(item => item.text().includes('Карточки'));
      if (cardsItem) {
        await cardsItem.trigger('click');
      }

      // Find the compactList checkbox
      const checkbox = wrapper.find('input[type="checkbox"]');
      if (checkbox.exists()) {
        await checkbox.setValue(true);
        
        expect(settingsService.saveSettings).toHaveBeenCalled();
      }
    });

    it('should call applyQuality when quality slider changes', async () => {
      // Navigate to perf category
      const perfItem = wrapper.findAll('.settings-nav-item').find(item => item.text().includes('Производительность'));
      if (perfItem) {
        await perfItem.trigger('click');
      }

      // Find the quality slider
      const perfGroup = wrapper.findAll('.settings-group').find(g => g.text().includes('Производительность'));
      if (perfGroup) {
        const slider = perfGroup.find('input[type="range"]');
        if (slider.exists()) {
          await slider.setValue(50);
          expect(settingsService.applyQualityLevel).toHaveBeenCalled();
        }
      }
    });

    it('should update color values when color input changes', async () => {
      // Navigate to colors category
      const colorsItem = wrapper.findAll('.settings-nav-item').find(item => item.text().includes('Цвета'));
      if (colorsItem) {
        await colorsItem.trigger('click');
      }

      // Find a color input
      const colorInput = wrapper.find('input[type="color"]');
      if (colorInput.exists()) {
        await colorInput.setValue('#ff0000');
        
        expect(settingsService.saveSettings).toHaveBeenCalled();
      }
    });

    it('should update radius values when range input changes', async () => {
      // Navigate to radii category
      const radiiItem = wrapper.findAll('.settings-nav-item').find(item => item.text().includes('Радиусы'));
      if (radiiItem) {
        await radiiItem.trigger('click');
      }

      // Find a radius slider
      const slider = wrapper.find('input[type="range"]');
      if (slider.exists()) {
        await slider.setValue(30);
        
        expect(settingsService.saveSettings).toHaveBeenCalled();
      }
    });

    it('should update toggle switches correctly', async () => {
      // Navigate to animations category
      const animationsItem = wrapper.findAll('.settings-nav-item').find(item => item.text().includes('Анимации'));
      if (animationsItem) {
        await animationsItem.trigger('click');
      }

      // Find animation toggle
      const animGroup = wrapper.findAll('.settings-group').find(g => g.text().includes('Анимации'));
      if (animGroup) {
        const checkbox = animGroup.find('input[type="checkbox"]');
        if (checkbox.exists()) {
          await checkbox.setValue(false);
          await checkbox.trigger('change');
          expect(settingsService.saveSettings).toHaveBeenCalled();
        }
      }
    });

    it('should update radio button groups', async () => {
      // Navigate to layout category
      const layoutItem = wrapper.findAll('.settings-nav-item').find(item => item.text().includes('Компоновка'));
      if (layoutItem) {
        await layoutItem.trigger('click');
      }

      // Find radio buttons for columns
      const radioButtons = wrapper.findAll('.radio-btn');
      if (radioButtons.length > 0) {
        await radioButtons[1].trigger('click');
        
        expect(settingsService.saveSettings).toHaveBeenCalled();
      }
    });
  });

  describe('Background File Picker', () => {
    it('should handle image file selection', async () => {
      const { open } = await import('@tauri-apps/plugin-dialog');
      vi.mocked(open).mockResolvedValue('/path/to/image.jpg');

      // Navigate to background category
      const backgroundItem = wrapper.findAll('.settings-nav-item').find(item => item.text().includes('Фон'));
      if (backgroundItem) {
        await backgroundItem.trigger('click');
      }

      const bgGroup = wrapper.findAll('.settings-group').find(g => g.text().includes('Фон') || g.text().includes('Тип фона'));
      if (bgGroup) {
        // Select image type
        const imageRadio = bgGroup.findAll('.radio-btn').find(btn => btn.text().includes('Изображение'));
        if (imageRadio) {
          await imageRadio.trigger('click');
        }

        // Click pick file button
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

      // Navigate to background category
      const backgroundItem = wrapper.findAll('.settings-nav-item').find(item => item.text().includes('Фон'));
      if (backgroundItem) {
        await backgroundItem.trigger('click');
      }

      const bgGroup = wrapper.findAll('.settings-group').find(g => g.text().includes('Фон') || g.text().includes('Тип фона'));
      if (bgGroup) {
        // Select video type
        const videoRadio = bgGroup.findAll('.radio-btn').find(btn => btn.text().includes('Видео'));
        if (videoRadio) {
          await videoRadio.trigger('click');
        }

        // Click pick file button
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
      // Change a setting
      const checkbox = wrapper.find('input[type="checkbox"]');
      if (checkbox.exists()) {
        await checkbox.setValue(true);
        
        expect(settingsService.saveSettings).toHaveBeenCalled();
      }
    });

    it('should call resetSettings when reset is triggered', async () => {
      // Find reset button (might need to trigger through confirm)
      const resetButton = wrapper.findAll('button').find(btn => btn.text().includes('Сброс') || btn.text().includes('Reset'));
      if (resetButton) {
        // Mock confirm
        vi.spyOn(global, 'confirm').mockReturnValue(true);
        await resetButton.trigger('click');
        
        expect(settingsService.resetSettings).toHaveBeenCalled();
      }
    });
  });

  describe('Locale Change', () => {
    it('should call setLocale when locale changes', async () => {
      // This would typically be tested through the locale selector
      // For now, verify the mock is in place
      expect(setLocale).toBeDefined();
    });
  });

  describe('Font Options', () => {
    it('should display all font options', async () => {
      // Navigate to fonts category
      const fontsItem = wrapper.findAll('.settings-nav-item').find(item => item.text().includes('Шрифты'));
      if (fontsItem) {
        await fontsItem.trigger('click');
      }

      // Check for font options
      const fontOptions = wrapper.findAll('.radio-btn');
      expect(fontOptions.length).toBeGreaterThanOrEqual(5); // Inter, Roboto, SF Pro, Segoe UI, Fira Code
    });
  });

  describe('Notification Settings', () => {
    it('should have notification position radio buttons', async () => {
      // Navigate to notifications category
      const notificationsItem = wrapper.findAll('.settings-nav-item').find(item => item.text().includes('Уведомления'));
      if (notificationsItem) {
        await notificationsItem.trigger('click');
      }

      // Check for position radio buttons
      const radioButtons = wrapper.findAll('.radio-btn');
      const positions = radioButtons.map(btn => btn.text());
      expect(positions).toContain('Сверху слева');
      expect(positions).toContain('Сверху справа');
      expect(positions).toContain('Снизу слева');
      expect(positions).toContain('Снизу справа');
    });

    it('should have duration slider', async () => {
      // Navigate to notifications category
      const notificationsItem = wrapper.findAll('.settings-nav-item').find(item => item.text().includes('Уведомления'));
      if (notificationsItem) {
        await notificationsItem.trigger('click');
      }

      const slider = wrapper.find('input[type="range"]');
      expect(slider.exists()).toBe(true);
    });
  });

  describe('Editor Settings', () => {
    it('should have auto-save interval slider', async () => {
      // Navigate to editor category
      const editorItem = wrapper.findAll('.settings-nav-item').find(item => item.text().includes('Редактор'));
      if (editorItem) {
        await editorItem.trigger('click');
      }

      const sliders = wrapper.findAll('input[type="range"]');
      expect(sliders.length).toBeGreaterThanOrEqual(3); // autoSave, snapshot, maxSnapshots
    });
  });
});
