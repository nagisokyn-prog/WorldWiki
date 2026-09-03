<template>
  <div class="settings-scene">
    <div class="scene-header">
      <h2>◇ {{ t('settings.scenes.interface.title') }}</h2>
      <p class="scene-desc">{{ t('settings.scenes.interface.desc') }}</p>
    </div>

    <SettingsLivePreview :settings="settings" />

    <div v-auto-animate class="settings-grid">
      <!-- КОМПОНОВКА (Layout) -->
      <div class="settings-group">
        <h3 class="form-label settings-group-title">{{ t('settings.groupTitles.layout', 'Компоновка') }}</h3>
        
        <div class="control-row"><label>{{ t('settings.fields.columns', 'Колонки по умолчанию') }}</label></div>
        <div class="radio-group">
          <div v-for="n in [1,2,3,4]" :key="n" class="radio-btn" :class="{ active: settings.layout.columns === n }" @click="settings.layout.columns = n; save()">{{ n }}</div>
        </div>
        
        <div class="control-row mt-3"><label>{{ t('settings.fields.sidebarPosition', 'Позиция боковой панели') }}</label></div>
        <div class="radio-group">
          <div class="radio-btn" :class="{ active: settings.layout.sidebarPos === 'row' }" @click="settings.layout.sidebarPos = 'row'; save()">{{ t('settings.fields.left', 'Слева') }}</div>
          <div class="radio-btn" :class="{ active: settings.layout.sidebarPos === 'row-reverse' }" @click="settings.layout.sidebarPos = 'row-reverse'; save()">{{ t('settings.fields.right', 'Справа') }}</div>
        </div>
        
        <div class="control-row mt-3">
          <label>{{ t('settings.fields.focusMode', 'Режим фокусировки') }}</label>
          <label class="toggle-switch"><input v-model="settings.layout.focusMode" type="checkbox" class="interactive-el" @change="save()"><span class="slider"></span></label>
        </div>
      </div>

      <!-- ОТСТУПЫ И РАЗМЕРЫ (Spacing) -->
      <div class="settings-group">
        <h3 class="form-label settings-group-title">{{ t('settings.groupTitles.spacing', 'Отступы и размеры') }}</h3>
        
        <div class="control-row"><label>{{ t('settings.fields.density', 'Плотность интерфейса') }}</label><span class="val-badge">{{ settings.spacing.density }}x</span></div>
        <input v-model.number="settings.spacing.density" type="range" min="0.5" max="2.0" step="0.1" class="interactive-el" @input="save()">
        
        <div class="control-row"><label>{{ t('settings.fields.sidebarWidth', 'Ширина сайдбара') }}</label><span class="val-badge">{{ settings.spacing.sidebarWidth }}px</span></div>
        <input v-model.number="settings.spacing.sidebarWidth" type="range" min="200" max="500" step="10" class="interactive-el" @input="save()">
        
        <div class="control-row"><label>{{ t('settings.fields.panelHeight', 'Высота нижней панели') }}</label><span class="val-badge">{{ settings.spacing.panelHeight }}px</span></div>
        <input v-model.number="settings.spacing.panelHeight" type="range" min="150" max="500" step="10" class="interactive-el" @change="save()">
      </div>

      <!-- СКРУГЛЕНИЯ (Radii) -->
      <div class="settings-group">
        <h3 class="form-label settings-group-title">{{ t('settings.groupTitles.radii', 'Формы и скругления') }}</h3>
        <div class="control-row"><label>{{ t('settings.fields.islandRadius', 'Панели (Острова)') }}</label><span class="val-badge">{{ settings.radii.island }}px</span></div>
        <input v-model.number="settings.radii.island" type="range" min="0" max="60" class="interactive-el" @input="save()">
        
        <div class="control-row"><label>{{ t('settings.fields.cardRadius', 'Карточки') }}</label><span class="val-badge">{{ settings.radii.card }}px</span></div>
        <input v-model.number="settings.radii.card" type="range" min="0" max="40" class="interactive-el" @input="save()">
        
        <div class="control-row"><label>{{ t('settings.fields.btnRadius', 'Кнопки') }}</label><span class="val-badge">{{ settings.radii.btn }}px</span></div>
        <input v-model.number="settings.radii.btn" type="range" min="0" max="40" class="interactive-el" @input="save()">
        
        <div class="control-row"><label>{{ t('settings.fields.inputRadius', 'Поля ввода') }}</label><span class="val-badge">{{ settings.radii.input }}px</span></div>
        <input v-model.number="settings.radii.input" type="range" min="0" max="30" class="interactive-el" @input="save()">
        
        <div class="control-row"><label>{{ t('settings.fields.dropdownRadius', 'Выпадающие списки') }}</label><span class="val-badge">{{ settings.radii.dropdown }}px</span></div>
        <input v-model.number="settings.radii.dropdown" type="range" min="0" max="30" class="interactive-el" @input="save()">
      </div>

      <!-- ТЕНИ И ОБЪЕМ (Shadows) -->
      <div class="settings-group">
        <h3 class="form-label settings-group-title">
          {{ t('settings.groupTitles.shadows', 'Тени и объем') }}
          <span class="impact-badge cost-high ml-2 impact-badge-static">Cost: Medium</span>
        </h3>
        <div class="control-row"><label>{{ t('settings.fields.shadowOffsetY', 'Смещение Y') }}</label><span class="val-badge">{{ settings.shadows.islandY }}px</span></div>
        <input v-model.number="settings.shadows.islandY" type="range" min="0" max="50" class="interactive-el" @input="save()">
        
        <div class="control-row"><label>{{ t('settings.fields.shadowBlur', 'Размытие теней') }}</label><span class="val-badge">{{ settings.shadows.islandBlur }}px</span></div>
        <input v-model.number="settings.shadows.islandBlur" type="range" min="0" max="100" class="interactive-el" @input="save()">
        
        <div class="control-row mt-3">
          <label>{{ t('settings.fields.shadowInset', 'Внутренние тени (Вдавленность)') }}</label>
          <label class="toggle-switch"><input v-model="settings.shadows.useInset" type="checkbox" class="interactive-el" @change="save()"><span class="slider"></span></label>
        </div>
      </div>

      <!-- ЭЛЕМЕНТЫ: ИНПУТЫ И КАРТОЧКИ -->
      <div class="settings-group">
        <h3 class="form-label settings-group-title">Элементы управления</h3>
        
        <div class="control-row"><label>{{ t('settings.fields.inputStyle', 'Стиль полей ввода') }}</label></div>
        <div class="radio-group mb-4">
          <div class="radio-btn" :class="{ active: settings.inputs.style === 'outline' }" @click="settings.inputs.style = 'outline'; save()">{{ t('settings.fields.withOutline', 'С контуром') }}</div>
          <div class="radio-btn" :class="{ active: settings.inputs.style === 'filled' }" @click="settings.inputs.style = 'filled'; save()">{{ t('settings.fields.withBackground', 'С фоном') }}</div>
        </div>

        <div class="control-row">
          <label>{{ t('settings.fields.compactList', 'Компактные списки') }}</label>
          <label class="toggle-switch"><input v-model="settings.cards.compactList" type="checkbox" class="interactive-el" @change="save()"><span class="slider"></span></label>
        </div>
        
        <div class="control-row mt-2">
          <label>{{ t('settings.fields.showIcons', 'Показывать иконки') }}</label>
          <label class="toggle-switch"><input v-model="settings.cards.showIcons" type="checkbox" class="interactive-el" @change="save()"><span class="slider"></span></label>
        </div>
      </div>

      <!-- УВЕДОМЛЕНИЯ -->
      <div class="settings-group">
        <h3 class="form-label settings-group-title">{{ t('settings.groupTitles.notifications', 'Уведомления') }}</h3>
        
        <div class="control-row"><label>{{ t('settings.fields.notificationDuration', 'Длительность показа') }}</label><span class="val-badge">{{ settings.notifications.duration }}ms</span></div>
        <input v-model.number="settings.notifications.duration" type="range" min="1000" max="10000" step="500" class="interactive-el" @change="save()">
        
        <div class="control-row mt-3"><label>{{ t('settings.fields.notificationPosition', 'Позиция') }}</label></div>
        <div class="radio-group flex-wrap gap-2">
          <div class="radio-btn" :class="{ active: settings.notifications.position === 'top-left' }" @click="settings.notifications.position = 'top-left'; save()">{{ t('settings.fields.topLeft', 'Сверху слева') }}</div>
          <div class="radio-btn" :class="{ active: settings.notifications.position === 'top-right' }" @click="settings.notifications.position = 'top-right'; save()">{{ t('settings.fields.topRight', 'Сверху справа') }}</div>
          <div class="radio-btn" :class="{ active: settings.notifications.position === 'bottom-left' }" @click="settings.notifications.position = 'bottom-left'; save()">{{ t('settings.fields.bottomLeft', 'Снизу слева') }}</div>
          <div class="radio-btn" :class="{ active: settings.notifications.position === 'bottom-right' }" @click="settings.notifications.position = 'bottom-right'; save()">{{ t('settings.fields.bottomRight', 'Снизу справа') }}</div>
        </div>
      </div>
      
      <!-- ВЫПАДАЮЩИЕ СПИСКИ -->
      <div class="settings-group">
        <h3 class="form-label settings-group-title">{{ t('settings.groupTitles.dropdowns', 'Выпадающие списки') }}</h3>
        <div class="control-row">
          <label>{{ t('settings.fields.dropdownTransparency', 'Прозрачность') }}</label>
          <span class="val-badge">{{ settings.dropdowns.transparency ?? 0 }}%</span>
        </div>
        <input 
          v-model.number="settings.dropdowns.transparency" 
          type="range" 
          min="0" 
          max="100" 
          step="5" 
          class="interactive-el" 
          @input="save()"
        >
        <div class="control-row mt-3">
          <label>{{ t('settings.fields.wheel3DEffect', 'Эффект 3D-колеса') }}</label>
          <label class="toggle-switch"><input v-model="settings.dropdowns.use3DWheel" type="checkbox" class="interactive-el" @change="save()"><span class="slider"></span></label>
        </div>
        <div v-if="settings.dropdowns.use3DWheel" class="control-row mt-3"><label>{{ t('settings.fields.wheelOrientation', 'Ориентация') }}</label></div>
        <div v-if="settings.dropdowns.use3DWheel" class="radio-group">
          <div class="radio-btn" :class="{ active: settings.dropdowns.wheelOrientation === 'vertical' || !settings.dropdowns.wheelOrientation }" @click="settings.dropdowns.wheelOrientation = 'vertical'; save()">{{ t('settings.fields.vertical', 'Вертикально') }}</div>
          <div class="radio-btn" :class="{ active: settings.dropdowns.wheelOrientation === 'horizontal' }" @click="settings.dropdowns.wheelOrientation = 'horizontal'; save()">{{ t('settings.fields.horizontal', 'Горизонтально') }}</div>
        </div>
      </div>

    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import type { AppSettings } from '../../../ts/types/settings.js';
import SettingsLivePreview from './SettingsLivePreview.vue';

const { t } = useI18n();

defineProps<{
  settings: AppSettings;
  save: () => Promise<void>;
}>();
</script>
