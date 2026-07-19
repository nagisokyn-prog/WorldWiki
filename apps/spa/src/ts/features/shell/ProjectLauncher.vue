<template>
  <div class="app-container-new" v-cloak>
    <div class="app-main-new">
      <div style="flex: 1; display: flex; align-items: center; justify-content: center; flex-direction: column; gap: 16px; color: var(--text-main);">
        <div style="font-size: 18px; font-weight: 700;">Выбор проекта</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useAppShell } from '@/composables/useAppShell';

useAppShell({ projectName: 'default', sidebarItems: [] });
</script>