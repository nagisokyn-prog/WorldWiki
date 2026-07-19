<template>
  <div class="chapter-tree-wrapper" style="height: 100%; display: flex; flex-direction: column;">
    <ExplorerTree
      title="Структура"
      icon="fas fa-book-open"
      :showBack="true"
      :sections="explorerSections"
      storage-key="worldwiki-explorer"
      :active-id="activeId"
      ref="explorerTreeRef"
      @back="goBack"
      @select="handleSelect"
      @open="handleOpen"
      @create="handleCreate"
      @create-inline="handleCreateInline"
      @rename="handleRename"
      @cancel-rename="handleCancelRename"
      @delete="handleDelete"
    >
      <template #header-actions>
        <button class="tree-action-btn" title="Редактор сущностей (Sandbox)" style="background: transparent; border: none; color: var(--text-main); cursor: pointer; opacity: 0.5; font-size: 14px; transition: 0.2s;" onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=0.5" @click="$emit('open-sandbox')">
          <i class="fas fa-puzzle-piece"></i>
        </button>
      </template>

      <!-- Контекстное меню -->
      <template #context-menu="{ node, sectionId, close }">
        <template v-if="node.data?.type === 'chapter'">
          <div class="ctx-item" @click="startRename(node, close)">
            <span class="ctx-label"><i class="fas fa-pen ctx-icon"></i> Переименовать</span>
            <kbd class="ctx-kbd">F2</kbd>
          </div>
        </template>
        
        <template v-else-if="node.data?.type === 'volume'">
          <div class="ctx-item" @click="startRename(node, close)">
            <span class="ctx-label"><i class="fas fa-pen ctx-icon"></i> Переименовать</span>
            <kbd class="ctx-kbd">F2</kbd>
          </div>
          <div class="ctx-item" @click="handleCreate({ sectionId: 'manuscript', parentId: node.id }); close()">
            <span class="ctx-label"><i class="fas fa-layer-group ctx-icon"></i> Добавить арку</span>
          </div>
          <div class="ctx-item" @click="$emit('create-chapter-in', { arcId: null, volumeId: node.id }); close()">
            <span class="ctx-label"><i class="fas fa-file-alt ctx-icon"></i> Добавить главу</span>
          </div>
        </template>
        
        <template v-else-if="node.data?.type === 'arc'">
          <div class="ctx-item" @click="startRename(node, close)">
            <span class="ctx-label"><i class="fas fa-pen ctx-icon"></i> Переименовать</span>
            <kbd class="ctx-kbd">F2</kbd>
          </div>
          <div class="ctx-item" @click="handleCreateInline({ sectionId: 'manuscript', parentId: node.id }); close()">
            <span class="ctx-label"><i class="fas fa-file-alt ctx-icon"></i> Добавить главу</span>
          </div>
        </template>
        
        <template v-else-if="node.data?.isEntity">
          <div class="ctx-item" @click="handleOpen(node); close()">
            <span class="ctx-label"><i class="fas fa-pen ctx-icon"></i> Открыть / редактировать</span>
          </div>
        </template>

        <div class="ctx-sep"></div>

        <div class="ctx-danger ctx-item" @click="handleDelete([node.id]); close()">
          <span class="ctx-label">
            <i class="fas fa-trash ctx-icon"></i> Удалить
          </span>
          <kbd class="ctx-kbd ctx-kbd-danger">Del</kbd>
        </div>
      </template>
    </ExplorerTree>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick, triggerRef } from 'vue';
import { apiService } from '../../../services/api.service';
import { useEntityTree } from '../../../services/Entity/entity.tree';
import { ExplorerTree } from '@worldwiki/components';
import type { TreeSectionData, TreeNodeData } from '@worldwiki/components';

const props = defineProps({
  project: { type: String, required: true },
  activeNode: { type: Object, default: null },
  activeEditorId: { type: String, default: null }
});

const emit = defineEmits([
  'select-node', 'select-chapter', 'create-chapter-in', 'rename-chapter', 'delete-chapter',
  'open-entity', 'add-entity', 'rename-entity', 'delete-entity', 'delete-volume', 'delete-arc', 'open-sandbox', 'edit-schema'
]);

