<template>
  <div class="word-ribbon" @mousedown="onRibbonMousedown">
    <!-- Верхние вкладки Ribbon -->
    <div class="ribbon-tabs-bar">
      <button 
        type="button" 
        class="ribbon-tab-btn" 
        :class="{ 'is-active': activeTab === 'home' }" 
        @click="activeTab = 'home'"
      >
        Главная
      </button>
      <button 
        type="button" 
        class="ribbon-tab-btn" 
        :class="{ 'is-active': activeTab === 'insert' }" 
        @click="activeTab = 'insert'"
      >
        Вставка
      </button>
      <button 
        type="button" 
        class="ribbon-tab-btn" 
        :class="{ 'is-active': activeTab === 'layout' }" 
        @click="activeTab = 'layout'"
      >
        Макет
      </button>
      <button 
        v-if="isInsideTable"
        type="button" 
        class="ribbon-tab-btn ribbon-tab-btn-context" 
        :class="{ 'is-active': activeTab === 'table-design' }" 
        @click="activeTab = 'table-design'"
      >
        Конструктор таблицы
      </button>
    </div>

    <!-- Полоса инструментов активной вкладки -->
    <div class="ribbon-content-strip">
      <!-- ВКЛАДКА: ГЛАВНАЯ -->
      <RibbonHomeTab
        v-if="activeTab === 'home'"
        :current-font-family="currentFontFamily"
        :current-font-size="currentFontSize"
        :current-line-height="currentLineHeight"
        :show-invisibles="showInvisibles"
        :commands="commands"
        :call="call"
        @update:font-family="currentFontFamily = $event; applyFontFamily()"
        @update:font-size="currentFontSize = $event; applyFontSize()"
        @update:line-height="currentLineHeight = $event; applyLineHeight()"
        @step-font-size="stepFontSize"
        @toggle-invisibles="toggleInvisibles"
        @open-font-dialog="$emit('open-font-dialog')"
        @open-paragraph-dialog="$emit('open-paragraph-dialog')"
      />

      <!-- ВКЛАДКА: ВСТАВКА -->
      <RibbonInsertTab
        v-else-if="activeTab === 'insert'"
        :open-dropdown="openDropdown"
        :dropdown-pos="dropdownPos"
        :commands="commands"
        @toggle-dropdown="toggleDropdown"
        @close-dropdown="closeDropdown"
        @apply-header-preset="applyHeaderPreset"
        @apply-footer-preset="applyFooterPreset"
        @apply-page-number-position="applyPageNumberPosition"
      />

      <!-- ВКЛАДКА: МАКЕТ -->
      <RibbonLayoutTab
        v-else-if="activeTab === 'layout'"
        :open-dropdown="openDropdown"
        :dropdown-pos="dropdownPos"
        :current-page-size="currentPageSize"
        :indent-left-cm="indentLeftCm"
        :indent-right-cm="indentRightCm"
        :spacing-before-pt="spacingBeforePt"
        :spacing-after-pt="spacingAfterPt"
        :commands="commands"
        @toggle-dropdown="toggleDropdown"
        @close-dropdown="closeDropdown"
        @open-page-setup="$emit('open-page-setup')"
        @update:page-size="currentPageSize = $event as any; commands.setPageSize?.(currentPageSize)"
        @update:indent-left="indentLeftCm = $event; applyLeftIndent()"
        @update:indent-right="indentRightCm = $event; applyRightIndent()"
        @update:spacing-before="spacingBeforePt = $event; applySpacing()"
        @update:spacing-after="spacingAfterPt = $event; applySpacing()"
      />

      <!-- ВКЛАДКА: КОНСТРУКТОР ТАБЛИЦЫ -->
      <RibbonTableDesignTab
        v-else-if="activeTab === 'table-design'"
        :commands="commands"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { useWordRibbonBar } from './useWordRibbonBar';
import type { RibbonProps as WordRibbonProps } from './useWordRibbonBar';
import RibbonHomeTab from './tabs/RibbonHomeTab.vue';
import RibbonInsertTab from './tabs/RibbonInsertTab.vue';
import RibbonLayoutTab from './tabs/RibbonLayoutTab.vue';
import RibbonTableDesignTab from './tabs/RibbonTableDesignTab.vue';

const onRibbonMousedown = (e: MouseEvent): void => {
  const target = e.target;
  if (!(target instanceof HTMLElement)) return;
  if (target.closest('select, input, textarea')) return;
  e.preventDefault();
};

const props = defineProps<WordRibbonProps>();

const emit = defineEmits<{
  (e: 'open-paragraph-dialog'): void;
  (e: 'open-font-dialog'): void;
  (e: 'open-page-setup'): void;
  (e: 'open-header-footer-dialog', tab?: 'header' | 'footer'): void;
}>();

const {
  activeTab, currentPageSize, currentFontFamily, currentFontSize, currentLineHeight,
  showInvisibles, openDropdown, dropdownPos, indentLeftCm, indentRightCm,
  spacingBeforePt, spacingAfterPt, toggleDropdown, closeDropdown,
  applyLeftIndent, applyRightIndent, applySpacing, applyHeaderPreset,
  applyFooterPreset, applyPageNumberPosition, applyFontFamily, applyFontSize,
  applyLineHeight, stepFontSize, toggleInvisibles, call, commands,
} = useWordRibbonBar(props, emit);
</script>

<style scoped src="@worldwiki/resources/styles/features/chapters/WordRibbonBar.css"></style>
