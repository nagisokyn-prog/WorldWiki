import { ref, onMounted, onUnmounted, watch, computed, type PropType, shallowRef } from 'vue';
import { chapterService } from '../../../services/chapter.service';
import * as api from '../../../services/api.client';;
import { useCalendarStore } from '../../../stores/calendar.store';
import { useTimelineStore } from '../../../stores/timeline.store';

import EditorCore from '../EditorCoreTiptap/EditorCoreTiptap.vue';
import TimelinePanel from '../../timeline/Calendars/TimelinePanel/TimelinePanel.vue';
import ParticipantsPanel from '../ParticipantsPanel/ParticipantsPanel.vue';
import WowilonDrawer from '../WowilonDrawer.vue';
import ExportModal from '../Export/ExportModal.vue';
import ChapterTree from '../ChapterTree/ChapterTree.vue';
import PlanningPanel from '../PlanningPanel/PlanningPanel.vue';
import FloatingEntityEditor from '../../entities/FloatingEntityEditor.vue';

const props = defineProps({
  project: { type: String, required: true },
  controlledChapterId: { type: String, default: null },
  activeTreeNode: { type: Object as PropType<{ type: string; node: any } | null>, default: null }
});

const emit = defineEmits<{
  'open-chapter-as-tab': [chapter: any];
  'chapter-unsaved': [];
  'chapter-saved': [];
  'chapter-renamed': [payload: { id: string; title: string }];
  'scroll-change': [scroll: number];
}>();

const loading = ref(false);
const chapters = ref<any[]>([]);
const hierarchy = ref<{ volumes: any[]; arcs: any[]; chapters: any[] }>({ volumes: [], arcs: [], chapters: [] });
const currentChapterId = ref<string | undefined>(undefined);
const currentChapter = ref<any>(null);

const currentChapterNode = computed(() => {
  if (!currentChapterId.value || !hierarchy.value.chapters) return null;
  const targetId = currentChapterId.value.normalize('NFC').trim();
  return hierarchy.value.chapters.find(c => {
    const cid = (typeof c.id === 'string' ? c.id : String(c.id)).normalize('NFC').trim();
    return cid === targetId;
  }) || null;
});

const currentArc = computed(() => {
  const ch = currentChapterNode.value;
  if (!ch || !ch.arcId || !hierarchy.value.arcs) return null;
  return hierarchy.value.arcs.find(a => a.id === ch.arcId) || null;
});

const currentVolume = computed(() => {
  const ch = currentChapterNode.value;
  let volId = ch?.volumeId;
  if (!volId && currentArc.value) {
    volId = currentArc.value.volumeId;
  }
  if (!volId || !hierarchy.value.volumes) return null;
  return hierarchy.value.volumes.find(v => v.id === volId) || null;
});

const isVolumePlanOpen = ref(false);
const isArcPlanOpen = ref(false);

const volumePlanRef = ref<any>(null);
const arcPlanRef = ref<any>(null);

const addVolumePlanItem = async () => {
  if (!isVolumePlanOpen.value) {
    isVolumePlanOpen.value = true;
  }
  // Небольшая задержка, чтобы v-show отработал и компонент стал видимым перед фокусировкой
  setTimeout(() => {
    if (volumePlanRef.value) {
      volumePlanRef.value.addItem();
    }
  }, 50);
};

const addArcPlanItem = async () => {
  if (!isArcPlanOpen.value) {
    isArcPlanOpen.value = true;
  }
  setTimeout(() => {
    if (arcPlanRef.value) {
      arcPlanRef.value.addItem();
    }
  }, 50);
};

const hasUnsavedChanges = ref(false);
const localActiveTreeNode = ref<{ type: string; node: any } | undefined>(undefined);
const chaptersSidebarWidth = ref(parseInt(localStorage.getItem('chapters-sidebar-width') || '280'));
const debugError = ref<string | null>(null);

const startChaptersSidebarResize = (e: MouseEvent) => {
  const startX = e.clientX;
  const startW = chaptersSidebarWidth.value;
  document.body.style.userSelect = 'none';
  document.body.style.cursor = 'ew-resize';
  const onMove = (ev: MouseEvent) => {
    chaptersSidebarWidth.value = Math.max(180, Math.min(520, startW + (ev.clientX - startX)));
    localStorage.setItem('chapters-sidebar-width', chaptersSidebarWidth.value.toString());
  };
  const onUp = () => {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  };
  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
};


