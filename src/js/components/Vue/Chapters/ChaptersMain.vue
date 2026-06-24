<template>
  <div class="chapters-view-container" :class="{ 'zen-mode-active': isZenMode }" style="display: flex; height: 100%; overflow: hidden; color: var(--text-main);">
    
    <!-- MAIN AREA -->
    <div v-if="currentChapter" style="flex: 1; display: flex; overflow: hidden;">
      
      <!-- Editor -->
      <EditorCore
        :project="project"
        v-model:title="currentChapter.title"
        v-model:content="currentChapter.content"
        v-model:footnotesData="currentChapter.footnotes"
        :hasUnsavedChanges="hasUnsavedChanges"
        :initialScrollPos="currentChapter.scrollPos || 0"
        @change="markUnsaved"
        @save="saveChapter"
        @openEntity="handleOpenEntity"
        @scroll-change="handleScrollChange"
      />

      <!-- Right Panel Resizer -->
      <div v-if="isRightPanelVisible" class="panel-resize-handle" @mousedown="startResize" style="width: 4px; cursor: col-resize; background: transparent; transition: background 0.2s;"></div>

      <!-- Right Panel -->
      <div v-if="isRightPanelVisible" class="chapter-right-panel" :style="{ width: rightPanelWidth + 'px' }" style="background: rgba(0,0,0,0.15); border-left: 1px solid var(--border-color); display: flex; flex-direction: column; overflow: hidden; flex-shrink: 0;">

        <!-- Том или Арка выбрана: показываем только план -->
        <div v-if="activeTreeNode && activeTreeNode.type !== 'chapter'" style="flex: 1; overflow: hidden; display: flex; flex-direction: column;">
          <PlanningPanel
            :project="project"
            :parent-type="activeTreeNode.type"
            :parent-id="activeTreeNode.node.id"
            :parent-title="activeTreeNode.node.title"
          />
        </div>

        <!-- Глава открыта: таймлайн → участники → план -->
        <div v-else-if="currentChapter" style="padding: 20px; flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 0;">
          <TimelinePanel
            :project="project"
            v-model:events="currentChapter.timelineEvents"
            @change="markUnsaved"
          />
          <ParticipantsPanel
            :project="project"
            v-model:participants="currentChapter.participants"
            @change="markUnsaved"
          />
          <div class="parent-plans-container" style="display: flex; flex-direction: column; gap: 8px; margin-top: 10px;">
            <!-- План тома -->
            <div v-if="currentVolume" class="parent-plan-accordion" style="background: var(--bg-input); border: 1px solid var(--border-color); border-radius: 8px; overflow: hidden; margin: 0 14px;">
              <div class="accordion-header" @click="isVolumePlanOpen = !isVolumePlanOpen" style="cursor: pointer; padding: 8px 12px; display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.03); transition: background 0.2s;">
                <span style="font-size: 12px; font-weight: 600; color: var(--text-main); display: flex; align-items: center; gap: 6px;"><i class="fas fa-book" style="color: var(--accent);"></i> План тома: {{ currentVolume.title }}</span>
                <div style="display: flex; align-items: center; gap: 8px;">
                  <button @click.stop="addVolumePlanItem" style="background: none; border: none; color: var(--accent); cursor: pointer; padding: 2px 6px; border-radius: 4px; font-weight: bold; font-size: 14px; transition: background 0.2s;" class="add-from-header-btn">+</button>
                  <span style="font-size: 10px; color: var(--text-muted); transition: transform 0.2s;" :style="{ transform: isVolumePlanOpen ? 'rotate(180deg)' : 'rotate(0)' }">▼</span>
                </div>
              </div>
              <div v-show="isVolumePlanOpen" class="accordion-body" style="border-top: 1px solid var(--border-color); height: 200px; min-height: 100px; max-height: 600px; resize: vertical; overflow-y: auto; display: flex; flex-direction: column;">
                <PlanningPanel
                  ref="volumePlanRef"
                  :project="project"
                  parent-type="volume"
                  :parent-id="currentVolume.id"
                  :parent-title="currentVolume.title"
                />
              </div>
            </div>

            <!-- План арки -->
            <div v-if="currentArc" class="parent-plan-accordion" style="background: var(--bg-input); border: 1px solid var(--border-color); border-radius: 8px; overflow: hidden; margin: 0 14px;">
              <div class="accordion-header" @click="isArcPlanOpen = !isArcPlanOpen" style="cursor: pointer; padding: 8px 12px; display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.03); transition: background 0.2s;">
                <span style="font-size: 12px; font-weight: 600; color: var(--text-main); display: flex; align-items: center; gap: 6px;"><i class="fas fa-bookmark" style="color: var(--accent);"></i> План арки: {{ currentArc.title }}</span>
                <div style="display: flex; align-items: center; gap: 8px;">
                  <button @click.stop="addArcPlanItem" style="background: none; border: none; color: var(--accent); cursor: pointer; padding: 2px 6px; border-radius: 4px; font-weight: bold; font-size: 14px; transition: background 0.2s;" class="add-from-header-btn">+</button>
                  <span style="font-size: 10px; color: var(--text-muted); transition: transform 0.2s;" :style="{ transform: isArcPlanOpen ? 'rotate(180deg)' : 'rotate(0)' }">▼</span>
                </div>
              </div>
              <div v-show="isArcPlanOpen" class="accordion-body" style="border-top: 1px solid var(--border-color); height: 200px; min-height: 100px; max-height: 600px; resize: vertical; overflow-y: auto; display: flex; flex-direction: column;">
                <PlanningPanel
                  ref="arcPlanRef"
                  :project="project"
                  parent-type="arc"
                  :parent-id="currentArc.id"
                  :parent-title="currentArc.title"
                />
              </div>
            </div>

            <!-- План главы -->
            <div v-if="currentChapterId" style="background: var(--bg-input); border: 1px solid var(--border-color); border-radius: 8px; overflow: hidden; margin: 0 14px 14px 14px; height: 300px; min-height: 150px; max-height: 800px; resize: vertical; display: flex; flex-direction: column;">
              <div class="accordion-header" style="padding: 8px 12px; display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.03); border-bottom: 1px solid var(--border-color);">
                <span style="font-size: 12px; font-weight: 600; color: var(--text-main); display: flex; align-items: center; gap: 6px;"><i class="fas fa-file-alt" style="color: var(--accent);"></i> План главы</span>
              </div>
              <PlanningPanel
                :project="project"
                parent-type="chapter"
                :parent-id="currentChapterId"
                :parent-title="currentChapter?.title"
              />
            </div>
          </div>
        </div>

        <!-- Ничего не выбрано -->
        <div v-else style="flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; color:var(--text-muted); font-size:13px; padding:20px; text-align:center; gap:10px;">
          <i class="fas fa-hand-pointer" style="font-size:28px; opacity:0.2;"></i>
          Выберите главу, арку или том
        </div>

      </div>
    </div>
    
    <div v-else class="empty-state" style="flex: 1; display: flex; justify-content: center; align-items: center; color: var(--text-muted); flex-direction: column;">
      <div style="font-size: 48px; margin-bottom: 16px; opacity: 0.2;">📖</div>
      <div style="font-size: 16px;">Выберите главу для редактирования</div>
    </div>

    <!-- Floating UI Elements -->
    <button v-show="!isWowilonOpen" class="wowilon-toggle-btn" @click="isWowilonOpen = true" style="position: fixed; bottom: 20px; right: 20px; width: 44px; height: 44px; border-radius: 50%; background: var(--accent); color: white; border: none; font-size: 20px; cursor: pointer; box-shadow: 0 4px 12px rgba(0,0,0,0.3); z-index: 999;">
      <i class="fas fa-robot"></i>
    </button>

    <div v-if="showQuickLinkHint" class="quick-link-info-panel" style="position: fixed; bottom: 80px; right: 20px; width: 320px; background: var(--bg-panel); border: 1px solid var(--border-color); border-radius: 12px; z-index: 999; padding: 15px; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
      <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
        <strong style="color: var(--accent);"><i class="fas fa-bolt"></i> Быстрые ссылки Ctrl+Q</strong>
        <button @click="showQuickLinkHint = false" style="background:none; border:none; color:var(--text-muted); cursor:pointer;">✕</button>
      </div>
      <ol style="margin: 0; padding-left: 20px; font-size: 13px; color: var(--text-main);">
        <li>Напишите текст в квадратных скобках: <code>[Имя]</code></li>
        <li>Установите курсор после скобок</li>
        <li>Нажмите <kbd>Ctrl+Q</kbd></li>
      </ol>
    </div>

    <!-- Кнопка-кружок для показа подсказки -->
    <button v-if="!showQuickLinkHint" @click="showQuickLinkHint = true" class="quick-link-hint-circle" title="Показать подсказку Ctrl+Q" style="position: fixed; bottom: 75px; right: 20px; width: 44px; height: 44px; border-radius: 50%; background: #667eea; color: white; font-size: 26px; font-weight: bold; border: none; box-shadow: 0 4px 16px rgba(102,126,234,0.18); display: flex; align-items: center; justify-content: center; cursor: pointer; z-index: 998; transition: all 0.2s;">
      ?
    </button>

    <!-- Modals & Drawers -->
    <WowilonDrawer :is-open="isWowilonOpen" @close="isWowilonOpen = false" />
    
    <ExportModal 
      :is-open="isExportModalOpen" 
      :all-chapters="chapters"
      :current-chapter-id="currentChapterId || undefined"
      @close="isExportModalOpen = false"
      @export="handleExport"
    />

    <!-- Floating Entity Editors -->
    <FloatingEntityEditor
      v-for="editor in floatingEditors"
      :key="editor.id"
      :project="editor.project"
      :entity-type="editor.type"
      :entity-id="editor.entityId"
      :is-open="true"
      @close="closeFloatingEditor(editor.id)"
      @focus="() => {}"
      @saved="() => {}"
    />

    <!-- Debug Panel -->
    <div v-if="debugError" style="position: fixed; top: 20px; right: 20px; width: 300px; background: #ff6b6b; color: white; padding: 16px; border-radius: 8px; z-index: 9999; font-family: monospace; font-size: 12px;">
      <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
        <strong>⚠️ Ошибка</strong>
        <button @click="debugError = null" style="background: none; border: none; color: white; cursor: pointer;">✕</button>
      </div>
      <div style="white-space: pre-wrap; word-break: break-all;">{{ debugError }}</div>
      <div style="margin-top: 8px; opacity: 0.8;">Проект: {{ project }}</div>
    </div>

  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, computed, type PropType } from 'vue';
