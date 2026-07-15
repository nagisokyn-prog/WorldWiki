/**
 * @file form.service.ts
 * @description Ð¡ÐµÑ€Ð²Ð¸Ñ Ð´Ð»Ñ Ñ€Ð°Ð±Ð¾Ñ‚Ñ‹ Ñ Ñ„Ð¾Ñ€Ð¼Ð°Ð¼Ð¸, Ð¿Ð¾ÑÑ‚Ñ€Ð¾ÐµÐ½Ð½Ñ‹Ð¼Ð¸ Ð½Ð° Ð¾ÑÐ½Ð¾Ð²Ðµ JSON-ÐºÐ¾Ð½Ñ„Ð¸Ð³Ð°
 * @note DOM-Ð·Ð°Ð²Ð¸ÑÐ¸Ð¼Ñ‹Ð¹
 */


export interface FieldConfig {
  id: string;
  path?: string;
  class?: string;
  type?: string;
  label?: string;
  required?: boolean;
  [key: string]: unknown;
}

export interface DynamicContainerDef {
  id: string;
  type?: string;
  title?: string;
  limit?: number;
  emptyMessage?: string;
  template: string;
  dataPath?: string;
}

export interface SectionConfig {
  id: string;
  fields?: FieldConfig[];
  dynamicContainers?: DynamicContainerDef[];
}

export interface FormConfig {
  sections: SectionConfig[];
}

export interface TemplateDef {
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
      containerEl.innerHTML = `<div class="empty-timeline"><p>${containerDef.emptyMessage || 'Ð­Ð»ÐµÐ¼ÐµÐ½Ñ‚Ñ‹ Ð½Ðµ Ð´Ð¾Ð±Ð°Ð²Ð»ÐµÐ½Ñ‹'}</p></div>`;
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
        console.warn(`Ð”Ð¾ÑÑ‚Ð¸Ð³Ð½ÑƒÑ‚ Ð»Ð¸Ð¼Ð¸Ñ‚ ÑÐ»ÐµÐ¼ÐµÐ½Ñ‚Ð¾Ð² (${limit})`);
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
        console.error("ÐžÑˆÐ¸Ð±ÐºÐ° Ð²Ð¾ÑÑÑ‚Ð°Ð½Ð¾Ð²Ð»ÐµÐ½Ð¸Ñ Ð¿Ð¾Ð»Ñ ÐºÐ°Ð»ÐµÐ½Ð´Ð°Ñ€Ñ:", e);
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
      <h4>${containerDef.title || 'Ð‘ÐµÐ· Ð½Ð°Ð·Ð²Ð°Ð½Ð¸Ñ'}</h4>
      <div id="${containerDef.id}Container" class="${containerDef.type === 'timeline' ? 'timeline-container' : 'dynamic-container'}">
        <div class="empty-timeline"><p>${containerDef.emptyMessage || 'Ð­Ð»ÐµÐ¼ÐµÐ½Ñ‚Ñ‹ Ð½Ðµ Ð´Ð¾Ð±Ð°Ð²Ð»ÐµÐ½Ñ‹'}</p></div>
      </div>
      <button class="btn btn-secondary" data-add-dynamic="${containerDef.id}" data-template="${containerDef.template}">
        âž• Ð”Ð¾Ð±Ð°Ð²Ð¸Ñ‚ÑŒ
      </button>
    `;
    return container;
  }

  /**
   * createCalendarDateField — STUB
   * This method depends on a domain-specific calendarService (custom calendar system).
   * Override it in your app by extending FormService and injecting your own
   * calendar provider:
   *
   *   class MyFormService extends FormService {
   *     createCalendarDateField(field) { return myCalendar.createField(field); }
   *   }
   */
  createCalendarDateField(field: FieldConfig): HTMLElement {
    const el = document.createElement('input');
    el.type = 'text';
    el.id = field.id;
    el.placeholder = field.label ?? 'date';
    console.warn('[FormService] createCalendarDateField is a stub — override in your app.');
    return el;
  }

  populateEraSelect(_select: HTMLSelectElement): void {
    console.warn('[FormService] populateEraSelect is a stub — override in your app.');
  }

  populateMonthSelect(_select: HTMLSelectElement): void {
    console.warn('[FormService] populateMonthSelect is a stub — override in your app.');
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
