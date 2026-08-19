import { describe, it, expect, beforeEach, vi } from 'vitest';
import { uiEditorService } from '../uiEditorService';

describe('uiEditorService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('validateField', () => {
    it('validates correct field schema', () => {
      const validField = {
        id: 'char_name',
        label: 'Character Name',
        type: 'text',
        required: true,
        options: [{ value: 'opt1', label: 'Option 1' }],
      };

      const result = uiEditorService.validateField(validField);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('detects missing id, label, type and invalid types', () => {
      const invalidField = {
        required: 'yes' as any,
        options: 'not-array' as any,
      };

      const result = uiEditorService.validateField(invalidField);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Field must have a valid id (string)');
      expect(result.errors).toContain('Field must have a label (string)');
      expect(result.errors).toContain('Field must have a type (string)');
      expect(result.errors).toContain('Field options must be an array');
      expect(result.errors).toContain('Field required must be a boolean');
    });
  });

  describe('validateSchema', () => {
    it('validates correct UI editor schema', () => {
      const schema: any = {
        name: 'Character Schema',
        sections: [
          { id: 'sec1', title: 'Main Info' },
          { id: 'sec2', title: 'Stats' },
        ],
        templates: {},
      };

      const result = uiEditorService.validateSchema(schema);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('detects missing name, missing sections, and invalid section structure', () => {
      const invalidSchema: any = {
        sections: [
          { id: 123 }, // missing title, id not string
        ],
        templates: 'not-an-object',
      };

      const result = uiEditorService.validateSchema(invalidSchema);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Schema must have a name (string)');
      expect(result.errors).toContain('Section 0 must have a valid id');
      expect(result.errors).toContain('Section 0 must have a title');
      expect(result.errors).toContain('Schema templates must be an object');
    });
  });

  describe('loadSchema via fetch', () => {
    it('loads schema from endpoint and caches it', async () => {
      const mockSchema = { name: 'Character', sections: [] };
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(mockSchema),
      } as any);

      const res = await uiEditorService.loadSchema('character_custom');
      expect(global.fetch).toHaveBeenCalledWith('/struct/editor/character_custom.json');
      expect(res).toEqual(mockSchema);

      // Subsequent call should use cache
      const cached = await uiEditorService.loadSchema('character_custom');
      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(cached).toEqual(mockSchema);
    });

    it('returns null on fetch error or non-ok response', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
      } as any);

      const res = await uiEditorService.loadSchema('unknown_entity');
      expect(res).toBeNull();
    });
  });

  describe('loadComponents & getFieldBlueprints', () => {
    it('loads blueprints and maps them to components', async () => {
      const mockBlueprints = {
        title_base: { label: 'Title Blueprint', type: 'text' },
        tags_base: { type: 'tags' },
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ field_blueprints: mockBlueprints }),
      } as any);

      const components = await uiEditorService.loadComponents();
      expect(components).toHaveLength(2);
      expect(components[0].id).toBe('title_base');
      expect(components[0].name).toBe('Title Blueprint');
      expect(components[1].id).toBe('tags_base');
      expect(components[1].name).toBe('tags');
    });
  });
});
