<template>
  <div class="settings-scene">
    <div class="scene-header">
      <h2>◫ {{ t('settings.scenes.editor.title') }}</h2>
      <p class="scene-desc">{{ t('settings.scenes.editor.desc') }}</p>
    </div>

    <div v-auto-animate class="settings-grid">
      <!-- Вкладки -->
      <div class="settings-group">
        <h3 class="form-label settings-group-title">{{ t('settings.groupTitles.tabs', 'Вкладки (Tabs)') }}</h3>
        <div class="control-row"><label>{{ t('settings.fields.tabsPosition', 'Позиция вкладок') }}</label></div>
        <div class="radio-group">
          <div class="radio-btn" :class="{ active: settings.tabs.pos === 'row' }" @click="settings.tabs.pos = 'row'; save()">{{ t('settings.fields.top', 'Сверху') }}</div>
          <div class="radio-btn" :class="{ active: settings.tabs.pos === 'column' }" @click="settings.tabs.pos = 'column'; save()">{{ t('settings.fields.left', 'Слева') }}</div>
        </div>
      </div>

      <!-- Редактор (Сохранение) -->
      <div class="settings-group">
        <h3 class="form-label settings-group-title">Поведение и автосохранение</h3>
        
        <div class="control-row"><label>Интервал автосохранения</label><span class="val-badge">{{ settings.editor.autoSaveInterval === 0 ? 'Выкл' : settings.editor.autoSaveInterval + ' сек' }}</span></div>
        <input v-model.number="settings.editor.autoSaveInterval" type="range" min="0" max="300" step="10" class="interactive-el" @input="save()">
        
        <div class="control-row"><label>Интервал снапшотов</label><span class="val-badge">{{ settings.editor.snapshotInterval === 0 ? 'Выкл' : settings.editor.snapshotInterval + ' мин' }}</span></div>
        <input v-model.number="settings.editor.snapshotInterval" type="range" min="0" max="60" step="5" class="interactive-el" @input="save()">
        
        <div class="control-row"><label>Максимум снапшотов на главу</label><span class="val-badge">{{ settings.editor.maxSnapshots }}</span></div>
        <input v-model.number="settings.editor.maxSnapshots" type="range" min="1" max="50" step="1" class="interactive-el" @input="save()">
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import type { AppSettings } from '../../../ts/types/settings.js';

const { t } = useI18n();

const settings = defineModel<AppSettings>('settings', { required: true });

defineProps<{
  save: () => Promise<void>;
}>();
</script>