const chapterTreeRef = ref<any>(null);
const isWowilonOpen = ref(false);
const isExportModalOpen = ref(false);
const showQuickLinkHint = ref(true);
const isZenMode = ref(false);

// Состояние для плавающих редакторов
const floatingEditors = ref<Array<{ id: string; project: string; type: string; entityId: string }>>([]);

// Состояние истории
const showHistory = ref(false);
const isLoadingHistory = ref(false);
const revisions = shallowRef<any[]>([]);
const previewingRevId = ref<string | null>(null);
const maxSaves = ref(20);

// Храним оригинальные данные для восстановления после предпросмотра
const originalData = ref<{ content: any; title: string; footnotes: any } | null>(null);

const toggleHistory = () => {
  showHistory.value = !showHistory.value;
  if (showHistory.value && currentChapterId.value) {
    loadHistory();
  }
};

const loadHistory = async () => {
  if (!currentChapterId.value) return;
  try {
    isLoadingHistory.value = true;
    const history = await api.getChapterRevisions(props.project, currentChapterId.value) || [];
    revisions.value = history.map((rev: any) => ({
      ...rev,
      formattedDate: new Date(rev.created_at).toLocaleString()
    }));
  } catch (err) {
    console.error('Failed to load history:', err);
  } finally {
    isLoadingHistory.value = false;
  }
};

const previewHistory = (rev: any) => {
  if (!currentChapter.value) return;
  if (previewingRevId.value === rev.id) {
    // Отмена предпросмотра
    if (originalData.value) {
      currentChapter.value.content = originalData.value.content;
      currentChapter.value.title = originalData.value.title;
      currentChapter.value.footnotes = originalData.value.footnotes;
      originalData.value = null;
    }
    previewingRevId.value = null;
    return;
  }

  // Включение предпросмотра
  if (!originalData.value) {
    originalData.value = {
      content: currentChapter.value.content,
      title: currentChapter.value.title,
      footnotes: JSON.parse(JSON.stringify(currentChapter.value.footnotes || {}))
    };
  }

  const snap = rev.content;
  console.log('[ChaptersMain] previewHistory - rev:', rev);
  console.log('[ChaptersMain] previewHistory - snap:', snap);
  currentChapter.value.content = snap.content || snap.attributes?.content || '';
  currentChapter.value.title = snap.title || snap.attributes?.title || '';
  currentChapter.value.footnotes = snap.footnotes || snap.attributes?.footnotes || {};
  console.log('[ChaptersMain] previewHistory - set content to:', currentChapter.value.content);
  previewingRevId.value = rev.id;
};

const togglePin = async (rev: any) => {
  try {
    rev.is_pinned = !rev.is_pinned;
    await api.toggleChapterHistoryPin(rev.id, rev.is_pinned);
  } catch (err) {
    console.error('Failed to toggle pin:', err);
    rev.is_pinned = !rev.is_pinned; // revert
  }
};

const getDiffSummary = (current: any, previous: any) => {
  if (!previous) return 'Первая версия';
  const currSnap = current.content.attributes || current.content;
  const prevSnap = previous.content.attributes || previous.content;

  const changes = [];
  if (currSnap.title !== prevSnap.title) changes.push('Название');
  if (currSnap.content !== prevSnap.content) changes.push('Текст');
  if (JSON.stringify(currSnap.footnotes) !== JSON.stringify(prevSnap.footnotes)) changes.push('Сноски');

  if (changes.length > 0) {
    return `<span style="color:var(--accent)">Изменено:</span> ${changes.join(', ')}`;
  }
  return 'Нет визуальных изменений';
};

const changedFields = computed(() => {
  if (!previewingRevId.value || !originalData.value) return [];

  const currentSnap = revisions.value.find(r => r.id === previewingRevId.value);
  if (!currentSnap) return [];

  const snapData = currentSnap.content.attributes || currentSnap.content;
  const original = originalData.value;

  const changes = [];
  if (snapData.title !== original.title) changes.push('title');
  if (snapData.content !== original.content) changes.push('content');
  if (JSON.stringify(snapData.footnotes) !== JSON.stringify(original.footnotes)) changes.push('footnotes');

  return changes;
});

