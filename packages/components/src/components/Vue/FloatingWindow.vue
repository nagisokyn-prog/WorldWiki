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
import { ref, reactive, computed } from 'vue';
import { useI18n } from 'vue-i18n';

const props = defineProps<{
  title: string;
  isOpen: boolean;
  initialWidth?: number;
  initialHeight?: number;
  initialX?: number;
  initialY?: number;
  zIndexBase?: number;
}>();

const { t } = useI18n();

const emit = defineEmits(['close', 'focus']);

const windowRef = ref<HTMLElement | null>(null);
const pos = reactive({
  x: props.initialX ?? 100,
  y: props.initialY ?? 100,
  w: props.initialWidth ?? 850,
  h: props.initialHeight ?? 650
});

const zIndex = ref(props.zIndexBase ?? 10000);

const windowStyle = computed(() => ({
  left: `${pos.x}px`,
  top: `${pos.y}px`,
  width: `${pos.w}px`,
  height: `${pos.h}px`,
  zIndex: zIndex.value
}));

// Drag logic
let isDragging = false;
let dragOffset = { x: 0, y: 0 };

const startDrag = (e: MouseEvent) => {
  isDragging = true;
  dragOffset = { x: e.clientX - pos.x, y: e.clientY - pos.y };
  bringToFront();
  
  document.addEventListener('mousemove', handleDrag);
  document.addEventListener('mouseup', stopDrag);
};

const handleDrag = (e: MouseEvent) => {
  if (!isDragging) return;
  pos.x = e.clientX - dragOffset.x;
  pos.y = e.clientY - dragOffset.y;
};

const stopDrag = () => {
  isDragging = false;
  document.removeEventListener('mousemove', handleDrag);
  document.removeEventListener('mouseup', stopDrag);
};

// Resize logic
let isResizing = false;

const startResize = (e: MouseEvent) => {
  isResizing = true;
  bringToFront();
  
  document.addEventListener('mousemove', handleResize);
  document.addEventListener('mouseup', stopResize);
  e.preventDefault();
};

const handleResize = (e: MouseEvent) => {
  if (!isResizing) return;
  pos.w = Math.max(300, e.clientX - pos.x);
  pos.h = Math.max(200, e.clientY - pos.y);
};

const stopResize = () => {
  isResizing = false;
  document.removeEventListener('mousemove', handleResize);
  document.removeEventListener('mouseup', stopResize);
};

const bringToFront = () => {
  emit('focus');
  // Z-index management should be handled by parent or by global state
  // For now we just emit focus
};

const close = () => {
  emit('close');
};

const updateZIndex = (val: number) => {
  zIndex.value = val;
};

defineExpose({ updateZIndex });
</script>

<style scoped src="@worldwiki/resources/styles/components/FloatingWindow.css"></style>
