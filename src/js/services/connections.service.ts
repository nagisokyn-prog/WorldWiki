/**
 * @file connections.service.ts
 * @description Сервис связей
 * @rust-ready ✅ Связи между сущностями
 */

import { apiService } from './api.service';

// Используем тип ConnectionData из api.service (см. api.service.ts)
type ConnectionData = {
  id?: string;
  source?: { entityType: string; entityId: string };
  sourceId?: string;
  sourceType?: string;
  target?: { entityType: string; entityId: string };
  targetId?: string;
  targetType?: string;
  type?: string;
  role?: string;
  description?: string;
  period?: { start_chapter?: string; end_chapter?: string };
  [key: string]: unknown;
};

interface RelationshipItem {
  [key: string]: unknown;
}

class ConnectionsService {
  currentProject: string | null = null;
  currentEntityType: string | null = null;
  currentEntityId: string | null = null;
  relationships: Record<string, RelationshipItem[]> = {};
  config: any = null;
  formData: any = null;

  async init(project: string): Promise<void> {
    this.currentProject = project;
  }

  setCurrentEntity(entityType: string, entityId: string): void {
    this.currentEntityType = entityType;
    this.currentEntityId = entityId;
  }

  setCurrentProject(project: string): void {
    this.currentProject = project;
  }

  setConfig(config: any): void {
    this.config = config;
    console.log('[Connections] Установлен конфиг:', config);
  }

  setFormData(data: any): void {
    this.formData = data;
    console.log('[Connections] Установлены данные формы, ключи:', Object.keys(data || {}).sort());
    
    // Логируем наличие контейнеров отношений
    if (this.config && this.config.sections) {
      for (const section of this.config.sections) {
        if (section.dynamicContainers) {
          for (const container of section.dynamicContainers) {
            const cname = String(container.id || '').toLowerCase();
            if (cname.includes('relationship') || cname.includes('relation')) {
              const path = container.dataPath || container.id;
              const value = this.getPropFromPath(data, path);
              console.log(`   📦 ${path}: ${Array.isArray(value) ? value.length : 'не массив'} элементов`);
            }
          }
        }
      }
    }
  }

  private getPropFromPath(obj: any, path: string): any {
    if (!path || !obj) return undefined;
    const parts = path.split('.');
    let current = obj;
    for (const part of parts) {
      if (current === undefined || current === null) return undefined;
      current = current[part];
    }
    return current;
  }

  setRelationships(relationships: Record<string, RelationshipItem[]>): void {
    this.relationships = relationships;
  }

