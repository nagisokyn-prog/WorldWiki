import { ref, computed, watch, onMounted, onUnmounted, nextTick, type CSSProperties } from 'vue';
import { useI18n } from 'vue-i18n';

export interface XboxWheelOptionObject {
  value?: string | number | null;
  label?: string;
}

export type XboxWheelOption = string | number | XboxWheelOptionObject;

export interface XboxWheelProps {
  modelValue?: string | number | null;
  options: XboxWheelOption[] | readonly XboxWheelOption[];
  placeholder?: string;
  horizontal?: boolean;
}

export interface XboxWheelEmits {
  (e: 'update:modelValue', value: string): void;
  (e: 'hover-start'): void;
  (e: 'hover-end'): void;
}

export function useXboxWheel(
  props: XboxWheelProps,
  emit: XboxWheelEmits
) {
  let t: (key: string) => string;
  try {
    t = useI18n().t;
  } catch {
    t = (key: string) => {
      if (key === 'common.selectPlaceholder') return 'Выберите...';
      if (key === 'common.noData') return 'Нет данных';
      return key;
    };
  }

  const placeholderText = computed(() => props.placeholder || t('common.selectPlaceholder'));

  const trigger = ref<HTMLElement | null>(null);
  const wrapper = ref<HTMLElement | null>(null);
  const dropdownRef = ref<HTMLElement | null>(null);
  const isOpen = ref(false);

  const dropdownStyle = ref<CSSProperties>({
    position: 'fixed',
    top: '0',
    left: '0',
    width: '0',
    zIndex: 99999
  });

  const normalizedOptions = computed(() => {
    return props.options.map((opt) => {
      if (typeof opt === 'object' && opt !== null) {
        const obj = opt as XboxWheelOptionObject;
        return { value: String(obj.value ?? ''), label: obj.label || String(obj.value ?? '') };
      }
      return { value: String(opt ?? ''), label: String(opt ?? '') };
    });
  });

  const getIndex = (val: unknown) => {
    if (val === undefined || val === null || val === '') return 0;
    const rawVal = String(val).replace(/^[^:]+:/, '');
    const i = normalizedOptions.value.findIndex(o => {
      if (o.value === val) return true;
      const rawOpt = String(o.value || '').replace(/^[^:]+:/, '');
      return rawOpt === rawVal && rawVal !== '';
    });
    return i !== -1 ? i : 0;
  };

  const currentIndex = ref(getIndex(props.modelValue));
  const wheelAcc = ref(0);
  const ITEM_HEIGHT = 44;
  const LEN = computed(() => normalizedOptions.value.length);

  watch(normalizedOptions, () => {
    currentIndex.value = getIndex(props.modelValue);
  });

  const selectedLabel = computed(() => {
    if (props.modelValue === '' || props.modelValue === null || props.modelValue === undefined) {
      return placeholderText.value;
    }
    const rawVal = String(props.modelValue).replace(/^[^:]+:/, '');
    const found = normalizedOptions.value.find(o => {
      if (o.value === props.modelValue) return true;
      const rawOpt = String(o.value || '').replace(/^[^:]+:/, '');
      return rawOpt === rawVal && rawVal !== '';
    });
    if (found) return found.label;
    const opt = normalizedOptions.value[currentIndex.value];
    if (opt && (opt.value === props.modelValue || String(opt.value).replace(/^[^:]+:/, '') === rawVal)) {
      return opt.label;
    }
    const strVal = String(props.modelValue);
    if (strVal.includes(':') || strVal.startsWith('chapter_') || strVal.startsWith('arc_') || strVal.startsWith('volume_')) {
      return placeholderText.value;
    }
    return String(props.modelValue);
  });

  const updatePosition = (force = false) => {
    if ((!isOpen.value && !force) || !trigger.value) return;
    
    const rect = trigger.value.getBoundingClientRect();
    const zoom = parseFloat(document.documentElement.style.getPropertyValue('--app-zoom')) || 1;
    
    dropdownStyle.value = {
      position: 'fixed',
      top: `${rect.bottom + 8 * zoom}px`,
      left: `${rect.left}px`,
      width: `${rect.width / zoom}px`,
      '--local-zoom': zoom,
      zIndex: 99999
    } as CSSProperties;
  };

  const open = () => {
    updatePosition(true);
    isOpen.value = true;
  };

  const close = () => {
    isOpen.value = false;
  };

  const toggle = () => {
    if (isOpen.value) close();
    else open();
  };

  const emitUpdate = () => {
    const selected = normalizedOptions.value[currentIndex.value];
    if (selected) {
      emit('update:modelValue', selected.value);
    }
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

  const select = (index: number) => {
    currentIndex.value = index;
    emitUpdate();
    setTimeout(() => close(), 150);
  };

  const onWheel = (e: WheelEvent) => {
    if (!isOpen.value) return;
    wheelAcc.value += e.deltaY;
    if (Math.abs(wheelAcc.value) > 30) {
      if (wheelAcc.value > 0) next();
      else prev();
      wheelAcc.value = 0;
    }
  };

  const onKeydown = (e: KeyboardEvent) => {
    if (!isOpen.value) return;
    if (e.key === 'ArrowDown' || (props.horizontal && e.key === 'ArrowRight')) { e.preventDefault(); next(); }
    else if (e.key === 'ArrowUp' || (props.horizontal && e.key === 'ArrowLeft')) { e.preventDefault(); prev(); }
    else if (e.key === 'Enter' || e.key === 'Escape') close();
  };

  const closeOnOutsideClick = (e: MouseEvent) => {
    if (isOpen.value) {
      const isInsideTrigger = wrapper.value && wrapper.value.contains(e.target as Node);
      const isInsideDropdown = dropdownRef.value && dropdownRef.value.contains(e.target as Node);
      if (!isInsideTrigger && !isInsideDropdown) {
        close();
      }
    }
  };

  const handleScroll = () => updatePosition();
  const handleResize = () => updatePosition();

  onMounted(() => {
    document.addEventListener('click', closeOnOutsideClick);
    window.addEventListener('scroll', handleScroll, { passive: true, capture: true });
    window.addEventListener('resize', handleResize, { passive: true });
  });

  onUnmounted(() => {
    document.removeEventListener('click', closeOnOutsideClick);
    window.removeEventListener('scroll', handleScroll, true);
    window.removeEventListener('resize', handleResize);
  });

  watch(isOpen, (val) => {
    if (val) {
      void nextTick(() => {
        updatePosition();
        dropdownRef.value?.focus();
      });
    }
  });

  watch(() => props.modelValue, (newVal) => {
    const newIndex = getIndex(newVal);
    currentIndex.value = newIndex;
  });

  const getItemStyle = (i: number) => {
    if (LEN.value === 0) return {};
    let diff = i - currentIndex.value;
    const half = Math.floor(LEN.value / 2);
    
    if (diff > half) diff -= LEN.value;
    if (diff < -half) diff += LEN.value;
    
    let scale = 1;
    let opacity = 0;
    if (diff === 0) { scale = 1.15; opacity = 1; }
    else if (Math.abs(diff) === 1) { scale = 0.9; opacity = 0.5; }
    else if (Math.abs(diff) === 2) { scale = 0.75; opacity = 0.2; }
    
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

  return {
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
    onKeydown,
    select,
    getItemStyle
  };
}
