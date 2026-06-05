<template>
  <div class="chapter-tree" tabindex="0" @keydown="onTreeKeydown" @click.self="clearSelection(); entitySelection.clearSelection()">
    <!-- Шапка -->
    <div class="tree-header" style="display: flex; align-items: center;">
      <button class="tree-back-btn" @click="goBack" title="Вернуться к проектам">
        <i class="fas fa-arrow-left"></i>
      </button>
      <span class="tree-title">
        <i class="fas fa-book-open"></i>
        Структура
      </span>
      <button class="tree-action-btn" @click="$emit('open-sandbox')" title="Редактор сущностей (Sandbox)" style="margin-left: auto; background: transparent; border: none; color: var(--text-main); cursor: pointer; opacity: 0.5; font-size: 14px; transition: 0.2s;" onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=0.5">
        <i class="fas fa-puzzle-piece"></i>
      </button>
    </div>

    <!-- Тело дерева -->
    <div class="tree-body">
      <!-- СЕКЦИЯ: РУКОПИСЬ -->
      <div class="tree-section">
        <div class="tree-section-header" @click="toggleSection('manuscript')">
          <i :class="expandedSections.has('manuscript') ? 'fas fa-chevron-down' : 'fas fa-chevron-right'"></i>
          <span>ПРОИЗВЕДЕНИЕ</span>
          <div class="section-actions">
            <i class="fas fa-plus" @click.stop="createVolume" title="Добавить том"></i>
          </div>
        </div>

        <div v-if="expandedSections.has('manuscript')" class="tree-section-content">
          <!-- Тома -->
          <template v-for="vol in hierarchy.volumes" :key="'vol-' + vol.id">
            <div class="tree-item tree-volume" :class="{ active: activeNode?.node?.id === vol.id, selected: isSelected(vol.id) }">
              <div class="tree-item-row" @click="handleManuscriptClick($event, vol, 'volume')" @contextmenu.prevent="openCtx($event, 'volume', vol)">
                <span class="tree-expand-btn" @click.stop="toggleExpand('vol-' + vol.id)">
                  <i :class="expanded.has('vol-' + vol.id) ? 'fas fa-chevron-down' : 'fas fa-chevron-right'"></i>
                </span>
                <span class="tree-item-icon">📚</span>
                <span v-if="renaming?.id !== vol.id" class="tree-item-label">{{ vol.title || 'Без названия' }}</span>
                <input v-else class="tree-rename-input" v-model="renaming.title"
                  @keydown.enter="commitRename" @keydown.escape="renaming = null"
                  @blur="commitRename" ref="renameInput" autofocus />
              </div>

              <div v-if="expanded.has('vol-' + vol.id)" class="tree-children">
                <!-- Арки тома -->
                <template v-for="arc in getArcsForVolume(vol.id)" :key="'arc-' + arc.id">
                  <div class="tree-item tree-arc" :class="{ active: activeNode?.node?.id === arc.id, selected: isSelected(arc.id) }">
                    <div class="tree-item-row arc-row" @click="handleManuscriptClick($event, arc, 'arc')" @contextmenu.prevent="openCtx($event, 'arc', arc)">
                      <span class="tree-expand-btn" @click.stop="toggleExpand('arc-' + arc.id)">
                        <i :class="expanded.has('arc-' + arc.id) ? 'fas fa-chevron-down' : 'fas fa-chevron-right'"></i>
                      </span>
                      <span class="tree-item-icon">🌀</span>
                      <span v-if="renaming?.id !== arc.id" class="tree-item-label">{{ arc.title || 'Без названия' }}</span>
                      <input v-else class="tree-rename-input" v-model="renaming.title"
                        @keydown.enter="commitRename" @keydown.escape="renaming = null"
                        @blur="commitRename" autofocus />
                    </div>
                    <!-- Главы арки -->
                    <div v-if="expanded.has('arc-' + arc.id)" class="tree-children">
                      <div v-for="ch in getChaptersForArc(arc.id)" :key="'ch-' + ch.id"
                        class="tree-item tree-chapter" :class="{ active: activeNode?.node?.id === ch.id, selected: isSelected(ch.id) }"
                        @click="handleManuscriptClick($event, ch, 'chapter')"
                        @dblclick.stop="startChapterRename(ch)"
                        @contextmenu.prevent="openCtx($event, 'chapter', ch)">
                        <div class="tree-item-row chapter-row">
                          <span class="tree-item-icon chapter-icon">📖</span>
                          <template v-if="renaming?.id === ch.id">
                            <input class="tree-rename-input" v-model="renaming.title"
                              @keydown.enter="commitRename" @keydown.escape="renaming = null"
                              @blur="commitRename" ref="renameInput" autofocus @click.stop />
                          </template>
                          <template v-else>
                            <span class="tree-item-label">{{ ch.title || 'Без названия' }}</span>
                          </template>
                        </div>
                      </div>
                    </div>
                  </div>
                  <!-- Inline кнопка для добавления главы -->
                  <div class="tree-add-inline arc-add" @click.stop="$emit('create-chapter-in', { arcId: arc.id, volumeId: arc.volumeId })">
                    <i class="fas fa-plus"></i> <span>Глава</span>
                  </div>
                </template>
              </div>
              <!-- Inline кнопка для добавления арки в том -->
              <div class="tree-add-inline" @click.stop="createArc(vol.id)">
                <i class="fas fa-plus"></i> <span>Арка</span>
              </div>
            </div>
          </template>

          <!-- Корневые арки (без тома) -->
          <template v-for="arc in getRootArcs()" :key="'root-arc-' + arc.id">
            <div class="tree-item tree-arc" :class="{ active: activeNode?.node?.id === arc.id, selected: isSelected(arc.id) }">
              <div class="tree-item-row arc-row" @click="handleManuscriptClick($event, arc, 'arc')" @contextmenu.prevent="openCtx($event, 'arc', arc)">
                <span class="tree-expand-btn" @click.stop="toggleExpand('arc-' + arc.id)">
                  <i :class="expanded.has('arc-' + arc.id) ? 'fas fa-chevron-down' : 'fas fa-chevron-right'"></i>
                </span>
                <span class="tree-item-icon">🌀</span>
                <span v-if="renaming?.id !== arc.id" class="tree-item-label">{{ arc.title || 'Без названия' }}</span>
                <input v-else class="tree-rename-input" v-model="renaming.title"
                  @keydown.enter="commitRename" @keydown.escape="renaming = null"
                  @blur="commitRename" autofocus />
              </div>
              <div v-if="expanded.has('arc-' + arc.id)" class="tree-children">
                <div v-for="ch in getChaptersForArc(arc.id)" :key="'ch-' + ch.id"
                  class="tree-item tree-chapter" :class="{ active: activeNode?.node?.id === ch.id, selected: isSelected(ch.id) }"
                  @click="handleManuscriptClick($event, ch, 'chapter')"
                  @dblclick.stop="startChapterRename(ch)"
                  @contextmenu.prevent="openCtx($event, 'chapter', ch)">
                  <div class="tree-item-row chapter-row">
                    <span class="tree-item-icon chapter-icon">📖</span>
                    <template v-if="renaming?.id === ch.id">
                      <input class="tree-rename-input" v-model="renaming.title"
                        @keydown.enter="commitRename" @keydown.escape="renaming = null"
                        @blur="commitRename" autofocus @click.stop />
                    </template>
                    <template v-else>
                      <span class="tree-item-label">{{ ch.title || 'Без названия' }}</span>
                    </template>
                  </div>
                </div>
              </div>
              <!-- Inline кнопка для добавления главы в корневую арку -->
              <div class="tree-add-inline arc-add" @click.stop="$emit('create-chapter-in', { arcId: arc.id, volumeId: null })">
                <i class="fas fa-plus"></i> <span>Глава</span>
              </div>
            </div>
          </template>

          <!-- Корневые главы (без арки и тома) -->
          <div v-for="ch in getRootChapters()" :key="'root-ch-' + ch.id"
              class="tree-item tree-chapter" :class="{ active: activeNode?.node?.id === ch.id, selected: isSelected(ch.id) }"
              @click="handleManuscriptClick($event, ch, 'chapter')"
              @dblclick.stop="startChapterRename(ch)"
              @contextmenu.prevent="openCtx($event, 'chapter', ch)">
              <div class="tree-item-row chapter-row">
                <span class="tree-item-icon chapter-icon">📖</span>
                <template v-if="renaming?.id === ch.id">
                  <input class="tree-rename-input" v-model="renaming.title"
                    @keydown.enter="commitRename" @keydown.escape="renaming = null"
                    @blur="commitRename" autofocus @click.stop />
                </template>
                <template v-else>
                  <span class="tree-item-label">{{ ch.title || 'Без названия' }}</span>
                </template>
              </div>
          </div>
        </div>
      </div>

      <!-- СЕКЦИИ СУЩНОСТЕЙ (ПЕРСОНАЖИ, ОРГАНИЗАЦИИ И Т.Д.) -->
      <div v-for="sect in entitySections" :key="sect.type" class="tree-section">
        <div class="tree-section-header" @click="toggleSection(sect.type)">
          <i :class="expandedSections.has(sect.type) ? 'fas fa-chevron-down' : 'fas fa-chevron-right'"></i>
          <span>{{ sect.title }}</span>
        </div>


        <div v-if="expandedSections.has(sect.type)" class="tree-section-content">
          <div v-for="entity in entities[sect.type] || []" :key="entity.id"
            class="tree-item tree-entity"
            :class="{
              active: activeEditorId === entityKey(sect.type, entity.id),
              selected: entitySelection.isSelected(entityKey(sect.type, entity.id))
            }"
            @click="handleEntityClick($event, sect.type, entity, sect)"
            @contextmenu.prevent="openEntityCtx($event, sect.type, entity, sect)">
            <div class="tree-item-row">
              <span class="tree-item-icon">{{ sect.emoji }}</span>
              <span class="tree-item-label">{{ getEntityName(entity, sect.type) }}</span>
            </div>
          </div>
          
          <!-- Inline создание сущности -->
          <div v-if="creatingEntity && creatingEntity.type === sect.type" class="tree-item tree-entity creating">
             <div class="tree-item-row">
                <span class="tree-item-icon">{{ sect.emoji }}</span>
                <input 
                  class="tree-rename-input" 
                  v-model="creatingEntity.name"
                  @keydown.enter="commitCreateEntity" 
                  @keydown.escape="creatingEntity = null"
                  @blur="commitCreateEntity"
                  ref="createEntityInput" 
                  autofocus 
                />
             </div>
          </div>

          <div v-if="!(entities[sect.type]?.length) && (!creatingEntity || creatingEntity.type !== sect.type)" class="tree-item-row tree-empty-small">Пусто</div>
          
          <div class="tree-add-inline entity-add" @click.stop="startCreateEntity(sect.type)">
            <i class="fas fa-plus"></i> <span>{{ sect.title.charAt(0) + sect.title.slice(1).toLowerCase() }}</span>
          </div>
        </div>
      </div>

    <!-- Футер -->
      <div v-if="!hierarchy.volumes.length && !hierarchy.arcs.length && !hierarchy.chapters.length"
        class="tree-empty">
        <i class="fas fa-book" style="font-size: 28px; opacity: 0.2; margin-bottom: 10px;"></i>
        <div>Нет глав</div>
        <div style="font-size: 11px; margin-top: 4px; opacity: 0.6;">Создайте первую через кнопку выше</div>
      </div>
    </div>

    <!-- Контекстное меню — VS Code style -->
    <Teleport to="body">
      <!-- Оверлей для обычного меню (том/арка/глава) -->
      <div v-if="ctx" class="tree-ctx-overlay" @click="ctx = null"></div>
      <transition name="ctx-pop">
        <div v-if="ctx" class="tree-ctx-menu" :style="ctxStyle">

          <div class="ctx-item"
            @click="ctx.type === 'chapter' ? (startChapterRename(ctx.node), ctx = null) : startRename()">
            <span class="ctx-label"><i class="fas fa-pen ctx-icon"></i> Переименовать</span>
            <kbd class="ctx-kbd">F2</kbd>
          </div>

          <div v-if="ctx.type === 'volume'" class="ctx-item"
            @click="createArc(ctx.node.id); ctx = null">
            <span class="ctx-label"><i class="fas fa-layer-group ctx-icon"></i> Добавить арку</span>
          </div>

          <div v-if="ctx.type === 'arc'" class="ctx-item"
            @click="$emit('create-chapter-in', { arcId: ctx.node.id, volumeId: ctx.node.volumeId }); ctx = null">
            <span class="ctx-label"><i class="fas fa-file-alt ctx-icon"></i> Добавить главу</span>
          </div>

          <div class="ctx-sep"></div>

          <div class="ctx-danger ctx-item" @click="deleteNodeDirect">
            <span class="ctx-label">
              <i class="fas fa-trash ctx-icon"></i>
              {{ hasSelection && isSelected(ctx.node.id) && selectedCount > 1
                  ? `Удалить (${selectedCount})`
                  : 'Удалить' }}
            </span>
            <kbd class="ctx-kbd ctx-kbd-danger">Del</kbd>
          </div>

        </div>
      </transition>

      <!-- Контекстное меню для сущностей -->
      <div v-if="entityCtx" class="tree-ctx-overlay" @click="entityCtx = null"></div>
      <transition name="ctx-pop">
        <div v-if="entityCtx" class="tree-ctx-menu" :style="entityCtxStyle">

          <div class="ctx-item" @click="emit('open-entity', { ...entityCtx.entity, entityType: entityCtx.entityType }); entityCtx = null">
            <span class="ctx-label"><i class="fas fa-pen ctx-icon"></i> Открыть / редактировать</span>
          </div>

          <div class="ctx-sep"></div>

          <div class="ctx-danger ctx-item" @click="deleteEntityCtxNode">
            <span class="ctx-label">
              <i class="fas fa-trash ctx-icon"></i>
              {{ entitySelection.hasSelection.value && entitySelection.isSelected(entityKey(entityCtx.entityType, entityCtx.entity.id)) && entitySelection.selectedCount.value > 1
                  ? `Удалить (${entitySelection.selectedCount.value})`
                  : 'Удалить' }}
            </span>
            <kbd class="ctx-kbd ctx-kbd-danger">Del</kbd>
          </div>

        </div>
      </transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick, computed, onMounted, onUnmounted } from 'vue';