  private collectRelationshipsFromDOM(): void {
    console.log('[Connections] Начинаю сбор отношений...');
    this.relationships = {};

    if (!this.config) {
      console.warn('[Connections] Конфиг не установлен, пропускаю сбор');
      return;
    }

    // ПРИОРИТЕТ 1: Если есть formData, используем его (более надёжный источник)
    if (this.formData) {
      console.log('[Connections] Используем formData для сбора отношений...');
      const sections = this.config.sections || [];
      
      for (const section of sections) {
        if (!section.dynamicContainers) continue;
        
        for (const containerConfig of section.dynamicContainers) {
          const containerId = String(containerConfig.id || containerConfig.name || containerConfig.key || '').trim();
          if (!containerId) continue;
          const containerName = containerId.toLowerCase();
          
          if (!containerName.includes('relationship') && !containerName.includes('relation')) continue;
          
          const dataPath = containerConfig.dataPath || containerId;
          const value = this.getPropFromPath(this.formData, dataPath);
          
          if (Array.isArray(value) && value.length > 0) {
            this.relationships[containerId] = value;
            console.log(`   ✅ ${containerId} (path: ${dataPath}): ${value.length} элементов из formData`);
          } else {
            console.log(`   ℹ️ ${containerId} (path: ${dataPath}): пусто или не массив`);
          }
        }
      }
      
      console.log('[Connections] Сбор из formData завершен. Отношения:', this.relationships);
      return;
    }

    console.log('[Connections] Начинаю сбор отношений из DOM (расширенный режим)...');

    if (!this.config) {
      console.warn('[Connections] Конфиг не установлен, пропускаю сбор');
      return;
    }

    const sections = this.config.sections || [];
    console.log(`[Connections] Секций: ${sections.length}`);

    for (const section of sections) {
      if (!section.dynamicContainers) continue;

      for (const containerConfig of section.dynamicContainers) {
        const containerId = String(containerConfig.id || containerConfig.name || containerConfig.key || '').trim();
        if (!containerId) continue;
        const containerName = containerId.toLowerCase();

        // Оставляем только контейнеры, которые, вероятно, содержат отношения
        if (!containerName.includes('relationship') && !containerName.includes('relation')) continue;

        console.log(`🔍 [Connections] Ищу контейнер (гибкий поиск): ${containerId}`);

        // Возможные селекторы — проверяем по очереди
        const selectors = [
          `#${containerId}Container`,
          `#${containerId}`,
          `[data-dynamic-container="${containerId}"]`,
          `[data-container-id="${containerId}"]`,
          `.${containerId}-container`
        ];

        let containerElement: HTMLElement | null = null;
        for (const sel of selectors) {
          const el = document.querySelector(sel) as HTMLElement | null;
          if (el) {
            containerElement = el;
            console.log(`   ✅ Найден контейнер по селектору: ${sel}`);
            break;
          }
        }

        // Фоллбэк: найти элемент, id которого содержит название контейнера
        if (!containerElement) {
          const byIdContains = Array.from(document.querySelectorAll('[id]')).find(el => el.id.toLowerCase().includes(containerId.toLowerCase()));
          if (byIdContains) {
            containerElement = byIdContains as HTMLElement;
            console.log(`   ✅ Найден контейнер по частичному совпадению id: ${byIdContains.id}`);
          }
        }

        // Фоллбэк 2: найти контейнер по заголовку (h4) — совпадение с container.title
        if (!containerElement) {
          const titleToMatch = String(containerConfig.title || containerConfig.label || containerId).toLowerCase().trim();
          if (titleToMatch) {
            // Ищем h4 с нужным текстом
            const allH4s = Array.from(document.querySelectorAll('h4'));
            for (const h4 of allH4s) {
              const txt = (h4.textContent || '').toLowerCase().trim();
              if (!txt) continue;
              // Сравниваем по включению ключевой части заголовка
              if (!txt.includes(titleToMatch) && !titleToMatch.includes(txt) && !txt.includes(titleToMatch.split(' ')[0])) {
                continue; // не совпадает
              }

              // Нашли h4 с нужным заголовком
              console.log(`   ✅ Найден заголовок: "${(h4.textContent||'').trim()}"`);

              // Структура Vue: div (контейнер) > div (header с h4) > h4
              // или: div (контейнер) > div (header) + div (элементы с glass-card)
              // Ищем родителя контейнера (div с margin-bottom:24px)
              let parent = h4.parentElement;  // div header
              if (parent) {
                parent = parent.parentElement;  // div основной контейнер
              }
              
              if (!parent) continue;

              console.log(`   🔎 Ищу контейнер элементов в родителе (${parent.children.length} детей)`);

              // Структура Vue:
              // div (основной контейнер)
              //   ├─ div (header с h4 + button)
              //   └─ div (контейнер элементов или empty-timeline)
              
              // Ищем второй child (контейнер элементов)
              let elementsContainer = parent.children[1] as HTMLElement | null;
              if (!elementsContainer) {
                console.log(`   ❌ Второй child не найден в родителе`);
                continue;
              }

              console.log(`   📦 Найден контейнер элементов. Класс: "${elementsContainer.className}", детей: ${elementsContainer.children.length}`);

              // Проверяем, это ли empty-timeline
              if (elementsContainer.classList.contains('empty-timeline')) {
                console.log(`   ℹ️ Контейнер пуст (empty-timeline)`);
                continue;
              }

              // Ищем элементы отношений - это могут быть:
              // 1. RelationshipBlock компоненты (не имеют специального класса, это просто div-ы)
              // 2. div.glass-card элементы
              const relationshipElements = Array.from(elementsContainer.children).filter((el: Element) => {
                const classList = (el as HTMLElement).className;
                // Ищем элементы с контролами или это может быть RelationshipBlock компонент
                return el.querySelector('input, select, textarea, button') !== null || 
                       classList.includes('glass-card') || 
                       (el instanceof HTMLDivElement && el.children.length > 0);
              });

              console.log(`   🔍 Найдено элементов отношений: ${relationshipElements.length}`);

              if (relationshipElements.length > 0) {
                containerElement = elementsContainer;
                console.log(`   ✅ Установлен контейнер элементов`);
                break;
              }
            }
          }
        }

        if (!containerElement) {
          console.log(`   ❌ Контейнер не найден: ${containerId} (проверьте id/data-dynamic-container)`);
          continue;
        }

        console.log(`   📦 Контейнер найден. Tag: ${containerElement.tagName}, класс: "${containerElement.className}", детей: ${containerElement.children.length}`);

        const items: RelationshipItem[] = [];

        // Попробуем несколько стратегий поиска элементов-элементов отношений
        const itemSelectors = [
          `.glass-card`,
          `.${containerId}-item`,
          `.dynamic-item`,
          `.relationship-item`,
          `.item`,
          `div[data-item]`
        ];

        let itemElements: Element[] = [];
        for (const itSel of itemSelectors) {
          itemElements = Array.from(containerElement.querySelectorAll(itSel));
          if (itemElements.length) break;
        }

        // Если не нашли, возьмём дочерние элементы, у которых есть input/select/textarea
        if (itemElements.length === 0) {
          itemElements = Array.from(containerElement.querySelectorAll(':scope > *')).filter(el => el.querySelector('input, select, textarea'));
        }

        console.log(`   Найдено элементов: ${itemElements.length}`);

        itemElements.forEach((itemEl, elemIdx) => {
          const item: RelationshipItem = {};
          const elClass = (itemEl as HTMLElement).className || '(без класса)';
          const elId = (itemEl as HTMLElement).id || '(без id)';
          console.log(`     [elem ${elemIdx}] класс="${elClass}", id="${elId}"`);

          // Собираем поля из input/select/textarea
          const controls = Array.from(itemEl.querySelectorAll('input, select, textarea')) as (HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement)[];
          console.log(`     [elem ${elemIdx}] найдено контролов: ${controls.length}`);
          
          controls.forEach((ctrl, ctrlIdx) => {
            const name = (ctrl.getAttribute('name') || ctrl.getAttribute('data-field') || ctrl.getAttribute('data-name') || ctrl.id || '').toString().trim();
            const value = (ctrl as any).value;
            console.log(`       [ctrl ${ctrlIdx}] name="${name}", value="${value}"`);
            if (name) {
              item[name] = value;
            }
          });

          // Собираем data-* атрибуты самого элемента
          const ds = (itemEl as HTMLElement).dataset;
          console.log(`     [elem ${elemIdx}] data-* атрибуты:`, ds);
          for (const k in ds) {
            if (ds[k] !== undefined) item[k] = ds[k];
          }

          // Фоллбэк: попытаться взять target id из атрибутов
          if (!item['target'] && !item['character'] && !item['relation']) {
            const targetAttr = (itemEl as HTMLElement).getAttribute('data-target-id') || (itemEl as HTMLElement).getAttribute('data-entity-id');
            if (targetAttr) {
              item['target'] = targetAttr;
              console.log(`       взяли target из атрибута: ${targetAttr}`);
            }
          }

          console.log(`     [elem ${elemIdx}] итоговый item:`, item, `ключей: ${Object.keys(item).length}`);
          if (Object.keys(item).length > 0) items.push(item);
        });

        if (items.length > 0) {
          this.relationships[containerId] = items;
          console.log(`   ✅ Контейнер ${containerId}: собрано ${items.length} элементов`);
        }
      }
    }

    console.log('[Connections] Сбор завершен. Отношения:', this.relationships);
  }

