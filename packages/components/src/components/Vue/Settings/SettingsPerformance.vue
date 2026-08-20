<!-- eslint-disable vue/no-mutating-props -->
<!-- eslint-disable @typescript-eslint/no-unused-vars -->
<template>
  <div class="settings-scene">
    <div class="scene-header">
      <h2>⚡ {{ t('settings.scenes.performance.title') }}</h2>
      <p class="scene-desc">{{ t('settings.scenes.performance.desc') }}</p>
    </div>

    <!-- LAYER 1: System Status & Profiles -->
    <div class="settings-grid">
      <div class="settings-group">
        <h3 class="form-label settings-group-title">{{ t('settings.perf.systemStatus') }}</h3>
        <div class="system-status-box">
          <div class="status-item">
            <span class="status-icon">🚀</span>
            <div class="status-info">
              <div class="status-label">{{ t('settings.perf.rendering') }}</div>
              <div class="status-value" :class="statusColorClass">
                {{ performanceManager.status.value }}
                <span class="text-xs text-muted"> (95th: {{ performanceManager.lastP95.value }}ms)</span>
              </div>
            </div>
          </div>
          <div class="status-item">
            <span class="status-icon">⚡</span>
            <div class="status-info">
              <div class="status-label">{{ t('settings.perf.powerMode') }}</div>
              <div class="status-value text-green-500">{{ t(performanceManager.batteryStatus.value) }}</div>
            </div>
          </div>
        </div>
      </div>

      <div class="settings-group">
        <h3 class="form-label settings-group-title">{{ t('settings.perf.recProfile') }}</h3>
        
        <div v-if="recommendedProfile === 'Quality' || recommendedProfile === 'Max'" class="recommended-card">
          <div class="rec-title">QUALITY</div>
          <div class="rec-subtitle">{{ t('settings.perf.recDevice') }}</div>
          <ul class="rec-reasons">
            <li>{{ t('settings.perf.reasonStable60') }}</li>
            <li>{{ t('settings.perf.reasonGPUHeadroom') }}</li>
            <li>{{ t('settings.perf.reasonACPower') }}</li>
          </ul>
        </div>
        <div v-else-if="recommendedProfile === 'Balanced'" class="recommended-card">
          <div class="rec-title">BALANCED</div>
          <div class="rec-subtitle">{{ t('settings.perf.recBattery') }}</div>
          <ul class="rec-reasons">
            <li>{{ t('settings.perf.reasonStableUI') }}</li>
            <li>{{ t('settings.perf.reasonReducedGPU') }}</li>
            <li>{{ t('settings.perf.reasonBattery') }}</li>
          </ul>
        </div>
        <div v-else class="recommended-card">
          <div class="rec-title">ECO</div>
          <div class="rec-subtitle">{{ t('settings.perf.recLimited') }}</div>
          <ul class="rec-reasons">
            <li>{{ t('settings.perf.reasonResponsive') }}</li>
            <li>{{ t('settings.perf.reasonNoGlass') }}</li>
            <li>{{ t('settings.perf.reasonMaxBattery') }}</li>
          </ul>
        </div>

        <div class="control-row mt-4"><label>{{ t('settings.perf.activeProfile') }}</label></div>
        <div class="profile-tabs">
          <div class="profile-tab" :class="{ active: settings.perf?.level === 'Eco' }" @click="setProfile('Eco')">Eco</div>
          <div class="profile-tab" :class="{ active: settings.perf?.level === 'Balanced' || settings.perf?.level === 'Automatic' || !settings.perf?.level }" @click="setProfile('Balanced')">Balanced</div>
          <div class="profile-tab" :class="{ active: settings.perf?.level === 'Quality' }" @click="setProfile('Quality')">Quality</div>
          <div class="profile-tab" :class="{ active: settings.perf?.level === 'Max' }" @click="setProfile('Max')">Max</div>
        </div>
      </div>

      <!-- LAYER 2: Advanced (Гики) -->
      <div class="settings-group advanced-group">
        <div class="advanced-header" @click="showAdvanced = !showAdvanced">
          <h3 class="form-label settings-group-title mb-0">{{ t('settings.perf.advanced') }}</h3>
          <span class="dropdown-icon" :class="{ open: showAdvanced }">▼</span>
        </div>
        
        <div v-show="showAdvanced" class="advanced-content">
          <div class="control-row">
            <label>{{ t('settings.perf.autoDowngrade') }}</label>
            <label class="toggle-switch"><input v-model="settings.perf!.autoDowngrade" type="checkbox" class="interactive-el" @change="save()"><span class="slider"></span></label>
          </div>
          
          <div class="control-row mt-3">
            <label>{{ t('settings.perf.limitAnimations') }}</label>
            <label class="toggle-switch"><input v-model="settings.perf!.limitAnimations" type="checkbox" class="interactive-el" @change="save()"><span class="slider"></span></label>
          </div>

          <div class="control-row mt-3">
            <label>{{ t('settings.perf.limitGlass') }}</label>
            <label class="toggle-switch"><input v-model="settings.perf!.limitGlass" type="checkbox" class="interactive-el" @change="save()"><span class="slider"></span></label>
          </div>

          <p class="text-xs text-muted mt-3">
            {{ t('settings.perf.advancedWarning') }}
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import type { AppSettings } from '../../../ts/types/settings.js';
import { performanceManager } from '../../../ts/services/performance.service.js';

