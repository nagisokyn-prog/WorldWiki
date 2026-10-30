<template>
  <div class="ribbon-tab-content flex">
    <!-- Параметры страницы -->
    <RibbonPageSetupGroup
      :open-dropdown="openDropdown"
      :dropdown-pos="dropdownPos"
      :commands="commands"
      @toggle-dropdown="(evt, name) => $emit('toggleDropdown', evt, name)"
      @close-dropdown="$emit('closeDropdown')"
      @apply-margin-preset="$emit('applyMarginPreset', $event)"
      @apply-orientation="$emit('applyOrientation', $event)"
      @apply-columns="$emit('applyColumns', $event)"
    />

    <!-- Абзац (Отступы и интервалы) -->
    <div class="ribbon-group">
      <div class="ribbon-group-rows">
        <div class="ribbon-row">
          <span class="ribbon-input-label">Отступ Слева:</span>
          <input 
            type="number" 
            class="ribbon-input ribbon-input-sm" 
            :value="indentLeftCm" 
            step="0.25"
            min="0"
            max="10"
            @change="$emit('update:indentLeft', Number(($event.target as HTMLInputElement).value))"
          />
          <span class="ribbon-unit">см</span>

          <span class="ribbon-input-label ml-2">Интервал До:</span>
          <input 
            type="number" 
            class="ribbon-input ribbon-input-sm" 
            :value="spacingBeforePt" 
            step="1"
            min="0"
            max="72"
            @change="$emit('update:spacingBefore', Number(($event.target as HTMLInputElement).value))"
          />
          <span class="ribbon-unit">пт</span>
        </div>
        <div class="ribbon-row">
          <span class="ribbon-input-label">Отступ Справа:</span>
          <input 
            type="number" 
            class="ribbon-input ribbon-input-sm" 
            :value="indentRightCm" 
            step="0.25"
            min="0"
            max="10"
            @change="$emit('update:indentRight', Number(($event.target as HTMLInputElement).value))"
          />
          <span class="ribbon-unit">см</span>

          <span class="ribbon-input-label ml-2">Интервал После:</span>
          <input 
            type="number" 
            class="ribbon-input ribbon-input-sm" 
            :value="spacingAfterPt" 
            step="1"
            min="0"
            max="72"
            @change="$emit('update:spacingAfter', Number(($event.target as HTMLInputElement).value))"
          />
          <span class="ribbon-unit">пт</span>
        </div>
      </div>
      <div class="ribbon-group-footer">
        <span class="ribbon-group-label">Абзац</span>
        <button 
          type="button" 
          class="ribbon-dialog-launcher" 
          title="Параметры абзаца"
          @click="$emit('open-paragraph-dialog')"
        >
          <i class="fas fa-external-link-alt"></i>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import RibbonPageSetupGroup from '../groups/RibbonPageSetupGroup.vue';
import type { RibbonLayoutTabProps, RibbonLayoutTabEmits } from './RibbonLayoutTab.model';

defineProps<RibbonLayoutTabProps>();
defineEmits<RibbonLayoutTabEmits>();
</script>
