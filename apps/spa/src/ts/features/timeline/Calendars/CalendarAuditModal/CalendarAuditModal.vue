<template>
  <div v-if="isOpen" class="modal-backdrop" @click.self="close">
    <div class="modal-dialog audit-dialog">
      <div class="modal-header">
        <h3 class="m-0">🔍 Диагностический аудит календаря</h3>
        <button type="button" class="btn-close interactive-el" @click="close">✕</button>
      </div>

      <div class="modal-body audit-body">
        <div class="audit-status-badge" :class="auditReport.is_valid ? 'status-valid' : 'status-invalid'">
          {{ auditReport.is_valid ? '✅ Календарь математически корректен' : '❌ Обнаружены критические ошибки' }}
        </div>

        <div v-if="auditReport.errors.length > 0" class="audit-block errors-block">
          <h5>Ошибки ({{ auditReport.errors.length }}):</h5>
          <ul>
            <li v-for="(err, idx) in auditReport.errors" :key="idx">{{ err }}</li>
          </ul>
        </div>

        <div v-if="auditReport.warnings.length > 0" class="audit-block warnings-block">
          <h5>Предупреждения ({{ auditReport.warnings.length }}):</h5>
          <ul>
            <li v-for="(warn, idx) in auditReport.warnings" :key="idx">{{ warn }}</li>
          </ul>
        </div>

        <div class="audit-metrics grid-2">
          <div class="metric-card">
            <span class="metric-label">Вековой дрейф:</span>
            <span class="metric-value">{{ (auditReport.drift_milli_days_per_century / 1000).toFixed(2) }} сут / 100 лет</span>
          </div>
          <div class="metric-card">
            <span class="metric-label">Период гармоник:</span>
            <span class="metric-value">{{ auditReport.harmonics_cycle_years }} лет</span>
          </div>
        </div>

        <div class="year-preview-section">
          <div class="preview-header flex items-center justify-between">
            <h5>Предпросмотр года:</h5>
            <input v-model.number="previewYear" type="number" class="interactive-el year-input" min="1" />
          </div>
          <div class="preview-meta text-xs text-muted mb-2">
            Всего дней: <strong>{{ yearPreview.total_days }}</strong> | Високосный: <strong>{{ yearPreview.is_leap ? 'Да' : 'Нет' }}</strong>
          </div>
          <div class="months-preview-grid">
            <div
              v-for="m in yearPreview.months"
              :key="m.cultural_month_index"
              class="month-preview-chip"
            >
              <span class="m-title">Месяц {{ m.cultural_month_index + 1 }}</span>
              <span class="m-days">{{ m.days_count }} дн.</span>
            </div>
          </div>
        </div>
      </div>

      <div class="modal-footer">
        <button type="button" class="btn-secondary interactive-el" @click="close">Закрыть</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useCalendarAuditModal } from './useCalendarAuditModal';
import type { CalendarAuditModalProps, CalendarAuditModalEmits } from './CalendarAuditModal.model';

const props = defineProps<CalendarAuditModalProps>();
const emit = defineEmits<CalendarAuditModalEmits>();

const { isOpen, close, previewYear, auditReport, yearPreview } = useCalendarAuditModal(props, emit);
</script>

<style scoped src="@worldwiki/resources/styles/features/timeline/CalendarAuditModal.css"></style>
