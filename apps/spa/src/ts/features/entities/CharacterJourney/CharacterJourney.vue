<template>
  <div class="journey-container flex flex-col h-full w-full overflow-hidden bg-surface text-main">
    <!-- Header / Filter Toolbar -->
    <div class="journey-toolbar flex flex-wrap items-center justify-between gap-3 p-4 border-b border-subtle bg-surface">
      <div class="flex items-center gap-2">
        <span class="text-base font-bold">📜 Хроника Персонажа в Рукописи</span>
        <span v-if="timelineItems.length" class="text-xs px-2 py-0.5 rounded bg-surface-hover text-muted">
          {{ timelineItems.length }} событий
        </span>
      </div>

      <div class="flex items-center gap-2">
        <select
          v-model="filterType"
          class="journey-filter-select text-xs px-2 py-1.5 rounded border border-subtle bg-input text-main"
        >
          <option value="all">Все события</option>
          <option value="appearances">Только появления в главах</option>
          <option value="events">Только события мира</option>
          <option value="relations">Только изменения отношений</option>
          <option value="promises">Только сюжетные ружья</option>
        </select>

        <button
          class="btn-refresh text-xs px-3 py-1.5 rounded border border-subtle bg-surface-hover hover:bg-surface text-main cursor-pointer"
          :disabled="isLoading"
          @click="refresh"
        >
          🔄 {{ isLoading ? 'Загрузка...' : 'Обновить' }}
        </button>
      </div>
    </div>

    <!-- Timeline Stream -->
    <div class="journey-content flex-1 overflow-y-auto p-6">
      <div v-if="isLoading && !timelineItems.length" class="flex items-center justify-center h-48 text-muted text-sm">
        Сбор хронологии персонажа...
      </div>

      <div v-else-if="!timelineItems.length" class="flex items-center justify-center h-48 text-muted text-sm">
        У персонажа пока нет зафиксированных появлений в главах, связей или событий мира.
      </div>

      <div v-else class="timeline-stream relative pl-6 border-l-2 border-subtle ml-4 space-y-6">
        <div
          v-for="item in timelineItems"
          :key="item.id"
          class="timeline-node relative group"
        >
          <!-- Marker Dot -->
          <div
            class="timeline-dot absolute -left-[31px] top-1.5 w-3.5 h-3.5 rounded-full border-2 border-surface flex items-center justify-center"
            :class="'dot-' + (item.badgeType || 'accent')"
          ></div>

          <!-- Card Content -->
          <div class="journey-card p-4 rounded border border-subtle bg-surface hover:bg-surface-hover transition-colors shadow-sm">
            <div class="flex items-center justify-between gap-2 mb-1">
              <span class="font-bold text-sm text-main">{{ item.title }}</span>
              <span
                v-if="item.badge"
                class="badge text-2xs px-2 py-0.5 rounded font-medium"
                :class="'badge-' + (item.badgeType || 'accent')"
              >
                {{ item.badge }}
              </span>
            </div>

            <div v-if="item.subtitle" class="text-xs text-muted mb-1">
              {{ item.subtitle }}
            </div>

            <div v-if="item.description" class="text-xs text-main opacity-90 mt-2 p-2 rounded bg-input border border-subtle">
              {{ item.description }}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useCharacterJourney } from './useCharacterJourney';

const props = withDefaults(
  defineProps<{
    projectId?: string;
    entityId?: string;
  }>(),
  {
    projectId: '',
    entityId: '',
  }
);

const {
  timelineItems,
  isLoading,
  filterType,
  refresh,
} = useCharacterJourney(props.projectId, props.entityId);
</script>

<style scoped src="@worldwiki/resources/styles/features/entities/CharacterJourney.css"></style>

