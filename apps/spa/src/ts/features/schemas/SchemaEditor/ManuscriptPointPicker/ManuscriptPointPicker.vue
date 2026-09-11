<template>
  <div class="manuscript-point-picker" :class="{ 'mpp-disabled': props.disabled }">
    <div v-if="props.label || props.allowAutoExtend" class="mpp-header" :class="{ 'mpp-header-no-label': !props.label }">
      <span v-if="props.label" class="mpp-label">{{ props.label }}</span>
      <button
        v-if="props.allowAutoExtend"
        type="button"
        class="mpp-auto-btn interactive-el"
        :class="{ 'is-active': internalPoint.is_auto_extend }"
        :title="internalPoint.is_auto_extend ? 'Автопродление включено: конечная точка привязана к последней главе' : 'Включить автопродление до текущей главы'"
        @click="toggleAutoExtend"
      >
        <span class="mpp-auto-icon">⚡</span>
        <span>{{ internalPoint.is_auto_extend ? 'По наст. время' : 'Автопродление' }}</span>
      </button>
    </div>

    <div class="mpp-grid" :class="{ 'mpp-disabled': internalPoint.is_auto_extend }">
      <!-- Барабан 1: Том -->
      <div v-if="hasVolumes" class="mpp-col">
        <span class="mpp-col-label">Том</span>
        <XboxWheel
          :model-value="cleanRecordId(internalPoint.volume_id)"
          :options="volumeOptions"
          placeholder="-- Том --"
          :disabled="props.disabled || internalPoint.is_auto_extend"
          @update:model-value="onVolumeChange"
        />
      </div>

      <!-- Барабан 2: Глава -->
      <div class="mpp-col">
        <span class="mpp-col-label">Глава</span>
        <XboxWheel
          :model-value="cleanRecordId(internalPoint.chapter_id)"
          :options="chapterOptions"
          placeholder="-- Глава --"
          :disabled="props.disabled || internalPoint.is_auto_extend"
          @update:model-value="onChapterChange"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { XboxWheel } from '@worldwiki/components';
import type { ManuscriptPointPickerProps, ManuscriptPoint } from './ManuscriptPointPicker.model';
import { useManuscriptPointPicker } from './useManuscriptPointPicker';

const props = withDefaults(defineProps<ManuscriptPointPickerProps>(), {
  modelValue: null,
  label: '',
  allowAutoExtend: true,
  disabled: false,
  project: ''
});

const emit = defineEmits(['update:modelValue', 'change']);

const {
  internalPoint,
  cleanRecordId,
  hasVolumes,
  volumeOptions,
  chapterOptions,
  onVolumeChange,
  onChapterChange,
  toggleAutoExtend
} = useManuscriptPointPicker(props, (event, value: ManuscriptPoint) => emit(event, value));
</script>

<style scoped src="@worldwiki/resources/styles/features/schemas/ManuscriptPointPicker.css"></style>