import { chapterService } from '../../../services/chapter.service';
import { timelineService } from '../../../services/timeline.service';
import { apiService } from '../../../services/api.service';

import EditorCore from './EditorCoreTiptap.vue';
import TimelinePanel from './TimelinePanel.vue';
import ParticipantsPanel from './ParticipantsPanel.vue';
import WowilonDrawer from './WowilonDrawer.vue';
import ExportModal from './ExportModal.vue';
import ChapterTree from './ChapterTree.vue';
import PlanningPanel from './PlanningPanel.vue';
import FloatingEntityEditor from '../FloatingEntityEditor.vue';

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
const activeTreeNode = ref<{ type: string; node: any } | undefined>(undefined);
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
  await timelineService.init(props.project);
  
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
  document.addEventListener('ww:toggle-chapter-right-panel', toggleRightPanel as EventListener);
  document.addEventListener('ww:trigger-chapter-save', triggerSave as EventListener);
  document.addEventListener('ww:hierarchy-changed', loadChapters as EventListener);
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
  document.removeEventListener('ww:toggle-chapter-right-panel', toggleRightPanel as EventListener);
  document.removeEventListener('ww:trigger-chapter-save', triggerSave as EventListener);
  document.removeEventListener('ww:hierarchy-changed', loadChapters as EventListener);
  if (saveTimeout) clearTimeout(saveTimeout);
});

