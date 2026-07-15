<template>
  <div v-if="isOpen" class="modal" style="display: flex;">
    <div class="modal-content">
      <div class="modal-header">
        <h2>Экспорт глав</h2>
        <button class="close-btn" @click="$emit('close')">&times;</button>
      </div>
      
      <div class="modal-body">
        <div class="export-section">
          <h3>Формат файла</h3>
          <div class="format-grid">
            <label class="format-option">
              <input type="radio" v-model="format" value="txt">
              <div class="format-icon"><i class="fas fa-file-alt"></i></div>
              <span>TXT</span><small>Текст</small>
            </label>
            <label class="format-option">
              <input type="radio" v-model="format" value="docx">
              <div class="format-icon"><i class="fas fa-file-word"></i></div>
              <span>DOCX</span><small>Word</small>
            </label>
            <label class="format-option">
              <input type="radio" v-model="format" value="pdf">
              <div class="format-icon"><i class="fas fa-file-pdf"></i></div>
              <span>PDF</span><small>Документ</small>
            </label>
          </div>
        </div>

        <div class="export-section">
          <h3>Главы для экспорта</h3>
          <div class="chapters-selection">
            <label class="selection-option">
              <input type="radio" v-model="selectionMode" value="current">
              <span>Текущая глава</span>
            </label>
            <label class="selection-option">
              <input type="radio" v-model="selectionMode" value="all">
              <span>Все главы</span>
            </label>
            <label class="selection-option">
              <input type="radio" v-model="selectionMode" value="selected">
              <span>Выбрать главы</span>
            </label>
          </div>
          
          <div v-if="selectionMode === 'selected'" style="margin-top: 20px;">
            <div class="chapters-dropdown-container" style="position: relative;">
              <div class="chapters-dropdown export-black" style="display: block;">
                <div class="dropdown-controls" style="padding: 10px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center;">
                  <div class="selected-count" style="font-size: 12px; color: #666;">
                    Выбрано: {{ selectedChapters.length }} глав
                  </div>
                  <div class="control-buttons" style="display: flex; gap: 8px;">
                    <button class="small-btn" @click="selectAll" style="padding: 4px 8px; font-size: 12px;">
                      <i class="fas fa-check-double"></i> Все
                    </button>
                    <button class="small-btn" @click="clearSelection" style="padding: 4px 8px; font-size: 12px;">
                      <i class="fas fa-times"></i> Очистить
                    </button>
                  </div>
                </div>
                <div class="chapters-list" style="max-height: 200px; overflow-y: auto; padding: 10px;">
                  <div v-for="ch in allChapters" :key="ch.id" style="margin-bottom: 5px;">
                    <label style="display: flex; align-items: center; gap: 8px; font-size: 13px; cursor: pointer;">
                      <input type="checkbox" :value="ch.id" v-model="selectedChapters">
                      {{ ch.title || 'Без названия' }}
                    </label>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="export-section">
          <h3>Дополнительно</h3>
          <div class="export-options">
            <label class="option-checkbox">
              <input type="checkbox" v-model="addTOC">
              <span>Добавить оглавление</span>
            </label>
            <label class="option-checkbox">
              <input type="checkbox" v-model="addPageNumbers">
              <span>Нумерация страниц</span>
            </label>
            <label class="option-checkbox">
              <input type="checkbox" v-model="includeMetadata">
              <span>Включить метаданные</span>
            </label>
          </div>
        </div>
      </div>
      
      <div class="modal-footer">
        <button class="btn btn-secondary" @click="$emit('close')">Отмена</button>
        <button class="btn btn-primary" @click="exportData" :disabled="loading">
          {{ loading ? 'Экспорт...' : 'Экспортировать' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';

const props = defineProps({
  isOpen: { type: Boolean, required: true },
  allChapters: { type: Array as () => any[], default: () => [] },
  currentChapterId: { type: String, default: null }
});

const emit = defineEmits(['close', 'export']);

const format = ref('txt');
const selectionMode = ref('current');
const selectedChapters = ref<string[]>([]);
const addTOC = ref(true);
const addPageNumbers = ref(true);
const includeMetadata = ref(true);
const loading = ref(false);

const selectAll = () => {
  selectedChapters.value = props.allChapters.map((c: any) => c.id);
};

const clearSelection = () => {
  selectedChapters.value = [];
};

const exportData = () => {
  let targets: string[] = [];
  if (selectionMode.value === 'current' && props.currentChapterId) {
    targets = [props.currentChapterId];
  } else if (selectionMode.value === 'all') {
    targets = props.allChapters.map((c: any) => c.id);
  } else {
    targets = [...selectedChapters.value];
  }
  
  if (targets.length === 0) {
    alert('Не выбраны главы для экспорта');
    return;
  }
  
  loading.value = true;
  emit('export', {
    format: format.value,
    chapterIds: targets,
    options: {
      addTOC: addTOC.value,
      addPageNumbers: addPageNumbers.value,
      includeMetadata: includeMetadata.value
    }
  });
  
  setTimeout(() => {
    loading.value = false;
    emit('close');
  }, 1000); // Simulate export time
};
</script>

<style scoped>
.modal {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.7);
  backdrop-filter: blur(4px);
  z-index: 10000;
  align-items: center;
  justify-content: center;
}
.modal-content {
  background: var(--bg-panel);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  width: 90%;
  max-width: 600px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  color: var(--text-main);
}
.modal-header {
  padding: 20px;
  border-bottom: 1px solid var(--border-color);
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.modal-header h2 { margin: 0; font-size: 20px; }
.close-btn { background: none; border: none; font-size: 24px; color: var(--text-muted); cursor: pointer; }
.modal-body {
  padding: 20px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 24px;
}
.export-section h3 { margin-top: 0; margin-bottom: 12px; font-size: 14px; color: var(--text-muted); text-transform: uppercase; }
.format-grid { display: flex; gap: 12px; }
.format-option {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 15px;
  border: 2px solid var(--border-color);
  border-radius: 8px;
  cursor: pointer;
  background: var(--bg-input);
  transition: all 0.2s;
}
.format-option input { display: none; }
.format-option:has(input:checked) { border-color: var(--accent); background: rgba(139, 92, 246, 0.1); }
.format-icon { font-size: 24px; margin-bottom: 8px; color: var(--text-main); }
.chapters-selection { display: flex; gap: 16px; }
.selection-option { display: flex; align-items: center; gap: 8px; cursor: pointer; }
.export-options { display: flex; flex-direction: column; gap: 10px; }
.option-checkbox { display: flex; align-items: center; gap: 8px; cursor: pointer; }
.modal-footer {
  padding: 20px;
  border-top: 1px solid var(--border-color);
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}
.btn { padding: 8px 16px; border-radius: 6px; border: none; cursor: pointer; font-weight: 500; font-size: 14px; }
.btn-secondary { background: var(--bg-input); color: var(--text-main); border: 1px solid var(--border-color); }
.btn-primary { background: var(--accent); color: white; }
.btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
</style>
