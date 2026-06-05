/**
 * @file form.service.ts
 * @description Сервис для работы с формами, построенными на основе JSON-конфига
 * @note DOM-зависимый
 */

import { calendarService } from './calendar.service';

interface FieldConfig {
  id: string;
  path?: string;
  class?: string;
  type?: string;
  label?: string;
  required?: boolean;
  [key: string]: unknown;
}

interface DynamicContainerDef {
  id: string;
  type?: string;
  title?: string;
  limit?: number;
  emptyMessage?: string;
  template: string;
  dataPath?: string;
}

interface SectionConfig {
  id: string;
  fields?: FieldConfig[];
  dynamicContainers?: DynamicContainerDef[];
}

interface FormConfig {
  sections: SectionConfig[];
}

interface TemplateDef {
  fields?: FieldConfig[];
  dynamicContainers?: DynamicContainerDef[];
}

export class FormService {
  config: FormConfig;
  templates: Record<string, TemplateDef>;
  fieldMap: Map<string, FieldConfig> = new Map();
  fieldByLastSegment: Map<string, FieldConfig> = new Map();

  constructor(config: FormConfig, templates: Record<string, TemplateDef>) {
    this.config = config;
    this.templates = templates;
    this.buildFieldMap();
  }

  buildFieldMap(): void {
    const addField = (field: FieldConfig, fullPath: string) => {
      if (!field) return;
      this.fieldMap.set(fullPath, field);
      const segments = fullPath.split('.');
      const last = segments[segments.length - 1];
      if (last && !this.fieldByLastSegment.has(last)) {
        this.fieldByLastSegment.set(last, field);
      }
    };

    const processFields = (fields: FieldConfig[], basePath: string) => {
      if (!fields) return;
      fields.forEach(field => {
        const path = field.path || field.id || field.class || '';
        const fullPath = basePath ? `${basePath}.${path}` : path;
        addField(field, fullPath);
      });
    };

    const processDynamicContainer = (container: DynamicContainerDef, basePath: string) => {
      const template = this.templates[container.template];
      if (!template) return;

      const containerPath = container.dataPath || container.id;
      const newBasePath = basePath ? `${basePath}.${containerPath}` : containerPath;

      if (template.fields) {
        template.fields.forEach(field => {
          const fieldKey = field.class || field.id;
          const fullPath = `${newBasePath}.${fieldKey}`;
          addField(field, fullPath);
        });
      }

      if (template.dynamicContainers) {
        template.dynamicContainers.forEach(nested => {
          processDynamicContainer(nested, newBasePath);
        });
      }
    };

    this.config.sections.forEach(section => {
      if (section.fields) processFields(section.fields, '');
      if (section.dynamicContainers) {
        section.dynamicContainers.forEach(container => {
          processDynamicContainer(container, '');
        });
      }
    });
  }

  normalizePath(path: string): string {
    return path.replace(/\[\d+\]/g, '');
  }

  findFieldConfig(fullPath: string): FieldConfig | null {
    const normalized = this.normalizePath(fullPath);
    if (this.fieldMap.has(normalized)) return this.fieldMap.get(normalized) || null;
    const segments = normalized.split('.');
    const lastSegment = segments[segments.length - 1];
    if (lastSegment && this.fieldByLastSegment.has(lastSegment)) return this.fieldByLastSegment.get(lastSegment) || null;
    return null;
  }

  getNestedValue(obj: Record<string, unknown> | undefined, path: string): unknown {
    if (!path || !obj) return obj;
    return path.split('.').reduce<unknown>((o: unknown, key) => {
      if (o && typeof o === 'object' && key in (o as Record<string, unknown>)) {
        return (o as Record<string, unknown>)[key];
      }
      return undefined;
    }, obj);
  }

  setNestedValue(obj: Record<string, unknown>, path: string, value: unknown): void {
    const parts = path.split('.');
    const last = parts.pop();
    let current: Record<string, unknown> = obj;
    for (const part of parts) {
      if (!current[part] || typeof current[part] !== 'object') {
        current[part] = {};
      }
      current = current[part] as Record<string, unknown>;
    }
    if (last) current[last] = value;
  }

  getFieldValue(field: FieldConfig, element: HTMLElement): unknown {
    if (!element) return '';
    if (field.type === 'calendar_date') {
      const container = element.closest('.form-group') as HTMLElement & { getValue?: () => unknown };
      if (container && container.getValue) return container.getValue();
      return null;
    }
    if (field.type === 'multiselect') {
      const select = element as HTMLSelectElement;
      return Array.from(select.options).filter(opt => opt.selected).map(opt => opt.value);
    }
    if ((element as HTMLSelectElement).tagName === 'SELECT' && (element as HTMLSelectElement).multiple) {
      return Array.from((element as HTMLSelectElement).selectedOptions).map(opt => opt.value);
    }
    return (element as HTMLInputElement).value?.trim() || '';
  }

