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

  private collectRelationships(): void {
    console.log('[Connections] Начинаю сбор отношений...');
    this.relationships = {};

    if (!this.config || !this.formData) {
      console.warn('[Connections] Конфиг или formData не установлены, пропускаю сбор');
      return;
    }

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
          this.relationships[containerId] = value as RelationshipItem[];
          console.log(`   ✅ ${containerId} (path: ${dataPath}): ${value.length} элементов из formData`);
        } else {
          console.log(`   ℹ️ ${containerId} (path: ${dataPath}): пусто или не массив`);
        }
      }
    }
    
    console.log('[Connections] Сбор из formData завершен. Отношения:', this.relationships);
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
      // 1. Собираем отношения из formData
      this.collectRelationships();

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
      return await apiService.saveConnections(this.currentProject!, sourceId, connectionsList);
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