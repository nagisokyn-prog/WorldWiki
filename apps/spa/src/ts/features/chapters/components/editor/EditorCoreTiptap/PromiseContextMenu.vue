<template>
  <div
    v-if="isOpen"
    ref="menuRef"
    class="promise-context-menu"
    :style="{ top: `${adjustedPos.y}px`, left: `${adjustedPos.x}px` }"
    @click.stop
  >
    <!-- Header with tab switch if existing promises exist -->
    <div class="promise-menu-header">
      <span class="header-icon">🎯</span>
      <span class="header-title">Сюжетное обещание</span>
    </div>

    <!-- Mode Tabs: Создать новое / Привязать к существующему -->
    <div v-if="activeExistingPromises.length > 0" class="menu-tabs">
      <button 
        class="tab-btn" 
        :class="{ active: currentTab === 'create' }"
        @click="currentTab = 'create'"
      >
        ✨ Создать
      </button>
      <button 
        class="tab-btn" 
        :class="{ active: currentTab === 'link' }"
        @click="currentTab = 'link'"
      >
        🔗 Привязать ({{ activeExistingPromises.length }})
      </button>
    </div>

    <!-- TAB 1: CREATE NEW PROMISE -->
    <div v-if="currentTab === 'create'" class="promise-menu-items">
      <div
        v-for="(item, idx) in promiseTypes"
        :key="item.kind"
        class="promise-menu-item"
        :class="{ active: selectedIndex === idx }"
        @click="selectItem(item)"
        @mouseenter="selectedIndex = idx"
      >
        <span class="item-icon">{{ item.icon }}</span>
        <div class="item-content">
          <div class="item-label">{{ item.label }}</div>
          <div class="item-desc">{{ item.description }}</div>
        </div>
      </div>
    </div>

    <!-- TAB 2: LINK TO EXISTING PROMISE (Progress or Resolve) -->
    <div v-else-if="currentTab === 'link'" class="existing-promises-list">
      <div 
        v-for="(p, idx) in activeExistingPromises" 
        :key="p.id || p.quote || idx"
        class="existing-promise-card"
      >
        <div class="existing-promise-info">
          <span class="promise-kind-badge">{{ p.kindIcon }} {{ p.kindLabel }}</span>
          <div class="promise-quote-preview">«{{ p.quote }}»</div>
        </div>
        
        <div class="milestone-action-buttons">
          <template v-if="p.kind === 'scene'">
            <button 
              class="btn-milestone btn-progress" 
              title="Привязать как дочернюю сцену"
              @click="selectSubScene(p)"
            >
              🎬 Привязать под-сцену
            </button>
          </template>
          <template v-else>
            <button 
              class="btn-milestone btn-progress" 
              title="Добавить как этап развития / напоминания"
              @click="selectMilestone(p, 'progression')"
            >
              🌿 Развить
            </button>
            <button 
              class="btn-milestone btn-resolve" 
              title="Отметить как развязку / выстрел ружья"
              @click="selectMilestone(p, 'resolution')"
            >
              🎯 Отстрелять
            </button>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { 
  usePromiseContextMenu, 
  type PromiseContextMenuProps, 
  type PromiseContextMenuEmits,
  type PromiseTypeOption 
} from './usePromiseContextMenu';

export type { PromiseTypeOption };

const props = defineProps<PromiseContextMenuProps>();
const emit = defineEmits<PromiseContextMenuEmits>();

const {
  menuRef,
  selectedIndex,
  currentTab,
  adjustedPos,
  promiseTypes,
  activeExistingPromises,
  selectItem,
  selectMilestone,
  selectSubScene
} = usePromiseContextMenu(props, emit);
</script>

<style scoped src="@worldwiki/resources/styles/features/chapters/PromiseContextMenu.css"></style>
