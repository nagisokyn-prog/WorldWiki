<template>
  <div ref="wrapper" class="dropdown-container" :class="{ 'is-open': isOpen }">
    <div 
      ref="trigger" 
      class="status-trigger interactive-el"
      :class="{ active: isOpen }"
      @click.stop="toggle"
      @mouseenter="$emit('hover-start')"
      @mouseleave="$emit('hover-end')"
      @wheel.passive="onWheelClosed"
    >

      <span class="font-medium">{{ selectedLabel }}</span>
      <span class="arrow-icon" :class="{ rotated: isOpen }">▼</span>
    </div>

    <!-- Dropdown with Teleport: v-if ensures it only exists when open -->
    <Teleport to="body">
      <transition name="wheel-fade">
        <div 
          v-if="isOpen"
          ref="dropdownRef" 
          class="wheel-wrapper expanded"
          :class="{ 'is-horizontal': horizontal }" 
          tabindex="0"
          :style="dropdownStyle"
          @wheel.prevent="onWheel"
          @keydown="onKeydown"
        >
          <div v-if="normalizedOptions.length > 0" class="wheel-container">
            <div 
              v-for="(opt, i) in normalizedOptions" 
              :key="i"
              class="wheel-item"
              :class="{ active: i === currentIndex }"
              :style="getItemStyle(i)"
              @click.stop="select(i)"
            >
              {{ opt.label }}
            </div>
          </div>
          <div v-else class="wheel-empty-state">
            {{ t('common.noData') }}
          </div>
        </div>
      </transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { 
  useXboxWheel, 
  type XboxWheelProps, 
  type XboxWheelEmits,
  type XboxWheelOption 
} from './useXboxWheel';

export type { XboxWheelOption };

const props = withDefaults(defineProps<XboxWheelProps>(), {
  modelValue: '',
  placeholder: '',
  horizontal: false
});

const emit = defineEmits<XboxWheelEmits>();

const {
  t,
  trigger,
  wrapper,
  dropdownRef,
  isOpen,
  dropdownStyle,
  normalizedOptions,
  currentIndex,
  selectedLabel,
  toggle,
  onWheel,
  onWheelClosed,
  onKeydown,
  select,
  getItemStyle
} = useXboxWheel(props, emit);
</script>

<style src="@worldwiki/resources/styles/components/XboxWheel.css"></style>
