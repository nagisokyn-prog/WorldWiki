<template>
  <div class="settings-modal-content" style="height:100%;overflow:hidden;">
    <div class="settings-layout" style="height:100%;">
      <!-- Сайдбар с категориями -->
      <div class="settings-sidebar">
        <div style="font-size:11px;text-transform:uppercase;color:var(--text-muted);margin-bottom:12px;font-weight:bold;letter-spacing:1px;">Категории настроек</div>
        <div v-for="cat in categories" :key="cat.id" class="settings-nav-item" :class="{ active: activeCategory === cat.id }" @click="activeCategory = cat.id">
          <span>{{ cat.icon }}</span> {{ cat.title }}
        </div>
      </div>

      <!-- Контент настроек -->
      <div class="settings-content-area">
        <div class="glass-card-container" style="width:100%;height:100%;display:flex;flex-direction:column;overflow-y:auto;">
          <div class="glass-card-bg" style="border-color:var(--accent);"></div>
          <div class="glass-card-content" style="width:100%;flex:1;overflow-y:auto;min-height:0;display:flex;flex-direction:column;">
            <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--border-color);padding-bottom:12px;margin-bottom:24px;">
              <h2 class="card-title" style="border:none;margin:0;padding:0;">⚙️ UI Customization Engine</h2>
              <button class="btn btn-outline interactive-el" style="padding:6px 12px;" @click="resetSettings">Сбросить по умолчанию</button>
            </div>

            <p style="color:var(--text-muted);margin-bottom:24px;font-size:13px;">Изменения применяются мгновенно. Активная категория: <strong>{{ getCategoryTitle(activeCategory) }}</strong>.</p>

            <div class="settings-grid">
              <!-- 1. ТЕМА ОФОРМЛЕНИЯ -->
              <div class="settings-group" v-show="activeCategory === 'theme' || activeCategory === 'all'">
                <h3 class="form-label" style="color:var(--accent);margin-bottom:16px;">🎨 Тема оформления</h3>
                <ThemeSwitcher />
              </div>

              <!-- 2. ЦВЕТОВАЯ СХЕМА -->
              <div class="settings-group" v-show="activeCategory === 'colors' || activeCategory === 'all'">
                <h3 class="form-label" style="color:var(--accent);margin-bottom:16px;">1. Цветовая схема</h3>
                <div class="color-control"><span class="color-label">Цвет фона (Основной)</span><div style="display:flex;gap:12px;width:100%;"><input type="color" :value="toHex(settings.colors.bgBase)" @input="e => updateColorAlpha('bgBase', (e.target as HTMLInputElement).value)" class="interactive-el color-picker-input"><input type="text" v-model="settings.colors.bgBase" @input="save()" class="interactive-el color-text-input"></div></div>
                <div class="color-control"><span class="color-label">Цвет фона (Вторичный)</span><div style="display:flex;gap:12px;width:100%;"><input type="color" :value="toHex(settings.colors.bgSecondary)" @input="e => updateColorAlpha('bgSecondary', (e.target as HTMLInputElement).value)" class="interactive-el color-picker-input"><input type="text" v-model="settings.colors.bgSecondary" @input="save()" class="interactive-el color-text-input"></div></div>
                <div class="color-control"><span class="color-label">Цвет панелей</span><div style="display:flex;gap:12px;width:100%;"><input type="color" :value="toHex(settings.colors.bgPanel)" @input="e => updateColorAlpha('bgPanel', (e.target as HTMLInputElement).value)" class="interactive-el color-picker-input"><input type="text" v-model="settings.colors.bgPanel" @input="save()" class="interactive-el color-text-input"></div></div>
                <div class="color-control"><span class="color-label">Цвет инпутов</span><div style="display:flex;gap:12px;width:100%;"><input type="color" :value="toHex(settings.colors.bgInput)" @input="e => updateColorAlpha('bgInput', (e.target as HTMLInputElement).value)" class="interactive-el color-picker-input"><input type="text" v-model="settings.colors.bgInput" @input="save()" class="interactive-el color-text-input"></div></div>
                <div class="color-control"><span class="color-label">Цвет текста (Основной)</span><div style="display:flex;gap:12px;width:100%;"><input type="color" :value="toHex(settings.colors.textMain)" @input="e => updateColorAlpha('textMain', (e.target as HTMLInputElement).value)" class="interactive-el color-picker-input"><input type="text" v-model="settings.colors.textMain" @input="save()" class="interactive-el color-text-input"></div></div>
                <div class="color-control"><span class="color-label">Цвет текста (Второстепенный)</span><div style="display:flex;gap:12px;width:100%;"><input type="color" :value="toHex(settings.colors.textMuted)" @input="e => updateColorAlpha('textMuted', (e.target as HTMLInputElement).value)" class="interactive-el color-picker-input"><input type="text" v-model="settings.colors.textMuted" @input="save()" class="interactive-el color-text-input"></div></div>
                <div class="color-control"><span class="color-label">Цвет акцента</span><div style="display:flex;gap:12px;width:100%;"><input type="color" :value="toHex(settings.colors.accent)" @input="e => updateColorAlpha('accent', (e.target as HTMLInputElement).value)" class="interactive-el color-picker-input"><input type="text" v-model="settings.colors.accent" @input="save()" class="interactive-el color-text-input"></div></div>
                <div class="color-control"><span class="color-label">Цвет акцента (Hover)</span><div style="display:flex;gap:12px;width:100%;"><input type="color" :value="toHex(settings.colors.accentHover)" @input="e => updateColorAlpha('accentHover', (e.target as HTMLInputElement).value)" class="interactive-el color-picker-input"><input type="text" v-model="settings.colors.accentHover" @input="save()" class="interactive-el color-text-input"></div></div>
                <div class="color-control"><span class="color-label">Цвет границ</span><div style="display:flex;gap:12px;width:100%;"><input type="color" :value="toHex(settings.colors.borderColor)" @input="e => updateColorAlpha('borderColor', (e.target as HTMLInputElement).value)" class="interactive-el color-picker-input"><input type="text" v-model="settings.colors.borderColor" @input="save()" class="interactive-el color-text-input"></div></div>
                <div class="color-control"><span class="color-label">Цвет теней</span><div style="display:flex;gap:12px;width:100%;"><input type="color" :value="toHex(settings.colors.shadowColor)" @input="e => updateColorAlpha('shadowColor', (e.target as HTMLInputElement).value)" class="interactive-el color-picker-input"><input type="text" v-model="settings.colors.shadowColor" @input="save()" class="interactive-el color-text-input"></div></div>
              </div>

              <!-- 3. ПРОЗРАЧНОСТЬ И СТЕКЛО -->
              <div class="settings-group" v-show="activeCategory === 'glass' || activeCategory === 'all'">
                <h3 class="form-label" style="color:var(--accent);margin-bottom:16px;">2. Прозрачность и стекло</h3>
                <div class="control-row"><label>Прозрачность фона островков</label><span class="val-badge">{{ Math.round(settings.glass.islandAlpha * 100) }}%</span></div>
                <input type="range" min="0" max="1" step="0.05" v-model.number="settings.glass.islandAlpha" class="interactive-el" @change="save()">
                <div class="control-row"><label>Прозрачность карточек</label><span class="val-badge">{{ Math.round(settings.glass.cardAlpha * 100) }}%</span></div>
                <input type="range" min="0" max="0.5" step="0.01" v-model.number="settings.glass.cardAlpha" class="interactive-el" @change="save()">
                <div class="control-row"><label>Интенсивность размытия</label><span class="val-badge">{{ settings.glass.blur }}px</span></div>
                <input type="range" min="0" max="100" v-model.number="settings.glass.blur" class="interactive-el" @change="save()">
                <div class="control-row"><label>Прозрачность границ</label><span class="val-badge">{{ Math.round(settings.glass.borderAlpha * 100) }}%</span></div>
                <input type="range" min="0" max="1" step="0.05" v-model.number="settings.glass.borderAlpha" class="interactive-el" @change="save()">
              </div>

              <!-- 4. СКРУГЛЕНИЯ -->
              <div class="settings-group" v-show="activeCategory === 'radii' || activeCategory === 'all'">
                <h3 class="form-label" style="color:var(--accent);margin-bottom:16px;">3. Скругления</h3>
                <div class="control-row"><label>Скругление островков</label><span class="val-badge">{{ settings.radii.island }}px</span></div>
                <input type="range" min="0" max="60" v-model.number="settings.radii.island" class="interactive-el" @change="save()">
                <div class="control-row"><label>Скругление карточек</label><span class="val-badge">{{ settings.radii.card }}px</span></div>
                <input type="range" min="0" max="40" v-model.number="settings.radii.card" class="interactive-el" @change="save()">
                <div class="control-row"><label>Скругление кнопок</label><span class="val-badge">{{ settings.radii.btn }}px</span></div>
                <input type="range" min="0" max="40" v-model.number="settings.radii.btn" class="interactive-el" @change="save()">
                <div class="control-row"><label>Скругление инпутов</label><span class="val-badge">{{ settings.radii.input }}px</span></div>
                <input type="range" min="0" max="30" v-model.number="settings.radii.input" class="interactive-el" @change="save()">
                <div class="control-row"><label>Скругление выпадающих меню</label><span class="val-badge">{{ settings.radii.dropdown }}px</span></div>
                <input type="range" min="0" max="30" v-model.number="settings.radii.dropdown" class="interactive-el" @change="save()">
              </div>

              <!-- 5. ТЕНИ И ОБЪЕМ -->
              <div class="settings-group" v-show="activeCategory === 'shadows' || activeCategory === 'all'">
                <h3 class="form-label" style="color:var(--accent);margin-bottom:16px;">4. Тени и объем</h3>
                <div class="control-row"><label>Смещение теней (Y)</label><span class="val-badge">{{ settings.shadows.islandY }}px</span></div>
                <input type="range" min="0" max="50" v-model.number="settings.shadows.islandY" class="interactive-el" @change="save()">
                <div class="control-row"><label>Размытие теней</label><span class="val-badge">{{ settings.shadows.islandBlur }}px</span></div>
                <input type="range" min="0" max="100" v-model.number="settings.shadows.islandBlur" class="interactive-el" @change="save()">
                <div class="control-row"><label>Внутренние тени (Inset)</label><label class="toggle-switch"><input type="checkbox" v-model="settings.shadows.useInset" class="interactive-el" @change="save()"><span class="slider"></span></label></div>
              </div>

              <!-- 6. АНИМАЦИИ -->
              <div class="settings-group" v-show="activeCategory === 'animations' || activeCategory === 'all'">
                <h3 class="form-label" style="color:var(--accent);margin-bottom:16px;">5. Анимации</h3>
                <div class="control-row"><label>Включение анимаций</label><label class="toggle-switch"><input type="checkbox" v-model="settings.animations.enabled" class="interactive-el" @change="save()"><span class="slider"></span></label></div>
                <div class="control-row"><label>Скорость анимаций</label><span class="val-badge">{{ settings.animations.speed }}s</span></div>
                <input type="range" min="0.1" max="1.0" step="0.05" v-model.number="settings.animations.speed" class="interactive-el" :disabled="!settings.animations.enabled" @change="save()">
                <div class="control-row"><label>Анимация появления</label><span class="val-badge">{{ settings.animations.entrance }}s</span></div>
                <input type="range" min="0.1" max="2.0" step="0.1" v-model.number="settings.animations.entrance" class="interactive-el" :disabled="!settings.animations.enabled" @change="save()">
                <div class="control-row"><label>Пульсация активных элементов</label><label class="toggle-switch"><input type="checkbox" v-model="settings.animations.pulse" class="interactive-el" @change="save()"><span class="slider"></span></label></div>
                <div class="control-row"><label>Сила Push (нажатие)</label><span class="val-badge">{{ settings.animations.scalePush }}x</span></div>
                <input type="range" min="0.8" max="1.0" step="0.01" v-model.number="settings.animations.scalePush" class="interactive-el" @change="save()">
                <div class="control-row"><label>Сила Pull (наведение)</label><span class="val-badge">{{ settings.animations.scalePull }}x</span></div>
                <input type="range" min="1.0" max="1.2" step="0.01" v-model.number="settings.animations.scalePull" class="interactive-el" @change="save()">
              </div>

              <!-- 7. ШРИФТЫ -->
              <div class="settings-group" v-show="activeCategory === 'fonts' || activeCategory === 'all'">
                <h3 class="form-label" style="color:var(--accent);margin-bottom:16px;">6. Шрифты</h3>
                <div class="control-row"><label>Семейство шрифтов</label></div>
                <div class="radio-group" style="flex-direction:column;">
                  <div v-for="font in fontOptions" :key="font.val" class="radio-btn" :class="{ active: settings.fonts.family === font.val }" @click="settings.fonts.family = font.val; save()" :style="{ fontFamily: font.val }">{{ font.name }}</div>
                </div>
                <div class="control-row" style="margin-top:12px;"><label>Базовый размер</label><span class="val-badge">{{ settings.fonts.size }}px</span></div>
                <input type="range" min="12" max="24" v-model.number="settings.fonts.size" class="interactive-el" @change="save()">
                <div class="control-row"><label>Межстрочный интервал</label><span class="val-badge">{{ settings.fonts.lineHeight }}</span></div>
                <input type="range" min="1.0" max="2.0" step="0.1" v-model.number="settings.fonts.lineHeight" class="interactive-el" @change="save()">
                <div class="control-row"><label>Межбуквенный интервал</label><span class="val-badge">{{ settings.fonts.letterSpacing }}px</span></div>
                <input type="range" min="-1" max="3" step="0.1" v-model.number="settings.fonts.letterSpacing" class="interactive-el" @change="save()">
              </div>

              <!-- 8. ОТСТУПЫ И ПЛОТНОСТЬ -->
              <div class="settings-group" v-show="activeCategory === 'spacing' || activeCategory === 'all'">
                <h3 class="form-label" style="color:var(--accent);margin-bottom:16px;">7. Отступы и плотность</h3>
                <div class="control-row"><label>Режим плотности</label><span class="val-badge">{{ settings.spacing.density }}x</span></div>
                <input type="range" min="0.5" max="2.0" step="0.1" v-model.number="settings.spacing.density" class="interactive-el" @change="save()">
                <div class="control-row"><label>Ширина сайдбара</label><span class="val-badge">{{ settings.spacing.sidebarWidth }}px</span></div>
                <input type="range" min="200" max="500" step="10" v-model.number="settings.spacing.sidebarWidth" class="interactive-el" @change="save()">
                <div class="control-row"><label>Высота нижней панели</label><span class="val-badge">{{ settings.spacing.panelHeight }}px</span></div>
                <input type="range" min="150" max="500" step="10" v-model.number="settings.spacing.panelHeight" class="interactive-el" @change="save()">
              </div>

              <!-- 9. КОМПОНОВКА -->
              <div class="settings-group" v-show="activeCategory === 'layout' || activeCategory === 'all'">
                <h3 class="form-label" style="color:var(--accent);margin-bottom:16px;">8. Компоновка</h3>
                <div class="control-row"><label>Количество колонок</label></div>
                <div class="radio-group">
                  <div v-for="n in [1,2,3,4]" :key="n" class="radio-btn" :class="{ active: settings.layout.columns === n }" @click="settings.layout.columns = n; save()">{{ n }}</div>
                </div>
                <div class="control-row"><label>Положение сайдбара</label></div>
                <div class="radio-group">
                  <div class="radio-btn" :class="{ active: settings.layout.sidebarPos === 'row' }" @click="settings.layout.sidebarPos = 'row'; save()">Слева</div>
                  <div class="radio-btn" :class="{ active: settings.layout.sidebarPos === 'row-reverse' }" @click="settings.layout.sidebarPos = 'row-reverse'; save()">Справа</div>
                </div>
                <div class="control-row"><label>Режим фокуса</label><label class="toggle-switch"><input type="checkbox" v-model="settings.layout.focusMode" class="interactive-el" @change="save()"><span class="slider"></span></label></div>
              </div>

              <!-- 10. ИНПУТЫ И ФОРМЫ -->
              <div class="settings-group" v-show="activeCategory === 'inputs' || activeCategory === 'all'">
                <h3 class="form-label" style="color:var(--accent);margin-bottom:16px;">9. Инпуты и формы</h3>
                <div class="control-row"><label>Стиль инпутов</label></div>
                <div class="radio-group">
                  <div class="radio-btn" :class="{ active: settings.inputs.style === 'outline' }" @click="settings.inputs.style = 'outline'; save()">С обводкой</div>
                  <div class="radio-btn" :class="{ active: settings.inputs.style === 'filled' }" @click="settings.inputs.style = 'filled'; save()">С подложкой</div>
                </div>
                <div class="control-row" style="margin-top:12px;"><label>Анимация фокуса</label><label class="toggle-switch"><input type="checkbox" v-model="settings.inputs.focusAnim" class="interactive-el" @change="save()"><span class="slider"></span></label></div>
              </div>

              <!-- 11. КНОПКИ -->
              <div class="settings-group" v-show="activeCategory === 'buttons' || activeCategory === 'all'">
                <h3 class="form-label" style="color:var(--accent);margin-bottom:16px;">10. Кнопки</h3>
                <div class="control-row"><label>Эффект при наведении</label><label class="toggle-switch"><input type="checkbox" v-model="settings.buttons.hoverScale" class="interactive-el" @change="save()"><span class="slider"></span></label></div>
                <div class="control-row"><label>Эффект при нажатии</label><label class="toggle-switch"><input type="checkbox" v-model="settings.buttons.clickPress" class="interactive-el" @change="save()"><span class="slider"></span></label></div>
              </div>

              <!-- 12. ВКЛАДКИ -->
              <div class="settings-group" v-show="activeCategory === 'tabs' || activeCategory === 'all'">
                <h3 class="form-label" style="color:var(--accent);margin-bottom:16px;">11. Вкладки</h3>
                <div class="control-row"><label>Позиция вкладок</label></div>
                <div class="radio-group">
                  <div class="radio-btn" :class="{ active: settings.tabs.pos === 'row' }" @click="settings.tabs.pos = 'row'; save()">Сверху</div>
                  <div class="radio-btn" :class="{ active: settings.tabs.pos === 'column' }" @click="settings.tabs.pos = 'column'; save()">Слева</div>
                </div>
              </div>

              <!-- 13. ВЫПАДАЮЩИЕ СПИСКИ -->
              <div class="settings-group" v-show="activeCategory === 'dropdowns' || activeCategory === 'all'">
                <h3 class="form-label" style="color:var(--accent);margin-bottom:16px;">12. Выпадающие списки</h3>
                <div class="control-row"><label>3D-эффект колеса</label><label class="toggle-switch"><input type="checkbox" v-model="settings.dropdowns.use3DWheel" class="interactive-el" @change="save()"><span class="slider"></span></label></div>
                <div class="control-row" v-if="settings.dropdowns.use3DWheel" style="margin-top:12px;"><label>Ориентация колеса</label></div>
                <div class="radio-group" v-if="settings.dropdowns.use3DWheel">
                  <div class="radio-btn" :class="{ active: settings.dropdowns.wheelOrientation === 'vertical' || !settings.dropdowns.wheelOrientation }" @click="settings.dropdowns.wheelOrientation = 'vertical'; save()">Вертикальная</div>
                  <div class="radio-btn" :class="{ active: settings.dropdowns.wheelOrientation === 'horizontal' }" @click="settings.dropdowns.wheelOrientation = 'horizontal'; save()">Горизонтальная</div>
                </div>
              </div>

              <!-- 14. КАРТОЧКИ И СПИСКИ -->
              <div class="settings-group" v-show="activeCategory === 'cards' || activeCategory === 'all'">
                <h3 class="form-label" style="color:var(--accent);margin-bottom:16px;">13. Карточки и списки</h3>
                <div class="control-row"><label>Компактный режим списка</label><label class="toggle-switch"><input type="checkbox" v-model="settings.cards.compactList" class="interactive-el" @change="save()"><span class="slider"></span></label></div>
                <div class="control-row"><label>Показ иконок</label><label class="toggle-switch"><input type="checkbox" v-model="settings.cards.showIcons" class="interactive-el" @change="save()"><span class="slider"></span></label></div>
              </div>

              <!-- 15. РЕДАКТОР ТЕКСТА -->
              <div class="settings-group" v-show="activeCategory === 'editor' || activeCategory === 'all'">
                <h3 class="form-label" style="color:var(--accent);margin-bottom:16px;">14. Редактор текста</h3>
                <div class="control-row"><label>Показ счётчика слов</label><label class="toggle-switch"><input type="checkbox" v-model="settings.editor.showWordCount" class="interactive-el" @change="save()"><span class="slider"></span></label></div>
              </div>

              <!-- 16. УВЕДОМЛЕНИЯ -->
              <div class="settings-group" v-show="activeCategory === 'notifications' || activeCategory === 'all'">
                <h3 class="form-label" style="color:var(--accent);margin-bottom:16px;">15. Уведомления</h3>
                <div class="control-row"><label>Длительность показа</label><span class="val-badge">{{ settings.notifications.duration }}ms</span></div>
                <input type="range" min="1000" max="10000" step="500" v-model.number="settings.notifications.duration" class="interactive-el" @change="save()">
                
                <div class="control-row" style="margin-top:12px;"><label>Позиция уведомлений</label></div>
                <div class="radio-group" style="flex-wrap: wrap; gap: 8px;">
                  <div class="radio-btn" :class="{ active: settings.notifications.position === 'top-left' }" @click="settings.notifications.position = 'top-left'; save()">Слева сверху</div>
                  <div class="radio-btn" :class="{ active: settings.notifications.position === 'top-right' }" @click="settings.notifications.position = 'top-right'; save()">Справа сверху</div>
                  <div class="radio-btn" :class="{ active: settings.notifications.position === 'bottom-left' }" @click="settings.notifications.position = 'bottom-left'; save()">Слева снизу</div>
                  <div class="radio-btn" :class="{ active: settings.notifications.position === 'bottom-right' }" @click="settings.notifications.position = 'bottom-right'; save()">Справа снизу</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import ThemeSwitcher from './ThemeSwitcher.vue';
