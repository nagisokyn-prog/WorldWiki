<template>
  <div class="ribbon-group">
    <div class="ribbon-row">
      <!-- Верхний колонтитул -->
      <div class="ribbon-dropdown">
        <button type="button" class="ribbon-btn ribbon-btn-large" :class="{ 'is-open': openDropdown === 'header' }" title="Верхний колонтитул" @click="$emit('toggleDropdown', $event, 'header')">
          <i class="fas fa-grip-lines"></i>
          <span>Верхний ▾</span>
        </button>
        <div v-if="openDropdown === 'header'" class="ribbon-dropdown-menu" :style="{ top: dropdownPos.top + 'px', left: dropdownPos.left + 'px' }">
          <button type="button" class="ribbon-dropdown-item" @click="$emit('applyHeaderPreset', 'empty')">Пусто</button>
          <button type="button" class="ribbon-dropdown-item" @click="$emit('applyHeaderPreset', 'chapter-left')">Название главы (слева)</button>
          <button type="button" class="ribbon-dropdown-item" @click="$emit('applyHeaderPreset', 'chapter-center')">Название главы (по центру)</button>
          <div class="ribbon-dropdown-sep"></div>
          <button type="button" class="ribbon-dropdown-item" @click="$emit('closeDropdown'); commands.openHeaderFooterDialog?.('header')">
            <i class="fas fa-edit"></i> Изменить верхний колонтитул...
          </button>
        </div>
      </div>

      <!-- Нижний колонтитул -->
      <div class="ribbon-dropdown">
        <button type="button" class="ribbon-btn ribbon-btn-large" :class="{ 'is-open': openDropdown === 'footer' }" title="Нижний колонтитул" @click="$emit('toggleDropdown', $event, 'footer')">
          <i class="fas fa-grip-lines"></i>
          <span>Нижний ▾</span>
        </button>
        <div v-if="openDropdown === 'footer'" class="ribbon-dropdown-menu" :style="{ top: dropdownPos.top + 'px', left: dropdownPos.left + 'px' }">
          <button type="button" class="ribbon-dropdown-item" @click="$emit('applyFooterPreset', 'empty')">Пусто</button>
          <button type="button" class="ribbon-dropdown-item" @click="$emit('applyFooterPreset', 'page-right')">Стр. {page} из {total} (справа)</button>
          <button type="button" class="ribbon-dropdown-item" @click="$emit('applyFooterPreset', 'page-center')">Стр. {page} из {total} (центр)</button>
          <button type="button" class="ribbon-dropdown-item" @click="$emit('applyFooterPreset', 'page-only-right')">{page} (справа)</button>
          <div class="ribbon-dropdown-sep"></div>
          <button type="button" class="ribbon-dropdown-item" @click="$emit('closeDropdown'); commands.openHeaderFooterDialog?.('footer')">
            <i class="fas fa-edit"></i> Изменить нижний колонтитул...
          </button>
        </div>
      </div>

      <!-- Номер страницы -->
      <div class="ribbon-dropdown">
        <button type="button" class="ribbon-btn ribbon-btn-large" :class="{ 'is-open': openDropdown === 'pagenum' }" title="Номер страницы" @click="$emit('toggleDropdown', $event, 'pagenum')">
          <i class="fas fa-hashtag"></i>
          <span>Номер страницы ▾</span>
        </button>
        <div v-if="openDropdown === 'pagenum'" class="ribbon-dropdown-menu" :style="{ top: dropdownPos.top + 'px', left: dropdownPos.left + 'px' }">
          <div class="ribbon-dropdown-title">Вверху страницы:</div>
          <button type="button" class="ribbon-dropdown-item" @click="$emit('applyPageNumberPosition', 'header-left')">Слева</button>
          <button type="button" class="ribbon-dropdown-item" @click="$emit('applyPageNumberPosition', 'header-center')">Центр</button>
          <button type="button" class="ribbon-dropdown-item" @click="$emit('applyPageNumberPosition', 'header-right')">Справа</button>
          <div class="ribbon-dropdown-sep"></div>
          <div class="ribbon-dropdown-title">Внизу страницы:</div>
          <button type="button" class="ribbon-dropdown-item" @click="$emit('applyPageNumberPosition', 'footer-left')">Слева</button>
          <button type="button" class="ribbon-dropdown-item" @click="$emit('applyPageNumberPosition', 'footer-center')">Центр</button>
          <button type="button" class="ribbon-dropdown-item" @click="$emit('applyPageNumberPosition', 'footer-right')">Справа</button>
          <div class="ribbon-dropdown-sep"></div>
          <button type="button" class="ribbon-dropdown-item" @click="$emit('applyHeaderPreset', 'empty'); $emit('applyFooterPreset', 'empty')">Убрать номера страниц</button>
        </div>
      </div>
    </div>
    <div class="ribbon-group-footer">
      <span class="ribbon-group-label">Колонтитулы</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { RibbonCommands } from '../../../ribbon/commands';

defineProps<{
  openDropdown: string | null;
  dropdownPos: { top: number; left: number };
  commands: Partial<RibbonCommands>;
}>();

defineEmits<{
  (e: 'toggleDropdown', event: MouseEvent, name: string): void;
  (e: 'closeDropdown'): void;
  (e: 'applyHeaderPreset', preset: 'empty' | 'chapter-left' | 'chapter-center'): void;
  (e: 'applyFooterPreset', preset: 'empty' | 'page-right' | 'page-center' | 'page-only-right'): void;
  (e: 'applyPageNumberPosition', pos: 'header-left' | 'header-center' | 'header-right' | 'footer-left' | 'footer-center' | 'footer-right'): void;
}>();
</script>