// ... (in setup) ...
onMounted(() => {
  const handler = () => {
    console.log('🌳 ChapterTree: hierarchy changed, reloading...');
    load();
  };
  document.addEventListener('ww:hierarchy-changed', handler);
  onUnmounted(() => document.removeEventListener('ww:hierarchy-changed', handler));
});
import { apiService } from '../../../services/api.service';
import { useTreeSelection } from '../../../composables/useTreeSelection.js';

const props = defineProps({
  project: { type: String, required: true },
  activeNode: { type: Object, default: null },
  activeEditorId: { type: String, default: null }
});

const emit = defineEmits([
  'select-node', 'select-chapter', 'create-chapter-in', 'rename-chapter', 'delete-chapter',
  'open-entity', 'add-entity', 'delete-entity', 'delete-volume', 'delete-arc', 'open-sandbox'
]);

const hierarchy = ref({ volumes: [] as any[], arcs: [] as any[], chapters: [] as any[] });
const entities  = ref<Record<string, any[]>>({});
const entitySections = ref<any[]>([]);
const expanded   = ref(new Set<string>());
const expandedSections = ref<Set<string>>(new Set(['manuscript']));
const titleFields = ref<Record<string, string>>({}); // Карта: тип сущности -> путь к полю заголовка

// --- Persistence Logic ---
const EXPANDED_KEY = `worldwiki-expanded-${props.project}`;
const SECTIONS_KEY = `worldwiki-sections-${props.project}`;