import { settingsService } from '../../services/settings.service';
import type { AppSettings } from '../../types/settings';

const activeCategory = ref('theme');
const settings = ref<AppSettings>(settingsService.getSettings());

const categories = [
  { id: 'theme', icon: '🎨', title: 'Тема оформления' },
  { id: 'all', icon: '📋', title: 'Все настройки' },
  { id: 'colors', icon: '🎨', title: '1. Цветовая схема' },
  { id: 'glass', icon: '🪟', title: '2. Прозрачность и стекло' },
  { id: 'radii', icon: '⭕', title: '3. Скругления' },
  { id: 'shadows', icon: '🌑', title: '4. Тени и объем' },
  { id: 'animations', icon: '🎬', title: '5. Анимации' },
  { id: 'fonts', icon: '🔤', title: '6. Шрифты' },
  { id: 'spacing', icon: '📏', title: '7. Отступы и плотность' },
  { id: 'layout', icon: '📐', title: '8. Компоновка' },
  { id: 'inputs', icon: '📝', title: '9. Инпуты и формы' },
  { id: 'buttons', icon: '🔘', title: '10. Кнопки' },
  { id: 'tabs', icon: '📑', title: '11. Вкладки' },
  { id: 'dropdowns', icon: '📋', title: '12. Выпадающие списки' },
  { id: 'cards', icon: '🃏', title: '13. Карточки и списки' },
  { id: 'editor', icon: '✏️', title: '14. Редактор текста' },
  { id: 'notifications', icon: '🔔', title: '15. Уведомления' }
];

