<template>
  <div v-cloak class="app-container-new">
    <div class="app-main-new">
      <!-- Universal Sidebar (VS Code Explorer Style) -->
      <div
        v-show="sidebarVisible"
        class="sidebar-universal"
        :style="{ width: sidebarWidth + 'px' }"
      >
        <chapter-tree-vue
          ref="chapterTreeRef"
          :project="projectName"
          :active-editor-id="activeEditorId"
          @open-entity="openEntity"
          @select-chapter="openChapterTab"
          @select-node="selectTreeNode"
          @add-entity="addNewEntity"
          @create-chapter-in="createChapterIn"
          @rename-chapter="renameChapter"
          @delete-chapter="deleteChapter"
          @rename-entity="renameEntity"
          @delete-entity="deleteEntity"
          @delete-volume="deleteVolume"
          @delete-arc="deleteArc"
          @open-sandbox="openSandbox"
          @edit-schema="openSchemaEditor"
        ></chapter-tree-vue>
      </div>

      <!-- Sidebar resize handle -->
      <div
        class="sidebar-resize-handle"
        @mousedown.prevent="startSidebarResize"
      ></div>

      <!-- Main editor area -->
      <div class="content-area-new">
        <div
          v-if="activeView === 'sandbox'"
          style="flex: 1; display: flex; align-items: center; justify-content: center;"
        >
          <h2>Песочница удалена в рамках Phase 5.</h2>
        </div>

        <div v-else class="editor-groups-container" @mousedown.stop>
          <template v-for="(group, gIdx) in editorGroups" :key="group.id">
            <editor-group-pane-vue
              :group="group"
              :is-active="activeGroupId === group.id"
              :can-close="editorGroups.length > 1"
              :is-sandbox="false"
              :style="{ flexBasis: group.flexBasis + '%' }"
              @focus="focusGroup(group.id)"
              @activate-tab="activateTabInGroup"
              @close-tab="onGroupCloseTab"
              @split="splitRight"
              @close-group="closeGroup"
              @move-tab="moveTab"
              @reorder-tab="reorderTab"
            >
              <template #chapter="{ tab, groupId }">
                <chapters-main-vue
                  :key="tab.id + '-' + groupId"
                  :project="projectName"
                  :controlled-chapter-id="tab.id"
                  :active-tree-node="activeTreeNode"
                  style="flex: 1"
                  @chapter-unsaved="markUnsaved(tab.id)"
                  @chapter-saved="markSaved(tab.id)"
                  @chapter-renamed="onChapterRenamed"
                  @open-chapter-as-tab="openChapterTab"
                  @scroll-change="handleScrollChange(groupId, tab.id, $event)"
                ></chapters-main-vue>
              </template>

              <template #entity="{ tab, groupId }">
                <div
                  class="chapter-editor"
                  style="
                    flex: 1;
                    padding: 24px;
                    display: flex;
                    flex-direction: column;
                    min-height: 0;
                    overflow: hidden;
                  "
                >
                  <div
                    class="glass-card-container"
                    style="
                      flex: 1;
                      display: flex;
                      flex-direction: column;
                      min-height: 0;
                    "
                  >
                    <div class="glass-card-bg"></div>
                    <div
                      class="glass-card-content"
                      style="
                        flex: 1;
                        display: flex;
                        flex-direction: column;
                        min-height: 0;
                        padding: 0;
                        overflow: hidden;
                      "
                    >
                      <div
                        class="chapter-toolbar"
                        style="
                          display: flex;
                          justify-content: space-between;
                          align-items: center;
                          padding: 12px 24px;
                          border-bottom: 1px solid var(--border-color);
                        "
                      >
                        <div class="toolbar-group">
                          <button
                            class="btn-outline-new interactive-el"
                            style="
                              padding: 6px 12px;
                              border-radius: 8px;
                              border: 1px solid var(--border-color);
                              background: transparent;
                              color: var(--text-main);
                              cursor: pointer;
                            "
                            @click="closeEditor(tab.id)"
                          >
                            ← Назад
                          </button>
                        </div>
                        <div class="toolbar-group" style="flex: 1; margin-left: 16px">
                          <h1
                            style="
                              font-size: 16px;
                              font-weight: 600;
                              margin: 0;
                              color: var(--accent);
                            "
                          >
                            {{ tab.title }}
                          </h1>
                        </div>
                        <div class="toolbar-group" style="border: none; display: flex; gap: 8px">
                          <button
                            class="btn-new btn-outline-new interactive-el"
                            title="История изменений"
                            @click="toggleEntityHistory(tab.rawId)"
                          >
                            <svg stroke="currentColor" fill="none" stroke-width="2" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round" height="16" width="16" xmlns="http://www.w3.org/2000/svg" style="display:inline;vertical-align:middle"><path d="M7 18m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"></path><path d="M7 6m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"></path><path d="M17 6m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"></path><path d="M7 8l0 8"></path><path d="M9 18h6a2 2 0 0 0 2 -2v-5"></path><path d="M14 14l3 -3l3 3"></path></svg>
                          </button>
                          <button class="btn-new interactive-el" @click="saveAll">
                            💾 Сохранить
                          </button>
                          <button
                            class="btn-new interactive-el"
                            style="background: rgba(239, 68, 68, 0.4)"
                            @click="deleteEntity(tab.id, tab.entityType)"
                          >
                            🗑️
                          </button>
                          <button
                            class="btn-new interactive-el"
                            title="Открыть в новой панели (Ctrl+\)"
                            style="background: rgba(139, 92, 246, 0.2)"
                            @click="splitRight()"
                          >
                            ⬜⬜
                          </button>
                        </div>
                      </div>

                      <entity-editor-vue
                        :key="tab.id + '-' + groupId"
                        :entity-id="tab.rawId"
                        :entity-type="tab.entityType"
                        :project="projectName || 'default'"
                        :initial-data="tab.data"
                        :initial-section="tab.activeSection"
                        :initial-scroll-pos="tab.scrollPos"
                        @update-data="handleUpdateData(tab.id, $event)"
                        @modified="markUnsaved(tab.id)"
                        @section-change="handleSectionChange(groupId, tab.id, $event)"
                        @scroll-change="handleScrollChange(groupId, tab.id, $event)"
                      ></entity-editor-vue>

                      <div
                        class="status-bar"
                        style="
                          display: flex;
                          justify-content: space-between;
                          padding: 8px 24px;
                          border-top: 1px solid var(--border-color);
                          font-size: 11px;
                          color: var(--text-muted);
                          background: var(--bg-input);
                        "
                      >
                        <div>
                          <span>Готов</span>
                          <span
                            v-if="tab.unsaved"
                            style="color: var(--accent); margin-left: 12px"
                            >● Есть изменения</span
                          >
                        </div>
                        <span>ID: {{ tab.id }}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </template>

              <template #schema-editor="{ tab, groupId }">
                <div
                  class="chapter-editor"
                  style="
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    min-height: 0;
                    overflow: hidden;
                  "
                >
                  <schema-editor-main-vue
                    :key="tab.id + '-' + groupId"
                    :project="projectName"
                    :entity-type="tab.entityType"
                    :initial-scroll-pos="tab.scrollPos"
                    :initial-section="tab.activeSection"
                    @scroll-change="handleScrollChange(groupId, tab.id, $event)"
                    @section-change="handleSectionChange(groupId, tab.id, $event)"
                    @modified="markUnsaved(tab.id)"
                    @close="closeEditor(tab.id)"
                  ></schema-editor-main-vue>
                </div>
              </template>
            </editor-group-pane-vue>

            <div
              v-if="Number(gIdx) < editorGroups.length - 1"
              :key="'resize-'+group.id"
              class="group-resize-handle"
              @mousedown.prevent="startGroupResize($event, Number(gIdx))"
            ></div>
          </template>
        </div>
      </div>

      <!-- WoWiLon AI Panel (Right Sidebar) -->
      <wowilon-panel-vue
        :is-open="isWowilonOpen"
        @close="toggleWowilon"
      ></wowilon-panel-vue>
    </div>

    <div
      class="panel-new"
      :style="activePanelTab !== '' ? { height: panelHeight + 'px' } : { height: '36px' }"
    >
      <div
        v-if="activePanelTab !== ''"
        class="terminal-resize-handle"
        @mousedown.prevent="startResize"
      ></div>
      <div
        class="panel-header-new"
        style="justify-content: space-between"
        @click="activePanelTab = activePanelTab === '' ? 'console' : ''"
      >
        <div style="display: flex; gap: 8px">
          <div
            class="panel-tab-new interactive-el"
            :class="{ active: activePanelTab === 'console' }"
            @click.stop="activePanelTab = 'console'"
          >
            💻 Терминал Системы
          </div>
          <div
            class="panel-tab-new interactive-el"
            :class="{ active: activePanelTab === 'stats' }"
            @click.stop="activePanelTab = 'stats'"
          >
            📊 Аналитика
          </div>
        </div>
        <div style="font-size: 11px; padding-right: 16px; opacity: 0.5">
          {{ activePanelTab === '' ? '▲ Развернуть панель' : '▼ Свернуть панель' }}
        </div>
      </div>
      <div v-show="activePanelTab !== ''" class="panel-content-new">
        <div v-if="activePanelTab === 'console'">
          <div
            v-for="log in consoleLogs.slice(0, 100)"
            :key="log.id"
            class="console-line"
            :class="log.type"
          >
            <span class="console-time">[{{ log.timestamp }}]</span>
            <span>{{ log.text }}</span>
          </div>
        </div>
      </div>
    </div>

    <quick-open-vue
      ref="quickOpenRef"
      :data-source="quickOpenDataSource"
      @select="handleQuickOpenSelect"
    ></quick-open-vue>

    <command-palette-vue
      ref="commandPaletteRef"
      @save-all="saveAll"
      @new-entity="addNewEntity(currentSidebarTab || '')"
      @new-chapter="createChapterIn({})"
      @open-settings="toggleSettings()"
      @toggle-sidebar="sidebarVisible = !sidebarVisible"
      @toggle-panel="activePanelTab = activePanelTab === '' ? 'console' : ''"
      @close-all-tabs="closeAllTabs()"
      @zoom-in="applyZoom(zoomLevel + 0.1)"
      @zoom-out="applyZoom(zoomLevel - 0.1)"
      @zoom-reset="applyZoom(1)"
      @open-quick="quickOpenRef?.open()"
      @open-tags="openTagsManager()"
      @open-sandbox="openSandbox()"
    ></command-palette-vue>

    <tags-manager-modal-vue
      ref="tagsManagerRef"
      :project="projectName"
    ></tags-manager-modal-vue>

    <div class="toast-container-new" :class="settings.settings?.notifications?.position || 'bottom-right'">
      <transition-group name="fade">
        <div v-for="toast in toasts" :key="toast.id" class="toast-new">
          <i :class="getToastIcon(toast.type)"></i>
          <span>{{ toast.text }}</span>
        </div>
      </transition-group>
    </div>

    <!-- Global Floating Button for AI -->
    <button 
      v-show="!isWowilonOpen" 
      class="wowilon-toggle-btn" 
      style="position: fixed; bottom: 20px; right: 20px; width: 44px; height: 44px; border-radius: 50%; background: var(--accent); color: white; border: none; font-size: 20px; cursor: pointer; box-shadow: 0 4px 12px rgba(0,0,0,0.3); z-index: 999; display: flex; align-items: center; justify-content: center; transition: transform 0.2s;"
      onmouseover="this.style.transform='scale(1.1)'"
      onmouseout="this.style.transform='scale(1)'"
      title="Открыть WoWiLon AI (Ctrl+Shift+A)"
      @click="toggleWowilon"
    >
      <i class="fas fa-robot"></i>
    </button>
  </div>
</template>

<script src="./EditorView.vue.ts" lang="ts"></script>