const saveTreeState = () => {
  localStorage.setItem(EXPANDED_KEY, JSON.stringify([...expanded.value]));
  localStorage.setItem(SECTIONS_KEY, JSON.stringify([...expandedSections.value]));
};

const restoreTreeState = () => {
  const savedExpanded = localStorage.getItem(EXPANDED_KEY);
  const savedSections = localStorage.getItem(SECTIONS_KEY);
  
  if (savedExpanded) {
    try {
      const arr = JSON.parse(savedExpanded);
      expanded.value = new Set(arr);
    } catch (e) { console.warn('Failed to restore expanded nodes', e); }
  }
  
  if (savedSections) {
    try {
      const arr = JSON.parse(savedSections);
      expandedSections.value = new Set(arr);
    } catch (e) { console.warn('Failed to restore expanded sections', e); }
  }
};

// Хелпер для получения значения по пути "key1.key2"
const getValueByPath = (obj: any, path: string): any => {
  if (!path) return undefined;
  return path.split('.').reduce((cur: any, k: string) => (cur != null ? cur[k] : undefined), obj);
};

const renaming   = ref(null as any);
const renameInput = ref(null as any);
const creatingEntity = ref<{ type: string, name: string } | null>(null);
const createEntityInput = ref<HTMLInputElement | null>(null);
const ctx        = ref(null as any);