const toggleZenMode = () => {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(err => {
      console.error(`Zen Mode: Error entering fullscreen: ${err.message}`);
    });
  } else {
    if (document.exitFullscreen) {
      document.exitFullscreen();
    }
  }
};

const onFullscreenChange = () => {
  isZenMode.value = !!document.fullscreenElement;
  if (isZenMode.value) {
    console.log('🧘 Zen Mode activated');
  } else {
    console.log('🧘 Zen Mode deactivated');
  }
};

const rightPanelWidth = ref(320);
const isRightPanelVisible = ref(localStorage.getItem('chapters-right-panel-visible') !== 'false');
const isSaving = ref(false);
let isDragging = false;
let startX = 0;
let startWidth = 0;

let saveTimeout: any = null;
let hierarchyChangeTimeout: any = null;

// Синхронизация заголовка главы между Редактором, Деревом и Табами
watch(() => currentChapter.value?.title, (newTitle) => {
  if (!currentChapter.value || !newTitle) return;

  const id = currentChapterId.value;
  console.log('🔄 Watch Title Change:', { id, newTitle });

  // 1. Обновляем в иерархии (для дерева)
  if (hierarchy.value?.chapters) {
    const ch = hierarchy.value.chapters.find(c => {
      // Используем более гибкое сравнение, если прямое === не сработало
      return c.id === id || (String(c.id).split(':').pop() === String(id).split(':').pop());
    });

    if (ch) {
      console.log('🌳 Updating tree node:', ch.id, '->', newTitle);
      ch.title = newTitle;
    } else {
      console.warn('🌳 Tree node NOT FOUND for id:', id);
    }
  }

  // 2. Обновляем в списке глав (legacy)
  const listIdx = chapters.value.findIndex(c => c.id === id);
  if (listIdx !== -1) {
    chapters.value[listIdx].title = newTitle;
  }

  // 3. Сообщаем родителю (для табов)
  if (id) {
    console.log('📑 Emitting chapter-renamed for tabs:', { id, newTitle });
    emit('chapter-renamed', { id, title: newTitle });

    // Глобальное уведомление для синхронизации дерева (с дебаунсом)
    if (hierarchyChangeTimeout) clearTimeout(hierarchyChangeTimeout);
    hierarchyChangeTimeout = setTimeout(() => {
      console.log('🌳 Dispatching hierarchy-changed for tree sync...');
      document.dispatchEvent(new CustomEvent('ww:hierarchy-changed'));
    }, 500);
  }
});

onMounted(async () => {
  console.log('🔧 ChaptersMain.onMounted: компонент монтирован, project =', props.project);
  console.log('🔧 ChaptersMain: chapterTreeRef =', chapterTreeRef.value);
  console.log('🔧 ChaptersMain: openChapterFromTree =', typeof openChapterFromTree);
  await loadChapters();
  await useTimelineStore().init(props.project);

  // Если нам передали controlledChapterId — сразу открываем главу
  if (props.controlledChapterId) {
    await openChapter(props.controlledChapterId);
  }

  const savedWidth = localStorage.getItem('chapters-tools-panel-width');
  if (savedWidth) rightPanelWidth.value = parseInt(savedWidth);

  if (localStorage.getItem('quickLinkPanelHidden') === 'true') {
    showQuickLinkHint.value = false;
  }

  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp);
  document.addEventListener('fullscreenchange', onFullscreenChange);
  document.addEventListener('ww:toggle-chapter-right-panel', toggleRightPanel as any);
  document.addEventListener('ww:trigger-chapter-save', triggerSave as any);
  document.addEventListener('ww:hierarchy-changed', loadChapters as any);
});

// Когда родитель меняет активную вкладку — загружаем нужную главу
watch(() => props.controlledChapterId, async (newId) => {
  if (newId && newId !== currentChapterId.value) {
    await openChapter(newId);
  }
});


const triggerSave = () => {
  saveChapter();
};

