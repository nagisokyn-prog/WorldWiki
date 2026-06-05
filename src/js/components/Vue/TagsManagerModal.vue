<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div v-if="isOpen" class="modal-overlay" @click.self="close">
        <div class="tags-manager-modal glass-panel">
          <div class="modal-header">
            <h3><i class="fas fa-tags"></i> Управление тегами проекта</h3>
            <button class="close-btn" @click="close">&times;</button>
          </div>

          <div class="modal-body">
            <div class="add-tag-section">
              <input 
                v-model="newTagName" 
                class="input-base" 
                placeholder="Имя нового тега..." 
                @keydown.enter="addTag"
              />
              <input 
                v-model="newTagColor" 
                type="color" 
                class="color-input"
              />
              <button class="btn btn-primary" @click="addTag">Добавить</button>
            </div>

            <div class="tags-list-container">
              <div v-if="loading" class="loading-state">Загрузка тегов...</div>
              <div v-else-if="tags.length === 0" class="empty-state">Тегов пока нет</div>
              <div v-else class="tags-grid-manage">
                <div v-for="tag in tags" :key="tag.id" class="tag-manage-card interactive-el">
                  <div class="tag-color-preview" :style="{ background: tag.color }"></div>
                  <input 
                    v-model="tag.name" 
                    class="tag-name-input" 
                    @change="updateTag(tag)"
                  />
                  <input 
                    v-model="tag.color" 
                    type="color" 
                    class="tag-color-picker" 
                    @change="updateTag(tag)"
                  />
                  <button class="delete-tag-btn" @click="deleteTag(tag.id)">&times;</button>
                </div>
              </div>
            </div>
          </div>

          <div class="modal-footer">
            <span class="tags-count">Всего тегов: {{ tags.length }}</span>
            <button class="btn btn-outline" @click="close">Закрыть</button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { apiService } from '../../services/api.service';

const props = defineProps<{
  project: string;
}>();

const isOpen = ref(false);
const loading = ref(false);
const tags = ref<any[]>([]);
const newTagName = ref('');
const newTagColor = ref('#7c3aed');

const loadTags = async () => {
  loading.value = true;
  try {
    tags.value = await apiService.getTags(props.project);
  } catch (e) {
    console.error('[TagsManager] Load error:', e);
  } finally {
    loading.value = false;
  }
};

const addTag = async () => {
  if (!newTagName.value.trim()) return;
  try {
    await apiService.saveTag(props.project, { 
      name: newTagName.value.trim(), 
      color: newTagColor.value 
    } as any);
    newTagName.value = '';
    await loadTags();
  } catch (e) {
    console.error('[TagsManager] Add error:', e);
  }
};

const updateTag = async (tag: any) => {
  try {
    await apiService.saveTag(props.project, tag);
  } catch (e) {
    console.error('[TagsManager] Update error:', e);
  }
};

const deleteTag = async (id: string) => {
  if (!confirm('Удалить этот тег? Он исчезнет из всех сущностей.')) return;
  try {
    await apiService.deleteTag(props.project, id);
    await loadTags();
  } catch (e) {
    console.error('[TagsManager] Delete error:', e);
  }
};

const open = () => {
  isOpen.value = true;
  loadTags();
};

const close = () => {
  isOpen.value = false;
};

defineExpose({ open, close });
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.6);
  backdrop-filter: blur(8px);
  z-index: 20000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.tags-manager-modal {
  width: 650px;
  max-width: 95vw;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  border-radius: 20px;
  border: 1px solid rgba(255,255,255,0.1);
  box-shadow: 0 40px 100px rgba(0,0,0,0.6);
  background: var(--bg-panel, #1a1a2e);
}

.modal-header {
  padding: 20px 24px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid rgba(255,255,255,0.05);
}

.modal-header h3 {
  margin: 0;
  font-size: 18px;
  display: flex;
  align-items: center;
  gap: 12px;
  color: var(--text-main);
}

.modal-header h3 i { color: var(--accent); }

.close-btn {
  background: none;
  border: none;
  color: var(--text-muted);
  font-size: 28px;
  cursor: pointer;
  transition: color 0.2s;
}
.close-btn:hover { color: #fff; }

.modal-body {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
}

.add-tag-section {
  display: flex;
  gap: 12px;
  margin-bottom: 30px;
  padding: 16px;
  background: rgba(255,255,255,0.03);
  border-radius: 12px;
  border: 1px dashed rgba(255,255,255,0.1);
}

.color-input {
  width: 42px;
  height: 42px;
  padding: 0;
  border: none;
  background: none;
  cursor: pointer;
}

.tags-list-container {
  min-height: 200px;
}

.tags-grid-manage {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 12px;
}

.tag-manage-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 10px;
  transition: all 0.2s;
}

.tag-manage-card:hover {
  background: rgba(255,255,255,0.08);
  border-color: rgba(255,255,255,0.2);
}

.tag-color-preview {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  flex-shrink: 0;
}

.tag-name-input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  color: var(--text-main);
  font-size: 14px;
}

.tag-color-picker {
  width: 24px;
  height: 24px;
  padding: 0;
  border: none;
  background: none;
  cursor: pointer;
  opacity: 0.6;
  transition: opacity 0.2s;
}
.tag-color-picker:hover { opacity: 1; }

.delete-tag-btn {
  background: none;
  border: none;
  color: var(--text-muted);
  font-size: 18px;
  cursor: pointer;
  transition: color 0.2s;
}
.delete-tag-btn:hover { color: #ef4444; }

.modal-footer {
  padding: 16px 24px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-top: 1px solid rgba(255,255,255,0.05);
}

.tags-count { font-size: 12px; color: var(--text-muted); }

.modal-fade-enter-active, .modal-fade-leave-active { transition: opacity 0.3s; }
.modal-fade-enter-from, .modal-fade-leave-to { opacity: 0; }

.empty-state, .loading-state {
  text-align: center;
  padding: 40px;
  color: var(--text-muted);
  font-style: italic;
}
</style>
