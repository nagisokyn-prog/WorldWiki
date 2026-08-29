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

<style scoped>
.settings-nav-rail {
  width: 240px;
  display: flex;
  flex-direction: column;
  padding: 16px 12px;
  border-right: 1px solid var(--border-color);
  background: var(--bg-secondary);
  flex-shrink: 0;
}

.nav-header {
  padding: 0 12px 16px 12px;
  margin-bottom: 8px;
}

.nav-title {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--text-muted);
}

.nav-items-container {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.nav-item {
  position: relative;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-radius: var(--radius-xs, 8px);
  cursor: pointer;
  color: var(--text-muted);
  transition: all 0.2s ease;
  overflow: hidden;
}

.nav-item:hover {
  background: var(--bg-hover);
  color: var(--text-main);
}

.nav-item.is-active {
  color: var(--text-main);
  background: var(--bg-selected);
}

.nav-item-icon {
  font-size: 16px;
  width: 20px;
  text-align: center;
}

.nav-item-label {
  font-size: 14px;
  font-weight: 500;
}

.nav-item-indicator {
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 3px;
  height: 60%;
  background: var(--accent);
  border-radius: 0 4px 4px 0;
  box-shadow: var(--shadow-glow);
}

.nav-item-glow {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: radial-gradient(circle at 10% 50%, var(--accent) 0%, transparent 70%);
  opacity: 0.1;
  pointer-events: none;
}
</style>
