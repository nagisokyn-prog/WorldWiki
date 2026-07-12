/**
 * @file dynamic.service.ts
 * @description Сервис для работы с динамическими контейнерами
 * @note DOM-зависимый, используется внутри FormService
 */

import { FormService } from './form.service';
import { i18n } from '../i18n';

interface DynamicContainerDef {
  id: string;
  type?: string;
  title?: string;
  limit?: number;
  emptyMessage?: string;
  template: string;
  dataPath?: string;
}

export class DynamicService {
  formService: FormService | null = null;

  constructor(formService: FormService | null = null) {
    this.formService = formService;
  }

  /**
   * Создать DOM-элемент динамического контейнера
   */
  createContainer(containerDef: DynamicContainerDef): HTMLElement {
    const container = document.createElement('div');
    container.className = 'dynamic-section';
    if (containerDef.limit !== undefined) container.setAttribute('data-limit', String(containerDef.limit));
    container.innerHTML = `
      <h4>${containerDef.title || i18n.global.t('dynamic.unnamed')}</h4>
      <div id="${containerDef.id}Container" class="${containerDef.type === 'timeline' ? 'timeline-container' : 'dynamic-container'}">
        <div class="empty-timeline"><p>${containerDef.emptyMessage || i18n.global.t('dynamic.emptyItems')}</p></div>
      </div>
      <button class="btn btn-secondary" data-add-dynamic="${containerDef.id}" data-template="${containerDef.template}">
        ➕ ${i18n.global.t('dynamic.add')}
      </button>
    `;
    return container;
  }

  /**
   * Добавить элемент в контейнер
   */
  addItem(containerId: string, templateId: string, itemData: Record<string, unknown> | null, containerEl: HTMLElement, skipFill: boolean = false): HTMLElement | null {
    if (this.formService && typeof this.formService.addDynamicItem === 'function') {
      return this.formService.addDynamicItem(containerId, templateId, itemData, skipFill, containerEl.closest('.form-section') as HTMLElement);
    }
    return null;
  }
}

export const dynamicService = new DynamicService();

declare global {
  interface Window {
    dynamicService: DynamicService;
  }
}

if (typeof window !== 'undefined') {
  window.dynamicService = dynamicService;
}