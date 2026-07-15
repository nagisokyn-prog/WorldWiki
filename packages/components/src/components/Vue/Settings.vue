<template>
  <div class="settings-modal-content" style="width:100%;height:100%;overflow:hidden;display:flex;flex-direction:column;">
    <div class="settings-layout" style="height:100%;width:100%;flex:1 1 auto;">
      <!-- Сайдбар с категориями -->
      <div class="settings-sidebar">
        <div style="font-size:11px;text-transform:uppercase;color:var(--text-muted);margin-bottom:12px;font-weight:bold;letter-spacing:1px;">{{ t('settings.categories.title') }}</div>
        <div v-for="cat in categories" :key="cat.id" class="settings-nav-item" :class="{ active: activeCategory === cat.id }" @click="activeCategory = cat.id">
          <span>{{ cat.icon }}</span> {{ t(cat.titleKey) }}
        </div>
      </div>

      <!-- Контент настроек -->
      <div class="settings-content-area">
        <div class="glass-card-container" style="width:100%;min-width:0;height:100%;display:flex;flex-direction:column;overflow-y:auto;flex:1 1 auto;">
          <div class="glass-card-bg" style="border-color:var(--accent);"></div>
          <div class="glass-card-content" style="width:100%;flex:1;overflow-y:auto;min-height:0;display:flex;flex-direction:column;">
            <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--border-color);padding-bottom:12px;margin-bottom:24px;">
              <h2 class="card-title" style="border:none;margin:0;padding:0;">⚙️ {{ t('settings.title') }}</h2>
            </div>

            <p style="color:var(--text-muted);margin-bottom:24px;font-size:13px;">{{ t('settings.description', { category: getCategoryTitle(activeCategory) }) }}</p>

            <div class="settings-grid">
              <!-- 1. ТЕМА ОФОРМЛЕНИЯ -->
              <div class="settings-group" v-show="activeCategory === 'theme' || activeCategory === 'all'">
                <h3 class="form-label" style="color:var(--accent);margin-bottom:16px;">{{ t('settings.groupTitles.theme') }}</h3>
                <ThemeSwitcher />
              </div>

              <!-- 2. ЦВЕТОВАЯ СХЕМА -->
              <div class="settings-group" v-show="activeCategory === 'colors' || activeCategory === 'all'">
                <h3 class="form-label" style="color:var(--accent);margin-bottom:16px;">{{ t('settings.groupTitles.colors') }}</h3>
                <div class="color-control"><span class="color-label">{{ t('settings.fields.bgBase') }}</span><div style="display:flex;gap:12px;width:100%;"><input type="color" :value="toHex(settings.colors.bgBase)" @input="e => updateColorAlpha('bgBase', (e.target as HTMLInputElement).value)" class="interactive-el color-picker-input"><input type="text" v-model="settings.colors.bgBase" @input="save()" class="interactive-el color-text-input"></div></div>
                <div class="color-control"><span class="color-label">{{ t('settings.fields.bgSecondary') }}</span><div style="display:flex;gap:12px;width:100%;"><input type="color" :value="toHex(settings.colors.bgSecondary)" @input="e => updateColorAlpha('bgSecondary', (e.target as HTMLInputElement).value)" class="interactive-el color-picker-input"><input type="text" v-model="settings.colors.bgSecondary" @input="save()" class="interactive-el color-text-input"></div></div>
                <div class="color-control"><span class="color-label">{{ t('settings.fields.bgPanel') }}</span><div style="display:flex;gap:12px;width:100%;"><input type="color" :value="toHex(settings.colors.bgPanel)" @input="e => updateColorAlpha('bgPanel', (e.target as HTMLInputElement).value)" class="interactive-el color-picker-input"><input type="text" v-model="settings.colors.bgPanel" @input="save()" class="interactive-el color-text-input"></div></div>
                <div class="color-control"><span class="color-label">{{ t('settings.fields.bgInput') }}</span><div style="display:flex;gap:12px;width:100%;"><input type="color" :value="toHex(settings.colors.bgInput)" @input="e => updateColorAlpha('bgInput', (e.target as HTMLInputElement).value)" class="interactive-el color-picker-input"><input type="text" v-model="settings.colors.bgInput" @input="save()" class="interactive-el color-text-input"></div></div>
                <div class="color-control"><span class="color-label">{{ t('settings.fields.textMain') }}</span><div style="display:flex;gap:12px;width:100%;"><input type="color" :value="toHex(settings.colors.textMain)" @input="e => updateColorAlpha('textMain', (e.target as HTMLInputElement).value)" class="interactive-el color-picker-input"><input type="text" v-model="settings.colors.textMain" @input="save()" class="interactive-el color-text-input"></div></div>
                <div class="color-control"><span class="color-label">{{ t('settings.fields.textMuted') }}</span><div style="display:flex;gap:12px;width:100%;"><input type="color" :value="toHex(settings.colors.textMuted)" @input="e => updateColorAlpha('textMuted', (e.target as HTMLInputElement).value)" class="interactive-el color-picker-input"><input type="text" v-model="settings.colors.textMuted" @input="save()" class="interactive-el color-text-input"></div></div>
                <div class="color-control"><span class="color-label">{{ t('settings.fields.accent') }}</span><div style="display:flex;gap:12px;width:100%;"><input type="color" :value="toHex(settings.colors.accent)" @input="e => updateColorAlpha('accent', (e.target as HTMLInputElement).value)" class="interactive-el color-picker-input"><input type="text" v-model="settings.colors.accent" @input="save()" class="interactive-el color-text-input"></div></div>
                <div class="color-control"><span class="color-label">{{ t('settings.fields.accentHover') }}</span><div style="display:flex;gap:12px;width:100%;"><input type="color" :value="toHex(settings.colors.accentHover)" @input="e => updateColorAlpha('accentHover', (e.target as HTMLInputElement).value)" class="interactive-el color-picker-input"><input type="text" v-model="settings.colors.accentHover" @input="save()" class="interactive-el color-text-input"></div></div>
                <div class="color-control"><span class="color-label">{{ t('settings.fields.accentText') }}</span><div style="display:flex;gap:12px;width:100%;"><input type="color" :value="toHex(settings.colors.accentText)" @input="e => updateColorAlpha('accentText', (e.target as HTMLInputElement).value)" class="interactive-el color-picker-input"><input type="text" v-model="settings.colors.accentText" @input="save()" class="interactive-el color-text-input"></div></div>
                <div class="color-control"><span class="color-label">{{ t('settings.fields.borderColor') }}</span><div style="display:flex;gap:12px;width:100%;"><input type="color" :value="toHex(settings.colors.borderColor)" @input="e => updateColorAlpha('borderColor', (e.target as HTMLInputElement).value)" class="interactive-el color-picker-input"><input type="text" v-model="settings.colors.borderColor" @input="save()" class="interactive-el color-text-input"></div></div>
                <div class="color-control"><span class="color-label">{{ t('settings.fields.shadowColor') }}</span><div style="display:flex;gap:12px;width:100%;"><input type="color" :value="toHex(settings.colors.shadowColor)" @input="e => updateColorAlpha('shadowColor', (e.target as HTMLInputElement).value)" class="interactive-el color-picker-input"><input type="text" v-model="settings.colors.shadowColor" @input="save()" class="interactive-el color-text-input"></div></div>
              </div>

              <!-- 3. ПРОЗРАЧНОСТЬ И СТЕКЛО -->
              <div class="settings-group" v-show="activeCategory === 'glass' || activeCategory === 'all'">
                <h3 class="form-label" style="color:var(--accent);margin-bottom:16px;">{{ t('settings.groupTitles.glass') }}</h3>
                <div class="control-row"><label>{{ t('settings.fields.islandAlpha') }}</label><span class="val-badge">{{ Math.round(settings.glass.islandAlpha * 100) }}%</span></div>
                <input type="range" min="0" max="1" step="0.05" v-model.number="settings.glass.islandAlpha" class="interactive-el" @change="save()">
                <div class="control-row"><label>{{ t('settings.fields.cardAlpha') }}</label><span class="val-badge">{{ Math.round(settings.glass.cardAlpha * 100) }}%</span></div>
                <input type="range" min="0" max="0.5" step="0.01" v-model.number="settings.glass.cardAlpha" class="interactive-el" @change="save()">
                <div class="control-row"><label>{{ t('settings.fields.blur') }}</label><span class="val-badge">{{ settings.glass.blur }}px</span></div>
                <input type="range" min="0" max="100" v-model.number="settings.glass.blur" class="interactive-el" @change="save()">
                <div class="control-row"><label>{{ t('settings.fields.borderAlpha') }}</label><span class="val-badge">{{ Math.round(settings.glass.borderAlpha * 100) }}%</span></div>
                <input type="range" min="0" max="1" step="0.05" v-model.number="settings.glass.borderAlpha" class="interactive-el" @change="save()">
              </div>

              <!-- 4. СКРУГЛЕНИЯ -->
              <div class="settings-group" v-show="activeCategory === 'radii' || activeCategory === 'all'">
                <h3 class="form-label" style="color:var(--accent);margin-bottom:16px;">{{ t('settings.groupTitles.radii') }}</h3>
                <div class="control-row"><label>{{ t('settings.fields.islandRadius') }}</label><span class="val-badge">{{ settings.radii.island }}px</span></div>
                <input type="range" min="0" max="60" v-model.number="settings.radii.island" class="interactive-el" @change="save()">
                <div class="control-row"><label>{{ t('settings.fields.cardRadius') }}</label><span class="val-badge">{{ settings.radii.card }}px</span></div>
                <input type="range" min="0" max="40" v-model.number="settings.radii.card" class="interactive-el" @change="save()">
                <div class="control-row"><label>{{ t('settings.fields.btnRadius') }}</label><span class="val-badge">{{ settings.radii.btn }}px</span></div>
                <input type="range" min="0" max="40" v-model.number="settings.radii.btn" class="interactive-el" @change="save()">
                <div class="control-row"><label>{{ t('settings.fields.inputRadius') }}</label><span class="val-badge">{{ settings.radii.input }}px</span></div>
                <input type="range" min="0" max="30" v-model.number="settings.radii.input" class="interactive-el" @change="save()">
                <div class="control-row"><label>{{ t('settings.fields.dropdownRadius') }}</label><span class="val-badge">{{ settings.radii.dropdown }}px</span></div>
                <input type="range" min="0" max="30" v-model.number="settings.radii.dropdown" class="interactive-el" @change="save()">
              </div>

              <!-- 5. ТЕНИ И ОБЪЕМ -->
              <div class="settings-group" v-show="activeCategory === 'shadows' || activeCategory === 'all'">
                <h3 class="form-label" style="color:var(--accent);margin-bottom:16px;">{{ t('settings.groupTitles.shadows') }}</h3>
                <div class="control-row"><label>{{ t('settings.fields.shadowOffsetY') }}</label><span class="val-badge">{{ settings.shadows.islandY }}px</span></div>
                <input type="range" min="0" max="50" v-model.number="settings.shadows.islandY" class="interactive-el" @change="save()">
                <div class="control-row"><label>{{ t('settings.fields.shadowBlur') }}</label><span class="val-badge">{{ settings.shadows.islandBlur }}px</span></div>
                <input type="range" min="0" max="100" v-model.number="settings.shadows.islandBlur" class="interactive-el" @change="save()">
                <div class="control-row"><label>{{ t('settings.fields.shadowInset') }}</label><label class="toggle-switch"><input type="checkbox" v-model="settings.shadows.useInset" class="interactive-el" @change="save()"><span class="slider"></span></label></div>
              </div>

              <!-- 6. АНИМАЦИИ -->
              <div class="settings-group" v-show="activeCategory === 'animations' || activeCategory === 'all'">
                <h3 class="form-label" style="color:var(--accent);margin-bottom:16px;">{{ t('settings.groupTitles.animations') }}</h3>
                <div class="control-row"><label>{{ t('settings.fields.animationsEnabled') }}</label><label class="toggle-switch"><input type="checkbox" v-model="settings.animations.enabled" class="interactive-el" @change="save()"><span class="slider"></span></label></div>
                <div class="control-row"><label>{{ t('settings.fields.animationSpeed') }}</label><span class="val-badge">{{ settings.animations.speed }}s</span></div>
                <input type="range" min="0.1" max="1.0" step="0.05" v-model.number="settings.animations.speed" class="interactive-el" :disabled="!settings.animations.enabled" @change="save()">
                <div class="control-row"><label>{{ t('settings.fields.entrance') }}</label><span class="val-badge">{{ settings.animations.entrance }}s</span></div>
                <input type="range" min="0.1" max="2.0" step="0.1" v-model.number="settings.animations.entrance" class="interactive-el" :disabled="!settings.animations.enabled" @change="save()">
                <div class="control-row"><label>{{ t('settings.fields.pulse') }}</label><label class="toggle-switch"><input type="checkbox" v-model="settings.animations.pulse" class="interactive-el" @change="save()"><span class="slider"></span></label></div>
                <div class="control-row"><label>{{ t('settings.fields.scalePush') }}</label><span class="val-badge">{{ settings.animations.scalePush }}x</span></div>
                <input type="range" min="0.8" max="1.0" step="0.01" v-model.number="settings.animations.scalePush" class="interactive-el" @change="save()">
                <div class="control-row"><label>{{ t('settings.fields.scalePull') }}</label><span class="val-badge">{{ settings.animations.scalePull }}x</span></div>
                <input type="range" min="1.0" max="1.2" step="0.01" v-model.number="settings.animations.scalePull" class="interactive-el" @change="save()">
              </div>

              <!-- 7. ШРИФТЫ -->
              <div class="settings-group" v-show="activeCategory === 'fonts' || activeCategory === 'all'">
                <h3 class="form-label" style="color:var(--accent);margin-bottom:16px;">{{ t('settings.groupTitles.fonts') }}</h3>
                <div class="control-row"><label>{{ t('settings.fields.fontFamily') }}</label></div>
                <div class="radio-group" style="flex-direction:column;">
                  <div v-for="font in fontOptions" :key="font.val" class="radio-btn" :class="{ active: settings.fonts.family === font.val }" @click="settings.fonts.family = font.val; save()" :style="{ fontFamily: font.val }">{{ t(font.titleKey) }}</div>
                </div>
                <div class="control-row" style="margin-top:12px;"><label>{{ t('settings.fields.fontSize') }}</label><span class="val-badge">{{ settings.fonts.size }}px</span></div>
                <input type="range" min="12" max="24" v-model.number="settings.fonts.size" class="interactive-el" @change="save()">
                <div class="control-row"><label>{{ t('settings.fields.fontLineHeight') }}</label><span class="val-badge">{{ settings.fonts.lineHeight }}</span></div>
                <input type="range" min="1.0" max="2.0" step="0.1" v-model.number="settings.fonts.lineHeight" class="interactive-el" @change="save()">
                <div class="control-row"><label>{{ t('settings.fields.fontLetterSpacing') }}</label><span class="val-badge">{{ settings.fonts.letterSpacing }}px</span></div>
                <input type="range" min="-1" max="3" step="0.1" v-model.number="settings.fonts.letterSpacing" class="interactive-el" @change="save()">
              </div>

              <!-- 8. ОТСТУПЫ И ПЛОТНОСТЬ -->
              <div class="settings-group" v-show="activeCategory === 'spacing' || activeCategory === 'all'">
                <h3 class="form-label" style="color:var(--accent);margin-bottom:16px;">{{ t('settings.groupTitles.spacing') }}</h3>
                <div class="control-row"><label>{{ t('settings.fields.density') }}</label><span class="val-badge">{{ settings.spacing.density }}x</span></div>
                <input type="range" min="0.5" max="2.0" step="0.1" v-model.number="settings.spacing.density" class="interactive-el" @change="save()">
                <div class="control-row"><label>{{ t('settings.fields.sidebarWidth') }}</label><span class="val-badge">{{ settings.spacing.sidebarWidth }}px</span></div>
                <input type="range" min="200" max="500" step="10" v-model.number="settings.spacing.sidebarWidth" class="interactive-el" @change="save()">
                <div class="control-row"><label>{{ t('settings.fields.panelHeight') }}</label><span class="val-badge">{{ settings.spacing.panelHeight }}px</span></div>
                <input type="range" min="150" max="500" step="10" v-model.number="settings.spacing.panelHeight" class="interactive-el" @change="save()">
              </div>

              <!-- 9. КОМПОНОВКА -->
              <div class="settings-group" v-show="activeCategory === 'layout' || activeCategory === 'all'">
                <h3 class="form-label" style="color:var(--accent);margin-bottom:16px;">{{ t('settings.groupTitles.layout') }}</h3>
                <div class="control-row"><label>{{ t('settings.fields.columns') }}</label></div>
                <div class="radio-group">
                  <div v-for="n in [1,2,3,4]" :key="n" class="radio-btn" :class="{ active: settings.layout.columns === n }" @click="settings.layout.columns = n; save()">{{ n }}</div>
                </div>
                <div class="control-row"><label>{{ t('settings.fields.sidebarPosition') }}</label></div>
                <div class="radio-group">
                  <div class="radio-btn" :class="{ active: settings.layout.sidebarPos === 'row' }" @click="settings.layout.sidebarPos = 'row'; save()">{{ t('settings.fields.left') }}</div>
                  <div class="radio-btn" :class="{ active: settings.layout.sidebarPos === 'row-reverse' }" @click="settings.layout.sidebarPos = 'row-reverse'; save()">{{ t('settings.fields.right') }}</div>
                </div>
                <div class="control-row"><label>{{ t('settings.fields.focusMode') }}</label><label class="toggle-switch"><input type="checkbox" v-model="settings.layout.focusMode" class="interactive-el" @change="save()"><span class="slider"></span></label></div>
              </div>

              <!-- 10. ИНПУТЫ И ФОРМЫ -->
              <div class="settings-group" v-show="activeCategory === 'inputs' || activeCategory === 'all'">
                <h3 class="form-label" style="color:var(--accent);margin-bottom:16px;">{{ t('settings.groupTitles.inputs') }}</h3>
                <div class="control-row"><label>{{ t('settings.fields.inputStyle') }}</label></div>
                <div class="radio-group">
                  <div class="radio-btn" :class="{ active: settings.inputs.style === 'outline' }" @click="settings.inputs.style = 'outline'; save()">{{ t('settings.fields.withOutline') }}</div>
                  <div class="radio-btn" :class="{ active: settings.inputs.style === 'filled' }" @click="settings.inputs.style = 'filled'; save()">{{ t('settings.fields.withBackground') }}</div>
                </div>
                <div class="control-row" style="margin-top:12px;"><label>{{ t('settings.fields.inputFocusAnimation') }}</label><label class="toggle-switch"><input type="checkbox" v-model="settings.inputs.focusAnim" class="interactive-el" @change="save()"><span class="slider"></span></label></div>
              </div>

              <!-- 11. КНОПКИ -->
              <div class="settings-group" v-show="activeCategory === 'buttons' || activeCategory === 'all'">
                <h3 class="form-label" style="color:var(--accent);margin-bottom:16px;">{{ t('settings.groupTitles.buttons') }}</h3>
                <div class="control-row"><label>{{ t('settings.fields.hoverEffect') }}</label><label class="toggle-switch"><input type="checkbox" v-model="settings.buttons.hoverScale" class="interactive-el" @change="save()"><span class="slider"></span></label></div>
                <div class="control-row"><label>{{ t('settings.fields.clickEffect') }}</label><label class="toggle-switch"><input type="checkbox" v-model="settings.buttons.clickPress" class="interactive-el" @change="save()"><span class="slider"></span></label></div>
              </div>

              <!-- 12. ВКЛАДКИ -->
              <div class="settings-group" v-show="activeCategory === 'tabs' || activeCategory === 'all'">
                <h3 class="form-label" style="color:var(--accent);margin-bottom:16px;">{{ t('settings.groupTitles.tabs') }}</h3>
                <div class="control-row"><label>{{ t('settings.fields.tabsPosition') }}</label></div>
                <div class="radio-group">
                  <div class="radio-btn" :class="{ active: settings.tabs.pos === 'row' }" @click="settings.tabs.pos = 'row'; save()">{{ t('settings.fields.top') }}</div>
                  <div class="radio-btn" :class="{ active: settings.tabs.pos === 'column' }" @click="settings.tabs.pos = 'column'; save()">{{ t('settings.fields.left') }}</div>
                </div>
              </div>

              <!-- 13. ВЫПАДАЮЩИЕ СПИСКИ -->
              <div class="settings-group" v-show="activeCategory === 'dropdowns' || activeCategory === 'all'">
                <h3 class="form-label" style="color:var(--accent);margin-bottom:16px;">{{ t('settings.groupTitles.dropdowns') }}</h3>
                <div class="control-row"><label>{{ t('settings.fields.wheel3DEffect') }}</label><label class="toggle-switch"><input type="checkbox" v-model="settings.dropdowns.use3DWheel" class="interactive-el" @change="save()"><span class="slider"></span></label></div>
                <div class="control-row" v-if="settings.dropdowns.use3DWheel" style="margin-top:12px;"><label>{{ t('settings.fields.wheelOrientation') }}</label></div>
                <div class="radio-group" v-if="settings.dropdowns.use3DWheel">
                  <div class="radio-btn" :class="{ active: settings.dropdowns.wheelOrientation === 'vertical' || !settings.dropdowns.wheelOrientation }" @click="settings.dropdowns.wheelOrientation = 'vertical'; save()">{{ t('settings.fields.vertical') }}</div>
                  <div class="radio-btn" :class="{ active: settings.dropdowns.wheelOrientation === 'horizontal' }" @click="settings.dropdowns.wheelOrientation = 'horizontal'; save()">{{ t('settings.fields.horizontal') }}</div>
                </div>
              </div>

              <!-- 14. КАРТОЧКИ И СПИСКИ -->
              <div class="settings-group" v-show="activeCategory === 'cards' || activeCategory === 'all'">
                <h3 class="form-label" style="color:var(--accent);margin-bottom:16px;">{{ t('settings.groupTitles.cards') }}</h3>
                <div class="control-row"><label>{{ t('settings.fields.compactList') }}</label><label class="toggle-switch"><input type="checkbox" v-model="settings.cards.compactList" class="interactive-el" @change="save()"><span class="slider"></span></label></div>
                <div class="control-row"><label>{{ t('settings.fields.showIcons') }}</label><label class="toggle-switch"><input type="checkbox" v-model="settings.cards.showIcons" class="interactive-el" @change="save()"><span class="slider"></span></label></div>
              </div>


              <!-- 16. УВЕДОМЛЕНИЯ -->
              <div class="settings-group" v-show="activeCategory === 'notifications' || activeCategory === 'all'">
                <h3 class="form-label" style="color:var(--accent);margin-bottom:16px;">{{ t('settings.groupTitles.notifications') }}</h3>
                <div class="control-row"><label>{{ t('settings.fields.notificationDuration') }}</label><span class="val-badge">{{ settings.notifications.duration }}ms</span></div>
                <input type="range" min="1000" max="10000" step="500" v-model.number="settings.notifications.duration" class="interactive-el" @change="save()">
                
                <div class="control-row" style="margin-top:12px;"><label>{{ t('settings.fields.notificationPosition') }}</label></div>
                <div class="radio-group" style="flex-wrap: wrap; gap: 8px;">
                  <div class="radio-btn" :class="{ active: settings.notifications.position === 'top-left' }" @click="settings.notifications.position = 'top-left'; save()">{{ t('settings.fields.topLeft') }}</div>
                  <div class="radio-btn" :class="{ active: settings.notifications.position === 'top-right' }" @click="settings.notifications.position = 'top-right'; save()">{{ t('settings.fields.topRight') }}</div>
                  <div class="radio-btn" :class="{ active: settings.notifications.position === 'bottom-left' }" @click="settings.notifications.position = 'bottom-left'; save()">{{ t('settings.fields.bottomLeft') }}</div>
                  <div class="radio-btn" :class="{ active: settings.notifications.position === 'bottom-right' }" @click="settings.notifications.position = 'bottom-right'; save()">{{ t('settings.fields.bottomRight') }}</div>
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
import { useI18n } from 'vue-i18n';
import ThemeSwitcher from './ThemeSwitcher.vue';
import { settingsService } from '../../ts/services/settings.service.js';
import { setLocale } from '../../ts/i18n.js';
import type { AppSettings } from '../../ts/types/settings.js';

