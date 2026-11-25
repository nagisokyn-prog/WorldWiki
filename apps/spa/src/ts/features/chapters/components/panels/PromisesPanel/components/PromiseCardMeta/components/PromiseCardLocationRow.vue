<template>
  <div class="meta-row flex items-center gap-1.5 relative">
    <span class="meta-icon text-accent text-sm flex-shrink-0" title="Локация действия">📍</span>

    <div class="tags-input-container flex-1 relative flex items-center">
      <input
        :value="locationDraft"
        type="text"
        placeholder="Локация (выберите или введите текст)..."
        class="tags-input flex-1"
        @input="$emit('update:locationDraft', ($event.target as HTMLInputElement).value)"
        @focus="$emit('open-dropdown')"
        @blur="$emit('blur')"
        @keydown.enter.prevent="$emit('select', locationDraft)"
        @keydown.esc="$emit('close-dropdown')"
      />

      <span
        v-if="isEntityLocation"
        class="badge-entity-link font-mono text-xs text-accent px-1.5 py-0.5 rounded border border-border flex-shrink-0 select-none"
        title="Связано с сущностью мира"
      >
        сущность
      </span>

      <button
        v-if="locationDraft.trim() || hasLocationId"
        type="button"
        class="tag-remove flex-shrink-0"
        title="Очистить локацию"
        @mousedown.stop.prevent="$emit('clear')"
      >
        ✕
      </button>

      <div
        v-if="isDropdownOpen && (filteredLocations.length > 0 || locationDraft.trim())"
        class="character-dropdown shadow-dropdown"
      >
        <div class="flex items-center justify-between px-2 py-1 border-b border-subtle text-xs text-muted">
          <span>Выберите или введите локацию:</span>
          <button type="button" class="btn-ghost-xs text-muted hover:text-main" @mousedown.stop.prevent="$emit('close-dropdown')">✕ Скрыть</button>
        </div>

        <div
          v-for="loc in filteredLocations"
          :key="loc.id"
          class="char-option interactive-el"
          @mousedown.prevent="$emit('select', loc.name)"
        >
          <span class="text-accent text-xs">📍</span>
          <span class="font-medium flex-1 text-main">{{ loc.name }}</span>
          <span class="text-xs text-muted">сущность</span>
        </div>

        <div
          v-if="locationDraft.trim() && !filteredLocations.some(l => l.name.toLowerCase() === locationDraft.trim().toLowerCase())"
          class="char-option create-custom-option interactive-el"
          @mousedown.prevent="$emit('select', locationDraft)"
        >
          <span>＋</span>
          <span>Использовать «{{ locationDraft.trim() }}»</span>
        </div>
      </div>
    </div>

    <button
      v-if="hasPreviousScene"
      type="button"
      class="btn-copy-context"
      title="Скопировать локацию, участников и арки из предыдущей сцены"
      @click="$emit('copy-context')"
    >
      📋 Из пред.
    </button>

    <span v-if="blockBadgeText" class="badge-block font-mono text-xs text-muted py-1 px-2 bg-panel rounded border border-border flex-shrink-0" title="Идентификатор блока">
      🧱 {{ blockBadgeText }}
    </span>
  </div>
</template>

<script setup lang="ts">
import type { PromiseCardLocationRowProps, PromiseCardLocationRowEmits } from '../PromiseCardMeta.model';

defineProps<PromiseCardLocationRowProps>();
defineEmits<PromiseCardLocationRowEmits>();
</script>