const hierarchy = ref({ volumes: [] as any[], arcs: [] as any[], chapters: [] as any[] });

// Entity tree handles fetching characters, locations, etc.
const { 
  entities, entitySections, loadEntities, getEntityName, entityKey 
} = useEntityTree(props.project, emit);

// ID Helper
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

const getArcsForVolume = (volumeId: any) => hierarchy.value.arcs.filter(a => compareIds(a.volumeId, volumeId));
const getRootArcs = () => hierarchy.value.arcs.filter(a => !a.volumeId);
const getChaptersForArc = (arcId: any) => hierarchy.value.chapters.filter(c => compareIds(c.arcId, arcId));
const getRootChapters = () => hierarchy.value.chapters.filter(c => !c.arcId && !c.volumeId);

const activeId = computed(() => {
  // if entity is open, use activeEditorId
  if (props.activeEditorId) return props.activeEditorId;
  // if chapter is open, use activeNode id
  if (props.activeNode && props.activeNode.node) {
    return String(props.activeNode.node.id);
  }
  return undefined;
});

const explorerSections = computed<any[]>(() => {
  const sections: any[] = [];
  
  // --- 1. MANUSCRIPT SECTION ---
  const msNodes: any[] = [];
  
  // Volumes
  for (const vol of hierarchy.value.volumes) {
    const arcs = getArcsForVolume(vol.id);
    const volNode: any = {
      id: String(vol.id),
      label: vol.title || 'Без названия',
      emoji: '📚',
      isGroup: true,
      canAdd: true, 
      addLabel: 'Арка',
      data: { type: 'volume', original: vol },
      children: []
    };
    
    for (const arc of arcs) {
      const chapters = getChaptersForArc(arc.id);
      const arcNode: any = {
        id: String(arc.id),
        label: arc.title || 'Без названия',
        emoji: '🌀',
        isGroup: true,
        canAdd: true, 
        addLabel: 'Глава',
        data: { type: 'arc', original: arc },
        children: []
      };
      
      for (const ch of chapters) {
        arcNode.children.push({
          id: String(ch.id),
          label: ch.title || 'Без названия',
          emoji: '📖',
          data: { type: 'chapter', original: ch }
        });
      }
      volNode.children.push(arcNode);
    }
    msNodes.push(volNode);
  }
  
  // Root arcs
  for (const arc of getRootArcs()) {
    const chapters = getChaptersForArc(arc.id);
    const arcNode: any = {
      id: String(arc.id),
      label: arc.title || 'Без названия',
      emoji: '🌀',
      isGroup: true,
      canAdd: true, 
      addLabel: 'Глава',
      data: { type: 'arc', original: arc },
      children: []
    };
    
    for (const ch of chapters) {
      arcNode.children.push({
        id: String(ch.id),
        label: ch.title || 'Без названия',
        emoji: '📖',
        data: { type: 'chapter', original: ch }
      });
    }
    msNodes.push(arcNode);
  }
  
  // Root chapters
  for (const ch of getRootChapters()) {
    msNodes.push({
      id: String(ch.id),
      label: ch.title || 'Без названия',
      emoji: '📖',
      data: { type: 'chapter', original: ch }
    });
  }
  
  sections.push({
    id: 'manuscript',
    title: 'ПРОИЗВЕДЕНИЕ',
    canAdd: true,
    itemLabel: 'Том',
    nodes: msNodes
  });
  
  // --- 2. ENTITY SECTIONS ---
  for (const sect of entitySections.value) {
    const entNodes: any[] = [];
    const entList = entities.value[sect.type] || [];
    
    for (const ent of entList) {
      entNodes.push({
        id: entityKey(sect.type, ent.id),
        label: getEntityName(ent, sect.type),
        emoji: sect.emoji,
        data: { isEntity: true, type: sect.type, original: ent, section: sect }
      });
    }
    
    sections.push({
      id: sect.type,
      title: sect.title,
      icon: sect.icon,
      canAddInline: true,
      itemLabel: sect.title.charAt(0) + sect.title.slice(1).toLowerCase(),
      nodes: entNodes
    });
  }
  
  return sections;
});