defineEmits(['close', 'back']);

const { t } = useI18n();
const activeCategory = ref('theme');
const settings = ref<AppSettings>(settingsService.getSettings());

const categories = [
  { id: 'theme', icon: '🎨', titleKey: 'settings.categories.theme' },
  { id: 'all', icon: '📋', titleKey: 'settings.categories.all' },
  { id: 'colors', icon: '🎨', titleKey: 'settings.categories.colors' },
  { id: 'glass', icon: '🪟', titleKey: 'settings.categories.glass' },
  { id: 'radii', icon: '⭕', titleKey: 'settings.categories.radii' },
  { id: 'shadows', icon: '🌑', titleKey: 'settings.categories.shadows' },
  { id: 'animations', icon: '🎬', titleKey: 'settings.categories.animations' },
  { id: 'fonts', icon: '🔤', titleKey: 'settings.categories.fonts' },
  { id: 'spacing', icon: '📏', titleKey: 'settings.categories.spacing' },
  { id: 'layout', icon: '📐', titleKey: 'settings.categories.layout' },
  { id: 'inputs', icon: '📝', titleKey: 'settings.categories.inputs' },
  { id: 'buttons', icon: '🔘', titleKey: 'settings.categories.buttons' },
  { id: 'tabs', icon: '📑', titleKey: 'settings.categories.tabs' },
  { id: 'dropdowns', icon: '📋', titleKey: 'settings.categories.dropdowns' },
  { id: 'cards', icon: '🃏', titleKey: 'settings.categories.cards' },
  { id: 'notifications', icon: '🔔', titleKey: 'settings.categories.notifications' }
];

const fontOptions = [
  { val: 'Inter', titleKey: 'settings.fonts.interDefault' },
  { val: 'Roboto', titleKey: 'settings.fonts.roboto' },
  { val: 'SF Pro Display', titleKey: 'settings.fonts.sfPro' },
  { val: 'Segoe UI', titleKey: 'settings.fonts.segoe' },
  { val: 'Fira Code', titleKey: 'settings.fonts.firaCode' }
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
  return cat ? t(cat.titleKey) : '';
};

const changeLocale = async (lang: 'ru' | 'en') => {
  settings.value.locale = lang;
  setLocale(lang);
  try {
    await settingsService.saveSettings(settings.value, true);
  } catch (e) {
    console.error('Failed to save locale setting:', e);
  }
};

const save = async () => {
  try {
    await settingsService.saveSettings(settings.value);
  } catch (e) {
    console.error('Failed to save settings:', e);
  }
};

const resetSettings = () => {
  if (confirm(t('settings.confirmReset'))) {
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
@import '../../../../../src/css/modules/settings.css';
</style>
