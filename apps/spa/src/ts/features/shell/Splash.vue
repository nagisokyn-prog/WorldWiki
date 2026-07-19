<template>
  <div class="app-container-new" v-cloak>
    <div class="app-main-new">
      <div style="flex: 1; display: flex; align-items: center; justify-content: center; flex-direction: column; gap: 16px; color: var(--text-main);">
        <div style="font-size: 18px; font-weight: 700;">World Wiki Ultimate</div>
        <div style="font-size: 12px; color: var(--text-muted);">Загрузка...</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';

onMounted(async () => {
  // init project via app shell later
});
</script>