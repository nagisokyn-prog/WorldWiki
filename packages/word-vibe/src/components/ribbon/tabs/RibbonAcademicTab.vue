<template>
  <div class="ribbon-tab-content flex">
    <!-- Предустановки ГОСТ и стили -->
    <RibbonGostPresetsGroup
      :open-dropdown="openDropdown"
      :dropdown-pos="dropdownPos"
      @toggle-dropdown="(evt, name) => $emit('toggleDropdown', evt, name)"
      @apply-gost-preset="$emit('applyGostPreset', $event)"
      @apply-cite-style="$emit('applyCiteStyle', $event)"
    />

    <!-- Элементы ГОСТ оформления -->
    <div class="ribbon-group">
      <div class="ribbon-row">
        <button 
          type="button" 
          class="ribbon-btn ribbon-btn-large" 
          title="Вставить блок формулы с автонумерацией по правому краю"
          @click="commands.insertFormula?.()"
        >
          <i class="fas fa-square-root-alt"></i>
          <span>Формула ГОСТ</span>
        </button>
        <button 
          type="button" 
          class="ribbon-btn ribbon-btn-large" 
          title="Вставить пояснение к формуле (где x - это...)"
          @click="commands.insertFormulaWhere?.()"
        >
          <i class="fas fa-align-left"></i>
          <span>Блок «где»</span>
        </button>
        <button 
          type="button" 
          class="ribbon-btn ribbon-btn-large" 
          title="Вставить термин и определение по ГОСТ Р 1.5"
          @click="commands.insertTermDef?.()"
        >
          <i class="fas fa-spell-check"></i>
          <span>Термин ГОСТ</span>
        </button>
        <button 
          type="button" 
          class="ribbon-btn ribbon-btn-large" 
          title="Оформить библиографическую ссылку на источник"
          @click="commands.insertCitation?.()"
        >
          <i class="fas fa-quote-right"></i>
          <span>Ссылка ГОСТ</span>
        </button>
      </div>
      <div class="ribbon-group-footer">
        <span class="ribbon-group-label">Оформление</span>
      </div>
    </div>

    <!-- Академический валидатор -->
    <div class="ribbon-group">
      <div class="ribbon-row">
        <button 
          type="button" 
          class="ribbon-btn ribbon-btn-large ribbon-btn-primary" 
          title="Запустить полную проверку документа на соответствие ГОСТ 7.32"
          @click="commands.runGostCheck?.()"
        >
          <i class="fas fa-clipboard-check"></i>
          <span>Проверка ГОСТ</span>
        </button>
        <button 
          type="button" 
          class="ribbon-btn ribbon-btn-large" 
          title="Показать / скрыть панель академического инспектора"
          @click="commands.toggleAcademicInspector?.()"
        >
          <i class="fas fa-search-plus"></i>
          <span>Инспектор</span>
        </button>
      </div>
      <div class="ribbon-group-footer">
        <span class="ribbon-group-label">Контроль</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import RibbonGostPresetsGroup from '../groups/RibbonGostPresetsGroup.vue';
import type { RibbonAcademicTabProps, RibbonAcademicTabEmits } from './RibbonAcademicTab.model';

defineProps<RibbonAcademicTabProps>();
defineEmits<RibbonAcademicTabEmits>();
</script>