const load = async () => {
  try {
    hierarchy.value = await apiService.getHierarchy(props.project);
    await loadEntities();
  } catch (e) {
    console.error('ChapterTree load error:', e);
  }
};

watch(() => props.project, load, { immediate: true });

const hierarchyChangedHandler = () => load();

const entityRenamedHandler = (e: any) => {
  const { id, type, name } = e.detail;
  if (entities.value[type]) {
    const ent = entities.value[type].find((en: any) => String(en.id) === String(id) || String(en.id).endsWith(`:${id}`));
    if (ent) {
      const titleField = Object.keys(ent).find(k => k.toLowerCase() === 'name') || Object.keys(ent)[0];
      if (titleField) ent[titleField] = name;
      triggerRef(entities);
    }
  }
};

onMounted(() => {
  document.addEventListener('ww:hierarchy-changed', hierarchyChangedHandler);
  document.addEventListener('ww:entity-renamed', entityRenamedHandler);
});
onUnmounted(() => {
  document.removeEventListener('ww:hierarchy-changed', hierarchyChangedHandler);
  document.removeEventListener('ww:entity-renamed', entityRenamedHandler);
});

// ─── Actions ────────────────────────────────────────────────────────────────
const goBack = () => {
  window.location.href = '../../../project_launcher.html';
};

const handleSelect = (nodes: any[], event: MouseEvent) => {
  if (!nodes.length) return;
  const node = nodes[0];
  
  // Old behavior: entities were handled by handleEntityClick -> emit('open-entity')
  if (node.data?.isEntity) {
    emit('open-entity', { ...node.data.original, entityType: node.data.type });
    return;
  }
  
  if (node.data) {
    emit('select-node', { type: node.data.type, node: node.data.original });
    if (node.data.type === 'chapter') {
       if (!event?.ctrlKey && !event?.shiftKey) {
         emit('select-chapter', node.data.original);
       }
    }
  }
};

const handleOpen = (node: any) => {
  if (node.data?.isEntity) {
    emit('open-entity', { ...node.data.original, entityType: node.data.type });
  } else if (node.data?.type === 'chapter') {
    emit('select-chapter', node.data.original);
  }
};

const explorerTreeRef = ref<any>(null);

const startRename = (node: any, closeCtx: Function) => {
  closeCtx();
  explorerTreeRef.value?.startRename(node);
};

const handleCreate = async ({ sectionId, parentId, name }: { sectionId: string, parentId?: string, name?: string }) => {
  if (sectionId === 'manuscript') {
    if (!parentId) {
      const tempId = '__new_volume__';
      hierarchy.value.volumes.push({ id: tempId, title: 'Новый том', sort_order: 999 } as any);
      await nextTick();
      const node = findNodeById(tempId);
      if (node) explorerTreeRef.value?.startRename(node);
    } else {
      const tempId = '__new_arc__' + Date.now();
      hierarchy.value.arcs.push({ id: tempId, title: 'Новая арка', volumeId: parentId, sort_order: 999 } as any);
      explorerTreeRef.value?.expandNode(String(parentId));
      await nextTick();
      const node = findNodeById(tempId);
      if (node) explorerTreeRef.value?.startRename(node);
    }
  } else if (name) {
    emit('add-entity', sectionId, name);
  }
};

const handleCreateInline = async ({ sectionId, parentId }: { sectionId: string, parentId?: string }) => {
  // alert(`TREENODES clicked! sectionId: ${sectionId}, parentId: ${parentId}`);
  if (sectionId === 'manuscript') {
    if (parentId) {
      const arc = hierarchy.value.arcs.find(a => String(a.id) === String(parentId));
      if (arc) {
         emit('create-chapter-in', { arcId: arc.id, volumeId: arc.volumeId });
      } else {
         const vol = hierarchy.value.volumes.find(v => String(v.id) === String(parentId));
         if (vol) {
           handleCreate({ sectionId: 'manuscript', parentId });
         } else {
           emit('create-chapter-in', { arcId: null, volumeId: parentId });
         }
      }
    } else {
       emit('create-chapter-in', { arcId: null, volumeId: null });
    }
  } else {
    explorerTreeRef.value?.startCreate(sectionId);
  }
};

