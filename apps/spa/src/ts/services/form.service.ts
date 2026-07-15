/**
 * @file form.service.ts
 * @description Domain-specific extension of FormService that integrates the local calendar logic.
 */

import { FormService as BaseFormService, type FieldConfig } from '@worldwiki/components';
import { calendarService } from './calendar.service';

export class FormService extends BaseFormService {
  createCalendarDateField(field: FieldConfig): HTMLElement & { setDate: (v: unknown) => void; getValue: () => unknown } {
    const container = document.createElement('div') as unknown as HTMLElement & { setDate: (v: unknown) => void; getValue: () => unknown };
    container.className = `form-group calendar-date-group ${field.class || ''}`;
    if (field.label) {
      const label = document.createElement('label');
      label.htmlFor = field.id;
      label.innerHTML = field.label || '';
      if (field.required) label.innerHTML += ' *';
      container.appendChild(label);
    }

    const pickerWrapper = document.createElement('div');
    pickerWrapper.className = 'calendar-date-picker';

    const eraSelect = document.createElement('select');
    eraSelect.id = `${field.id}_era`;
    eraSelect.className = 'calendar-era';
    this.populateEraSelect(eraSelect);

    const yearSelect = document.createElement('input');
    yearSelect.type = 'number';
    yearSelect.id = `${field.id}_year`;
    yearSelect.className = 'calendar-year';
    yearSelect.style.width = '80px';

    const monthSelect = document.createElement('select');
    monthSelect.id = `${field.id}_month`;
    monthSelect.className = 'calendar-month';
    this.populateMonthSelect(monthSelect);

    const daySelect = document.createElement('select');
    daySelect.id = `${field.id}_day`;
    daySelect.className = 'calendar-day';

    pickerWrapper.appendChild(eraSelect);
    pickerWrapper.appendChild(yearSelect);
    pickerWrapper.appendChild(monthSelect);
    pickerWrapper.appendChild(daySelect);
    container.appendChild(pickerWrapper);

    const hiddenInput = document.createElement('input');
    hiddenInput.type = 'hidden';
    hiddenInput.id = field.id;
    hiddenInput.name = field.id;
    container.appendChild(hiddenInput);

    const updateHidden = () => {
      const eraIdx = parseInt((eraSelect as HTMLSelectElement).value, 10);
      const year = parseInt((yearSelect as HTMLInputElement).value, 10);
      const month = parseInt((monthSelect as HTMLSelectElement).value, 10);
      const day = parseInt((daySelect as HTMLSelectElement).value, 10);
      if (!isNaN(eraIdx) && !isNaN(year) && !isNaN(month) && !isNaN(day)) {
        hiddenInput.value = JSON.stringify({ эпоха_ключ: eraIdx, год: year, месяц: month, день: day });
      } else {
        hiddenInput.value = '';
      }
    };

    const updateDaySelect = () => {
      const year = parseInt((yearSelect as HTMLInputElement).value, 10);
      const monthIdx = parseInt((monthSelect as HTMLSelectElement).value, 10);
      if (isNaN(year) || isNaN(monthIdx)) return;
      const calService = calendarService as unknown as { currentCalendar?: unknown; getDaysInMonth?: (cal: unknown, y: number, m: number) => number };
      const daysInMonth = calService.getDaysInMonth?.(calService.currentCalendar, year, monthIdx) || 30;
      daySelect.innerHTML = '';
      for (let d = 1; d <= daysInMonth; d++) {
        const opt = document.createElement('option');
        opt.value = String(d);
        opt.textContent = String(d);
        daySelect.appendChild(opt);
      }
      if (daySelect.options.length && parseInt((daySelect as HTMLSelectElement).value, 10) > daysInMonth) {
        (daySelect as HTMLSelectElement).value = '1';
      }
      updateHidden();
    };

    const updateYearRange = () => {
      const eraIdx = parseInt((eraSelect as HTMLSelectElement).value, 10);
      if (isNaN(eraIdx)) return;
      const calService = calendarService as unknown as { currentCalendar?: { эпохи?: Array<{ год_начала: number; год_конца: number }> } };
      const era = calService.currentCalendar?.эпохи?.[eraIdx];
      if (era) {
        (yearSelect as HTMLInputElement).min = String(era.год_начала);
        (yearSelect as HTMLInputElement).max = String(era.год_конца || era.год_начала + 1000);
        if (!(yearSelect as HTMLInputElement).value || parseInt((yearSelect as HTMLInputElement).value) < era.год_начала || parseInt((yearSelect as HTMLInputElement).value) > (era.год_конца || era.год_начала + 1000)) {
          (yearSelect as HTMLInputElement).value = String(era.год_начала);
        }
      }
      updateDaySelect();
      updateHidden();
    };

    eraSelect.addEventListener('change', updateYearRange);
    yearSelect.addEventListener('change', () => { updateDaySelect(); updateHidden(); });
    monthSelect.addEventListener('change', () => { updateDaySelect(); updateHidden(); });
    daySelect.addEventListener('change', updateHidden);
    updateYearRange();

    container.setDate = (value: unknown) => {
      let dateObj: Record<string, number> | null = null;
      if (typeof value === 'string' && value.trim()) {
        try {
          const parsed = JSON.parse(value);
          if (parsed && typeof parsed === 'object' && 'год' in parsed) dateObj = parsed;
        } catch {}
      } else if (value && typeof value === 'object') {
        dateObj = value as Record<string, number>;
      }
      const calService = calendarService as unknown as { currentCalendar?: { эпохи?: Array<{ год_начала: number; год_конца: number }>; месяцы?: Array<unknown> }; getDaysInMonth?: (cal: unknown, y: number, m: number) => number };
      if (dateObj && calService.currentCalendar && calService.currentCalendar.эпохи) {
        const eraIdx = dateObj.эпоха_ключ;
        if (eraIdx >= 0 && eraIdx < calService.currentCalendar.эпохи.length) {
          (eraSelect as HTMLSelectElement).value = String(eraIdx);
          updateYearRange();
          const era = calService.currentCalendar.эпохи[eraIdx];
          const year = Math.min(era.год_конца || parseInt((yearSelect as HTMLInputElement).max), Math.max(era.год_начала, dateObj.год));
          (yearSelect as HTMLInputElement).value = String(year);
          if (dateObj.месяц >= 0 && dateObj.месяц < (calService.currentCalendar.месяцы?.length || 0)) {
            (monthSelect as HTMLSelectElement).value = String(dateObj.месяц);
          } else {
            (monthSelect as HTMLSelectElement).value = '0';
          }
          updateDaySelect();
          const monthIdx = parseInt((monthSelect as HTMLSelectElement).value, 10);
          const daysInMonth = calService.getDaysInMonth?.(calService.currentCalendar, year, monthIdx) || 30;
          const day = Math.min(daysInMonth, Math.max(1, dateObj.день));
          (daySelect as HTMLSelectElement).value = String(day);
          updateHidden();
        }
      }
    };

    container.getValue = () => {
      const val = hiddenInput.value;
      try { return val ? JSON.parse(val) : null; } catch { return null; }
    };

    return container;
  }

  populateEraSelect(select: HTMLSelectElement): void {
    select.innerHTML = '';
    const calService = calendarService as unknown as { currentCalendar?: { эпохи?: Array<{ название: string }> } };
    if (!calService.currentCalendar?.эпохи) {
      const opt = document.createElement('option');
      opt.value = '0';
      opt.textContent = 'Наша эра';
      select.appendChild(opt);
      return;
    }
    calService.currentCalendar.эпохи.forEach((era: { название: string }, idx: number) => {
      const opt = document.createElement('option');
      opt.value = String(idx);
      opt.textContent = era.название;
      select.appendChild(opt);
    });
  }

  populateMonthSelect(select: HTMLSelectElement): void {
    select.innerHTML = '';
    const calService = calendarService as unknown as { currentCalendar?: { месяцы?: Array<{ название: string }> } };
    const months = calService.currentCalendar?.месяцы || [];
    months.forEach((month: { название: string }, idx: number) => {
      const opt = document.createElement('option');
      opt.value = String(idx);
      opt.textContent = month.название;
      select.appendChild(opt);
    });
  }
}



if (typeof window !== 'undefined') {
  window.FormService = FormService;
}