// ─── Flat list для Shift-выделения (визуальный порядок) ───────────────
const flatItems = computed(() => {
  const result = [];
  for (const vol of hierarchy.value.volumes) {
    result.push({ ...vol, _type: 'volume' });
    if (expanded.value.has('vol-' + vol.id)) {
      for (const arc of hierarchy.value.arcs.filter(a => String(a.volumeId) === String(vol.id))) {
        result.push({ ...arc, _type: 'arc' });
        if (expanded.value.has('arc-' + arc.id)) {
          for (const ch of hierarchy.value.chapters.filter(c => String(c.arcId) === String(arc.id)))
            result.push({ ...ch, _type: 'chapter' });
        }
      }
    }
  }
  for (const arc of hierarchy.value.arcs.filter(a => !a.volumeId)) {
    result.push({ ...arc, _type: 'arc' });
    if (expanded.value.has('arc-' + arc.id)) {
      for (const ch of hierarchy.value.chapters.filter(c => String(c.arcId) === String(arc.id)))
        result.push({ ...ch, _type: 'chapter' });
    }
  }
  for (const ch of hierarchy.value.chapters.filter(c => !c.arcId && !c.volumeId))
    result.push({ ...ch, _type: 'chapter' });
  return result;
});

// ─── Multi-select для том/арка/глава ────────────────────
const {
  selected, selectedCount, hasSelection, selectedIds,
  isSelected, handleClick, clearSelection, deleteSelected: selectionDeleteSelected, handleKeydown,
} = useTreeSelection({
  onDelete: async (ids: any[]) => {
    if (!ids.length) return;
    if (!confirm(`Удалить выбранные объекты (${ids.length})?`)) return;
    
    const items = flatItems.value.filter(i => ids.includes(i.id));
    for (const item of items) {
      if (item._type === 'volume') {
        const arcs = getArcsForVolume(item.id).map((a: any) => a.id);
        let chapters = hierarchy.value.chapters.filter((c: any) => compareIds(c.volumeId, item.id));
        for (const arcId of arcs) {
          chapters = chapters.concat(getChaptersForArc(arcId));
        }
        emit('delete-volume', item, chapters, arcs, true);
      }
      else if (item._type === 'arc') {
        emit('delete-arc', item, getChaptersForArc(item.id), true);
      }
      else if (item._type === 'chapter') emit('delete-chapter', item, true);
    }
    await load();
  },
});

// Ключ: "entity:entityType:id" — для синхронизации с вкладками в app.ts
const entityKey = (type: string, id: any) => `entity:${type}:${id}`;

const entityCtx = ref(null as any);
const entityCtxStyle = computed(() => {
  if (!entityCtx.value) return {};
  const x = entityCtx.value.x + 220 > window.innerWidth  ? entityCtx.value.x - 220 : entityCtx.value.x;
  const y = entityCtx.value.y + 120 > window.innerHeight ? entityCtx.value.y - 120 : entityCtx.value.y;
  return { top: y + 'px', left: x + 'px' };
});

// Flat-список всех видимых сущностей (для Shift-диапазона)
const flatEntityItems = computed(() => {
  const result: any[] = [];
  for (const sect of entitySections.value) {
    if (!expandedSections.value.has(sect.type)) continue;
    for (const entity of entities.value[sect.type] || []) {
      result.push({ id: entityKey(sect.type, entity.id), _entity: entity, _type: sect.type });
    }
  }
  return result;
});

const entitySelection = useTreeSelection({
  onDelete: async (keys: any[]) => {
    if (!keys.length) return;
    if (!confirm(`Удалить выбранные сущности (${keys.length})?`)) return;

    for (const key of keys) {
      const [etype, eid] = key.split(':');
      emit('delete-entity', key, etype, true);
    }
    await load();
  },
});

// Количество выбранных сущностей данного типа
const entitySelectedInSection = (type: string) => {
  let count = 0;
  for (const key of entitySelection.selected.value) {
    if (String(key).startsWith(type + ':')) count++;
  }
  return count;
};

const handleEntityClick = (event: MouseEvent, type: string, entity: any, sect: any) => {
  // Снимаем выделение с глав при клике на сущность
  clearSelection();
  
  const key = entityKey(type, entity.id);
  entitySelection.handleClick(event, { id: key }, flatEntityItems.value);
  // При обычном клике (без модификаторов) — открываем сущность
  if (!event.ctrlKey && !event.metaKey && !event.shiftKey) {
    emit('open-entity', { ...entity, entityType: type });
  }
};

const openEntityCtx = (e: MouseEvent, type: string, entity: any, sect: any) => {
  // Если сущность не выделена — выделяем её одну
  const key = entityKey(type, entity.id);
  if (!entitySelection.isSelected(key)) {
    entitySelection.handleClick(new MouseEvent('click'), { id: key }, flatEntityItems.value);
  }
  entityCtx.value = { x: e.clientX, y: e.clientY, entityType: type, entity, sect };
};

const deleteSelectedEntities = async (sectionType?: string) => {
  if (sectionType) {
    // Удаляем только выделенные сущности данного типа
    const keys = [...entitySelection.selected.value].filter((k: any) => String(k).startsWith(sectionType + ':'));
    if (!keys.length) return;
    entitySelection.selected.value = new Set([...entitySelection.selected.value].filter((k: any) => !String(k).startsWith(sectionType + ':')));
    for (const key of keys) {
      const [etype, eid] = String(key).split(':');
      try { await apiService.deleteEntity(props.project, etype, eid); } catch (e) { console.error(e); }
    }
    await load();
  } else {
    await entitySelection.deleteSelected();
  }
};

const deleteEntityCtxNode = async () => {
  if (!entityCtx.value) return;
  const { entityType, entity } = entityCtx.value;
  entityCtx.value = null;
  const key = entityKey(entityType, entity.id);
  if (entitySelection.hasSelection.value && entitySelection.isSelected(key) && entitySelection.selectedCount.value > 1) {
    await deleteSelectedEntities();
  } else {
    try { await apiService.deleteEntity(props.project, entityType, entity.id); } catch (e) { console.error(e); }
    await load();
  }
};


// ─── Load ───────────────────────────────────────────────

