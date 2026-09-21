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
                {{ status }}
                <span class="text-xs text-muted"> (95th: {{ lastP95 }}ms)</span>
              </div>
            </div>
          </div>
          <div class="status-item">
            <span class="status-icon">⚡</span>
            <div class="status-info">
              <div class="status-label">{{ t('settings.perf.powerMode') }}</div>
              <div class="status-value text-success">{{ t(batteryStatus) }}</div>
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
          <div class="profile-tab" :class="{ active: activeLevel === 'Eco' }" @click="setProfile('Eco')">Eco</div>
          <div class="profile-tab" :class="{ active: activeLevel === 'Balanced' || activeLevel === 'Automatic' }" @click="setProfile('Balanced')">Balanced</div>
          <div class="profile-tab" :class="{ active: activeLevel === 'Quality' }" @click="setProfile('Quality')">Quality</div>
          <div class="profile-tab" :class="{ active: activeLevel === 'Max' }" @click="setProfile('Max')">Max</div>
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
            <label class="toggle-switch"><input v-model="autoDowngrade" type="checkbox" class="interactive-el"><span class="slider"></span></label>
          </div>
          
          <div class="control-row mt-3">
            <label>{{ t('settings.perf.limitAnimations') }}</label>
            <label class="toggle-switch"><input v-model="limitAnimations" type="checkbox" class="interactive-el"><span class="slider"></span></label>
          </div>

          <div class="control-row mt-3">
            <label>{{ t('settings.perf.limitGlass') }}</label>
            <label class="toggle-switch"><input v-model="limitGlass" type="checkbox" class="interactive-el"><span class="slider"></span></label>
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
import type { AppSettings } from '../../../ts/types/settings.js';
import { useSettingsPerformance } from './useSettingsPerformance';

const settings = defineModel<AppSettings>('settings', { required: true });

const emit = defineEmits<{
  (e: 'save'): void;
}>();

const {
  t,
  status,
  lastP95,
  batteryStatus,
  activeLevel,
  showAdvanced,
  statusColorClass,
  recommendedProfile,
  autoDowngrade,
  limitAnimations,
  limitGlass,
  setProfile
} = useSettingsPerformance(() => settings.value, () => emit('save'));
</script>

<style scoped src="@worldwiki/resources/styles/components/SettingsPerformance.css"></style>
