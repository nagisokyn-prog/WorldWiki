<template>
  <div v-if="isOpen" class="create-entity-backdrop" @click.self="handleClose">
    <div class="create-entity-dialog" role="dialog" aria-modal="true" aria-labelledby="create-entity-title">
      <div class="create-entity-header">
        <h3 id="create-entity-title" class="create-entity-title">
          <span>✨</span> Новая сущность
        </h3>
        <button
          type="button"
          class="btn-close interactive-el"
          aria-label="Закрыть"
          @click="handleClose"
        >
          ✕
        </button>
      </div>

      <form class="create-entity-form" @submit.prevent="handleSubmit">
        <div class="form-group">
          <label for="entity-name-input" class="form-label">
            Название <span class="required">*</span>
          </label>
          <input
            id="entity-name-input"
            v-model="entityName"
            type="text"
            class="form-input glass-input"
            placeholder="Например: Артур Пендрагон, Камелот, Экскалибур..."
            autofocus
            required
            :disabled="isLoading"
            @keydown.esc="handleClose"
          />
        </div>

        <div class="entity-types-section">
          <div class="entity-types-header">
            <label class="form-label mb-0">
              Тип сущности <span class="required">*</span>
            </label>
            <input
              v-if="availableTypes.length > 6"
              v-model="searchTypeQuery"
              type="text"
              class="glass-input entity-types-search"
              placeholder="Фильтр типов..."
            />
          </div>

          <div class="entity-types-grid">
            <div
              v-for="item in filteredTypes"
              :key="item.type"
              class="entity-type-card interactive-el"
              :class="{ active: selectedEntityType === item.type }"
              :title="item.description || item.name"
              @click="selectType(item.type)"
            >
              <span class="entity-type-icon">{{ item.icon }}</span>
              <span class="entity-type-name">{{ item.name }}</span>
            </div>
            <div v-if="filteredTypes.length === 0" class="entity-types-empty">
              Типы сущностей не найдены
            </div>
          </div>
        </div>

        <div v-if="errorMessage" class="error-banner">
          {{ errorMessage }}
        </div>

        <div class="create-entity-actions">
          <button
            type="button"
            class="glass-btn outline sm interactive-el"
            :disabled="isLoading"
            @click="handleClose"
          >
            Отмена
          </button>
          <button
            type="submit"
            class="glass-btn primary sm interactive-el"
            :disabled="isLoading || !entityName.trim() || !selectedEntityType"
          >
            {{ isLoading ? 'Создание...' : 'Создать сущность' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import type {
  CreateEntityModalProps,
  CreateEntityModalEmits,
} from './CreateEntityModal.model';
import { useCreateEntityModal } from './useCreateEntityModal';

const props = defineProps<CreateEntityModalProps>();
const emit = defineEmits<CreateEntityModalEmits>();

const {
  entityName,
  selectedEntityType,
  availableTypes,
  filteredTypes,
  searchTypeQuery,
  isLoading,
  errorMessage,
  selectType,
  handleClose,
  handleSubmit,
} = useCreateEntityModal(props, emit);
</script>

<style src="@worldwiki/resources/styles/features/entities/CreateEntityModal.css"></style>