const expandToId = (targetId: string) => {
  if (!targetId) return;
  console.log('🌳 ChapterTree: expanding to', targetId);
  
  // Всегда раскрываем секцию произведения
  expandedSections.value.add('manuscript');

  // 1. Ищем в главах
  const ch = hierarchy.value.chapters.find(c => String(c.id) === String(targetId));
  if (ch) {
    if (ch.arcId) expanded.value.add('arc-' + ch.arcId);
    if (ch.volumeId) expanded.value.add('vol-' + ch.volumeId);
    
    // Если глава в арке, а арка в томе — нужно раскрыть и то, и другое
    if (ch.arcId) {
      const arc = hierarchy.value.arcs.find(a => String(a.id) === String(ch.arcId));
      if (arc && arc.volumeId) expanded.value.add('vol-' + arc.volumeId);
    }
  }
  
  // 2. Ищем в арках
  const arc = hierarchy.value.arcs.find(a => String(a.id) === String(targetId));
  if (arc) {
    expanded.value.add('arc-' + arc.id);
    if (arc.volumeId) expanded.value.add('vol-' + arc.volumeId);
  }
  
  // 3. Ищем в томах
  const vol = hierarchy.value.volumes.find(v => String(v.id) === String(targetId));
  if (vol) {
    expanded.value.add('vol-' + vol.id);
  }

  expanded.value = new Set(expanded.value);
  expandedSections.value = new Set(expandedSections.value);
  saveTreeState();
};

const load = async (expandId?: string) => {
  try {
    console.log('🌳 ChapterTree.load: загружаю иерархию и сущности для проекта', props.project);
    
    // Восстанавливаем состояние перед загрузкой (или после, если загрузка может его затереть)
    restoreTreeState();

    // Загружаем структуру сайдбара из JSON
    const sidebarResp = await fetch('/struct/sidebar.json');
    const sidebarData = await sidebarResp.json();
    entitySections.value = sidebarData
      .filter((i: any) => i.type === 'entity')
      .map((i: any) => ({
        type: i.entityType,
        title: i.title.toUpperCase(),
        emoji: i.emoji || '📄'
      }));

    // Загружаем главы
    hierarchy.value = await apiService.getHierarchy(props.project);
    console.log('🌳 ChapterTree.load: hierarchy:', hierarchy.value);
    
    if (expandId) {
      expandToId(expandId);
    }
    if (hierarchy.value.chapters && hierarchy.value.chapters.length > 0) {
      console.log('📖 ChapterTree.load: FIRST CHAPTER:', hierarchy.value.chapters[0]);
      console.log('📖 ChapterTree.load: arcId type:', typeof hierarchy.value.chapters[0].arcId);
    }
    if (hierarchy.value.arcs && hierarchy.value.arcs.length > 0) {
      console.log('🌈 ChapterTree.load: FIRST ARC:', hierarchy.value.arcs[0]);
    }
    // Если состояние не было восстановлено (например, первый запуск), раскрываем всё по умолчанию
    if (expanded.value.size === 0) {
      hierarchy.value.volumes.forEach(v => expanded.value.add('vol-' + v.id));
      hierarchy.value.arcs.forEach(a => expanded.value.add('arc-' + a.id));
    }
    
    // Загружаем сущности всех типов
    for (const sect of entitySections.value) {
      try {
        // Пытаемся загрузить схему, чтобы узнать titleField
        if (!titleFields.value[sect.type]) {
          try {
            const schemaResp = await fetch(`/struct/editor/${sect.type}.json`);
            if (schemaResp.ok) {
              const schema = await schemaResp.json();
              if (schema.titleField) titleFields.value[sect.type] = schema.titleField;
            }
          } catch (se) {
            console.warn(`Could not load schema for ${sect.type}`, se);
          }
        }

        const list = await apiService.getEntityList(props.project, sect.type);
        entities.value[sect.type] = list;
      } catch (e) {
        console.warn(`Could not load entities for ${sect.type}`, e);
      }
    }

    expanded.value = new Set(expanded.value);
    console.log('✅ ChapterTree.load: всё загружено');
  } catch (e: any) {
    const err = e?.message || String(e);
    console.error('❌ ChapterTree.load ошибка:', err);
  }
};

const toggleSection = (id: string) => {
  if (expandedSections.value.has(id)) expandedSections.value.delete(id);
  else expandedSections.value.add(id);
  expandedSections.value = new Set(expandedSections.value);
  saveTreeState();
};

const getEntityName = (entity: any, type: string) => {
  if (!entity) return 'Пусто';
  
  // 1. Проверка по titleField из схемы (ПРИОРИТЕТ - первый инпут)
  const path = titleFields.value[type];
  if (path) {
    const val = getValueByPath(entity, path);
    if (val && String(val).trim().length > 0) {
      return String(val).trim();
    }
  }

  // 2. Прямая гарантия пользователя (на случай если схема не загрузилась)
  const topName = entity.Name || entity.name || entity.название;
  if (topName && String(topName).trim().length > 0) {
    return String(topName).trim();
  }

  return `[${String(entity.id || '').substring(0, 6)}]`;
};

const startCreateEntity = (type: string) => {
  creatingEntity.value = { type, name: '' };
  nextTick(() => {
    if (createEntityInput.value) {
      const el = Array.isArray(createEntityInput.value) ? createEntityInput.value[0] : createEntityInput.value;
      el?.focus();
    }
  });
};

const commitCreateEntity = async () => {
  if (!creatingEntity.value || !creatingEntity.value.name.trim()) {
    creatingEntity.value = null;
    return;
  }
  const { type, name } = creatingEntity.value;
  creatingEntity.value = null;
  emit('add-entity', type, name);
};

watch(() => props.project, load, { immediate: true });

// ─── Getters ─────────────────────────────────────────────