  setFieldValue(field: FieldConfig, element: HTMLElement, value: unknown): void {
    if (!element) return;
    if (field.type === 'calendar_date') {
      const container = element.closest('.form-group') as HTMLElement & { setDate?: (v: unknown) => void };
      if (container && container.setDate) container.setDate(value);
      return;
    }
    if (field.type === 'multiselect') {
      const select = element as HTMLSelectElement;
      const valArr = Array.isArray(value) ? value : [];
      Array.from(select.options).forEach(opt => {
        opt.selected = valArr.includes(opt.value);
      });
      this.updateSelectedCount(field.id);
      return;
    }
    if ((element as HTMLSelectElement).tagName === 'SELECT' && (element as HTMLSelectElement).multiple) {
      const select = element as HTMLSelectElement;
      const valArr = Array.isArray(value) ? value : [];
      Array.from(select.options).forEach(opt => {
        opt.selected = valArr.includes(opt.value);
      });
      return;
    }
    if ((element as HTMLInputElement).type === 'number') {
      const input = element as HTMLInputElement;
      if (value !== undefined && value !== null && value !== '') {
        let num = parseFloat(value as string);
        if (!isNaN(num)) {
          input.value = String(num);
          this.normalizeNumberInput(input, true);
        } else {
          input.value = '';
        }
      } else {
        input.value = '';
      }
    } else {
      (element as HTMLInputElement).value = value !== undefined && value !== null ? String(value) : '';
    }
  }

  normalizeNumberInput(input: HTMLInputElement, fillEmpty: boolean = false): void {
    if (!input || input.type !== 'number') return;
    const min = parseFloat(input.getAttribute('min') || '');
    const max = parseFloat(input.getAttribute('max') || '');
    if (isNaN(min) && isNaN(max)) return;
    let val = input.value.trim();
    if (val === '') {
      if (fillEmpty && !isNaN(min)) input.value = String(min);
      return;
    }
    let num = parseFloat(val);
    if (isNaN(num)) {
      input.value = '';
      return;
    }
    if (!isNaN(min) && num < min) num = min;
    if (!isNaN(max) && num > max) num = max;
    input.value = String(num);
  }

  updateSelectedCount(fieldId: string): void {
    const origSelect = document.getElementById(fieldId) as HTMLSelectElement;
    if (!origSelect) return;
    const count = Array.from(origSelect.options).filter(opt => opt.selected).length;
    const countSpan = document.getElementById(`count-${fieldId}`);
    if (countSpan) countSpan.textContent = String(count);
  }

  collectFormData(container: HTMLElement): Record<string, unknown> {
    const data: Record<string, unknown> = {};
    const inputs = container.querySelectorAll('input[id], select[id], textarea[id]');

    inputs.forEach(input => {
      const el = input as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
      if (!el || !el.id) return;

      if ((el as HTMLInputElement).type === 'checkbox') {
        data[el.id] = (el as HTMLInputElement).checked;
      } else if ((el as HTMLInputElement).type === 'number') {
        data[el.id] = (el as HTMLInputElement).value === '' ? null : Number((el as HTMLInputElement).value);
      } else {
        data[el.id] = (el as HTMLInputElement).value;
      }
    });

    const groups = container.querySelectorAll('.form-group');
    groups.forEach(group => {
      const fieldId = (group as HTMLElement).dataset.fieldId;
      if (!fieldId) return;

      const input = group.querySelector('input, select, textarea');
      if (input) {
        data[fieldId] = (input as HTMLInputElement).value;
      }
    });

    return data;
  }