const fontOptions = [
  { val: 'Inter', name: 'Inter (По умолчанию)' },
  { val: 'Roboto', name: 'Roboto' },
  { val: 'SF Pro Display', name: 'SF Pro Display' },
  { val: 'Segoe UI', name: 'Segoe UI' },
  { val: 'Fira Code', name: 'Fira Code (Monospace)' }
];

const toHex = (color: string): string => {
  if (!color) return '#000000';
  if (color.startsWith('#')) return color;
  const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (match) {
    const r = parseInt(match[1]).toString(16).padStart(2, '0');
    const g = parseInt(match[2]).toString(16).padStart(2, '0');
    const b = parseInt(match[3]).toString(16).padStart(2, '0');
    return `#${r}${g}${b}`;
  }
  return '#000000';
};

const updateColorAlpha = (key: keyof AppSettings['colors'], newHex: string) => {
  const oldVal = settings.value.colors[key] || '';
  if (oldVal.startsWith('rgba')) {
    const alphaMatch = oldVal.match(/,\s*([\d.]+)\)/);
    if (alphaMatch) {
      const alpha = alphaMatch[1];
      const r = parseInt(newHex.slice(1,3), 16);
      const g = parseInt(newHex.slice(3,5), 16);
      const b = parseInt(newHex.slice(5,7), 16);
      settings.value.colors[key] = `rgba(${r}, ${g}, ${b}, ${alpha})`;
      save();
      return;
    }
  }
  (settings.value.colors as any)[key] = newHex;
  save();
};

const getCategoryTitle = (id: string): string => {
  const cat = categories.find(c => c.id === id);
  return cat ? cat.title : '';
};

const save = async () => {
  try {
    await settingsService.saveSettings(settings.value);
  } catch (e) {
    console.error('Failed to save settings:', e);
  }
};

const resetSettings = () => {
  if (confirm('Сбросить все настройки на стандартные?')) {
    settingsService.resetSettings();
    settings.value = settingsService.getSettings();
  }
};

onMounted(async () => {
  await settingsService.loadSettings();
  settings.value = settingsService.getSettings();
  
  settingsService.onChange((newSettings) => {
    settings.value = newSettings;
  });
});
</script>

<style scoped>
@import '../../../css/modules/settings.css';
</style>