const { t } = useI18n();

const props = defineProps<{
  settings: AppSettings;
  save: () => Promise<void>;
}>();

const showAdvanced = ref(false);

const statusColorClass = computed(() => {
  const status = performanceManager.status.value;
  if (status === 'Good') return 'text-green-500';
  if (status === 'Limited') return 'text-yellow-500';
  if (status === 'Poor') return 'text-red-500';
  return 'text-green-500';
});

const recommendedProfile = computed(() => {
  const status = performanceManager.status.value;
  if (status === 'Poor') return 'Eco';
  if (status === 'Limited') return 'Balanced';
  return 'Quality';
});

const setProfile = (level: 'Eco' | 'Balanced' | 'Quality' | 'Max') => {
  performanceManager.applyProfile(level);
  props.settings.perf!.level = level;
  props.save();
};
</script>

<style scoped>
.system-status-box {
  display: flex;
  gap: 16px;
  background: var(--bg-secondary, rgba(255,255,255,0.02));
  border: 1px solid var(--border-color, rgba(255,255,255,0.05));
  border-radius: 12px;
  padding: 16px;
}
.status-item {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
}
.status-icon {
  font-size: 24px;
}
.status-label {
  font-size: 11px;
  text-transform: uppercase;
  color: var(--text-muted);
  font-weight: 600;
  letter-spacing: 0.05em;
}
.status-value {
  font-size: 14px;
  font-weight: 500;
  margin-top: 2px;
}

.recommended-card {
  background: linear-gradient(135deg, rgba(79, 172, 254, 0.1) 0%, rgba(0, 242, 254, 0.05) 100%);
  border: 1px solid rgba(79, 172, 254, 0.2);
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 16px;
}
.rec-title {
  font-size: 16px;
  font-weight: 700;
  letter-spacing: 0.1em;
  color: var(--accent-color, #4facfe);
}
.rec-subtitle {
  font-size: 13px;
  color: var(--text-muted);
  margin-bottom: 12px;
}
.rec-reasons {
  list-style: none;
  padding: 0;
  margin: 0;
  font-size: 13px;
  color: var(--text-main);
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.profile-tabs {
  display: flex;
  background: var(--bg-input, rgba(0,0,0,0.3));
  border-radius: 8px;
  padding: 4px;
  gap: 4px;
}
.profile-tab {
  flex: 1;
  text-align: center;
  padding: 8px 0;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-muted);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}
.profile-tab:hover {
  background: rgba(255,255,255,0.05);
}
.profile-tab.active {
  background: var(--bg-panel, rgba(255,255,255,0.1));
  color: var(--text-main);
  box-shadow: 0 2px 8px rgba(0,0,0,0.2);
}

.advanced-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
  padding: 8px 0;
}
.dropdown-icon {
  font-size: 10px;
  color: var(--text-muted);
  transition: transform 0.2s;
}
.dropdown-icon.open {
  transform: rotate(180deg);
}
.advanced-content {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--border-color);
}
</style>