  collectDynamicContainer(containerDef: DynamicContainerDef, sectionEl: HTMLElement): unknown[] {
    const containerId = containerDef.id;
    const containerEl = sectionEl.querySelector(`#${containerId}Container`);
    if (!containerEl) return [];

    const items: unknown[] = [];
    const itemElements = containerEl.querySelectorAll('.timeline-item, .dynamic-item');
    const template = this.templates[containerDef.template];

    itemElements.forEach(item => {
      const itemData: Record<string, unknown> = {};

      const calendarGroups = item.querySelectorAll('.calendar-date-group');
      calendarGroups.forEach(calendarGroup => {
        let key: string | null = null;
        for (const cls of Array.from(calendarGroup.classList)) {
          if (cls !== 'form-group' && cls !== 'calendar-date-group' && cls !== 'full-width') {
            key = cls;
            break;
          }
        }
        const cg = calendarGroup as HTMLElement & { getValue?: () => unknown };
        if (key && typeof cg.getValue === 'function') {
          itemData[key] = cg.getValue();
        }
      });

      const allInputs = item.querySelectorAll('input, select, textarea');
      allInputs.forEach(input => {
        if (input.closest('.calendar-date-group')) return;
        let key: string | null = null;
        for (const cls of Array.from(input.classList)) {
          if (!cls.startsWith('btn') && !cls.startsWith('form-') &&
              cls !== 'timeline-item' && cls !== 'dynamic-item') {
            key = cls;
            break;
          }
        }
        if (!key && (input as HTMLElement).id) key = (input as HTMLElement).id;
        if (key) {
          let value = (input as HTMLInputElement).value;
          if ((input as HTMLInputElement).type === 'number' && value !== '') value = String(Number(value));
          itemData[key] = value;
        }
      });

      if (template && template.dynamicContainers) {
        template.dynamicContainers.forEach(nestedDef => {
          const nestedIdBase = (item as HTMLElement).getAttribute(`data-nested-container-${nestedDef.id.toLowerCase()}`);
          if (nestedIdBase) {
            const nestedContainerEl = document.getElementById(nestedIdBase + 'Container');
            if (nestedContainerEl) {
              const nestedContainer: DynamicContainerDef = {
                ...nestedDef,
                id: nestedIdBase,
                template: nestedDef.template,
                dataPath: nestedDef.dataPath
              };
              const nestedData = this.collectDynamicContainer(nestedContainer, item as HTMLElement);
              if (nestedData.length > 0) {
                itemData[nestedDef.dataPath || ''] = nestedData;
              }
            }
          }
        });
      }

      items.push(itemData);
    });

    return items;
  }

  fillForm(data: Record<string, unknown>, rootEl: HTMLElement): void {
    this.config.sections.forEach(section => {
      const sectionEl = rootEl.querySelector(`#section-${section.id}`);
      if (!sectionEl) return;

      if (section.fields) {
        section.fields.forEach(field => {
          const element = document.getElementById(field.id);
          if (element) {
            const value = this.getNestedValue(data, field.path || field.id);
            this.setFieldValue(field, element, value);
          }
        });
      }

      if (section.dynamicContainers) {
        section.dynamicContainers.forEach(container => {
          const containerData = this.getNestedValue(data, container.dataPath || container.id) as unknown[] | undefined;
          this.loadDynamicContainer(container, containerData || [], sectionEl as HTMLElement);
        });
      }
    });
  }

  loadDynamicContainer(containerDef: DynamicContainerDef, itemsData: unknown[], sectionEl: HTMLElement): void {
    const containerEl = sectionEl.querySelector(`#${containerDef.id}Container`);
    if (!containerEl) return;

    containerEl.innerHTML = '';
    if (!itemsData || itemsData.length === 0) {
      containerEl.innerHTML = `<div class="empty-timeline"><p>${containerDef.emptyMessage || 'Элементы не добавлены'}</p></div>`;
      return;
    }

    itemsData.forEach(() => {
      this.addDynamicItem(containerDef.id, containerDef.template, null, true, sectionEl);
    });

    const itemElements = containerEl.querySelectorAll('.timeline-item, .dynamic-item');
    itemElements.forEach((item, index) => {
      if (index < itemsData.length) {
        this.fillDynamicItem(item as HTMLElement, itemsData[index] as Record<string, unknown>, containerDef.template, sectionEl);
      }
    });
  }

