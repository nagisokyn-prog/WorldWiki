<template>
  <div class="ribbon-tab-content flex">
    <div class="ribbon-group">
      <div class="ribbon-row">
        <!-- Поля: dropdown пресетов -->
        <div class="ribbon-dropdown">
          <button
            type="button"
            class="ribbon-btn ribbon-btn-large"
            :class="{ 'is-open': openDropdown === 'margins' }"
            title="Поля страницы"
            @click="$emit('toggleDropdown', $event, 'margins')"
          >
            <i class="fas fa-border-all"></i>
            <span>Поля ▾</span>
          </button>
          <div v-if="openDropdown === 'margins'" class="ribbon-dropdown-menu" :style="{ top: dropdownPos.top + 'px', left: dropdownPos.left + 'px' }">
            <button type="button" class="ribbon-dropdown-item" @click="commands.setMarginPreset?.('gost'); $emit('closeDropdown')">
              <i class="fas fa-check"></i> ГОСТ 7.32 <small>(Л:30 П:15 В:20 Н:20 мм)</small>
            </button>
            <button type="button" class="ribbon-dropdown-item" @click="commands.setMarginPreset?.('normal'); $emit('closeDropdown')">
              <i class="fas fa-circle"></i> Нормальные <small>(все по 20 мм)</small>
            </button>
            <button type="button" class="ribbon-dropdown-item" @click="commands.setMarginPreset?.('narrow'); $emit('closeDropdown')">
              <i class="fas fa-circle"></i> Узкие <small>(все по 12 мм)</small>
            </button>
            <button type="button" class="ribbon-dropdown-item" @click="commands.setMarginPreset?.('wide'); $emit('closeDropdown')">
              <i class="fas fa-circle"></i> Широкие <small>(Л:50 П:50 В:20 Н:20 мм)</small>
            </button>
            <div class="ribbon-dropdown-sep"></div>
            <button type="button" class="ribbon-dropdown-item" @click="$emit('closeDropdown'); $emit('open-page-setup')">
              <i class="fas fa-sliders-h"></i> Произвольные поля...
            </button>
          </div>
        </div>

        <!-- Ориентация: dropdown -->
        <div class="ribbon-dropdown">
          <button
            type="button"
            class="ribbon-btn ribbon-btn-large"
            :class="{ 'is-open': openDropdown === 'orientation' }"
            title="Ориентация страницы"
            @click="$emit('toggleDropdown', $event, 'orientation')"
          >
            <i class="fas fa-sync-alt"></i>
            <span>Ориентация ▾</span>
          </button>
          <div v-if="openDropdown === 'orientation'" class="ribbon-dropdown-menu" :style="{ top: dropdownPos.top + 'px', left: dropdownPos.left + 'px' }">
            <button type="button" class="ribbon-dropdown-item" @click="commands.togglePageOrientation?.(); $emit('closeDropdown')">
              <i class="fas fa-file"></i> Книжная
            </button>
            <button type="button" class="ribbon-dropdown-item" @click="commands.togglePageOrientation?.(); $emit('closeDropdown')">
              <i class="fas fa-file"></i> Альбомная
            </button>
          </div>
        </div>

        <!-- Размер листа (А4, А5, А3, Letter, B5) -->
        <div class="ribbon-field-column">
          <label class="ribbon-mini-label">Формат</label>
          <select 
            :value="currentPageSize" 
            class="ribbon-select" 
            title="Формат бумаги"
            @change="$emit('update:pageSize', ($event.target as HTMLSelectElement).value)"
          >
            <option value="A4">A4 (210 × 297 мм) · ГОСТ</option>
            <option value="A5">A5 (148 × 210 мм) · Книга</option>
            <option value="A3">A3 (297 × 420 мм) · Схемы/Карты</option>
            <option value="Letter">Letter (216 × 279 мм)</option>
            <option value="B5">B5 (176 × 250 мм) · Монография</option>
          </select>
        </div>

        <!-- Разрывы: dropdown -->
        <div class="ribbon-dropdown">
          <button
            type="button"
            class="ribbon-btn ribbon-btn-large"
            :class="{ 'is-open': openDropdown === 'breaks' }"
            title="Разрывы страниц и разделов"
            @click="$emit('toggleDropdown', $event, 'breaks')"
          >
            <i class="fas fa-scissors"></i>
            <span>Разрывы ▾</span>
          </button>
          <div v-if="openDropdown === 'breaks'" class="ribbon-dropdown-menu" :style="{ top: dropdownPos.top + 'px', left: dropdownPos.left + 'px' }">
            <div class="ribbon-dropdown-title">Разрывы страниц:</div>
            <button type="button" class="ribbon-dropdown-item" @click="commands.insertPageBreak?.(); $emit('closeDropdown')">
              <i class="fas fa-file"></i> Страница
            </button>
            <div class="ribbon-dropdown-sep"></div>
            <div class="ribbon-dropdown-title">Разрывы разделов:</div>
            <button type="button" class="ribbon-dropdown-item" @click="commands.insertSectionBreak?.(); $emit('closeDropdown')">
              <i class="fas fa-file-alt"></i> Следующая страница (Книжная)
            </button>
            <button type="button" class="ribbon-dropdown-item" @click="commands.insertSectionLandscape?.(); $emit('closeDropdown')">
              <i class="fas fa-file-alt"></i> Следующая страница (Альбомная) ★
            </button>
            <button type="button" class="ribbon-dropdown-item" @click="commands.insertSectionPortrait?.(); $emit('closeDropdown')">
              <i class="fas fa-file-alt"></i> Вернуть книжную
            </button>
          </div>
        </div>

        <!-- Лаунчер Параметров страницы -->
        <button
          type="button"
          class="ribbon-btn"
          title="Параметры страницы"
          @click="$emit('open-page-setup')"
        >
          <i class="fas fa-external-link-alt"></i>
        </button>
      </div>
      <div class="ribbon-group-footer">
        <span class="ribbon-group-label">Параметры страницы</span>
      </div>
    </div>

    <!-- Группа: Абзац (отступы и интервалы) -->
    <div class="ribbon-group">
      <div class="ribbon-row">
        <div class="ribbon-field-column">
          <label class="ribbon-mini-label">Отступ: Слева (см)</label>
          <input :value="indentLeftCm" type="number" class="ribbon-input-number" step="0.5" min="0" title="Отступ слева (выделенному абзацу)" @change="$emit('update:indentLeft', Number(($event.target as HTMLInputElement).value))" />
        </div>
        <div class="ribbon-field-column">
          <label class="ribbon-mini-label">Отступ: Справа (см)</label>
          <input :value="indentRightCm" type="number" class="ribbon-input-number" step="0.5" min="0" title="Отступ справа (выделенному абзацу)" @change="$emit('update:indentRight', Number(($event.target as HTMLInputElement).value))" />
        </div>
        <span class="ribbon-separator"></span>
        <div class="ribbon-field-column">
          <label class="ribbon-mini-label">Интервал: До (пт)</label>
          <input :value="spacingBeforePt" type="number" class="ribbon-input-number" step="6" min="0" title="Интервал до абзаца" @change="$emit('update:spacingBefore', Number(($event.target as HTMLInputElement).value))" />
        </div>
        <div class="ribbon-field-column">
          <label class="ribbon-mini-label">Интервал: После (пт)</label>
          <input :value="spacingAfterPt" type="number" class="ribbon-input-number" step="6" min="0" title="Интервал после абзаца" @change="$emit('update:spacingAfter', Number(($event.target as HTMLInputElement).value))" />
        </div>
      </div>
      <div class="ribbon-group-footer">
        <span class="ribbon-group-label">Абзац</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { PageSize } from '../../../types/dto';
import type { RibbonCommands } from '../../../ribbon/commands';

defineProps<{
  openDropdown: string | null;
  dropdownPos: { top: number; left: number };
  currentPageSize: PageSize;
  indentLeftCm: number;
  indentRightCm: number;
  spacingBeforePt: number;
  spacingAfterPt: number;
  commands: Partial<RibbonCommands>;
}>();

defineEmits<{
  (e: 'toggleDropdown', event: MouseEvent, name: string): void;
  (e: 'closeDropdown'): void;
  (e: 'open-page-setup'): void;
  (e: 'update:pageSize', val: string): void;
  (e: 'update:indentLeft', val: number): void;
  (e: 'update:indentRight', val: number): void;
  (e: 'update:spacingBefore', val: number): void;
  (e: 'update:spacingAfter', val: number): void;
}>();
</script>
