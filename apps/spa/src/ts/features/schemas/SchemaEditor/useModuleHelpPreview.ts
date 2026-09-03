import { ref, computed, nextTick } from 'vue';
import { useModuleReferenceData, type SchemaFieldDef } from './useModuleReferenceData';

export interface ModuleHelpPreviewProps {
  templateKey: string;
}

export function useModuleHelpPreview(props: ModuleHelpPreviewProps) {
  const triggerEl = ref<HTMLElement | null>(null);
  const popoverEl = ref<HTMLElement | null>(null);
  const popoverStyle = ref<{ top: string; left: string; right: string }>({ top: '0px', left: '0px', right: 'auto' });

  const { getModuleUsageInfo } = useModuleReferenceData();
  const usageInfo = computed(() => getModuleUsageInfo(props.templateKey));

  const isBidiType = computed(() => props.templateKey === 'Двунаправленная связь');
  const isTimelineType = computed(() => props.templateKey === 'Базовая хронология');

  const isVisible = ref(false);
  let closeTimer: ReturnType<typeof setTimeout> | null = null;

  const isChapterField = (field: SchemaFieldDef): boolean => {
    if (field.entityType === 'chapter') return true;
    if (field.type === 'manuscript_point' || field.type === 'chapter') return true;
    const cls = (field.class || field.id || field.label || '').toLowerCase();
    return cls.includes('глава') || cls.includes('chapter') || cls === 'начальная_глава' || cls === 'конечная_глава';
  };

  const isEntityOrChapterSelect = (field: SchemaFieldDef): boolean => {
    const eType = field.entityType;
    const fClass = (field.class || field.id || field.label || '').toLowerCase();
    if (eType && eType !== '' && eType !== 'none') return true;
    if (fClass.includes('глава') || fClass.includes('chapter')) return true;
    if (fClass.includes('целевая_сущность') || fClass.includes('сущность') || fClass.includes('персонаж') || fClass.includes('государство') || fClass.includes('организаци')) {
      return true;
    }
    return false;
  };

  const getSelectOptions = (field: SchemaFieldDef): Array<{ value: string; label: string }> => {
    if (Array.isArray(field.options) && field.options.length > 0) {
      return field.options;
    }
    return [
      { value: '', label: field.placeholder || 'Выберите...' }
    ];
  };

  const scrollToExample = (idx: number) => {
    const el = document.getElementById('example-card-' + idx);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const updatePosition = () => {
    if (!triggerEl.value) return;
    const rect = triggerEl.value.getBoundingClientRect();
    const popoverWidth = 640;
    const popoverHeight = Math.min(700, window.innerHeight - 40);

    let left = rect.left - popoverWidth - 14;
    if (left < 16) {
      left = rect.right + 14;
    }
    if (left + popoverWidth > window.innerWidth - 16) {
      left = window.innerWidth - popoverWidth - 16;
    }

    let top = rect.top + rect.height / 2 - popoverHeight / 2;
    if (top < 16) top = 16;
    if (top + popoverHeight > window.innerHeight - 16) {
      top = Math.max(16, window.innerHeight - popoverHeight - 16);
    }

    popoverStyle.value = {
      top: `${Math.round(top)}px`,
      left: `${Math.round(left)}px`,
      right: 'auto'
    };
  };

  const showPopup = () => {
    if (closeTimer) {
      clearTimeout(closeTimer);
      closeTimer = null;
    }
    updatePosition();
    isVisible.value = true;
    void nextTick(() => {
      updatePosition();
    });
  };

  const hidePopup = () => {
    closeTimer = setTimeout(() => {
      isVisible.value = false;
    }, 150);
  };

  const togglePopup = () => {
    if (isVisible.value) {
      isVisible.value = false;
    } else {
      showPopup();
    }
  };

  return {
    triggerEl,
    popoverEl,
    popoverStyle,
    usageInfo,
    isBidiType,
    isTimelineType,
    isVisible,
    isChapterField,
    isEntityOrChapterSelect,
    getSelectOptions,
    scrollToExample,
    showPopup,
    hidePopup,
    togglePopup
  };
}
