<template>
  <div class="dropdown-container" ref="wrapper" :style="{ zIndex: isOpen ? 10005 : 1000 }">
    <div 
      class="status-trigger interactive-el" 
      :class="{ active: isOpen }"
      @click.stop="toggle"
      @mouseenter="$emit('hover-start')"
      @mouseleave="$emit('hover-end')"
      ref="trigger"
    >
      <span style="font-weight: 500;">{{ selectedLabel }}</span>
      <span class="arrow-icon" :class="{ rotated: isOpen }">▼</span>
    </div>

    <!-- Dropdown with Teleport: v-if ensures it only exists when open -->
    <Teleport to="body">
      <transition name="wheel-fade">
        <div 
          v-if="isOpen"
          class="wheel-wrapper expanded" 
          :class="{ 'is-horizontal': horizontal }"
          ref="dropdownRef" 
          tabindex="0"
          @wheel.prevent="onWheel"
          @keydown="onKeydown"
          :style="dropdownStyle"
        >
          <div class="wheel-container" v-if="normalizedOptions.length > 0">
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
          <div v-else style="padding: 20px; text-align: center; color: var(--text-muted); padding-top: 100px;">
            Нет данных
          </div>
        </div>
      </transition>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue';

const props = defineProps({
  modelValue: {
    type: [String, Number],
    default: ''
  },
  options: {
    type: Array,
    required: true
  },
  placeholder: {
    type: String,
    default: 'Выберите...'
  },
  horizontal: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['update:modelValue', 'hover-start', 'hover-end']);

const trigger = ref(null);
const wrapper = ref(null);
const dropdownRef = ref(null);
const isOpen = ref(false);

const dropdownStyle = ref({
  position: 'fixed',
  top: '0',
  left: '0',
  width: '0',
  zIndex: 99999
});

const normalizedOptions = computed(() => {
  return props.options.map(opt => {
    if (typeof opt === 'object' && opt !== null) {
      return { value: opt.value, label: opt.label || opt.value };
    }
    return { value: opt, label: opt };
  });
});

const getIndex = (val) => {
  const i = normalizedOptions.value.findIndex(o => o.value === val);
  return i !== -1 ? i : 0;
};

const currentIndex = ref(getIndex(props.modelValue));
const wheelAcc = ref(0);
const ITEM_HEIGHT = 44;
const LEN = computed(() => normalizedOptions.value.length);

const selectedLabel = computed(() => {
  const opt = normalizedOptions.value[currentIndex.value];
  if (opt) return opt.label;
  return props.modelValue !== '' && props.modelValue !== null && props.modelValue !== undefined ? props.modelValue : props.placeholder;
});

const toggle = () => {
  if (isOpen.value) close();
  else open();
};

const open = () => {
  isOpen.value = true;
};

const close = () => {
  isOpen.value = false;
};

const updatePosition = () => {
  if (!isOpen.value || !trigger.value) return;
  
  const rect = trigger.value.getBoundingClientRect();
  dropdownStyle.value = {
    position: 'fixed',
    top: `${rect.bottom + 8}px`,
    left: `${rect.left}px`,
    width: `${rect.width}px`,
    zIndex: 99999
  };
};

onMounted(() => {
  document.addEventListener('click', closeOnOutsideClick);
  window.addEventListener('scroll', updatePosition, true);
  window.addEventListener('resize', updatePosition);
});

onUnmounted(() => {
  document.removeEventListener('click', closeOnOutsideClick);
  window.removeEventListener('scroll', updatePosition, true);
  window.removeEventListener('resize', updatePosition);
});

watch(isOpen, (val) => {
  if (val) {
    nextTick(() => {
      updatePosition();
      dropdownRef.value?.focus();
    });
  }
});

const onWheel = (e) => {
  if (!isOpen.value) return;
  wheelAcc.value += e.deltaY;
  if (Math.abs(wheelAcc.value) > 30) {
    if (wheelAcc.value > 0) next();
    else prev();
    wheelAcc.value = 0;
  }
};

const onKeydown = (e) => {
  if (!isOpen.value) return;
  if (e.key === 'ArrowDown' || (props.horizontal && e.key === 'ArrowRight')) { e.preventDefault(); next(); }
  else if (e.key === 'ArrowUp' || (props.horizontal && e.key === 'ArrowLeft')) { e.preventDefault(); prev(); }
  else if (e.key === 'Enter' || e.key === 'Escape') close();
};

const next = () => {
  if (LEN.value === 0) return;
  currentIndex.value = (currentIndex.value + 1) % LEN.value;
  emitUpdate();
};

const prev = () => {
  if (LEN.value === 0) return;
  currentIndex.value = (currentIndex.value - 1 + LEN.value) % LEN.value;
  emitUpdate();
};
const select = (index) => {
  currentIndex.value = index;
  emitUpdate();
  setTimeout(() => close(), 150);
};

const emitUpdate = () => {
  const selected = normalizedOptions.value[currentIndex.value];
  if (selected) {
    emit('update:modelValue', selected.value);
  }
};

const closeOnOutsideClick = (e) => {
  if (isOpen.value) {
    const isInsideTrigger = wrapper.value && wrapper.value.contains(e.target);
    const isInsideDropdown = dropdownRef.value && dropdownRef.value.contains(e.target);
    if (!isInsideTrigger && !isInsideDropdown) {
      close();
    }
  }
};

watch(() => props.modelValue, (newVal) => {
  const newIndex = getIndex(newVal);
  currentIndex.value = newIndex;
});

const getItemStyle = (i) => {
  if (LEN.value === 0) return {};
  let diff = i - currentIndex.value;
  const half = Math.floor(LEN.value / 2);
  
  if (diff > half) diff -= LEN.value;
  if (diff < -half) diff += LEN.value;
  
  let scale = 1, opacity = 1;
  if (diff === 0) { scale = 1.15; opacity = 1; }
  else if (Math.abs(diff) === 1) { scale = 0.9; opacity = 0.5; }
  else if (Math.abs(diff) === 2) { scale = 0.75; opacity = 0.2; }
  else { opacity = 0; }
  
  if (props.horizontal) {
    return {
      transform: `translateX(${diff * 100}px) scale(${scale})`,
      opacity: opacity,
      zIndex: 10 - Math.abs(diff),
      left: '50%',
      marginLeft: '-50px',
      width: '100px'
    };
  }
  
  return {
    transform: `translateY(${diff * ITEM_HEIGHT}px) scale(${scale})`,
    opacity: opacity,
    zIndex: 10 - Math.abs(diff)
  };
};
</script>

<style scoped>
.wheel-wrapper {
  margin: 0;
  height: 280px; /* Force height since we use v-if now */
  opacity: 1;    /* Force opacity since we use v-if now */
  pointer-events: auto;
}

.wheel-fade-enter-active, .wheel-fade-leave-active {
  transition: opacity 0.3s, transform 0.3s;
}
.wheel-fade-enter-from, .wheel-fade-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

/* Horizontal Mode Overrides */
.wheel-wrapper.is-horizontal {
  height: 80px !important; 
}
.wheel-wrapper.is-horizontal::after {
  top: 10px !important;
  bottom: 10px !important;
  left: 50% !important;
  width: 100px !important;
  height: auto !important;
  margin-top: 0 !important;
  margin-left: -50px !important;
  border-top: none !important;
  border-bottom: none !important;
  border-left: 1px solid var(--glass-highlight) !important;
  border-right: 1px solid var(--glass-highlight) !important;
}
.is-horizontal .wheel-container {
  height: 100% !important;
}
</style>
