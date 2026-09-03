<template>
  <Teleport to="body">
    <div 
      v-if="isOpen"
      ref="windowRef"
      class="floating-window-vue glass-panel"
      :style="windowStyle"
      @mousedown="bringToFront"
    >
      <!-- Header / Drag Handle -->
      <div class="window-header" @mousedown="startDrag">
        <div class="header-left">
          <slot name="icon"><i class="fas fa-window-maximize"></i></slot>
          <span class="window-title">{{ title }}</span>
        </div>
        <div class="header-actions">
          <button class="action-btn close-btn" :title="t('common.closeWindow')" @click.stop="close">&times;</button>
        </div>
      </div>

      <!-- Content Area -->
      <div class="window-content">
        <slot></slot>
      </div>

      <!-- Resize Handle -->
      <div class="resize-handle" @mousedown.stop="startResize"></div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { 
  useFloatingWindow, 
  type FloatingWindowProps, 
  type FloatingWindowEmits 
} from './useFloatingWindow';

const props = defineProps<FloatingWindowProps>();
const emit = defineEmits<FloatingWindowEmits>();

const {
  t,
  windowRef,
  windowStyle,
  startDrag,
  startResize,
  bringToFront,
  close,
  updateZIndex
} = useFloatingWindow(props, emit);

defineExpose({ updateZIndex });
</script>

<style scoped src="@worldwiki/resources/styles/components/FloatingWindow.css"></style>