  addDynamicItem(containerId: string, templateId: string, itemData: Record<string, unknown> | null, skipFill: boolean, sectionEl: HTMLElement): HTMLElement | null {
    const containerEl = sectionEl.querySelector(`#${containerId}Container`);
    const template = document.getElementById(templateId) as HTMLTemplateElement;
    if (!containerEl || !template) return null;

    const dynamicSection = containerEl.closest('.dynamic-section') as HTMLElement;
    const limit = dynamicSection ? parseInt(dynamicSection.getAttribute('data-limit') || '', 10) : null;
    if (limit !== null && !isNaN(limit)) {
      const currentItems = containerEl.querySelectorAll('.timeline-item, .dynamic-item');
      if (currentItems.length >= limit) {
        console.warn(`Достигнут лимит элементов (${limit})`);
        return null;
      }
    }

    const empty = containerEl.querySelector('.empty-timeline');
    if (empty) empty.remove();

    const clone = template.content.cloneNode(true) as DocumentFragment;
    const item = clone.firstElementChild as HTMLElement | null;
    if (!item) return null;
    containerEl.appendChild(item);

    const placeholders = item.querySelectorAll('.calendar-date-placeholder');
    placeholders.forEach(ph => {
      try {
        const fieldDef = JSON.parse((ph as HTMLElement).dataset.fieldDef || '{}');
        const realField = this.createCalendarDateField(fieldDef);
        ph.parentNode?.replaceChild(realField, ph);
      } catch(e) {
        console.error("Ошибка восстановления поля календаря:", e);
      }
    });

    const itemIndex = containerEl.querySelectorAll('.timeline-item, .dynamic-item').length - 1;
    item.dataset.index = String(itemIndex);

    const templateDef = this.templates[templateId];
    if (templateDef && templateDef.dynamicContainers) {
      const itemContent = item.querySelector('.item-content');
      if (itemContent) {
        templateDef.dynamicContainers.forEach(nestedDef => {
          const nestedId = `${containerId}_${itemIndex}_${nestedDef.id}`;
          const nestedContainerDef: DynamicContainerDef = {
            ...nestedDef,
            id: nestedId
          };
          const nestedContainer = this.createDynamicContainer(nestedContainerDef, sectionEl);
          itemContent.appendChild(nestedContainer);
          item.setAttribute(`data-nested-container-${nestedDef.id.toLowerCase()}`, nestedId);
        });
      }
    }

    if (itemData && !skipFill) {
      this.fillDynamicItem(item, itemData, templateId, sectionEl);
    }

    return item;
  }

  fillDynamicItem(item: HTMLElement, data: Record<string, unknown>, templateId: string, sectionEl: HTMLElement): void {
    if (!data) return;

    const calendarGroups = item.querySelectorAll('.calendar-date-group');
    calendarGroups.forEach(calendarGroup => {
      let key: string | null = null;
      for (const cls of Array.from(calendarGroup.classList)) {
        if (cls !== 'form-group' && cls !== 'calendar-date-group' && cls !== 'full-width') {
          key = cls;
          break;
        }
      }
      const cg = calendarGroup as HTMLElement & { setDate?: (v: unknown) => void };
      if (key && data[key] !== undefined && typeof cg.setDate === 'function') {
        cg.setDate(data[key]);
      }
    });

    Object.keys(data).forEach(key => {
      if (key === 'calendar-year' || key === 'calendar-month' || key === 'calendar-day' || key === 'calendar-era') return;
      const input = item.querySelector(`.${key}`);
      if (input && !input.closest('.calendar-date-group')) {
        this.setFieldValue({ id: key, type: 'text' }, input as HTMLElement, data[key]);
      }
    });

    const templateDef = this.templates[templateId];
    if (templateDef && templateDef.dynamicContainers) {
      templateDef.dynamicContainers.forEach(nestedDef => {
        const nestedIdBase = item.getAttribute(`data-nested-container-${nestedDef.id.toLowerCase()}`);
        if (nestedIdBase && data[nestedDef.dataPath || '']) {
          const nestedContainerEl = document.getElementById(nestedIdBase + 'Container');
          if (nestedContainerEl) {
            const nestedContainer: DynamicContainerDef = {
              ...nestedDef,
              id: nestedIdBase,
              template: nestedDef.template,
              dataPath: nestedDef.dataPath
            };
            this.loadDynamicContainer(nestedContainer, data[nestedDef.dataPath || ''] as unknown[] || [], sectionEl);
          }
        }
      });
    }
  }

  createDynamicContainer(containerDef: DynamicContainerDef, _parent: HTMLElement): HTMLElement {
    const container = document.createElement('div');
    container.className = 'dynamic-section';
    if (containerDef.limit !== undefined) container.setAttribute('data-limit', String(containerDef.limit));
    container.innerHTML = `
      <h4>${containerDef.title || 'Без названия'}</h4>
      <div id="${containerDef.id}Container" class="${containerDef.type === 'timeline' ? 'timeline-container' : 'dynamic-container'}">
        <div class="empty-timeline"><p>${containerDef.emptyMessage || 'Элементы не добавлены'}</p></div>
      </div>
      <button class="btn btn-secondary" data-add-dynamic="${containerDef.id}" data-template="${containerDef.template}">
        ➕ Добавить
      </button>
    `;
    return container;
  }

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

declare global {
  interface Window {
    FormService: typeof FormService;
  }
}

if (typeof window !== 'undefined') {
  window.FormService = FormService;
}