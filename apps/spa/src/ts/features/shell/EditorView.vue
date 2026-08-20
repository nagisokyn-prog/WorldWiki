<template>
  <div v-cloak class="app-container-new">
    <AppDialog />
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
          class="flex-1 flex items-center justify-center"
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
                  class="flex-1"
                  @chapter-unsaved="markUnsaved(tab.id)"
                  @chapter-saved="markSaved(tab.id)"
                  @chapter-renamed="onChapterRenamed"
                  @open-chapter-as-tab="openChapterTab"
                  @scroll-change="handleScrollChange(groupId, tab.id, $event)"
                ></chapters-main-vue>
              </template>

              <template #entity="{ tab, groupId }">
                <div class="chapter-editor flex-1 p-6 flex-col overflow-hidden">
                  <div class="glass-card-container flex-1 flex-col">
                    <div class="glass-card-bg"></div>
                    <div class="glass-card-content flex-1 flex-col p-0 overflow-hidden">
                      <div class="chapter-toolbar flex justify-between items-center px-6 py-3 border-b">
                        <div class="toolbar-group">
                          <button
                            class="btn-outline-new interactive-el text-main cursor-pointer"
                            @click="closeEditor(tab.id)"
                          >
                            ← Назад
                          </button>
                        </div>
                        <div class="toolbar-group flex-1 ml-4">
                          <h1 class="text-accent font-bold text-base m-0">
                            {{ tab.title }}
                          </h1>
                        </div>
                        <div class="toolbar-group flex gap-2 border-none">
                          <button
                            class="btn-new btn-outline-new interactive-el"
                            title="История изменений"
                            @click="toggleEntityHistory(tab.rawId)"
                          >
                            <svg stroke="currentColor" fill="none" stroke-width="2" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round" height="16" width="16" xmlns="http://www.w3.org/2000/svg" class="inline align-middle"><path d="M7 18m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"></path><path d="M7 6m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"></path><path d="M17 6m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"></path><path d="M7 8l0 8"></path><path d="M9 18h6a2 2 0 0 0 2 -2v-5"></path><path d="M14 14l3 -3l3 3"></path></svg>
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

                      <div class="status-bar flex justify-between px-6 py-2 border-t text-xs text-muted bg-input">
                        <div>
                          <span>Готов</span>
                          <span
                            v-if="tab.unsaved"
                            class="text-accent ml-3"
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
                <div class="chapter-editor flex-1 flex-col overflow-hidden">
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
        class="panel-header-new flex justify-between"
        @click="activePanelTab = activePanelTab === '' ? 'console' : ''"
      >
        <div class="flex gap-2">
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
        <div class="text-xs pr-4 opacity-50">
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

    <div class="toast-container-new" :class="settings?.notifications?.position || 'bottom-right'">
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
      class="wowilon-toggle-btn interactive-el" 
      title="Открыть WoWiLon AI (Ctrl+Shift+A)"
      @click="toggleWowilon"
    >
      <i class="fas fa-robot"></i>
    </button>
  </div>
</template>

<script src="./EditorView.vue.ts" lang="ts"></script>

<style src="@worldwiki/resources/styles/features/shell/EditorView.css"></style>
