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
        @click="$emit('update:activeTab', item.id); $emit('update:active-tab', item.id)"
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
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

defineProps<{
  activeTab: string;
}>();

defineEmits<{
  (e: 'update:activeTab', tab: string): void;
  (e: 'update:active-tab', tab: string): void;
}>();

const items = computed(() => [
  { id: 'appearance', icon: '✦', label: t('settings.scenes.appearance.title') },
  { id: 'interface', icon: '◇', label: t('settings.scenes.interface.title') },
  { id: 'motion', icon: '◌', label: t('settings.scenes.motion.title') },
  { id: 'typography', icon: 'Aa', label: t('settings.scenes.typography.title') },
  { id: 'editor', icon: '◫', label: t('settings.scenes.editor.title') },
  { id: 'performance', icon: '⚡', label: t('settings.scenes.performance.title') }
]);
</script>

<style scoped src="@worldwiki/resources/styles/components/SettingsNavRail.css"></style>