const handleRename = async (node: any, newName: string) => {
  if (!newName.trim()) return;
  try {
    if (String(node.id).startsWith('__new_volume__')) {
      await apiService.createVolume(props.project, newName);
      await load();
    } else if (String(node.id).startsWith('__new_arc__')) {
      await apiService.createArc(props.project, newName, node.data.original.volumeId);
      await load();
    } else if (node.data?.type === 'volume') {
      const vol = hierarchy.value.volumes.find((v: any) => String(v.id) === String(node.data.original.id));
      if (vol) vol.title = newName;
      await apiService.updateVolume(props.project, node.data.original.id, newName);
      await load();
    } else if (node.data?.type === 'arc') {
      const arc = hierarchy.value.arcs.find((a: any) => String(a.id) === String(node.data.original.id));
      if (arc) arc.title = newName;
      await apiService.updateArc(props.project, node.data.original.id, newName);
      await load();
    } else if (node.data?.type === 'chapter') {
      const ch = hierarchy.value.chapters.find((c: any) => String(c.id) === String(node.data.original.id));
      if (ch) ch.title = newName;
      document.dispatchEvent(new CustomEvent('ww:chapter-renamed', { detail: { id: node.data.original.id, title: newName } }));
      emit('rename-chapter', node.data.original, newName);
    } else if (node.data?.isEntity) {
      const entityType = node.data.type;
      const originalId = node.data.original.id;
      const idToUpdate = String(originalId).split(':').pop()!;
      
      if (entities.value[entityType]) {
        const ent = entities.value[entityType].find((en: any) => String(en.id) === String(originalId) || String(en.id) === String(idToUpdate));
        if (ent) {
          const titleField = Object.keys(ent).find(k => k.toLowerCase() === 'name') || Object.keys(ent)[0];
          if (titleField) ent[titleField] = newName;
        }
      }
      
      emit('rename-entity', entityType, idToUpdate, newName);
    }
  } catch (e) {
    console.error('Rename error:', e);
    await load(); // Reload to restore previous state
  }
};

const handleCancelRename = async (node: any) => {
  if (String(node.id).startsWith('__new_volume__') || String(node.id).startsWith('__new_arc__')) {
    await load(); // Just reload from server to wipe out temp object
  }
};

const handleDelete = async (ids: string[]) => {
  for (const id of ids) {
    const node = findNodeById(id);
    if (!node) continue;
    
    const type = node.data.type;
    const original = node.data.original;
    
    if (type === 'volume') {
      const arcs = getArcsForVolume(original.id).map((a: any) => a.id);
      let chapters = hierarchy.value.chapters.filter((c: any) => compareIds(c.volumeId, original.id));
      for (const arcId of arcs) chapters = chapters.concat(getChaptersForArc(arcId));
      emit('delete-volume', original, chapters, arcs, ids.length > 1);
    } else if (type === 'arc') {
      emit('delete-arc', original, getChaptersForArc(original.id), ids.length > 1);
    } else if (type === 'chapter') {
      emit('delete-chapter', original, ids.length > 1);
    } else if (node.data.isEntity) {
      emit('delete-entity', entityKey(type, original.id), type, ids.length > 1);
    }
  }
  await load();
};

const findNodeById = (id: string): any => {
  for (const sect of explorerSections.value) {
    for (const node of sect.nodes) {
      if (node.id === id) return node;
      if (node.children) {
        for (const child of node.children) {
          if (child.id === id) return child;
          if (child.children) {
             for (const gchild of child.children) {
               if (gchild.id === id) return gchild;
             }
          }
        }
      }
    }
  }
  return null;
};



defineExpose({ load });
</script>

<style scoped src="./ChapterTree/ChapterTree.style.css"></style>