const loadChapters = async () => {
  try {
    console.log('📚 loadChapters: загружаю иерархию для проекта', props.project);
    loading.value = true;
    hierarchy.value = await apiService.getHierarchy(props.project);
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
  const autoParts = timelineService.parseParticipants(currentChapter.value.content);
  autoParts.forEach(p => {
    if (!currentChapter.value.participants.some((ep: any) => ep.id === p.id && ep.type === p.type)) {
      currentChapter.value.participants.push({ ...p, autoParsed: true });
    }
  });
  
  try {
    console.log('💾 saveChapter: сохраняю главу', currentChapter.value.id);
    await chapterService.save(props.project, currentChapter.value);
    
    hasUnsavedChanges.value = false;
    emit('chapter-saved');
    
    const listIdx = chapters.value.findIndex(c => c.id === currentChapterId.value);
    if (listIdx !== -1) chapters.value[listIdx].title = currentChapter.value.title;
    await chapterService.updateIndex(props.project);
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
    if (!full.timelineEvents) full.timelineEvents = [];
    if (!full.participants) full.participants = [];
    if (!full.footnotes) full.footnotes = {};
    
    currentChapter.value = JSON.parse(JSON.stringify(full));
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
  activeTreeNode.value = nodeData;
};

const openChapterFromTree = async (ch: any) => {
  console.log('📖 ChaptersMain.openChapterFromTree: получено событие select-chapter', ch.id, ch.title);
  activeTreeNode.value = { type: 'chapter', node: ch };
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
  await chapterService.save(props.project, newCh);
  await chapterTreeRef.value?.load();
  // Обновляем локальную иерархию
  hierarchy.value = await apiService.getHierarchy(props.project).catch(() => hierarchy.value);
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
const onDeleteChapter = async (chapter: any) => {
  await chapterService.delete(props.project, chapter.id);
  if (currentChapterId.value === chapter.id) {
    currentChapterId.value = undefined;
    currentChapter.value = null;
    activeTreeNode.value = undefined;
  }
  await chapterTreeRef.value?.load();
};

const deleteChapter = async (id: string) => {
  if (!confirm('Удалить главу?')) return;
  await chapterService.delete(props.project, id);
  if (currentChapterId.value === id) {
    currentChapterId.value = undefined;
    currentChapter.value = null;
  }
  chapterTreeRef.value?.load();
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
    activeTreeNode.value = node;
  } else {
    activeTreeNode.value = undefined;
    if (!props.controlledChapterId) {
      currentChapter.value = null;
      currentChapterId.value = undefined;
    }
  }
}, { immediate: true });

// Handle opening entity in floating editor
const handleOpenEntity = (data: {type: string, id: string}) => {
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
    const data = await apiService.getHierarchy(props.project);
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
</script>

<style scoped>
.chapter-item:hover { background: rgba(255,255,255,0.05); }
.chapter-item.active { background: rgba(139, 92, 246, 0.15); border-color: rgba(139, 92, 246, 0.4); }
.btn-icon:hover { color: var(--accent) !important; }

/* ── Ресайзеры ──────────────────────────────────────── */
.chapters-sidebar-resize,
.panel-resize-handle {
  flex-shrink: 0;
  background: transparent;
  position: relative;
  transition: background 0.15s;
  z-index: 10;
}

/* Левый сайдбар — горизонтальный ресайзер */
.chapters-sidebar-resize {
  width: 4px;
  cursor: ew-resize;
}
.chapters-sidebar-resize::after {
  content: '';
  position: absolute;
  top: 50%; left: 50%;
  transform: translate(-50%, -50%);
  width: 2px; height: 48px;
  border-radius: 2px;
  background: rgba(139,92,246,0);
  transition: background 0.15s, height 0.15s;
}
.chapters-sidebar-resize:hover { background: rgba(139,92,246,0.08); }
.chapters-sidebar-resize:hover::after { background: rgba(139,92,246,0.7); height: 64px; }
.chapters-sidebar-resize:active { background: rgba(139,92,246,0.18); }

/* Правая панель — вертикальный ресайзер */
.panel-resize-handle {
  width: 4px;
  cursor: col-resize;
}
.panel-resize-handle::after {
  content: '';
  position: absolute;
  top: 50%; left: 50%;
  transform: translate(-50%, -50%);
  width: 2px; height: 48px;
  border-radius: 2px;
  background: rgba(139,92,246,0);
  transition: background 0.15s, height 0.15s;
}
.panel-resize-handle:hover { background: rgba(139,92,246,0.08); }
.panel-resize-handle:hover::after { background: rgba(139,92,246,0.7); height: 64px; }
.panel-resize-handle:active { background: rgba(139,92,246,0.18); }

/* ZEN MODE STYLES */
.zen-mode-active {
  background: #000000 !important;
}

.zen-mode-active .chapters-sidebar-resize,
.zen-mode-active .panel-resize-handle,
.zen-mode-active .chapter-right-panel,
.zen-mode-active .wowilon-toggle-btn,
.zen-mode-active .quick-link-hint-circle,
.zen-mode-active .quick-link-info-panel {
  display: none !important;
}

.zen-mode-active .chapters-sidebar {
  width: 60px !important;
  opacity: 0.3;
  transition: all 0.5s ease;
  border-right: 1px solid rgba(255,255,255,0.05) !important;
}

.zen-mode-active .chapters-sidebar:hover {
  width: 280px !important;
  opacity: 1;
}

.zen-mode-active .chapters-sidebar .sidebar-header h2,
.zen-mode-active .chapters-sidebar .sidebar-header .btn-icon:not([title*="Zen"]) {
  display: none;
}

.zen-mode-active .chapters-sidebar:hover .sidebar-header h2,
.zen-mode-active .chapters-sidebar:hover .sidebar-header .btn-icon {
  display: flex;
}

.zen-mode-active :deep(.editor-container) {
  max-width: 900px;
  margin: 0 auto;
  border: none !important;
  background: transparent !important;
}

.zen-mode-active :deep(.toastui-editor-defaultUI) {
  border: none !important;
}
</style>

