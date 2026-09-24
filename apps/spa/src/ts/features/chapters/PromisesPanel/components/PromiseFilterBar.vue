<template>
  <div class="promise-filters-bar">
    <div class="scope-tabs">
      <button 
        class="tab-pill" 
        :class="{ active: scopeFilter === 'all' }"
        @click="$emit('update:scopeFilter', 'all')"
      >
        Все ({{ totalCount }})
      </button>
      <button 
        class="tab-pill" 
        :class="{ active: scopeFilter === 'current' }"
        @click="$emit('update:scopeFilter', 'current')"
      >
        В этой главе ({{ chapterCount }})
      </button>
    </div>

    <!-- Фильтр по категории: Все / Сцены / Обещания -->
    <div class="category-tabs flex gap-1 my-1">
      <button
        class="tab-pill text-2xs"
        :class="{ active: categoryFilter === 'all' }"
        @click="$emit('update:categoryFilter', 'all')"
      >
        🎯 Все
      </button>
      <button
        class="tab-pill text-2xs"
        :class="{ active: categoryFilter === 'scenes' }"
        @click="$emit('update:categoryFilter', 'scenes')"
      >
        🎬 Сцены & Конфликты
      </button>
      <button
        class="tab-pill text-2xs"
        :class="{ active: categoryFilter === 'promises' }"
        @click="$emit('update:categoryFilter', 'promises')"
      >
        🔫 Ружья & Обещания
      </button>
    </div>

    <!-- Фильтр по статусу -->
    <div class="status-pills">
      <button 
        class="status-pill-btn" 
        :class="{ active: statusFilter === 'all' }"
        @click="$emit('update:statusFilter', 'all')"
      >
        Все
      </button>
      <button 
        v-for="st in statuses"
        :key="st.id"
        class="status-pill-btn" 
        :class="{ active: statusFilter === st.id }"
        @click="$emit('update:statusFilter', st.id)"
      >
        {{ st.icon }} {{ st.label }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  scopeFilter: 'all' | 'current';
  statusFilter: string;
  categoryFilter: 'all' | 'scenes' | 'promises';
  totalCount: number;
  chapterCount: number;
  statuses: Array<{ id: string; label: string; icon: string }>;
}>();

defineEmits<{
  (e: 'update:scopeFilter', val: 'all' | 'current'): void;
  (e: 'update:statusFilter', val: string): void;
  (e: 'update:categoryFilter', val: 'all' | 'scenes' | 'promises'): void;
}>();
</script>