const toggleRightPanel = () => {
  isRightPanelVisible.value = !isRightPanelVisible.value;
  localStorage.setItem('chapters-right-panel-visible', isRightPanelVisible.value.toString());
};

onUnmounted(() => {
  document.removeEventListener('mousemove', onMouseMove);
  document.removeEventListener('mouseup', onMouseUp);
  document.removeEventListener('fullscreenchange', onFullscreenChange);
  document.removeEventListener('ww:toggle-chapter-right-panel', toggleRightPanel as any);
  document.removeEventListener('ww:trigger-chapter-save', triggerSave as any);
  document.removeEventListener('ww:hierarchy-changed', loadChapters as any);
  document.removeEventListener('ww:chapter-renamed', handleGlobalChapterRename as any);
  if (saveTimeout) clearTimeout(saveTimeout);
});

const handleGlobalChapterRename = (e: any) => {
  const { id, title } = e.detail;
  if (currentChapter.value && String(currentChapter.value.id) === String(id)) {
    if (currentChapter.value.title !== title) {
      currentChapter.value.title = title;
    }
  }
};

onMounted(() => {
  document.addEventListener('ww:chapter-renamed', handleGlobalChapterRename as any);
});

const loadChapters = async () => {
  try {
    console.log('📚 loadChapters: загружаю иерархию для проекта', props.project);
    loading.value = true;
    hierarchy.value = await api.getChapterHierarchy(props.project);
    console.log('✅ loadChapters: иерархия загружена', hierarchy.value);
    debugError.value = null;
    loading.value = false;
  } catch (e: any) {
    const err = e?.message || String(e);
    console.error('❌ loadChapters ошибка:', err);
    debugError.value = `Ошибка загрузки иерархии: ${err}`;
    loading.value = false;
  }
};

const saveChapter = async () => {
  if (!currentChapter.value || isSaving.value) return;
  isSaving.value = true;

  // Parse participants from text automatically
  const autoParts = useTimelineStore().parseParticipants(currentChapter.value.content);
  autoParts.forEach((p: any) => {
    if (!currentChapter.value.participants.some((ep: any) => ep.id === p.id && ep.type === p.type)) {
      currentChapter.value.participants.push({ ...p, autoParsed: true });
    }
  });

  try {
    console.log('💾 saveChapter: сохраняю главу', currentChapter.value.id);
    await chapterService.save(props.project, currentChapter.value);

    hasUnsavedChanges.value = false;
    emit('chapter-saved');
    if (showHistory.value) {
      // SurrealDB event `log_chapter_revision` needs a moment to create the revision
      setTimeout(() => {
        loadHistory();
      }, 500);
    }

    const listIdx = chapters.value.findIndex(c => c.id === currentChapterId.value);
    if (listIdx !== -1) chapters.value[listIdx].title = currentChapter.value.title;
    await chapterService.updateIndex(props.project);
    document.dispatchEvent(new CustomEvent('ww:hierarchy-changed'));
    console.log('✅ saveChapter: глава сохранена');
    debugError.value = null;
  } catch (e: any) {
    const err = e?.message || String(e);
    console.error('❌ saveChapter ошибка:', err);
    debugError.value = `Ошибка сохранения: ${err}`;
  } finally {
    isSaving.value = false;
  }
};

const openChapter = async (id: string) => {
  console.log('📖 openChapter: вызван для ID', id);
  if (hasUnsavedChanges.value) {
    console.log('📖 openChapter: есть несохраненные изменения, сохраняю');
    await saveChapter();
  }
  try {
    console.log('📖 openChapter: загружаю главу через chapterService.get');
    const full = await chapterService.get(props.project, id);
    console.log('📖 openChapter: chapterService.get вернул данные:', full);
    if (!full) {
      console.warn('⚠️ Глава не найдена или удалена:', id);
      return;
    }
    if (!full.timeline_events) {
      full.timeline_events = (full as any).timelineEvents || [];
    }
    delete (full as any).timelineEvents;
    if (!full.participants) full.participants = [];
    if (!full.footnotes) full.footnotes = {};

    currentChapter.value = JSON.parse(JSON.stringify(full));
    previewingRevId.value = null;
    originalData.value = null;
    if (showHistory.value) {
      loadHistory();
    }
    console.log('📖 openChapter: currentChapter.value установлен:', currentChapter.value);
    console.log('📖 openChapter: currentChapter.title =', currentChapter.value?.title);
    currentChapterId.value = id;
    hasUnsavedChanges.value = false;
    console.log('✅ openChapter: глава полностью загружена и готова');
    console.log('✅ openChapter: title для EditorCore =', currentChapter.value?.title);
    debugError.value = null;
  } catch (e: any) {
    const err = e?.message || String(e);
    console.error('❌ openChapter ошибка:', err, e);
    debugError.value = `Ошибка загрузки главы: ${err}`;
  }
};

