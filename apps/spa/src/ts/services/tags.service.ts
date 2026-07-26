/**
 * @file tags.service.ts
 * @description Сервис для работы с тегами
 * @rust-ready ✅ Работа с тегами
 */

import { apiService } from './api.service';
import { getCached, setCache, invalidateCache } from '../utils/requestCache';

interface TagData {
  id?: string;
  name: string;
  color: string;
}

interface TagField {
  input: HTMLInputElement | null;
  dropdown: HTMLElement | null;
  list: HTMLElement | null;
  selectedContainer: HTMLElement | null;
  selectAllBtn: HTMLElement | null;
  clearAllBtn: HTMLElement | null;
}

class TagsManager {
  project: string | null = null;
  globalTags: TagData[] = [];
  fields: Record<string, TagField> = {};
  selectedTags: string[] = [];
  isInitialized = false;

  async init(project: string): Promise<void> {
    if (this.isInitialized && this.project === project) return;
    this.project = project;

    try {
      const cacheKey = `tags:${this.project}`;
      const cached = getCached<TagData[]>(cacheKey);
      if (cached) {
        this.globalTags = cached;
      } else {
        this.globalTags = (await apiService.getTags(this.project)) || [];
        setCache(cacheKey, this.globalTags);
      }
    } catch (e) {
      console.error("Ошибка загрузки тегов:", e);
      this.globalTags = [];
    }

    document.addEventListener('click', (e: Event) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.tags-input-wrapper')) {
        document.querySelectorAll('.tags-dropdown').forEach(d => d.classList.remove('active'));
      }
    });

    const tagsManagerAPI = {
      getTagsForSave: () => this.selectedTags
    };
    (window as unknown as Record<string, unknown>).TagsManagerAPI = tagsManagerAPI;

    this.isInitialized = true;
  }

  registerField(fieldId: string, elements: { dropdownId: string; tagsListId: string; selectedContainerId: string }): void {
    this.fields[fieldId] = {
      input: document.getElementById(fieldId) as HTMLInputElement | null,
      dropdown: document.getElementById(elements.dropdownId),
      list: document.getElementById(elements.tagsListId),
      selectedContainer: document.getElementById(elements.selectedContainerId),
      selectAllBtn: document.getElementById(`${fieldId}SelectAll`),
      clearAllBtn: document.getElementById(`${fieldId}ClearAll`)
    };

    this.attachEvents(fieldId);

    const editor = (window as unknown as Record<string, unknown>).entityEditor as { entityData?: Record<string, unknown> } | undefined;
    if (editor && editor.entityData) {
      this.loadEntityTags(fieldId, editor.entityData[fieldId] as string | string[] | undefined);
    }
  }

  loadEntityTags(fieldId: string, tagsData: string | string[] | undefined): void {
    if (!tagsData) {
      this.selectedTags = [];
    } else if (typeof tagsData === 'string') {
      try {
        this.selectedTags = JSON.parse(tagsData);
      } catch {
        this.selectedTags = [];
      }
    } else if (Array.isArray(tagsData)) {
      this.selectedTags = tagsData.map(t => typeof t === 'string' ? t : (t as Record<string, unknown>).name as string);
    } else {
      this.selectedTags = [];
    }
    this.renderSelectedTags(fieldId);
  }

  attachEvents(fieldId: string): void {
    const field = this.fields[fieldId];
    if (!field || !field.input) return;

    field.input.addEventListener('focus', () => {
      field.dropdown?.classList.add('active');
      this.renderDropdown(fieldId, field.input?.value || '');
    });

    field.input.addEventListener('input', (e: Event) => {
      field.dropdown?.classList.add('active');
      this.renderDropdown(fieldId, (e.target as HTMLInputElement).value);
    });

    field.input.addEventListener('keydown', async (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const val = (e.target as HTMLInputElement).value.trim();
        if (val && !this.selectedTags.includes(val)) {
          await this.createNewTag(val);
          this.selectedTags.push(val);
          (e.target as HTMLInputElement).value = '';
          this.renderSelectedTags(fieldId);
          this.renderDropdown(fieldId, '');
          this.markEditorModified();
        }
      }
    });

    field.selectAllBtn?.addEventListener('click', () => {
      this.selectedTags = this.globalTags.map(t => t.name);
      this.renderSelectedTags(fieldId);
      field.dropdown?.classList.remove('active');
      this.markEditorModified();
    });

    field.clearAllBtn?.addEventListener('click', () => {
      this.selectedTags = [];
      this.renderSelectedTags(fieldId);
      field.dropdown?.classList.remove('active');
      this.markEditorModified();
    });
  }

  private isCreatingTag = false;

  async createNewTag(name: string): Promise<void> {
    if (this.isCreatingTag) return;
    
    const existing = this.globalTags.find(t => t.name.toLowerCase() === name.toLowerCase());
    if (existing) return;

    this.isCreatingTag = true;
    try {
      await apiService.saveTag(this.project!, { name, color: '#3498db' });
      invalidateCache(`tags:${this.project}`);
      this.globalTags.push({ name, color: '#3498db' });
    } catch (error) {
      console.error('Ошибка создания тега:', error);
    } finally {
      this.isCreatingTag = false;
    }
  }

  renderDropdown(fieldId: string, filterText: string = ''): void {
    const field = this.fields[fieldId];
    if (!field || !field.list) return;

    field.list.innerHTML = '';
    const term = filterText.toLowerCase();
    const filtered = this.globalTags.filter(t => t.name.toLowerCase().includes(term));

    if (filtered.length === 0) {
      field.list.innerHTML = `<div class="no-tags">Тег не найден. Нажмите Enter, чтобы создать "${filterText}"</div>`;
      return;
    }

    filtered.forEach(tag => {
      const isSelected = this.selectedTags.includes(tag.name);
      const item = document.createElement('div');
      item.className = `tag-option ${isSelected ? 'selected' : ''}`;
      item.innerHTML = `
        <input type="checkbox" ${isSelected ? 'checked' : ''}>
        <span style="color: ${tag.color || '#fff'}">${tag.name}</span>
      `;

      item.addEventListener('click', (e: Event) => {
        const target = e.target as HTMLElement;
        if (target.tagName !== 'INPUT') {
          const cb = item.querySelector('input') as HTMLInputElement;
          cb.checked = !cb.checked;
        }

        if ((item.querySelector('input') as HTMLInputElement).checked) {
          if (!this.selectedTags.includes(tag.name)) this.selectedTags.push(tag.name);
        } else {
          this.selectedTags = this.selectedTags.filter(t => t !== tag.name);
        }

        this.renderSelectedTags(fieldId);
        this.renderDropdown(fieldId, field.input?.value || '');
        this.markEditorModified();
      });

      field.list!.appendChild(item);
    });
  }

  renderSelectedTags(fieldId: string): void {
    const field = this.fields[fieldId];
    if (!field || !field.selectedContainer) return;

    field.selectedContainer.innerHTML = '';

    this.selectedTags.forEach(tagName => {
      const globalTag = this.globalTags.find(t => t.name === tagName) || { color: '#666' };
      const tagEl = document.createElement('div');
      tagEl.className = 'tag';
      tagEl.style.borderColor = globalTag.color;
      tagEl.innerHTML = `
        ${tagName}
        <button type="button" class="remove-tag" data-name="${tagName}">×</button>
      `;

      tagEl.querySelector('.remove-tag')?.addEventListener('click', (e: Event) => {
        const nameToRemove = (e.target as HTMLElement).dataset.name || '';
        this.selectedTags = this.selectedTags.filter(t => t !== nameToRemove);
        this.renderSelectedTags(fieldId);
        this.renderDropdown(fieldId, field.input?.value || '');
        this.markEditorModified();
      });

      field.selectedContainer!.appendChild(tagEl);
    });
  }

  private markEditorModified(): void {
    const editor = (window as unknown as Record<string, unknown>).entityEditor as { markAsModified?: () => void } | undefined;
    editor?.markAsModified?.();
  }
}

export const tagsManager = new TagsManager();

declare global {
  interface Window {
    TagsManagerAPI: { getTagsForSave: () => string[] };
  }
}