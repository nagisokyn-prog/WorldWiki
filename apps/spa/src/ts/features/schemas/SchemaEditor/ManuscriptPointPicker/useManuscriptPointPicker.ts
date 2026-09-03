import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { useChapterStore } from '../../../../stores/chapter.store';
import type { ManuscriptPoint, ManuscriptPointPickerProps } from './ManuscriptPointPicker.model';

export function useManuscriptPointPicker(
  props: ManuscriptPointPickerProps,
  emit: (event: 'change' | 'update:modelValue', value: ManuscriptPoint) => void
) {
  const chapterStore = useChapterStore();

  const internalPoint = ref<ManuscriptPoint>({
    volume_id: null,
    arc_id: null,
    chapter_id: null,
    is_auto_extend: false
  });

  const normalizeId = (id: unknown): string => {
    if (!id) return '';
    return String(id).trim();
  };

  const cleanRecordId = (id: unknown): string => {
    return normalizeId(id).replace(/^[^:]+:/, '');
  };

  // Последняя валидная глава в рукописи (игнорирует пустые тома и арки)
  const latestValidPoint = computed<ManuscriptPoint | null>(() => {
    const chapters = chapterStore.hierarchy?.chapters || [];
    if (chapters.length === 0) return null;
    
    const lastChapter = chapters[chapters.length - 1];
    const chapterId = normalizeId(lastChapter.id);
    const arcId = lastChapter.arc_id ? normalizeId(lastChapter.arc_id) : null;
    let volumeId = lastChapter.volume_id ? normalizeId(lastChapter.volume_id) : null;

    if (arcId && !volumeId) {
      const arcs = chapterStore.hierarchy?.arcs || [];
      const parentArc = arcs.find(a => normalizeId(a.id) === arcId || cleanRecordId(a.id) === cleanRecordId(arcId));
      if (parentArc && parentArc.volume_id) {
        volumeId = normalizeId(parentArc.volume_id);
      }
    }

    return {
      volume_id: volumeId,
      arc_id: arcId,
      chapter_id: chapterId,
      is_auto_extend: true
    };
  });

  // Парсинг входящего modelValue (поддержка и объекта, и старой строки)
  const parseIncomingValue = (val: ManuscriptPoint | string | null | undefined): ManuscriptPoint => {
    if (!val) {
      return {
        volume_id: null,
        arc_id: null,
        chapter_id: null,
        is_auto_extend: false
      };
    }

    if (typeof val === 'string') {
      const cleanVal = cleanRecordId(val);
      const chapters = chapterStore.hierarchy?.chapters || [];
      const found = chapters.find(c => cleanRecordId(c.id) === cleanVal);
      
      let arcId: string | null = null;
      let volumeId: string | null = null;

      if (found) {
        arcId = found.arc_id ? normalizeId(found.arc_id) : null;
        volumeId = found.volume_id ? normalizeId(found.volume_id) : null;
        if (arcId && !volumeId) {
          const arcs = chapterStore.hierarchy?.arcs || [];
          const parentArc = arcs.find(a => cleanRecordId(a.id) === cleanRecordId(arcId));
          if (parentArc && parentArc.volume_id) {
            volumeId = normalizeId(parentArc.volume_id);
          }
        }
      }

      return {
        volume_id: volumeId,
        arc_id: arcId,
        chapter_id: val,
        is_auto_extend: false
      };
    }

    return {
      volume_id: val.volume_id ?? null,
      arc_id: val.arc_id ?? null,
      chapter_id: val.chapter_id ?? null,
      is_auto_extend: Boolean(val.is_auto_extend)
    };
  };

  // Инициализация и синхронизация при изменении props.modelValue
  watch(
    () => props.modelValue,
    (newVal) => {
      const parsed = parseIncomingValue(newVal);
      if (
        parsed.volume_id !== internalPoint.value.volume_id ||
        parsed.arc_id !== internalPoint.value.arc_id ||
        parsed.chapter_id !== internalPoint.value.chapter_id ||
        parsed.is_auto_extend !== internalPoint.value.is_auto_extend
      ) {
        internalPoint.value = parsed;
      }
    },
    { immediate: true, deep: true }
  );

  const emitUpdate = () => {
    const payload: ManuscriptPoint = {
      volume_id: internalPoint.value.volume_id || null,
      arc_id: internalPoint.value.arc_id || null,
      chapter_id: internalPoint.value.chapter_id || null,
      is_auto_extend: Boolean(internalPoint.value.is_auto_extend)
    };
    emit('update:modelValue', payload);
    emit('change', payload);
  };

  // Опции для выпадающих списков
  const hasVolumes = computed(() => (chapterStore.hierarchy?.volumes?.length || 0) > 0);
  const hasArcs = computed(() => (chapterStore.hierarchy?.arcs?.length || 0) > 0);

  const volumeOptions = computed(() => {
    const list = (chapterStore.hierarchy?.volumes || []).map(v => ({
      value: cleanRecordId(v.id),
      label: v.title || `Том ${cleanRecordId(v.id)}`
    }));
    return [{ value: '', label: '-- Без тома --' }, ...list];
  });

  const arcOptions = computed(() => {
    const selectedVol = cleanRecordId(internalPoint.value.volume_id);
    const arcs = chapterStore.hierarchy?.arcs || [];
    const filtered = arcs.filter(a => {
      if (!selectedVol) return true;
      return cleanRecordId(a.volume_id) === selectedVol;
    });

    const list = filtered.map(a => ({
      value: cleanRecordId(a.id),
      label: a.title || `Арка ${cleanRecordId(a.id)}`
    }));
    return [{ value: '', label: '-- Без арки --' }, ...list];
  });

  const chapterOptions = computed(() => {
    const selectedArc = cleanRecordId(internalPoint.value.arc_id);
    const selectedVol = cleanRecordId(internalPoint.value.volume_id);
    const chapters = chapterStore.hierarchy?.chapters || [];

    const filtered = chapters.filter(c => {
      if (selectedArc) return cleanRecordId(c.arc_id) === selectedArc;
      if (selectedVol) return cleanRecordId(c.volume_id) === selectedVol;
      return true;
    });

    const list = filtered.map(c => ({
      value: cleanRecordId(c.id),
      label: c.title || `Глава ${cleanRecordId(c.id)}`
    }));
    return [{ value: '', label: '-- Выберите главу --' }, ...list];
  });

  // Каскадное переключение
  const onVolumeChange = (newVolId: unknown) => {
    const cleanVol = cleanRecordId(newVolId);
    internalPoint.value.volume_id = cleanVol ? `volumes:${cleanVol}` : null;

    // Проверяем, валидна ли текущая арка для выбранного тома
    if (internalPoint.value.arc_id && cleanVol) {
      const arcs = chapterStore.hierarchy?.arcs || [];
      const currentArc = arcs.find(a => cleanRecordId(a.id) === cleanRecordId(internalPoint.value.arc_id));
      if (!currentArc || cleanRecordId(currentArc.volume_id) !== cleanVol) {
        internalPoint.value.arc_id = null;
        internalPoint.value.chapter_id = null;
      }
    }
    emitUpdate();
  };

  const onArcChange = (newArcId: unknown) => {
    const cleanArc = cleanRecordId(newArcId);
    internalPoint.value.arc_id = cleanArc ? `arcs:${cleanArc}` : null;

    if (cleanArc) {
      const arcs = chapterStore.hierarchy?.arcs || [];
      const parentArc = arcs.find(a => cleanRecordId(a.id) === cleanArc);
      if (parentArc && parentArc.volume_id) {
        internalPoint.value.volume_id = normalizeId(parentArc.volume_id);
      }
    }

    // Проверяем, валидна ли текущая глава
    if (internalPoint.value.chapter_id && cleanArc) {
      const chapters = chapterStore.hierarchy?.chapters || [];
      const currentCh = chapters.find(c => cleanRecordId(c.id) === cleanRecordId(internalPoint.value.chapter_id));
      if (!currentCh || cleanRecordId(currentCh.arc_id) !== cleanArc) {
        internalPoint.value.chapter_id = null;
      }
    }
    emitUpdate();
  };

  const onChapterChange = (newChapId: unknown) => {
    const cleanChap = cleanRecordId(newChapId);
    internalPoint.value.chapter_id = cleanChap ? `chapters:${cleanChap}` : null;

    if (cleanChap) {
      const chapters = chapterStore.hierarchy?.chapters || [];
      const ch = chapters.find(c => cleanRecordId(c.id) === cleanChap);
      if (ch) {
        if (ch.arc_id) internalPoint.value.arc_id = normalizeId(ch.arc_id);
        if (ch.volume_id) internalPoint.value.volume_id = normalizeId(ch.volume_id);
      }
    }
    emitUpdate();
  };

  // Переключение тумблера Автопродления
  const toggleAutoExtend = () => {
    if (props.disabled) return;
    const newStatus = !internalPoint.value.is_auto_extend;
    internalPoint.value.is_auto_extend = newStatus;

    if (newStatus && latestValidPoint.value) {
      internalPoint.value.volume_id = latestValidPoint.value.volume_id;
      internalPoint.value.arc_id = latestValidPoint.value.arc_id;
      internalPoint.value.chapter_id = latestValidPoint.value.chapter_id;
    }
    emitUpdate();
  };

  let unlistenTauri: UnlistenFn | null = null;
  let unlistenHealed: UnlistenFn | null = null;

  const applyNewPoint = (data: { chapter_id?: string | null; arc_id?: string | null; volume_id?: string | null }) => {
    if (!internalPoint.value.is_auto_extend) return;
    if (data.chapter_id) internalPoint.value.chapter_id = normalizeId(data.chapter_id);
    if (data.arc_id !== undefined) internalPoint.value.arc_id = data.arc_id ? normalizeId(data.arc_id) : null;
    if (data.volume_id !== undefined) internalPoint.value.volume_id = data.volume_id ? normalizeId(data.volume_id) : null;
    emitUpdate();
  };

  const handleHealedEvent = (payload: { deleted_chapter_id?: string; fallback_point?: { chapter_id?: string | null; arc_id?: string | null; volume_id?: string | null } | null }) => {
    if (!payload?.deleted_chapter_id) return;
    const cleanDeleted = cleanRecordId(payload.deleted_chapter_id);
    const cleanCurrent = cleanRecordId(internalPoint.value.chapter_id);
    if (cleanDeleted && cleanDeleted === cleanCurrent) {
      if (payload.fallback_point) {
        internalPoint.value.chapter_id = payload.fallback_point.chapter_id ? normalizeId(payload.fallback_point.chapter_id) : null;
        internalPoint.value.arc_id = payload.fallback_point.arc_id ? normalizeId(payload.fallback_point.arc_id) : null;
        internalPoint.value.volume_id = payload.fallback_point.volume_id ? normalizeId(payload.fallback_point.volume_id) : null;
      } else {
        internalPoint.value.chapter_id = null;
        internalPoint.value.arc_id = null;
        internalPoint.value.volume_id = null;
      }
      emitUpdate();
    }
  };

  const handleCustomEvent = (e: Event) => {
    const customEvt = e as CustomEvent<{ chapter_id?: string; arc_id?: string; volume_id?: string }>;
    if (customEvt?.detail) {
      applyNewPoint(customEvt.detail);
    }
  };

  // Реактивный автооткат при изменении/удалении глав в иерархии
  watch(() => chapterStore.hierarchy, (hier) => {
    if (!hier || !hier.chapters) return;
    if (internalPoint.value.is_auto_extend) {
      if (latestValidPoint.value) {
        if (cleanRecordId(internalPoint.value.chapter_id) !== cleanRecordId(latestValidPoint.value.chapter_id)) {
          internalPoint.value.chapter_id = latestValidPoint.value.chapter_id;
          internalPoint.value.arc_id = latestValidPoint.value.arc_id;
          internalPoint.value.volume_id = latestValidPoint.value.volume_id;
          emitUpdate();
        }
      } else {
        internalPoint.value.chapter_id = null;
        internalPoint.value.arc_id = null;
        internalPoint.value.volume_id = null;
        emitUpdate();
      }
    } else if (internalPoint.value.chapter_id) {
      const cleanChap = cleanRecordId(internalPoint.value.chapter_id);
      const exists = hier.chapters.some(c => cleanRecordId(c.id) === cleanChap);
      if (!exists) {
        if (latestValidPoint.value) {
          internalPoint.value.chapter_id = latestValidPoint.value.chapter_id;
          internalPoint.value.arc_id = latestValidPoint.value.arc_id;
          internalPoint.value.volume_id = latestValidPoint.value.volume_id;
        } else {
          internalPoint.value.chapter_id = null;
          internalPoint.value.arc_id = null;
          internalPoint.value.volume_id = null;
        }
        emitUpdate();
      }
    }
  }, { deep: true });

  if (typeof document !== 'undefined') {
    document.addEventListener('ww:timeline-auto-extended', handleCustomEvent);
  }

  onMounted(async () => {
    try {
      unlistenTauri = await listen<{ chapter_id?: string; arc_id?: string; volume_id?: string }>(
        'ww:timeline-auto-extended',
        (event) => {
          if (event.payload) {
            applyNewPoint(event.payload);
          }
        }
      );
      unlistenHealed = await listen<{ deleted_chapter_id?: string; fallback_point?: { chapter_id?: string | null; arc_id?: string | null; volume_id?: string | null } | null }>(
        'ww:timeline-healed',
        (event) => {
          if (event.payload) {
            handleHealedEvent(event.payload);
          }
        }
      );
    } catch {
      // Игнорируем в окружении без Tauri
    }

    // Если уже включено автопродление, выставляем последнюю актуальную точку
    if (internalPoint.value.is_auto_extend && latestValidPoint.value) {
      internalPoint.value.volume_id = latestValidPoint.value.volume_id;
      internalPoint.value.arc_id = latestValidPoint.value.arc_id;
      internalPoint.value.chapter_id = latestValidPoint.value.chapter_id;
    }
  });

  onUnmounted(() => {
    document.removeEventListener('ww:timeline-auto-extended', handleCustomEvent);
    if (unlistenTauri) {
      unlistenTauri();
      unlistenTauri = null;
    }
    if (unlistenHealed) {
      unlistenHealed();
      unlistenHealed = null;
    }
  });

  return {
    internalPoint,
    cleanRecordId,
    hasVolumes,
    hasArcs,
    volumeOptions,
    arcOptions,
    chapterOptions,
    onVolumeChange,
    onArcChange,
    onChapterChange,
    toggleAutoExtend
  };
}
