import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Entity Schemas Contract Audit (6 Core Entities)', () => {
  const schemasDir = path.resolve(__dirname, '../../../../public/struct/editor');
  const coreEntities = ['character', 'location', 'organization', 'state', 'item', 'event'];

  it('all 6 core entity schema files exist on disk and are valid JSON', () => {
    coreEntities.forEach((entityType) => {
      const filePath = path.join(schemasDir, `${entityType}.json`);
      expect(fs.existsSync(filePath), `Schema file ${entityType}.json must exist`).toBe(true);

      const raw = fs.readFileSync(filePath, 'utf8');
      expect(() => JSON.parse(raw), `${entityType}.json must be valid JSON`).not.toThrow();
    });
  });

  it('all schemas contain mandatory metadata and sections', () => {
    coreEntities.forEach((entityType) => {
      const filePath = path.join(schemasDir, `${entityType}.json`);
      const schema = JSON.parse(fs.readFileSync(filePath, 'utf8'));

      expect(schema.name).toBeDefined();
      expect(schema.icon).toBeDefined();
      expect(schema.entityType).toBe(entityType);
      expect(schema.titleField).toBe('название');
      expect(schema.sections).toBeInstanceOf(Array);
      expect(schema.sections.length).toBeGreaterThan(0);
    });
  });

  it('character schema contains all required system fields with isSystem: true', () => {
    const filePath = path.join(schemasDir, 'character.json');
    const schema = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const basicFields = schema.sections[0].fields;

    const nameField = basicFields.find((f: any) => f.path === 'название');
    expect(nameField).toBeDefined();
    expect(nameField.isSystem).toBe(true);
    expect(nameField.required).toBe(true);

    const statusField = basicFields.find((f: any) => f.path === 'статус_категория');
    expect(statusField).toBeDefined();
    expect(statusField.isSystem).toBe(true);
    expect(statusField.options.map((o: any) => o.value)).toContain('Жив');
    expect(statusField.options.map((o: any) => o.value)).toContain('Мёртв');

    const birthField = basicFields.find((f: any) => f.path === 'дата_рождения');
    expect(birthField).toBeDefined();
    expect(birthField.type).toBe('calendar_datetime');
    expect(birthField.isSystem).toBe(true);

    const deathField = basicFields.find((f: any) => f.path === 'дата_смерти');
    expect(deathField).toBeDefined();
    expect(deathField.type).toBe('calendar_datetime');
    expect(deathField.isSystem).toBe(true);
  });

  it('location schema contains correct scale options and hierarchy fields', () => {
    const filePath = path.join(schemasDir, 'location.json');
    const schema = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const basicFields = schema.sections[0].fields;

    const typeField = basicFields.find((f: any) => f.path === 'тип_локации');
    expect(typeField).toBeDefined();
    expect(typeField.isSystem).toBe(true);
    const scaleValues = typeField.options.map((o: any) => o.value);
    expect(scaleValues).toContain('интерьер');
    expect(scaleValues).toContain('здание');
    expect(scaleValues).toContain('поселение');
    expect(scaleValues).toContain('природная_зона');
    expect(scaleValues).toContain('гео_регион');

    const parentField = basicFields.find((f: any) => f.path === 'родительская_локация');
    expect(parentField).toBeDefined();
    expect(parentField.entityType).toBe('location');
  });

  it('item schema contains ownership history container and system fields', () => {
    const filePath = path.join(schemasDir, 'item.json');
    const schema = JSON.parse(fs.readFileSync(filePath, 'utf8'));

    const basicFields = schema.sections[0].fields;
    const typeField = basicFields.find((f: any) => f.path === 'тип_предмета');
    expect(typeField).toBeDefined();
    expect(typeField.isSystem).toBe(true);

    const statusField = basicFields.find((f: any) => f.path === 'статус_категория');
    expect(statusField).toBeDefined();
    expect(statusField.isSystem).toBe(true);

    const historySec = schema.sections.find((s: any) => s.id === 'history');
    expect(historySec).toBeDefined();
    expect(historySec.dynamicContainers.length).toBeGreaterThan(0);
    expect(historySec.dynamicContainers[0].dataPath).toBe('история_владения');
  });

  it('event schema contains date, scale and location links', () => {
    const filePath = path.join(schemasDir, 'event.json');
    const schema = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const basicFields = schema.sections[0].fields;

    const dateField = basicFields.find((f: any) => f.path === 'дата_события');
    expect(dateField).toBeDefined();
    expect(dateField.type).toBe('calendar_datetime');
    expect(dateField.isSystem).toBe(true);

    const scaleField = basicFields.find((f: any) => f.path === 'масштаб_важность');
    expect(scaleField).toBeDefined();
    expect(scaleField.isSystem).toBe(true);

    const locField = basicFields.find((f: any) => f.path === 'место_действия');
    expect(locField).toBeDefined();
    expect(locField.entityType).toBe('location');
  });
});