  async loadConnections(): Promise<boolean> {
    if (!this.currentProject || !this.currentEntityType || !this.currentEntityId) {
      console.warn('⚠️ [Connections] Текущая сущность не установлена, пропускаю загрузку');
      return false;
    }

    try {
      console.log(`📥 [Connections] Загружаю связи для ${this.currentEntityType} ${this.currentEntityId}...`);
      
      // Получаем все связи, где текущая сущность - TARGET (обратные связи)
      // т.е. другие сущности связаны с нами
      const connections = await this.getConnectionsByEntity(
        this.currentEntityType,
        this.currentEntityId
      );

      if (!connections || connections.length === 0) {
        console.log('ℹ️ [Connections] Входящих связей не найдено');
        return true;
      }

      console.log(`✅ [Connections] Загружено ${connections.length} входящих связей`);

      // Группируем связи по source для отрисовки
      const groupedBySource: Record<string, ConnectionData[]> = {};
      for (const conn of connections) {
        if (!conn.source) continue;
        const key = `${conn.source.entityType}_${conn.source.entityId}`;
        if (!groupedBySource[key]) {
          groupedBySource[key] = [];
        }
        groupedBySource[key].push(conn);
      }

      // Пока логируем загруженные связи (отрисовка может быть отложена)
      console.log('[Connections] Загруженные входящие связи:', groupedBySource);
      
      return true;
    } catch (error) {
      console.error('❌ [Connections] Ошибка загрузки связей:', error);
      return false;
    }
  }

  async getConnectionsByEntity(entityType: string, entityId: string): Promise<ConnectionData[]> {
    return await apiService.getConnectionsByEntity(this.currentProject!, entityType, entityId) as ConnectionData[];
  }

