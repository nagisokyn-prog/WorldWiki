<template>
  <div v-if="isOpen" class="paragraph-modal-backdrop" @click.self="$emit('close')">
    <div class="paragraph-modal-window">
      <!-- Шапка окна -->
      <div class="paragraph-modal-header">
        <span class="paragraph-modal-title">Абзац</span>
        <button type="button" class="paragraph-modal-close-btn" @click="$emit('close')">✕</button>
      </div>

      <!-- Вкладки -->
      <div class="paragraph-modal-tabs">
        <button 
          type="button" 
          class="paragraph-tab-btn" 
          :class="{ 'is-active': activeTab === 'indents' }" 
          @click="activeTab = 'indents'"
        >
          Отступы и интервалы
        </button>
      </div>

      <!-- Содержимое -->
      <div class="paragraph-modal-body">
        <!-- Секция: Общие -->
        <div class="modal-fieldset">
          <span class="fieldset-title">Общие</span>
          <div class="fieldset-grid">
            <div class="modal-field-row">
              <label class="modal-field-label">Выравнивание:</label>
              <select v-model="form.alignment" class="modal-input">
                <option value="left">По левому краю</option>
                <option value="center">По центру</option>
                <option value="right">По правому краю</option>
                <option value="justify">По ширине (ГОСТ)</option>
              </select>
            </div>
          </div>
        </div>

        <!-- Секция: Отступы -->
        <div class="modal-fieldset">
          <span class="fieldset-title">Отступы</span>
          <div class="fieldset-grid">
            <div class="modal-field-row">
              <label class="modal-field-label">Слева:</label>
              <input v-model.number="form.leftIndentCm" type="number" step="0.1" min="0" max="10" class="modal-input">
            </div>
            <div class="modal-field-row">
              <label class="modal-field-label">Первая строка:</label>
              <select v-model="form.firstLineType" class="modal-input">
                <option value="none">(отсутствует)</option>
                <option value="indent">Отступ (красная строка)</option>
              </select>
            </div>
            <div class="modal-field-row">
              <label class="modal-field-label">Справа:</label>
              <input v-model.number="form.rightIndentCm" type="number" step="0.1" min="0" max="10" class="modal-input">
            </div>
            <div v-if="form.firstLineType === 'indent'" class="modal-field-row">
              <label class="modal-field-label">На (см):</label>
              <input v-model.number="form.firstLineCm" type="number" step="0.05" min="0" max="5" class="modal-input">
            </div>
          </div>
        </div>

        <!-- Секция: Интервал -->
        <div class="modal-fieldset">
          <span class="fieldset-title">Интервал</span>
          <div class="fieldset-grid">
            <div class="modal-field-row">
              <label class="modal-field-label">Перед (пт):</label>
              <input v-model.number="form.spaceBeforePt" type="number" step="1" min="0" max="72" class="modal-input">
            </div>
            <div class="modal-field-row">
              <label class="modal-field-label">Междустрочный:</label>
              <select v-model="form.lineHeight" class="modal-input">
                <option value="1.0">Одинарный</option>
                <option value="1.15">1,15 строки</option>
                <option value="1.5">1,5 строки (ГОСТ)</option>
                <option value="2.0">Двойной</option>
              </select>
            </div>
            <div class="modal-field-row">
              <label class="modal-field-label">После (пт):</label>
              <input v-model.number="form.spaceAfterPt" type="number" step="1" min="0" max="72" class="modal-input">
            </div>
          </div>
        </div>

        <!-- Секция: Образец (Live Preview) -->
        <div class="preview-box-container">
          <span class="fieldset-title">Образец</span>
          <div class="preview-box">
            <p>Предыдущий абзац документа. Предыдущий абзац документа.</p>
            <p 
              class="preview-main-paragraph"
              :style="{
                textAlign: form.alignment,
                textIndent: form.firstLineType === 'indent' ? form.firstLineCm + 'cm' : '0cm',
                lineHeight: form.lineHeight,
                paddingLeft: form.leftIndentCm + 'cm',
                paddingRight: form.rightIndentCm + 'cm',
                marginTop: form.spaceBeforePt + 'px',
                marginBottom: form.spaceAfterPt + 'px'
              }"
            >
              Образец текста для проверки форматирования абзаца по ГОСТ 7.32. Здесь наглядно отображаются красная строка, межстрочный интервал и выравнивание.
            </p>
            <p>Следующий абзац документа. Следующий абзац документа.</p>
          </div>
        </div>
      </div>

      <!-- Подвал -->
      <div class="paragraph-modal-footer">
        <button type="button" class="btn btn-small btn-outline btn-gost-default" @click="resetToGost">
          По умолчанию (ГОСТ)
        </button>
        <button type="button" class="btn btn-small btn-outline" @click="$emit('close')">
          Отмена
        </button>
        <button type="button" class="btn btn-small btn-primary" @click="apply">
          ОК
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { 
  useParagraphFormatModal, 
  type ParagraphFormatModalProps, 
  type ParagraphFormatModalEmits, 
  type ParagraphFormatData 
} from './useParagraphFormatModal';

export type { ParagraphFormatData };

const props = defineProps<ParagraphFormatModalProps>();
const emit = defineEmits<ParagraphFormatModalEmits>();

const {
  activeTab,
  form,
  resetToGost,
  apply
} = useParagraphFormatModal(props, emit);
</script>

<style scoped src="@worldwiki/resources/styles/features/chapters/ParagraphFormatModal.css"></style>
