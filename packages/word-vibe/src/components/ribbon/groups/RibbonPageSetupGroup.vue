<template>
  <div class="ribbon-group">
    <div class="ribbon-row">
      <!-- Поля -->
      <div class="ribbon-dropdown">
        <button type="button" class="ribbon-btn ribbon-btn-large" :class="{ 'is-open': openDropdown === 'margins' }" title="Настройка полей страницы" @click="$emit('toggleDropdown', $event, 'margins')">
          <i class="fas fa-border-style"></i>
          <span>Поля ▾</span>
        </button>
        <div v-if="openDropdown === 'margins'" class="ribbon-dropdown-menu" :style="{ top: dropdownPos.top + 'px', left: dropdownPos.left + 'px' }">
          <button type="button" class="ribbon-dropdown-item" @click="$emit('applyMarginPreset', 'gost')">
            <strong>ГОСТ 7.32 (Обычные)</strong>
            <div class="ribbon-dropdown-sub">Лев: 30 мм, Прав: 10 мм, Верх: 20 мм, Низ: 20 мм</div>
          </button>
          <button type="button" class="ribbon-dropdown-item" @click="$emit('applyMarginPreset', 'narrow')">
            <strong>Узкие</strong>
            <div class="ribbon-dropdown-sub">12.7 мм со всех сторон</div>
          </button>
          <button type="button" class="ribbon-dropdown-item" @click="$emit('applyMarginPreset', 'moderate')">
            <strong>Средние</strong>
            <div class="ribbon-dropdown-sub">Верх/Низ: 25.4 мм, Лев/Прав: 19.05 мм</div>
          </button>
          <button type="button" class="ribbon-dropdown-item" @click="$emit('applyMarginPreset', 'wide')">
            <strong>Широкие</strong>
            <div class="ribbon-dropdown-sub">Верх/Низ: 25.4 мм, Лев/Прав: 50.8 мм</div>
          </button>
          <div class="ribbon-dropdown-sep"></div>
          <button type="button" class="ribbon-dropdown-item" @click="$emit('closeDropdown'); commands.openPageSetupDialog?.()">
            <i class="fas fa-sliders-h"></i> Настраиваемые поля...
          </button>
        </div>
      </div>

      <!-- Ориентация -->
      <div class="ribbon-dropdown">
        <button type="button" class="ribbon-btn ribbon-btn-large" :class="{ 'is-open': openDropdown === 'orientation' }" title="Ориентация страницы" @click="$emit('toggleDropdown', $event, 'orientation')">
          <i class="fas fa-redo"></i>
          <span>Ориентация ▾</span>
        </button>
        <div v-if="openDropdown === 'orientation'" class="ribbon-dropdown-menu" :style="{ top: dropdownPos.top + 'px', left: dropdownPos.left + 'px' }">
          <button type="button" class="ribbon-dropdown-item" @click="$emit('applyOrientation', 'portrait')">
            <i class="fas fa-file"></i> Книжная
          </button>
          <button type="button" class="ribbon-dropdown-item" @click="$emit('applyOrientation', 'landscape')">
            <i class="fas fa-file fa-rotate-90"></i> Альбомная
          </button>
        </div>
      </div>

      <!-- Колонки -->
      <div class="ribbon-dropdown">
        <button type="button" class="ribbon-btn ribbon-btn-large" :class="{ 'is-open': openDropdown === 'columns' }" title="Колонки текста" @click="$emit('toggleDropdown', $event, 'columns')">
          <i class="fas fa-columns"></i>
          <span>Колонки ▾</span>
        </button>
        <div v-if="openDropdown === 'columns'" class="ribbon-dropdown-menu" :style="{ top: dropdownPos.top + 'px', left: dropdownPos.left + 'px' }">
          <button type="button" class="ribbon-dropdown-item" @click="$emit('applyColumns', 1)">Одна колонка</button>
          <button type="button" class="ribbon-dropdown-item" @click="$emit('applyColumns', 2)">Две колонки</button>
          <button type="button" class="ribbon-dropdown-item" @click="$emit('applyColumns', 3)">Три колонки</button>
        </div>
      </div>
    </div>
    <div class="ribbon-group-footer">
      <span class="ribbon-group-label">Параметры страницы</span>
      <button 
        type="button" 
        class="ribbon-dialog-launcher" 
        title="Параметры страницы"
        @click="commands.openPageSetupDialog?.()"
      >
        <i class="fas fa-external-link-alt"></i>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { RibbonPageSetupGroupProps, RibbonPageSetupGroupEmits } from './RibbonPageSetupGroup.model';

defineProps<RibbonPageSetupGroupProps>();
defineEmits<RibbonPageSetupGroupEmits>();
</script>
