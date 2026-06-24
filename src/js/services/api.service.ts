/**
 * @file api.service.ts
 * @description Сервис для вызова Tauri команд
 * @rust-ready ✅ Все invoke вызовы
 */

// Определяем типы для аргументов и ответов
interface ProjectConfig {
  type: string;
  genres: string[];
  calendar: unknown;
}

interface EntityData {
  id: string;
  name: string;
  [key: string]: unknown;
}

interface ChapterData {
  id: string;
  title: string;
  content: string;
  [key: string]: unknown;
}

interface TagData {
  id?: string;
  name: string;
  color: string;
  [key: string]: unknown;
}

interface ConnectionData {
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
}

interface SchemaInfo {
  name: string;
  icon: string;
  [key: string]: unknown;
}

interface EntityType {
  type: string;
  name: string;
  iconEmoji: string;
}

import { invoke, stringifyId, processIds } from '../../../tauri-surreal-kit/frontend/src/js/services/api.service';

/*
const isTauri = typeof window !== 'undefined' && !!(window as any).__TAURI__?.core;

const invoke = isTauri
  ? (window as any).__TAURI__.core.invoke
  : async (cmd: string, args?: Record<string, unknown>): Promise<unknown> => {
      console.warn(`[API Mock] ${cmd}`, args);
      // Mock responses для браузерного тестирования
      switch (cmd) {
        case 'get_projects': return [];
        case 'get_project_config': return { type: 'novel', genres: [], calendar: null };
        case 'create_project': return { success: true };
        case 'delete_project': return { success: true };
        case 'save_project_config': return { success: true };
        default: return null;
      }
    };

const stringifyId = (val: any): string => {
  if (val === null || val === undefined) return '';
  
  // Если это уже строка
  if (typeof val === 'string') {
    let s = val;
    // Очистка от SurrealDB-специфичных оберток, если они затесались в строку
    if (s.includes('{String:')) {
      const match = s.match(/String:"?([^"]+)"?/);
      if (match && match[1]) {
        s = match[1];
      }
    }
    return s.replace(/"/g, '').normalize('NFC').trim();
  }

  // Если это объект RecordId { tb: "...", id: "..." }
  if (typeof val === 'object' && val.tb) {
    const table = val.tb;
    let actualId = val.id;
    
    // Обработка оберток SurrealDB 2.0+: { String: "..." }, { Int: 42 }, { Uuid: "..." }
    if (actualId && typeof actualId === 'object') {
      actualId = actualId.String ?? actualId.Int ?? actualId.Uuid ?? JSON.stringify(actualId);
    }
    
    return `${table}:${String(actualId).replace(/["⟨⟩]/g, '')}`.normalize('NFC').trim();
  }

  // Если это просто обертка { String: "..." }
  if (typeof val === 'object' && val.String) {
    return String(val.String).replace(/["⟨⟩]/g, '').normalize('NFC').trim();
  }

  return String(val).replace(/["⟨⟩]/g, '').normalize('NFC').trim();
};

const processIds = (data: any): any => {
  if (data === null || data === undefined) return data;
  
  if (Array.isArray(data)) {
    return data.map(item => processIds(item));
  }
  
  if (typeof data === 'object') {
    // Если сам объект похож на RecordId, превращаем его в строку
    if (data.tb && data.id) return stringifyId(data);
    
    const newData: any = {};
    for (const key in data) {
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        // Список полей, которые могут содержать ID
        if (['id', 'id_тома', 'id_арки', 'volumeId', 'arcId', 'volume_id', 'arc_id', 'id_проекта', 'parentId', 'parent_id', 'project_id', 'entity_type'].includes(key)) {
          newData[key] = stringifyId(data[key]);
        } else {
          newData[key] = processIds(data[key]);
        }
      }
    }
    return newData;
  }
  
  return data;
};
*/