  async getConnections(chapter: string | null = null): Promise<ConnectionData[]> {
    return await apiService.getConnections(this.currentProject!, chapter || '') as ConnectionData[];
  }

  async removeConnectionsBySource(entityType: string, entityId: string): Promise<{ success: boolean }> {
    return await apiService.removeConnectionsBySource(this.currentProject!, entityType, entityId);
  }

  /**
   * Преобразует отношения из динамических контейнеров в объекты Connection
   * и отправляет их в БД
   */
  async saveConnections(): Promise<{ success: boolean }> {
    if (!this.currentProject || !this.currentEntityType || !this.currentEntityId) {
      console.warn('⚠️ [Connections] Текущая сущность не установлена');
      return { success: false };
    }

    try {
      // 1. Собираем отношения из DOM
      this.collectRelationshipsFromDOM();

      const connectionsList: ConnectionData[] = [];
      const sourceId = String(this.currentEntityId);
      const sourceType = this.currentEntityType;

      // Перебираем все собранные отношения
      for (const [containerName, items] of Object.entries(this.relationships)) {
        if (!Array.isArray(items) || items.length === 0) continue;

        const cname = String(containerName).toLowerCase();

        // Определяем целевой тип сущности по контейнеру (регистро-независимо)
        let targetType: string | null = null;
        if (cname.includes('relationship') || cname.includes('relation')) {
          if (cname.includes('character')) targetType = 'character';
          else if (cname.includes('organization')) targetType = 'organization';
          else if (cname.includes('state')) targetType = 'state';
          else targetType = 'character';
        } else {
          console.log(`   ⚠️ [Connections] Пропущен контейнер ${containerName}: не похоже на relation`);
        }

        if (!targetType) continue;

        // Обрабатываем каждый элемент отношения
        for (const item of items) {
          if (!item || typeof item !== 'object') continue;

          // Ищем ID целевой сущности
          // Может быть в разных полях: персонаж, родственник, персона и т.д.
          let targetId: string | null = null;
          const possibleIdFields = ['персонаж', 'родственник', 'персона', 'character', 'relation', 'target'];
          
          for (const field of possibleIdFields) {
            if ((item as Record<string, unknown>)[field]) {
              targetId = String((item as Record<string, unknown>)[field]);
              break;
            }
          }

          if (!targetId) continue;

          // Создаем основной объект Connection
          const connection: ConnectionData = {
            id: `${sourceType}_${sourceId}_${targetType}_${targetId}_${Date.now()}`,
            source: { entityType: sourceType, entityId: sourceId },
            target: { entityType: targetType, entityId: targetId },
            role: String((item as Record<string, unknown>)['базовый_тип_связи'] || (item as Record<string, unknown>)['тип_родства'] || 'unknown'),
            description: String((item as Record<string, unknown>)['описание'] || ''),
            period: {
              start_chapter: String((item as Record<string, unknown>)['начальная_глава'] || ''),
              end_chapter: String((item as Record<string, unknown>)['конечная_глава'] || '')
            }
          };

          connectionsList.push(connection);
          console.log('✅ [Connections] Создана связь:', connection);

          // Создаем обратную связь (B -> A)
          const reverseConnection: ConnectionData = {
            id: `${targetType}_${targetId}_${sourceType}_${sourceId}_${Date.now() + 1}`,
            source: { entityType: targetType, entityId: targetId },
            target: { entityType: sourceType, entityId: sourceId },
            role: String((item as Record<string, unknown>)['базовый_тип_связи'] || (item as Record<string, unknown>)['тип_родства'] || 'unknown'),
            description: String((item as Record<string, unknown>)['описание'] || ''),
            period: {
              start_chapter: String((item as Record<string, unknown>)['начальная_глава'] || ''),
              end_chapter: String((item as Record<string, unknown>)['конечная_глава'] || '')
            }
          };

          connectionsList.push(reverseConnection);
          console.log('🔄 [Connections] Создана обратная связь:', reverseConnection);
        }
      }

      if (connectionsList.length === 0) {
        console.log('ℹ️ [Connections] Отношений для сохранения не найдено');
        return { success: true };
      }

      console.log(`📤 [Connections] Отправляю ${connectionsList.length} связей в БД...`);
      return await apiService.saveConnections(this.currentProject!, connectionsList);
    } catch (error) {
      console.error('❌ [Connections] Ошибка сохранения связей:', error);
      return { success: false };
    }
  }
}

export const connectionsManager = new ConnectionsService();

declare global {
  interface Window {
    connectionsManager: ConnectionsService;
  }
}

if (typeof window !== 'undefined') {
  window.connectionsManager = connectionsManager;
}