const onTreeNodeSelect = (nodeData: { type: string; node: any }) => {
  console.log('📖 ChaptersMain.onTreeNodeSelect: получено select-node', nodeData.type, nodeData.node.id);
  localActiveTreeNode.value = nodeData;
};

const openChapterFromTree = async (ch: any) => {
  console.log('📖 ChaptersMain.openChapterFromTree: получено событие select-chapter', ch.id, ch.title);
  localActiveTreeNode.value = { type: 'chapter', node: ch };
  // Всегда эмитируем событие - пусть родитель решает, что делать
  console.log('📖 ChaptersMain.openChapterFromTree: эмитируем open-chapter-as-tab');
  emit('open-chapter-as-tab', ch);
};

const createChapterIn = async ({ arcId, volumeId }: { arcId?: string; volumeId?: string }) => {
  await createNewChapter(arcId, volumeId);
};

const createNewChapter = async (arcId?: string, volumeId?: string) => {
  // Считаем главы для правильного номера
  const allChapters = hierarchy.value?.chapters ?? [];
  const num = allChapters.length + 1;
  const newCh = chapterService.createNew(`Глава ${num}`);
  if (arcId) newCh.arc_id = arcId;
  if (volumeId) newCh.volume_id = volumeId;

  if (num === 1) {
    try {
      const cal = await useCalendarStore().loadCalendar(props.project);
      if (cal && cal.точка_отсчета) {
        newCh.timelineEvents = [{
          date: {
            era: cal.точка_отсчета.эпоха ?? 0,
            year: cal.точка_отсчета.год ?? 1,
            month: cal.точка_отсчета.месяц ?? 0,
            day: cal.точка_отсчета.день ?? 1
          },
          time: { hour: 12, minute: 0 },
          description: "Начало истории"
        }];
      }
    } catch (e) {
      console.warn("Failed to attach default timeline event", e);
    }
  }

  await chapterService.save(props.project, newCh);
  await chapterTreeRef.value?.load();
  // Обновляем локальную иерархию
  hierarchy.value = await api.getChapterHierarchy(props.project).catch(() => hierarchy.value);
  await openChapter(newCh.id);
};

// Переименование главы из дерева
const onRenameChapter = async (chapter: any, newTitle: string) => {
  const updated = { ...chapter, title: newTitle };
  await chapterService.save(props.project, updated);
  // Если сейчас открыта эта глава — обновляем заголовок
  if (currentChapterId.value === chapter.id && currentChapter.value) {
    currentChapter.value.title = newTitle;
  }
  await chapterTreeRef.value?.load();
};

// Удаление главы из контекстного меню дерева (confirm уже был в ChapterTree)
const onDeleteChapter = (original: any, multi: boolean) => {
  if (multi) return;
  deleteChapter(original.id);
};

const deleteChapter = async (id: string) => {
  await chapterService.delete(props.project, id);
  if (currentChapterId.value === id) {
    currentChapterId.value = undefined;
    currentChapter.value = null;
    localActiveTreeNode.value = undefined;
  }
  await chapterTreeRef.value?.load();
};

const markUnsaved = () => {
  hasUnsavedChanges.value = true;
  emit('chapter-unsaved');
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => saveChapter(), 2000);
};

watch(showQuickLinkHint, (val) => {
  localStorage.setItem('quickLinkPanelHidden', (!val).toString());
});

