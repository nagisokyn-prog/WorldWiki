<template>
  <div v-if="containers && containers.length > 0" class="mt-4">
    <template v-for="(container, cIdx) in containers" :key="container.id">
      <div
        v-if="!container.hidden && !isContainerHidden(container.dataPath || container.id || '')"
        :class="{ 'history-changed': isFieldChanged(container.dataPath || container.id || '') }"
        class="glass-card dynamic-container-card mb-4 p-4 relative"
        :style="{ '--z-stack': 100 - cIdx }"
      >
        <div class="flex justify-between items-center mb-2">
          <h4 class="text-xs font-bold text-muted uppercase tracking-wide">
            {{ container.title || 'Дополнительно' }}
            <span v-if="isFieldChanged(container.dataPath || container.id || '')" class="changed-indicator" title="Связи отличаются от текущей версии">Изменено</span>
          </h4>
          <div class="flex items-center gap-2">
            <button
              v-if="getDynamicList(container).length > 1"
              type="button"
              class="btn-new btn-outline-new text-xs interactive-el py-0.5 px-2"
              :title="areAllCollapsed(container.dataPath || container.id || '', getDynamicList(container).length) ? 'Развернуть все элементы' : 'Свернуть все элементы'"
              @click.stop="$emit('toggleAllCollapse', container.dataPath || container.id || '', getDynamicList(container).length)"
            >
              {{ areAllCollapsed(container.dataPath || container.id || '', getDynamicList(container).length) ? 'Развернуть все' : 'Свернуть все' }}
            </button>
            <button
              v-if="canHideContainer(container)"
              type="button"
              class="container-hide-btn btn-new btn-outline-new text-xs interactive-el"
              title="Скрыть блок для этой сущности"
              @click.stop="$emit('hideContainer', container.dataPath || container.id || '')"
            >
              👁️‍🗨️ Скрыть
            </button>
            <button
              class="btn btn-small btn-outline interactive-el"
              @click="$emit('addDynamicItem', container.dataPath || container.id || '', container.template || '')"
            >
              ➕ Добавить
            </button>
          </div>
        </div>

        <div v-if="getDynamicList(container).length === 0" class="empty-timeline">
          {{ container.emptyMessage || 'Элементы не добавлены' }}
        </div>

        <div v-else class="relative z-50">
          <!-- Двусторонние связи — свой компонент -->
          <template v-if="container.isBidirectional || getResolvedTemplate(container)?.isBidirectional">
            <RelationshipBlock
              v-for="(item, idx) in getDynamicList(container)"
              :key="idx"
              :item="item"
              :idx="idx"
              :template-conf="getTemplateConf(container)"
              :all-templates="getAllTemplates()"
              :reference-data="referenceData || {}"
              :entity-id="entityId"
              :entity-type="entityType"
              :project="project"
              @remove="$emit('removeDynamicItem', container.dataPath || container.id || '', idx)"
              @modified="$emit('modified')"
              @foreign-update="$emit('foreignUpdate', $event)"
              @item-updated="handleItemUpdated(container, idx, $event)"
            />
          </template>

          <!-- Обычные динамические элементы -->
          <template v-else>
            <EntityDynamicItemCard
              v-for="(item, idx) in getDynamicList(container)"
              :key="idx"
              :item="item"
              :idx="idx"
              :container="container"
              :project="project"
              :wheel-horizontal="wheelHorizontal"
              :is-item-collapsed="isItemCollapsed"
              :get-item-summary="getItemSummary"
              :get-resolved-template="getResolvedTemplate"
              :get-prop="getProp"
              :set-prop="setProp"
              :get-options-for="getOptionsFor"
              :is-chapter-field="isChapterField"
              @toggle-collapse="onToggleCollapse"
              @remove="onRemoveItem"
              @modified="$emit('modified')"
            />
          </template>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { RelationshipBlock } from '@/shared/ui';
import EntityDynamicItemCard from '../EntityDynamicItemCard/EntityDynamicItemCard.vue';
import type { EntityDynamicContainersProps, EntityDynamicContainersEmits } from './EntityDynamicContainers.model';
import { useEntityDynamicContainers } from './useEntityDynamicContainers';

const props = defineProps<EntityDynamicContainersProps>();
const emit = defineEmits<EntityDynamicContainersEmits>();

const {
  getTemplateConf,
  getAllTemplates,
  handleItemUpdated,
  onToggleCollapse,
  onRemoveItem,
} = useEntityDynamicContainers(props, emit);
</script>
