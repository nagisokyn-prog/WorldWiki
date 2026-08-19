<template>
  <div class="tab-pane">
    <div class="sandbox-header">
      <h3>Разрешения и автоодобрение</h3>
      <div class="toggle-switch">
        <input id="global-sandbox" v-model="sandboxEnabled" type="checkbox">
        <label for="global-sandbox">Включить автоодобрение</label>
      </div>
    </div>

    <p class="text-muted" style="font-size: 13px; margin-bottom: 20px;">
      Если включено, ИИ сможет выполнять выбранные действия автоматически без окна подтверждения (AiToolApproval).
    </p>

    <div class="form-group">
      <label>Автоодобрение по умолчанию</label>
      <select v-model="defaultAction" class="input-base" :disabled="!sandboxEnabled">
        <option value="ask">Спрашивать (По умолчанию)</option>
        <option value="allow">Разрешить</option>
        <option value="deny">Запретить</option>
        <option value="custom">Пользовательский</option>
      </select>
    </div>

    <div class="categories-grid" :class="{ disabled: !sandboxEnabled }">
      <label class="checkbox-label">
        <input v-model="categories.read" type="checkbox">
        <span>Чтение данных (поиск, граф, главы)</span>
      </label>
      <label class="checkbox-label">
        <input v-model="categories.analyze" type="checkbox">
        <span>Аналитика (противоречия, отчёты)</span>
      </label>
      <label class="checkbox-label">
        <input v-model="categories.edit_entities" type="checkbox">
        <span>Изменение сущностей</span>
      </label>
      <label class="checkbox-label">
        <input v-model="categories.edit_relations" type="checkbox">
        <span>Изменение связей</span>
      </label>
      <label class="checkbox-label">
        <input v-model="categories.edit_content" type="checkbox">
        <span>Изменение контента (текст глав)</span>
      </label>
    </div>
    
    <button class="btn-primary" style="margin-top: 20px;" @click="$emit('save-sandbox')">Сохранить разрешения</button>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';

defineEmits(['save-sandbox']);

const sandboxEnabled = ref(false);
const defaultAction = ref('ask');
const categories = ref({
  read: false,
  analyze: false,
  edit_entities: false,
  edit_relations: false,
  edit_content: false
});

type CategoryKey = keyof typeof categories.value;
watch(defaultAction, (val) => {
  if (val === 'allow') {
    (Object.keys(categories.value) as CategoryKey[]).forEach(k => { categories.value[k] = true; });
  } else if (val === 'deny' || val === 'ask') {
    (Object.keys(categories.value) as CategoryKey[]).forEach(k => { categories.value[k] = false; });
  }
});
</script>

<style scoped>
.sandbox-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.sandbox-header h3 {
  margin: 0;
  font-size: 15px;
  color: var(--text-main);
}

.toggle-switch {
  display: flex;
  align-items: center;
  gap: 8px;
}

.categories-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
  background: var(--bg-surface);
  padding: 15px;
  border-radius: 8px;
  border: 1px solid var(--border-color);
  margin-top: 15px;
}

.categories-grid.disabled {
  opacity: 0.5;
  pointer-events: none;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}
</style>
