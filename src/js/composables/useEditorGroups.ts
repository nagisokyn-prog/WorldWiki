/**
 * useEditorGroups — VS Code-style editor groups (split panes)
 *
 * Each "group" is an independent panel with its own tab bar and active tab.
 * Ctrl+\ adds a new group (splits right). Tabs can be dragged between groups.
 */

import { reactive, ref, computed } from 'vue';

export interface EditorTab {
  id: string;
  rawId: string;
  title: string;
  entityType: string;
  tabType: 'entity' | 'chapter';
  data: Record<string, unknown>;
  unsaved: boolean;
  scrollPos?: number;
  activeSection?: string;
}

export interface EditorGroup {
  id: string;       // уникальный id группы (UUID-lite)
  tabs: EditorTab[];
  activeTabId: string | null;
  flexBasis: number; // % ширины, все группы суммируются до ~100
}

let _groupCounter = 1;
const mkGroupId = () => `grp-${Date.now()}-${_groupCounter++}`;

export function useEditorGroups() {
  // ─── State ────────────────────────────────────────────────────────────────
  // reactive() делает DEEP реактивность — мутации вложенных объектов (group.activeTabId,
  // tab.unsaved и т.д.) корректно триггерят Vue рендеринг.
  const state = reactive<{ groups: EditorGroup[] }>({
    groups: [{ id: mkGroupId(), tabs: [], activeTabId: null, flexBasis: 100 }]
  });

  // Публичный ref-совместимый proxy — для обратной совместимости с кодом, использующим groups.value
  const groups = computed(() => state.groups);

  // Фокусированная группа (где последний клик)
  const activeGroupId = ref<string>(state.groups[0].id);

  // ─── Computed ─────────────────────────────────────────────────────────────
  const activeGroup = computed(
    () => state.groups.find(g => g.id === activeGroupId.value) ?? state.groups[0]
  );

  // Единый плоский список всех вкладок (для обратной совместимости с save/restore)
  const allTabs = computed<EditorTab[]>(() => {
    const seen = new Set<string>();
    const result: EditorTab[] = [];
    for (const g of state.groups) {
      for (const t of g.tabs) {
        if (!seen.has(t.id)) { seen.add(t.id); result.push(t); }
      }
    }
    return result;
  });

  // Активная вкладка глобально (в активной группе)
  const activeTab = computed(() =>
    activeGroup.value?.tabs.find(t => t.id === activeGroup.value?.activeTabId) ?? null
  );

  // ─── Helpers ──────────────────────────────────────────────────────────────
  const findTabGlobal = (tabId: string): EditorTab | null => {
    for (const g of state.groups) {
      const t = g.tabs.find(t => t.id === tabId);
      if (t) return t;
    }
    return null;
  };

  const findGroupByTab = (tabId: string): EditorGroup | null =>
    state.groups.find(g => g.tabs.some(t => t.id === tabId)) ?? null;

  const rebalance = () => {
    const n = state.groups.length;
    if (n === 0) return;
    const base = Math.floor(100 / n);
    const rem = 100 - base * n;
    state.groups.forEach((g, i) => { g.flexBasis = base + (i === 0 ? rem : 0); });
  };

  // ─── Tab Operations ───────────────────────────────────────────────────────

  /** Открыть/активировать вкладку в группе (по умолчанию — активная группа) */
  const openTab = (tab: EditorTab, groupId?: string) => {
    const gid = groupId ?? activeGroupId.value;
    let g = state.groups.find(g => g.id === gid) ?? state.groups[0];

    // Если вкладка уже есть в этой группе — просто активируем
    const existing = g.tabs.find(t => t.id === tab.id);
    if (existing) {
      g.activeTabId = tab.id;
      activeGroupId.value = g.id;
      return;
    }

    // Если вкладки нет — добавляем
    g.tabs.push(tab);
    g.activeTabId = tab.id;
    activeGroupId.value = g.id;
  };


  /** Закрыть вкладку (в любой группе) */
  const closeTab = (tabId: string, force = false): boolean => {
    const g = findGroupByTab(tabId);
    if (!g) return true;

    const idx = g.tabs.findIndex(t => t.id === tabId);
    if (idx < 0) return true;

    if (!force && g.tabs[idx].unsaved) {
      if (!confirm('Есть несохраненные изменения. Закрыть?')) return false;
    }

    g.tabs.splice(idx, 1);

    // Активируем соседнюю вкладку
    if (g.activeTabId === tabId) {
      g.activeTabId = g.tabs[Math.max(0, idx - 1)]?.id ?? g.tabs[0]?.id ?? null;
    }

    // Если группа стала пустой и групп > 1 — удаляем группу
    if (g.tabs.length === 0 && state.groups.length > 1) {
      removeGroup(g.id);
    } else if (g.tabs.length === 0) {
      // Единственная группа — оставляем пустой
    }

    return true;
  };

  /** Обновить данные вкладки во всех группах */
  const updateTabData = (tabId: string, patch: Partial<EditorTab>) => {
    for (const g of state.groups) {
      const t = g.tabs.find(t => t.id === tabId);
      if (t) { Object.assign(t, patch); }
    }
  };

  /** Пометить вкладку как modified */
  const markTabUnsaved = (tabId: string) => updateTabData(tabId, { unsaved: true });
  const markTabSaved   = (tabId: string) => updateTabData(tabId, { unsaved: false });

  // ─── Group Operations ─────────────────────────────────────────────────────

  /** Добавить новую пустую группу справа от указанной (или справа от активной) */
  const splitRight = (sourceGroupId?: string) => {
    const sourceId = sourceGroupId ?? activeGroupId.value;
    const sourceIdx = state.groups.findIndex(g => g.id === sourceId);

    const newGroup: EditorGroup = {
      id: mkGroupId(),
      tabs: [],
      activeTabId: null,
      flexBasis: 50,
    };

    // Клонируем активную вкладку в новую группу если она есть
    const src = state.groups[sourceIdx];
    if (src?.activeTabId) {
      const srcTab = src.tabs.find(t => t.id === src.activeTabId);
      if (srcTab) {
        newGroup.tabs.push(srcTab);
        newGroup.activeTabId = srcTab.id;
      }
    }

    // Вставляем после sourceIdx
    const insertIdx = sourceIdx >= 0 ? sourceIdx + 1 : state.groups.length;
    state.groups.splice(insertIdx, 0, newGroup);
    rebalance();
    activeGroupId.value = newGroup.id;
  };

  /** Удалить группу */
  const removeGroup = (groupId: string) => {
    const idx = state.groups.findIndex(g => g.id === groupId);
    if (idx < 0) return;
    state.groups.splice(idx, 1);
    rebalance();

    // Переключаемся на соседнюю группу
    if (state.groups.length > 0) {
      const nextIdx = Math.min(idx, state.groups.length - 1);
      activeGroupId.value = state.groups[nextIdx].id;
    }
  };

  /** Переместить вкладку из одной группы в другую */
  const moveTab = (tabId: string, targetGroupId: string, targetIndex?: number) => {
    const srcGroup = findGroupByTab(tabId);
    if (!srcGroup) return;

    const tab = srcGroup.tabs.find(t => t.id === tabId)!;
    const srcIdx = srcGroup.tabs.indexOf(tab);
    srcGroup.tabs.splice(srcIdx, 1);

    const tgtGroup = state.groups.find(g => g.id === targetGroupId);
    if (!tgtGroup) {
      srcGroup.tabs.splice(srcIdx, 0, tab);
      return;
    }

    const insertAt = targetIndex !== undefined ? targetIndex : tgtGroup.tabs.length;
    tgtGroup.tabs.splice(insertAt, 0, tab);
    tgtGroup.activeTabId = tab.id;
    activeGroupId.value = targetGroupId;

    if (srcGroup.activeTabId === tabId) {
      srcGroup.activeTabId = srcGroup.tabs[Math.max(0, srcIdx - 1)]?.id ?? srcGroup.tabs[0]?.id ?? null;
    }

    if (srcGroup.tabs.length === 0 && state.groups.length > 1) {
      removeGroup(srcGroup.id);
    }
  };

  /** Переупорядочить вкладку внутри группы */
  const reorderTab = (groupId: string, fromIdx: number, toIdx: number) => {
    const g = state.groups.find(g => g.id === groupId);
    if (!g || fromIdx === toIdx) return;
    const [tab] = g.tabs.splice(fromIdx, 1);
    g.tabs.splice(toIdx, 0, tab);
  };

  // ─── Ctrl+Tab within active group ────────────────────────────────────────
  const switchTabInGroup = (groupId: string, dir: 1 | -1) => {
    const g = state.groups.find(g => g.id === groupId);
    if (!g || g.tabs.length < 2) return;
    const idx = g.tabs.findIndex(t => t.id === g.activeTabId);
    const next = (idx + dir + g.tabs.length) % g.tabs.length;
    g.activeTabId = g.tabs[next].id;
  };

  // ─── Close all ───────────────────────────────────────────────────────────
  const closeAll = (force = false) => {
    const hasUnsaved = allTabs.value.some(t => t.unsaved);
    if (!force && hasUnsaved && !confirm('Есть несохранённые изменения. Закрыть всё?')) return;

    state.groups.splice(0, state.groups.length,
      { id: mkGroupId(), tabs: [], activeTabId: null, flexBasis: 100 }
    );
    activeGroupId.value = state.groups[0].id;
  };

  // ─── Persistence ─────────────────────────────────────────────────────────
  const serializeState = () => state.groups.map(g => ({
    id: g.id,
    flexBasis: g.flexBasis,
    activeTabId: g.activeTabId,
    tabs: g.tabs.map(t => ({
      id: t.id, rawId: t.rawId, title: t.title,
      entityType: t.entityType, tabType: t.tabType,
      scrollPos: t.scrollPos, activeSection: t.activeSection
    }))
  }));

  const restoreState = (serialized: ReturnType<typeof serializeState>, loadedTabs: Map<string, EditorTab>) => {
    if (!serialized?.length) return;
    const restored = serialized.map(s => ({
      id: s.id,
      flexBasis: s.flexBasis,
      activeTabId: s.activeTabId,
      tabs: s.tabs.map(t => loadedTabs.get(t.id)).filter(Boolean) as EditorTab[]
    }));
    state.groups.splice(0, state.groups.length, ...restored);
    activeGroupId.value = state.groups[0]?.id ?? '';
  };

  return {
    groups,
    activeGroupId,
    activeGroup,
    activeTab,
    allTabs,
    openTab,
    closeTab,
    updateTabData,
    markTabUnsaved,
    markTabSaved,
    splitRight,
    removeGroup,
    moveTab,
    reorderTab,
    switchTabInGroup,
    closeAll,
    serializeState,
    restoreState,
    findTabGlobal,
    findGroupByTab,
  };
}