export const apiService = {
  uploadPhoto: async (file: File): Promise<string> => {
    const buffer = await file.arrayBuffer();
    const bytes = Array.from(new Uint8Array(buffer));
    return invoke('upload_photo', { bytes, filename: file.name }) as Promise<string>;
  },
  getLocalPhotoUrl: async (path: string): Promise<string> => {
    if (!path || path.startsWith('data:')) return path;
    if (path.startsWith('blob:')) return path; // Already a blob url
    
    // Tauri asset protocol often requires specific configurations in tauri.conf.json
    // To ensure images always load, we'll fetch bytes directly and create a blob URL

    
    // Fallback: load bytes via invoke
    try {
      const bytes: number[] = await invoke('get_local_file', { path }) as number[];
      
      // Determine basic mime type from extension
      let mimeType = 'image/jpeg';
      const lowerPath = path.toLowerCase();
      if (lowerPath.endsWith('.png')) mimeType = 'image/png';
      else if (lowerPath.endsWith('.webp')) mimeType = 'image/webp';
      else if (lowerPath.endsWith('.gif')) mimeType = 'image/gif';
      
      const blob = new Blob([new Uint8Array(bytes)], { type: mimeType });
      return URL.createObjectURL(blob);
    } catch (e) {
      console.error('[apiService] getLocalPhotoUrl error:', e);
      return path;
    }
  },

  // Проекты
  getProjects: (): Promise<unknown[]> => invoke<unknown[]>('get_projects'),
  createProject: (data: Record<string, unknown>): Promise<{ success: boolean }> =>
    invoke<{ success: boolean }>('create_project', { projectData: data }),
  getProjectConfig: (name: string): Promise<ProjectConfig> =>
    invoke<ProjectConfig>('get_project_config', { name }),
  deleteProject: (name: string): Promise<{ success: boolean }> =>
    invoke<{ success: boolean }>('delete_project', { name }),
  saveProjectConfig: (name: string, config: ProjectConfig): Promise<{ success: boolean }> =>
    invoke<{ success: boolean }>('save_project_config', { name, config }),

  // Сущности
  getEntityList: async (project: string, type: string, filters?: Record<string, unknown>): Promise<EntityData[]> => {
    const list = await invoke<any[]>('get_entities', { project, entityType: type, filters });
    return list.map(processIds).map(item => {
      if (item && item.data && typeof item.data === 'object') {
        return { ...item.data, id: item.id };
      }
      return item;
    });
  },
  getEntity: async (project: string, type: string, id: string): Promise<any> => {
    const detail: any = await invoke<any>('get_entity', { id });
    const processed = processIds(detail);
    // Всегда возвращаем раскрытые атрибуты (без обертки в attributes)
    if (processed && processed.attributes && typeof processed.attributes === 'object') {
      return { ...processed.attributes, id: processed.id };
    }
    if (processed && processed.data && typeof processed.data === 'object') {
      return { ...processed.data, id: processed.id };
    }
    return processed;
  },
  saveEntity: (project: string, type: string, data: any, id?: string, explicitName?: string): Promise<{ success: boolean; id?: string }> => {
    console.log('[apiService.saveEntity] 📤 Отправляю данные в Tauri:', { project, type, id, explicitName, data });
    let extractedName = explicitName || 'Без названия';

    // Если data.attributes уже существует и это не то, что мы ожидаем, раскрываем
    const actualData = data.attributes && !data.Name && !data.name && Object.keys(data).length === 1 && typeof data.attributes === 'object' 
      ? data.attributes 
      : data;

    if (extractedName === 'Без названия' && actualData && typeof actualData === 'object') {
      // Прямая гарантия пользователя: если нет явного имени, пробуем взять первое поле
      const keys = Object.keys(actualData).filter(k => k !== 'id' && k !== 'project_id' && k !== 'entity_type' && k !== 'attributes');
      if (keys.length > 0) {
        const firstVal = actualData[keys[0]];
        if (typeof firstVal === 'string' && firstVal.trim() !== '') {
          extractedName = firstVal.trim();
        }
      }
    }

    const SYSTEM_FIELDS = new Set(['id', 'project_id', 'entity_type', 'name', 'description', 'tags', 'embedding', 'created_at', 'updated_at', 'attributes']);
    const cleanAttributes: Record<string, unknown> = {};
    for (const k of Object.keys(actualData)) {
      if (!SYSTEM_FIELDS.has(k)) cleanAttributes[k] = actualData[k];
    }

    const entity = {
      id: id ?? null,
      project_id: `projects:${project}`,
      entity_type: type,
      name: extractedName,
      description: actualData.description || null,
      attributes: cleanAttributes,
      tags: actualData.tags || [],
    };
    return invoke<{ success: boolean; id?: string }>('save_entity', { project, entity });
  },
  deleteEntity: (project: string, type: string, id: string): Promise<{ success: boolean }> =>
    invoke<{ success: boolean }>('delete_entity', { id }),

  // Таймлайны глав
  getGlobalTimeline: (project: string): Promise<unknown> =>
    invoke<unknown>('get_global_timeline', { project }),
  saveGlobalTimeline: (project: string, data: unknown): Promise<{ success: boolean }> =>
    invoke<{ success: boolean }>('save_global_timeline', { project, data }),

  // Календари
  getCalendars: (project: string): Promise<any[]> =>
    invoke<any[]>('get_calendars', { project }),
  saveCalendar: (project: string, calendarData: unknown): Promise<{ success: boolean }> =>
    invoke<{ success: boolean }>('save_calendar', { data: calendarData }),
  deleteCalendar: (id: string): Promise<void> =>
    invoke<void>('delete_calendar', { id }),

  // Схемы для редактора
  getSchemas: async (project: string): Promise<Record<string, SchemaInfo>> => {
    const list = await invoke<any[]>('get_entity_schemas', { project });
    const map: Record<string, SchemaInfo> = {};
    for (const item of list) {
      map[item.type_key] = { name: item.type_name, icon: item.icon, full_schema: item.full_schema };
    }
    return map;
  },
  saveSchema: (project: string, schema: any): Promise<{ success: boolean }> =>
    invoke<{ success: boolean }>('save_entity_schema', { project, schema }),


  // Теги
  getTags: async (project: string): Promise<TagData[]> => {
    const list = await invoke<any[]>('get_tags', { project });
    return list.map(processIds);
  },
  saveTag: (project: string, tagData: TagData): Promise<{ success: boolean }> => {
    const data = {
      ...tagData,
      project_id: `projects:${project}`
    };
    return invoke<{ success: boolean }>('save_tag', { data });
  },
  deleteTag: (project: string, tagId: string): Promise<{ success: boolean }> =>
    invoke<{ success: boolean }>('delete_tag', { id: tagId }),

  // Главы
  getChaptersList: async (project: string): Promise<ChapterData[]> => {
    const list = await invoke<any[]>('get_chapters', { project });
    return list.map(processIds).filter((c: any) => c).map((c: any) => ({
      ...c,
      sortOrder: c.sort_order ?? c.sortOrder,
      wordCount: c.word_count ?? c.wordCount,
      arcId: c.arc_id ?? c.arcId,
      volumeId: c.volume_id ?? c.volumeId,
      timelineEvents: c.timeline_events ?? c.timelineEvents
    }));
  },
  getChapter: async (project: string, chapterId: string): Promise<ChapterData> => {
    const c: any = await invoke<any>('get_chapter', { id: chapterId });
    if (!c) return null as any;
    return {
      ...c,
      sortOrder: c.sort_order ?? c.sortOrder,
      wordCount: c.word_count ?? c.wordCount,
      arcId: c.arc_id ?? c.arcId,
      volumeId: c.volume_id ?? c.volumeId,
      timelineEvents: c.timeline_events ?? c.timelineEvents
    };
  },
  saveChapter: async (project: string, chapterData: any): Promise<{ success: boolean }> => {
    const data = { 
      ...chapterData, 
      project_id: `projects:${project}`,
      sort_order: chapterData.sortOrder ?? chapterData.sort_order,
      word_count: chapterData.wordCount ?? chapterData.word_count,
      arc_id: chapterData.arcId ?? chapterData.arc_id,
      volume_id: chapterData.volumeId ?? chapterData.volume_id,
      timeline_events: chapterData.timelineEvents ?? chapterData.timeline_events
    };
    delete data.sortOrder;
    delete data.wordCount;
    delete data.arcId;
    delete data.volumeId;
    delete data.timelineEvents;
    delete data.updatedAt;
    
    const res = await invoke<{ success: boolean }>('save_chapter', { data });
    
    // Extract and save text blocks
    if (data.content && typeof DOMParser !== 'undefined') {
      try {
        const doc = new DOMParser().parseFromString(data.content, 'text/html');
        const paragraphs = doc.querySelectorAll('p');
        const blocks: any[] = [];
        paragraphs.forEach((p) => {
          let tag = p.getAttribute('data-semantic-tag') || 'desc';
          if (tag === 'desc') tag = 'description';
          else if (tag === 'dialog') tag = 'dialogue';
          
          if (p.textContent && p.textContent.trim().length > 0) {
            blocks.push({
              block_type: tag,
              content: p.textContent.trim()
            });
          }
        });
        
        if (data.id) {
          await invoke<void>('save_text_blocks', { project, chapterId: data.id, blocks });
        }
      } catch (err) {
        console.error('Failed to parse text blocks:', err);
      }
    }
    
    return res;
  },
  deleteChapter: (project: string, id: string): Promise<{ success: boolean }> =>
    invoke<{ success: boolean }>('delete_chapter', { id }),

  // Связи
  getConnections: async (project: string, chapter: string): Promise<ConnectionData[]> => {
    const list = await invoke<any[]>('get_connections', { project, chapter });
    return list.map(processIds);
  },
  getConnectionsByEntity: (project: string, entityType: string, entityId: string): Promise<ConnectionData[]> =>
    invoke<ConnectionData[]>('get_connections_by_entity', { project, entityType, entityId }),
  removeConnectionsBySource: (project: string, entityType: string, entityId: string): Promise<{ success: boolean }> =>
    invoke<{ success: boolean }>('remove_connections_by_source', { project, entityType, entityId }),
  saveConnections: (project: string, data: ConnectionData[]): Promise<{ success: boolean }> =>
    invoke<{ success: boolean }>('save_connections', { project, data }),

  // Экспорт
  exportChapters: (project: string, chapters: unknown[], format: string, options: Record<string, unknown>): Promise<{ path: string }> =>
    invoke<{ path: string }>('export_chapters', { project, chapters, format, options }),

  // Типы сущностей
  getEntityTypes: async (project: string): Promise<EntityType[]> => {
    const schemas = await apiService.getSchemas(project);
    return Object.entries(schemas).map(([key, schema]) => ({
      type: key,
      name: schema.name || key,
      iconEmoji: schema.icon || '📄'
    }));
  },

  // ═══════════════════════════════════════════════════════
  //  HIERARCHY: ТОМ-АРКА-ГЛАВА
  // ═══════════════════════════════════════════════════════

  async getHierarchy(project: string): Promise<{ volumes: any[]; arcs: any[]; chapters: any[] }> {
    const data: any = await invoke('get_chapter_hierarchy', { project });
    if (data.volumes) data.volumes = data.volumes.map(processIds).map((v: any) => ({
      ...v,
      sortOrder: v.sort_order ?? v.sortOrder
    }));
    if (data.arcs) data.arcs = data.arcs.map(processIds).map((a: any) => ({
      ...a,
      sortOrder: a.sort_order ?? a.sortOrder,
      volumeId: a.volume_id ?? a.volumeId
    }));
    if (data.chapters) data.chapters = data.chapters.map(processIds).filter((c: any) => c).map((c: any) => ({
      ...c,
      sortOrder: c.sort_order ?? c.sortOrder,
      wordCount: c.word_count ?? c.wordCount,
      arcId: c.arc_id ?? c.arcId,
      volumeId: c.volume_id ?? c.volumeId,
      timelineEvents: c.timeline_events ?? c.timelineEvents
    }));
    return data;
  },

  async createVolume(project: string, title: string): Promise<string> {
    const res: any = await invoke('create_volume', { project, title });
    return stringifyId(res.id);
  },

  async updateVolume(project: string, id: string, title: string): Promise<void> {
    await invoke('update_volume', { project, id, title });
  },

  async deleteVolume(project: string, id: string): Promise<void> {
    await invoke('delete_volume', { project, id });
  },

  async createArc(project: string, title: string, volumeId?: string | null): Promise<string> {
    const res: any = await invoke('create_arc', { project, title, volumeId: volumeId ?? null });
    return stringifyId(res.id);
  },

  async updateArc(project: string, id: string, title: string, volumeId?: string | null): Promise<void> {
    await invoke('update_arc', { project, id, title, volumeId: volumeId ?? null });
  },

  async deleteArc(project: string, id: string): Promise<void> {
    await invoke('delete_arc', { project, id });
  },

  async assignChapter(project: string, chapterId: string, arcId?: string | null, volumeId?: string | null): Promise<void> {
    await invoke('assign_chapter', { project, chapterId, arcId: arcId ?? null, volumeId: volumeId ?? null });
  },

  async reorderNode(project: string, nodeType: string, id: string, sortOrder: number): Promise<void> {
    await invoke('reorder_node', { project, nodeType, id, sortOrder });
  },

  // ═══════════════════════════════════════════════════════
  //  PLAN ITEMS
  // ═══════════════════════════════════════════════════════

  async getPlanItems(project: string, parentType: string, parentId: string): Promise<any[]> {
    const allPlans = ((await invoke('get_plans', { project })) as any[]) || [];
    const cleanPlans = allPlans.map(processIds);
    const list = cleanPlans.filter((p: any) => p.parent_type === parentType && p.parent_ref === parentId);
    return list.map((p: any) => ({
      id: p.id,
      parentType: p.parent_type,
      parentId: p.parent_ref,
      text: p.title,
      done: p.completed,
      sortOrder: p.sort_order
    })).sort((a: any, b: any) => (a.sortOrder || 0) - (b.sortOrder || 0));
  },

  async savePlanItem(project: string, item: {
    id?: string; parentType: string; parentId: string;
    text: string; done?: boolean; indent?: number; sortOrder?: number;
  }): Promise<string> {
    const data = {
      id: item.id || null,
      project_id: `projects:${project}`,
      title: item.text,
      parent_ref: item.parentId,
      parent_type: item.parentType,
      sort_order: item.sortOrder || 0,
      completed: item.done || false
    };
    const res: any = await invoke('save_plan', { data });
    return res.id;
  },

  async deletePlanItem(project: string, id: string): Promise<void> {
    await invoke('delete_plan', { id });
  },

  async togglePlanItem(project: string, id: string): Promise<boolean> {
    const plan: any = await invoke('get_plan', { id });
    if (plan) {
      plan.completed = !plan.completed;
      await invoke('save_plan', { data: plan });
      return plan.completed;
    }
    return false;
  },

};

// Глобальный доступ для совместимости
declare global {
  interface Window {
    apiService: typeof apiService;
  }
}

if (typeof window !== 'undefined') {
  window.apiService = apiService;
}