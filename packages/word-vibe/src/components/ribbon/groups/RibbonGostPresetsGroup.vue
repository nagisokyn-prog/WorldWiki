<template>
  <div class="ribbon-group">
    <div class="ribbon-row">
      <!-- Предустановки ГОСТ -->
      <div class="ribbon-dropdown">
        <button type="button" class="ribbon-btn ribbon-btn-large" :class="{ 'is-open': openDropdown === 'gost-preset' }" title="Шаблоны оформления по ГОСТ" @click="$emit('toggleDropdown', $event, 'gost-preset')">
          <i class="fas fa-magic"></i>
          <span>Предустановки ГОСТ ▾</span>
        </button>
        <div v-if="openDropdown === 'gost-preset'" class="ribbon-dropdown-menu" :style="{ top: dropdownPos.top + 'px', left: dropdownPos.left + 'px' }">
          <button type="button" class="ribbon-dropdown-item" @click="$emit('applyGostPreset', 'thesis')">
            <strong>Диплом / ВКР (ГОСТ 7.32)</strong>
            <div class="ribbon-dropdown-sub">Times New Roman 14пт, 1.5 инт, поля: 30/10/20/20</div>
          </button>
          <button type="button" class="ribbon-dropdown-item" @click="$emit('applyGostPreset', 'coursework')">
            <strong>Курсовая работа</strong>
            <div class="ribbon-dropdown-sub">Times New Roman 14пт, 1.5 инт, абзац 1.25 см</div>
          </button>
          <button type="button" class="ribbon-dropdown-item" @click="$emit('applyGostPreset', 'report')">
            <strong>Отчёт о НИР</strong>
            <div class="ribbon-dropdown-sub">ГОСТ 7.32-2017 со стандартными рамками</div>
          </button>
          <button type="button" class="ribbon-dropdown-item" @click="$emit('applyGostPreset', 'article')">
            <strong>Научная статья (ВАК / РИНЦ)</strong>
            <div class="ribbon-dropdown-sub">Times New Roman 12пт, 1.0 инт, аннотация + UDC</div>
          </button>
        </div>
      </div>

      <!-- Стили цитирования -->
      <div class="ribbon-dropdown">
        <button type="button" class="ribbon-btn ribbon-btn-large" :class="{ 'is-open': openDropdown === 'cite-style' }" title="Стиль оформления библиографии" @click="$emit('toggleDropdown', $event, 'cite-style')">
          <i class="fas fa-graduation-cap"></i>
          <span>Стиль цитирования ▾</span>
        </button>
        <div v-if="openDropdown === 'cite-style'" class="ribbon-dropdown-menu" :style="{ top: dropdownPos.top + 'px', left: dropdownPos.left + 'px' }">
          <button type="button" class="ribbon-dropdown-item" @click="$emit('applyCiteStyle', 'gost-numeric')">ГОСТ Р 7.0.5-2008 (числовой [1])</button>
          <button type="button" class="ribbon-dropdown-item" @click="$emit('applyCiteStyle', 'gost-author-year')">ГОСТ Р 7.0.5-2008 (автор-год)</button>
          <button type="button" class="ribbon-dropdown-item" @click="$emit('applyCiteStyle', 'harvard')">Гарвардский стиль (Harvard)</button>
          <button type="button" class="ribbon-dropdown-item" @click="$emit('applyCiteStyle', 'apa7')">APA 7th Edition</button>
          <button type="button" class="ribbon-dropdown-item" @click="$emit('applyCiteStyle', 'ieee')">IEEE</button>
        </div>
      </div>
    </div>
    <div class="ribbon-group-footer">
      <span class="ribbon-group-label">Стандарты оформления</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { RibbonGostPresetsGroupProps, RibbonGostPresetsGroupEmits } from './RibbonGostPresetsGroup.model';

defineProps<RibbonGostPresetsGroupProps>();
defineEmits<RibbonGostPresetsGroupEmits>();
</script>
