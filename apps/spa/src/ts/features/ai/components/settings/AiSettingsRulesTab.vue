<template>
  <div class="tab-pane">
    <div class="sandbox-header">
      <h3>Точечный контроль (Granular)</h3>
      <div class="toggle-switch">
        <input id="is-global-setting" v-model="isGlobal" type="checkbox">
        <label for="is-global-setting">Применить для всех проектов</label>
      </div>
    </div>

    <p class="text-muted" style="font-size: 13px; margin-bottom: 20px;">
      Переопределение правил автоодобрения для конкретных типов сущностей.
    </p>
    
    <div class="form-group">
      <label>Denylist (Чёрный список)</label>
      <input v-model="denylistText" type="text" class="input-base" placeholder="Например: organization, state">
      <span class="hint">Изменение этих типов ВСЕГДА будет требовать одобрения.</span>
    </div>

    <div class="form-group">
      <label>Allowlist (Белый список)</label>
      <input v-model="allowlistText" type="text" class="input-base" placeholder="Например: character, location">
      <span class="hint">Разрешает изменение этих типов даже при выключенной категории (если не в Denylist).</span>
    </div>
    
    <button class="btn-primary" style="margin-top: 20px;" @click="$emit('save-rules')">Сохранить правила</button>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

defineEmits(['save-rules']);

const isGlobal = ref(false);
const denylistText = ref('');
const allowlistText = ref('');
</script>

<style scoped src="@worldwiki/resources/styles/features/ai/AiSettingsRulesTab.css"></style>