// Вспомогательная функция для надежного сравнения ID (строка или объект)
const compareIds = (id1: any, id2: any) => {
  if (!id1 || !id2) return false;
  const s1 = typeof id1 === 'string' ? id1 : (id1.id?.String || id1.id || JSON.stringify(id1));
  const s2 = typeof id2 === 'string' ? id2 : (id2.id?.String || id2.id || JSON.stringify(id2));
  const parts1 = String(s1).split(':');
  const parts2 = String(s2).split(':');
  const clean1 = parts1[parts1.length - 1] || String(s1);
  const clean2 = parts2[parts2.length - 1] || String(s2);
  return clean1.replace(/"/g, '') === clean2.replace(/"/g, '');
};

const getArcsForVolume = (volumeId: any) =>
  hierarchy.value.arcs.filter(a => compareIds(a.volumeId, volumeId));

const getRootArcs = () =>
  hierarchy.value.arcs.filter(a => !a.volumeId);

const getChaptersForArc = (arcId: any) =>
  hierarchy.value.chapters.filter(c => compareIds(c.arcId, arcId));

const getRootChapters = () =>
  hierarchy.value.chapters.filter(c => !c.arcId && !c.volumeId);

const handleManuscriptClick = (event: MouseEvent, item: any, type: string) => {
  // Снимаем выделение с сущностей при клике на рукопись
  entitySelection.clearSelection();
  
  handleClick(event, item, flatItems.value);
  selectNode(type, item);
  if (type === 'chapter') selectChapter(item, event);
};

// ─── Selection ───────────────────────────────────────────

const selectNode = (type: any, node: any) => {
  emit('select-node', { type, node });
};

// Выбрать главу и эмитить событие
const selectChapter = (chapter: any, event: MouseEvent) => {
  console.log('🖱️ ChapterTree.selectChapter: кликнута глава', chapter.id, chapter.title);
  if (!event.ctrlKey && !event.shiftKey) {
    console.log('  → нет ctrl/shift, эмитирую select-chapter');
    emit('select-chapter', chapter);
  } else {
    console.log('  → ctrl/shift нажаты, не эмитирую');
  }
};

// ─── Expand ──────────────────────────────────────────────

const toggleExpand = (key: string) => {
  if (expanded.value.has(key)) expanded.value.delete(key);
  else expanded.value.add(key);
  expanded.value = new Set(expanded.value);
  saveTreeState();
};

// ─── Rename ──────────────────────────────────────────────

const startRename = () => {
  if (!ctx.value) return;
  renaming.value = { id: ctx.value.node.id, type: ctx.value.type, title: ctx.value.node.title, node: ctx.value.node };
  ctx.value = null;
  nextTick(() => renameInput.value?.focus?.());
};

// Переименование тома/арки
const commitRename = async () => {
  if (!renaming.value) return;
  const { id, type, title, node, onCommit } = renaming.value;
  renaming.value = null;
  try {
    if (onCommit) {
      // inline-create callback
      await onCommit(title);
    } else if (type === 'volume') await apiService.updateVolume(props.project, id, title);
    else if (type === 'arc')    await apiService.updateArc(props.project, id, title);
    else if (type === 'chapter') emit('rename-chapter', node, title);
    if (!onCommit) await load();
  } catch (e) {
    console.error('Ошибка переименования:', e);
  }
};

// Двойной клик на главу — запуск inline rename
const startChapterRename = (ch: any) => {
  renaming.value = { id: ch.id, type: 'chapter', title: ch.title || '', node: ch };
  nextTick(() => {
    const input = document.querySelector('.tree-rename-input') as HTMLInputElement | null;
    if (input) input.focus();
  });
};

// ─── Create ──────────────────────────────────────────────

const createVolume = async () => {
  try {
    const tempId = '__new_volume__';
    const newVol = { id: tempId, title: 'Новый том', sort_order: 999 };
    hierarchy.value.volumes = [...hierarchy.value.volumes, newVol];
    await nextTick();
    renaming.value = { 
      id: tempId, type: 'volume', title: 'Новый том', node: newVol,
      onCommit: async (title: string) => {
        hierarchy.value.volumes = hierarchy.value.volumes.filter((v: any) => v.id !== tempId);
        if (!title.trim()) return;
        const id = await apiService.createVolume(props.project, title.trim());
        await load(id);
      }
    };
    nextTick(() => renameInput.value?.focus?.());
  } catch (e) {
    console.error('Failed to create volume:', e);
  }
};

const createArc = async (volumeId: any) => {
  try {
    const vid = (volumeId && typeof volumeId === 'object') 
      ? `${volumeId.tb}:${volumeId.id}` 
      : volumeId;
    const tempId = '__new_arc__';
    const newArc = { id: tempId, title: 'Новая арка', sort_order: 999, volumeId: vid };
    hierarchy.value.arcs = [...hierarchy.value.arcs, newArc];
    await nextTick();
    renaming.value = {
      id: tempId, type: 'arc', title: 'Новая арка', node: newArc,
      onCommit: async (title: string) => {
        hierarchy.value.arcs = hierarchy.value.arcs.filter((a: any) => a.id !== tempId);
        if (!title.trim()) return;
        const id = await apiService.createArc(props.project, title.trim(), vid);
        await load(id);
      }
    };
    nextTick(() => renameInput.value?.focus?.());
  } catch (e) {
    console.error('Failed to create arc:', e);
  }
};

const goBack = () => {
  window.location.href = '../../../project_launcher.html';
};

// ─── Delete (без confirm) ────────────────────────────────

const deleteNodeDirect = async () => {
  if (!ctx.value) return;
  const ctxNode = ctx.value;
  ctx.value = null;

  // Если есть выделение — удаляем всё выделенное
  // (+ добавляем кликнутый, если его нет в выделении)
  if (hasSelection.value) {
    if (!isSelected(ctxNode.node.id)) {
      // Кликнули на невыделенный — удаляем только его
      await _deleteSingle(ctxNode.type, ctxNode.node);
    } else {
      // Кликнули на выделенный — удаляем всё выделенное
      await selectionDeleteSelected();
    }
  } else {
    await _deleteSingle(ctxNode.type, ctxNode.node);
  }
};