// Watch для управляемого открытия главы через prop (вкладка)
watch(() => props.controlledChapterId, async (id) => {
  console.log('📖 ChaptersMain: controlledChapterId изменился на', id);
  if (id) {
    console.log('📖 ChaptersMain: вызываю openChapter для', id);
    await openChapter(id);
  }
}, { immediate: true });

// Синхронизация с деревом из внешнего мира (Universal Sidebar)
watch(() => props.activeTreeNode, (node) => {
  if (node) {
    console.log('📖 ChaptersMain: внешнее уведомление о смене узла в дереве', node.type, node.node.id);
    localActiveTreeNode.value = node;
  } else {
    localActiveTreeNode.value = undefined;
    if (!props.controlledChapterId) {
      currentChapter.value = null;
      currentChapterId.value = undefined;
    }
  }
}, { immediate: true });

// Handle opening entity in floating editor
const handleOpenEntity = (data: { type: string, id: string }) => {
  try {
    const editorId = `${data.type}-${data.id}-${Date.now()}`;
    floatingEditors.value.push({
      id: editorId,
      project: props.project,
      type: data.type,
      entityId: data.id
    });
    console.log('[ChaptersMain] Открыл редактор сущности:', data.type, data.id);
  } catch (e) {
    console.error('Ошибка открытия редактора сущности:', e);
  }
};

const closeFloatingEditor = (editorId: string) => {
  const idx = floatingEditors.value.findIndex(e => e.id === editorId);
  if (idx !== -1) {
    floatingEditors.value.splice(idx, 1);
  }
};

const loadHierarchy = async () => {
  console.log('🌳 ChaptersMain.loadHierarchy: загружаю иерархию для проекта', props.project);
  try {
    const data = await api.getChapterHierarchy(props.project);
    hierarchy.value = data;
    console.log('🌳 ChaptersMain.loadHierarchy: загружено', data.chapters.length, 'глав');
  } catch (e) {
    console.error('❌ ChaptersMain.loadHierarchy ошибка:', e);
  }
};

onMounted(async () => {
  console.log('🚀 ChaptersMain onMounted');
  await loadHierarchy();
  document.addEventListener('ww:hierarchy-changed', loadHierarchy);
});

onUnmounted(() => {
  document.removeEventListener('ww:hierarchy-changed', loadHierarchy);
});

const handleExport = (exportData: any) => {
  console.log('Экспорт', exportData);
  alert(`Начат экспорт ${exportData.chapterIds.length} глав в формат ${exportData.format}...`);
};

const handleScrollChange = (scroll: number) => {
  if (currentChapter.value) {
    currentChapter.value.scrollPos = scroll;
  }
  emit('scroll-change', scroll);
};

// Right Panel Resizing Logic
const startResize = (e: MouseEvent) => {
  isDragging = true;
  startX = e.clientX;
  startWidth = rightPanelWidth.value;
  document.body.style.cursor = 'col-resize';
  document.body.style.userSelect = 'none';
};

const onMouseMove = (e: MouseEvent) => {
  if (!isDragging) return;
  const delta = startX - e.clientX;
  const newW = Math.max(200, Math.min(600, startWidth + delta));
  rightPanelWidth.value = newW;
};

const onMouseUp = () => {
  if (isDragging) {
    isDragging = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    localStorage.setItem('chapters-tools-panel-width', rightPanelWidth.value.toString());
  }
};

// Горячие клавиши для правой панели (Ctrl+Alt+B) - ОБРАБОТАНО В CommandPalette/QuickOpen
// Слушатель события для синхронизации
const handleToggleRightPanel = () => {
  const isHidden = localStorage.getItem('chapters-right-panel-visible') === 'false';
  isRightPanelVisible.value = !isHidden;
};

// Слушатель события для синхронизации структуры
const handleToggleStructure = () => {
  // Это событие слушает EditorCoreTiptap
  document.dispatchEvent(new CustomEvent('ww:structure-toggled'));
};

onMounted(() => {
  document.addEventListener('ww:toggle-right-panel', handleToggleRightPanel);
  document.addEventListener('ww:toggle-structure', handleToggleStructure);
});

onUnmounted(() => {
  document.removeEventListener('ww:toggle-right-panel', handleToggleRightPanel);
  document.removeEventListener('ww:toggle-structure', handleToggleStructure);
});
