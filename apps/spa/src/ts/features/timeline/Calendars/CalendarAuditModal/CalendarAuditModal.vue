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

<style scoped>
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: var(--bg-overlay, rgba(0, 0, 0, 0.5));
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: var(--z-modal, 1000);
}

.modal-dialog.audit-dialog {
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg, 12px);
  width: 90%;
  max-width: 600px;
  box-shadow: var(--shadow-lg);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.modal-header {
  padding: var(--space-4, 16px);
  border-bottom: 1px solid var(--border-color);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.btn-close {
  background: transparent;
  border: none;
  font-size: 16px;
  color: var(--text-muted);
  cursor: pointer;
}

.modal-body.audit-body {
  padding: var(--space-4, 16px);
  display: flex;
  flex-direction: column;
  gap: var(--space-3, 12px);
  max-height: 70vh;
  overflow-y: auto;
}

.audit-status-badge {
  padding: var(--space-2, 8px) var(--space-3, 12px);
  border-radius: var(--radius-md, 8px);
  font-weight: 600;
  text-align: center;
}

.status-valid {
  background: var(--success-bg, rgba(34, 197, 94, 0.15));
  color: var(--success);
}

.status-invalid {
  background: var(--error-bg, rgba(239, 68, 68, 0.15));
  color: var(--error);
}

.errors-block {
  background: var(--error-bg, rgba(239, 68, 68, 0.1));
  border: 1px solid var(--error);
  padding: var(--space-3, 12px);
  border-radius: var(--radius-md, 8px);
  color: var(--error);
}

.warnings-block {
  background: var(--warning-bg, rgba(245, 158, 11, 0.1));
  border: 1px solid var(--warning);
  padding: var(--space-3, 12px);
  border-radius: var(--radius-md, 8px);
  color: var(--warning);
}

.metric-card {
  background: var(--bg-surface);
  padding: var(--space-3, 12px);
  border-radius: var(--radius-md, 8px);
  border: 1px solid var(--border-color);
  display: flex;
  justify-content: space-between;
}

.year-input {
  width: 90px;
  padding: var(--space-1, 4px) var(--space-2, 8px);
  background: var(--bg-input);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm, 4px);
  color: var(--text-primary);
}

.months-preview-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
  gap: var(--space-2, 8px);
}

.month-preview-chip {
  background: var(--bg-surface);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm, 4px);
  padding: var(--space-2, 8px);
  display: flex;
  flex-direction: column;
  align-items: center;
}

.m-days {
  font-weight: 700;
  color: var(--accent);
}

.modal-footer {
  padding: var(--space-3, 12px) var(--space-4, 16px);
  border-top: 1px solid var(--border-color);
  display: flex;
  justify-content: flex-end;
}
</style>