const _deleteSingle = async (type: any, node: any) => {
  try {
    if (type === 'volume') {
      const arcs = getArcsForVolume(node.id).map((a: any) => a.id);
      let chapters = hierarchy.value.chapters.filter((c: any) => compareIds(c.volumeId, node.id));
      for (const arcId of arcs) {
        chapters = chapters.concat(getChaptersForArc(arcId));
      }
      emit('delete-volume', node, chapters, arcs, false);
      return;
    }
    else if (type === 'arc') {
      emit('delete-arc', node, getChaptersForArc(node.id), false);
      return;
    }
    else if (type === 'chapter') { emit('delete-chapter', node, false); return; }
    else { emit('delete-entity', entityKey(type, node.id), type, false); return; }
  } catch (e) {
    console.error('Ошибка удаления:', e);
  }
};

// ─── Context menu ────────────────────────────────────────

const CTX_W = 220; // ширина меню
const CTX_H = 160; // примерная высота

const ctxStyle = computed(() => {
  if (!ctx.value) return {};
  const x = ctx.value.x + CTX_W > window.innerWidth  ? ctx.value.x - CTX_W : ctx.value.x;
  const y = ctx.value.y + CTX_H > window.innerHeight ? ctx.value.y - CTX_H : ctx.value.y;
  return { top: y + 'px', left: x + 'px' };
});

const openCtx = (e: any, type: any, node: any) => {
  ctx.value = { x: e.clientX, y: e.clientY, type, node };
};

const onTreeKeydown = async (e: KeyboardEvent) => {
  // Обрабатываем для глав
  if (hasSelection.value) {
    await handleKeydown(e, flatItems.value);
  }
  // Обрабатываем для сущностей
  if (entitySelection.hasSelection.value) {
    await entitySelection.handleKeydown(e, flatEntityItems.value);
  }
};

defineExpose({ load });
</script>

<style scoped>
/* ── Корневой контейнер ───────────────────────────────── */
.chapter-tree {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

/* ── Шапка ───────────────────────────────────────────── */
.tree-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 14px;
  border-bottom: 1px solid rgba(255,255,255,0.06);
  flex-shrink: 0;
  background: rgba(255,255,255,0.02);
}

.tree-back-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  background: rgba(139,92,246,0.08);
  border: 1px solid rgba(139,92,246,0.2);
  color: rgba(139,92,246,0.9);
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  transition: all 0.2s;
  flex-shrink: 0;
  margin-right: 8px;
  backdrop-filter: blur(4px);
}
.tree-back-btn:hover {
  background: rgba(139,92,246,0.18);
  border-color: rgba(139,92,246,0.45);
  color: #a78bfa;
  box-shadow: 0 0 12px rgba(139,92,246,0.15);
}

.tree-title {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--text-muted, #888);
}

/* ── Тело ────────────────────────────────────────────── */
.tree-body {
  flex: 1;
  overflow-y: auto;
  padding: 8px 0 16px;
}
.tree-body::-webkit-scrollbar { width: 4px; }
.tree-body::-webkit-scrollbar-track { background: transparent; }
.tree-body::-webkit-scrollbar-thumb { background: rgba(139,92,246,0.2); border-radius: 2px; }

/* ── Элементы ────────────────────────────────────────── */
.tree-item { position: relative; }

.tree-item-row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  margin: 1px 6px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.15s, box-shadow 0.15s;
  border: 1px solid transparent;
}

.tree-item-row:hover {
  background: rgba(255,255,255,0.04);
  border-color: rgba(255,255,255,0.05);
}

/* Active state — стеклянная подсветка */
.tree-item.active > .tree-item-row,
.tree-item.active > div > .tree-item-row {
  background: rgba(139,92,246,0.12);
  border-color: rgba(139,92,246,0.25);
  box-shadow: 0 0 16px rgba(139,92,246,0.08) inset;
}

/* Selected state — синеватая подсветка (multi-select) */
.tree-item.selected > .tree-item-row,
.tree-item.selected > div > .tree-item-row {
  background: rgba(96, 165, 250, 0.1);
  border-color: rgba(96, 165, 250, 0.25);
  box-shadow: 0 0 12px rgba(96,165,250,0.06) inset;
}

/* Статус-бар выделения */
.selection-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  background: rgba(96, 165, 250, 0.08);
  border-bottom: 1px solid rgba(96, 165, 250, 0.2);
  flex-shrink: 0;
  font-size: 11px;
  color: rgba(96, 165, 250, 0.9);
  backdrop-filter: blur(4px);
}

/* Вариант панели для сущностей — компактный, внутри секции */
.entity-sel-bar {
  margin: 2px 6px 4px;
  border-radius: 6px;
  border: 1px solid rgba(96, 165, 250, 0.2);
  border-bottom: 1px solid rgba(96, 165, 250, 0.2);
  padding: 4px 10px;
}

.sel-count { font-weight: 600; letter-spacing: 0.04em; }

