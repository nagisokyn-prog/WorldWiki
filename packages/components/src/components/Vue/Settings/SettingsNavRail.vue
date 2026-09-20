<template>
  <div class="settings-nav-rail">
    <div class="nav-header">
      <div class="nav-title">{{ t('settings.categories.title') || 'Settings' }}</div>
    </div>
    
    <div class="nav-items-container">
      <div 
        v-for="item in items" 
        :key="item.id"
        class="nav-item"
        :class="{ 'is-active': activeTab === item.id }"
        @click="handleSelectTab(item.id)"
      >
        <div class="nav-item-icon">{{ item.icon }}</div>
        <div class="nav-item-label">{{ item.label }}</div>
        <div v-if="activeTab === item.id" class="nav-item-glow"></div>
        <div v-if="activeTab === item.id" class="nav-item-indicator"></div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { SettingsNavRailProps, SettingsNavRailEmits } from './SettingsNavRail.model';
import { useSettingsNavRail } from './useSettingsNavRail';

const props = defineProps<SettingsNavRailProps>();
const emit = defineEmits<SettingsNavRailEmits>();

const { t, items, handleSelectTab } = useSettingsNavRail(props, emit);
</script>

<style scoped src="@worldwiki/resources/styles/components/SettingsNavRail.css"></style>
