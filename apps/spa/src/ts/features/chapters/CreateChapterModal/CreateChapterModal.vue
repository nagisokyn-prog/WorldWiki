<template>
  <div v-if="isOpen" class="create-chapter-backdrop" @click.self="handleClose">
    <div class="create-chapter-dialog" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div class="create-chapter-header">
        <h3 id="modal-title" class="create-chapter-title">
          <span class="modal-icon">📖</span> Новая глава
        </h3>
        <button
          type="button"
          class="btn-close"
          aria-label="Закрыть"
          @click="handleClose"
        >
          ✕
        </button>
      </div>

      <form class="create-chapter-form" @submit.prevent="handleSubmit">
        <div class="form-group">
          <label for="chapter-title-input" class="form-label">
            Название главы <span class="required">*</span>
          </label>
          <input
            id="chapter-title-input"
            v-model="title"
            type="text"
            class="form-input"
            placeholder="Например: Глава 1. Пробуждение"
            autofocus
            required
            :disabled="isLoading"
            @keydown.esc="handleClose"
          />
        </div>

        <div class="form-group">
          <label for="chapter-volume-select" class="form-label">
            Привязка к тому <span class="required">*</span>
          </label>
          <div v-if="volumes.length === 0" class="no-volumes-warning">
            ⚠️ В проекте нет томов. Сначала создайте том в структуре произведения.
          </div>
          <select
            v-else
            id="chapter-volume-select"
            :value="selectedVolumeId"
            class="form-select"
            :disabled="isLoading"
            required
            @change="onVolumeChange(($event.target as HTMLSelectElement).value)"
          >
            <option
              v-for="vol in volumes"
              :key="vol.id || 'vol'"
              :value="vol.id"
            >
              {{ vol.title }}
            </option>
          </select>
          <p v-if="volumes.length > 0" class="form-hint">
            Выберите том произведения, в который войдет новая глава.
          </p>
        </div>

        <div v-if="errorMessage" class="error-banner">
          {{ errorMessage }}
        </div>

        <div class="create-chapter-actions">
          <button
            type="button"
            class="btn-secondary"
            :disabled="isLoading"
            @click="handleClose"
          >
            Отмена
          </button>
          <button
            type="submit"
            class="btn-primary"
            :disabled="isLoading || !title.trim()"
          >
            <span v-if="isLoading" class="spinner"></span>
            <span v-else>Создать главу</span>
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { CreateChapterModalProps, CreateChapterModalEmits } from './CreateChapterModal.model';
import { useCreateChapterModal } from './useCreateChapterModal';

const props = defineProps<CreateChapterModalProps>();
const emit = defineEmits<CreateChapterModalEmits>();

const {
  title,
  selectedVolumeId,
  volumes,
  isLoading,
  errorMessage,
  onVolumeChange,
  handleClose,
  handleSubmit,
} = useCreateChapterModal(props, emit);
</script>

<style src="@worldwiki/resources/styles/features/chapters/CreateChapterModal.css"></style>


