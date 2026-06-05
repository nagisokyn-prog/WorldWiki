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
          <button class="action-btn close-btn" @click.stop="close" title="Закрыть">&times;</button>
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
import { ref, reactive, onMounted, onUnmounted, computed } from 'vue';

const props = defineProps<{
  title: string;
  isOpen: boolean;
  initialWidth?: number;
  initialHeight?: number;
  initialX?: number;
  initialY?: number;
  zIndexBase?: number;
}>();

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

<style scoped>
.floating-window-vue {
  position: fixed;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
  background: var(--bg-panel, #1e1e2f);
  backdrop-filter: blur(20px);
  /* Убираем задержку при перетаскивании */
  will-change: left, top, width, height;
  backface-visibility: hidden;
  transform: translateZ(0);
  /* ВАЖНО: Отключаем transition из glass-panel */
  transition: none !important;
}

.window-header {
  height: 42px;
  padding: 0 16px;
  background: rgba(0, 0, 0, 0.3);
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: move;
  user-select: none;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--text-main);
  font-size: 13px;
  font-weight: 600;
}

.header-left i {
  color: var(--accent);
  font-size: 14px;
}

.header-actions {
  display: flex;
  gap: 8px;
}

.action-btn {
  background: none;
  border: none;
  color: var(--text-muted);
  font-size: 24px;
  line-height: 1;
  cursor: pointer;
  padding: 0 4px;
}

.close-btn:hover {
  color: #ef4444;
  transform: scale(1.1);
  transition: all 0.2s;
}

.window-content {
  flex: 1;
  overflow: hidden;
  position: relative;
  display: flex;
  flex-direction: column;
}

.resize-handle {
  position: absolute;
  bottom: 0;
  right: 0;
  width: 16px;
  height: 16px;
  cursor: se-resize;
  background: linear-gradient(135deg, transparent 50%, rgba(255,255,255,0.1) 50%);
  z-index: 10;
}

.resize-handle:hover {
  background: linear-gradient(135deg, transparent 50%, var(--accent) 50%);
}
</style>
