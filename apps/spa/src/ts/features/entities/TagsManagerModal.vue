<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div v-if="isOpen" class="modal-overlay" @click.self="close">
        <div v-motion-pop class="tags-manager-modal glass-panel">
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
              <div v-else v-auto-animate class="tags-grid-manage">
                <div v-for="(tag, tIdx) in tags" :key="tag.id || tIdx" class="tag-manage-card interactive-el">
                  <div class="tag-color-preview" :style="{ '--tag-bg': tag.color }"></div>
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
                  <button class="delete-tag-btn" @click="tag.id && deleteTag(tag.id)">&times;</button>
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
import { useTagsManagerModal } from './useTagsManagerModal';

const props = defineProps<{
  project: string;
}>();

const {
  isOpen,
  loading,
  tags,
  newTagName,
  newTagColor,
  addTag,
  updateTag,
  deleteTag,
  open,
  close
} = useTagsManagerModal(props);

defineExpose({ open, close });
</script>

<style scoped src="@worldwiki/resources/styles/features/entities/TagsManagerModal.css"></style>