.sel-delete-btn, .sel-clear-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 5px;
  border: none;
  cursor: pointer;
  font-size: 10px;
  transition: all 0.15s;
  font-family: inherit;
}
.sel-delete-btn {
  background: rgba(239,68,68,0.12);
  color: #f87171;
}
.sel-delete-btn:hover {
  background: rgba(239,68,68,0.25);
  color: #fca5a5;
}
.sel-clear-btn {
  background: rgba(255,255,255,0.06);
  color: var(--text-muted, #888);
}
.sel-clear-btn:hover { background: rgba(255,255,255,0.1); color: var(--text-main); }

/* Анимация появления/исчезновения статус-бара */
.sel-bar-enter-active, .sel-bar-leave-active {
  transition: all 0.2s ease;
  overflow: hidden;
}
.sel-bar-enter-from, .sel-bar-leave-to {
  opacity: 0;
  max-height: 0;
  padding-top: 0;
  padding-bottom: 0;
}
.sel-bar-enter-to, .sel-bar-leave-from {
  opacity: 1;
  max-height: 40px;
}

/* Outline при фокусе на дереве (для keyboard nav) */
.chapter-tree:focus { outline: none; }
.chapter-tree:focus-visible { box-shadow: inset 0 0 0 1px rgba(139,92,246,0.3); }

/* Volume row */
.tree-item-row:not(.arc-row):not(.chapter-row) {
  padding-left: 8px;
}

/* Arc row */
.arc-row { padding-left: 20px; }

/* Chapter row */
.chapter-row { padding-left: 36px; }

/* Children indent */
.tree-children {
  margin-left: 0;
}
.tree-children .chapter-row { padding-left: 52px; }
.tree-children .tree-add-inline { padding-left: 52px; }

/* ── Expand кнопка ───────────────────────────────────── */
.tree-expand-btn {
  width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  color: var(--text-muted, #666);
  font-size: 9px;
  transition: color 0.15s;
}
.tree-item-row:hover .tree-expand-btn { color: var(--accent, #8b5cf6); }

/* ── Иконка и лейбл ──────────────────────────────────── */
.tree-item-icon {
  font-size: 13px;
  flex-shrink: 0;
  line-height: 1;
}
.chapter-icon { font-size: 12px; }

.tree-item-label {
  flex: 1;
  font-size: 13px;
  color: var(--text-main, #e5e7eb);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
}

/* ── Бейджи ──────────────────────────────────────────── */
.tree-item-badge {
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  padding: 2px 5px;
  border-radius: 4px;
  flex-shrink: 0;
  opacity: 0;
  transition: opacity 0.15s;
}
.tree-item-row:hover .tree-item-badge { opacity: 1; }

.volume-badge {
  background: rgba(251,191,36,0.12);
  color: #fbbf24;
  border: 1px solid rgba(251,191,36,0.2);
}
.arc-badge {
  background: rgba(139,92,246,0.12);
  color: #a78bfa;
  border: 1px solid rgba(139,92,246,0.2);
}

/* ── Счётчик слов ────────────────────────────────────── */
.tree-wordcount {
  font-size: 10px;
  color: var(--text-muted, #666);
  flex-shrink: 0;
  opacity: 0;
  transition: opacity 0.15s;
}
.tree-item-row:hover .tree-wordcount { opacity: 1; }

/* ── Inline кнопка добавления ────────────────────────── */
.tree-add-inline {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 4px 12px 4px 52px;
  font-size: 11px;
  color: var(--text-muted, #666);
  cursor: pointer;
  border-radius: 6px;
  margin: 1px 6px;
  transition: all 0.15s;
}
.arc-add { padding-left: 36px; }
.tree-add-inline:hover {
  color: var(--accent, #8b5cf6);
  background: rgba(139,92,246,0.06);
}

/* ── Пусто ───────────────────────────────────────────── */
.tree-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  font-size: 12px;
  color: var(--text-muted, #888);
  text-align: center;
}

.tree-empty-small {
  font-size: 11px;
  color: var(--text-muted, #666);
  padding: 6px 16px;
  font-style: italic;
  opacity: 0.7;
}

/* ── Rename input ────────────────────────────────────── */
.tree-rename-input {
  flex: 1;
  background: rgba(139,92,246,0.08);
  border: 1px solid rgba(139,92,246,0.4);
  color: var(--text-main, #e5e7eb);
  border-radius: 5px;
  padding: 2px 7px;
  font-size: 13px;
  outline: none;
  font-family: inherit;
  backdrop-filter: blur(4px);
}

/* ── Context menu ────────────────────────────────────── */
.tree-ctx-overlay {
  position: fixed;
  inset: 0;
  z-index: 9998;
}

/* ── Контекстное меню — VS Code style ───────────────── */

.tree-ctx-menu {
  position: fixed;
  z-index: 9999;
  background: #1e1e2e;
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 6px;
  box-shadow:
    0 4px 6px rgba(0,0,0,0.3),
    0 16px 48px rgba(0,0,0,0.5),
    0 0 0 0.5px rgba(255,255,255,0.04) inset;
  padding: 3px;
  min-width: 220px;
  user-select: none;
}

/* Transition */
.ctx-pop-enter-active { transition: opacity 0.1s ease, transform 0.12s ease; }
.ctx-pop-leave-active { transition: opacity 0.08s ease; }
.ctx-pop-enter-from   { opacity: 0; transform: scale(0.96) translateY(-3px); }
.ctx-pop-leave-to     { opacity: 0; }

.ctx-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 7px 10px;
  border-radius: 4px;
  font-size: 13px;
  color: #cccccc;
  cursor: pointer;
  transition: background 0.08s;
  gap: 12px;
}
.ctx-item:hover { background: rgba(255,255,255,0.07); color: #fff; }

.ctx-label {
  display: flex;
  align-items: center;
  gap: 9px;
  flex: 1;
}

.ctx-icon {
  width: 14px;
  font-size: 12px;
  text-align: center;
  opacity: 0.6;
  flex-shrink: 0;
}
.ctx-item:hover .ctx-icon { opacity: 0.9; }

/* Keyboard hint */
.ctx-kbd {
  font-size: 11px;
  font-family: 'Consolas', monospace;
  color: #666;
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 3px;
  padding: 1px 5px;
  flex-shrink: 0;
  letter-spacing: 0.03em;
  transition: color 0.08s;
}
.ctx-item:hover .ctx-kbd { color: #999; }

.ctx-kbd-danger { color: rgba(248,113,113,0.5); border-color: rgba(248,113,113,0.15); }
.ctx-item:hover .ctx-kbd-danger { color: rgba(252,165,165,0.8); }

/* Danger */
.ctx-danger { color: #f87171; }
.ctx-danger:hover { background: rgba(239,68,68,0.12) !important; color: #fca5a5; }
.ctx-danger .ctx-icon { opacity: 0.7; }

/* Separator */
.ctx-sep {
  height: 1px;
  background: rgba(255,255,255,0.07);
  margin: 3px 2px;
}
</style>
