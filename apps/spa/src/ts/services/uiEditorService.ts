
export interface TemplateConfig {
  id: string
  title: string
  icon?: string
  fields: Array<{
    id: string
    class?: string
    type: string
    label?: string
    placeholder?: string
    required?: boolean
    options?: Array<{ value: string; label: string }>
    entityType?: string
    path?: string
    rows?: number
    min?: number
    max?: number
    hint?: string
  }>
  dynamicContainers?: Array<{
    id: string
    title: string
    template: string
    dataPath?: string
    emptyMessage?: string
  }>
}

export interface UIEditorSchema {
  name: string
  icon?: string
  iconEmoji?: string
  sections: Array<{
    id: string
    title: string
    icon?: string
    fields?: Array<Record<string, unknown>>
    dynamicContainers?: Array<Record<string, unknown>>
  }>
  templates: Record<string, TemplateConfig>
}

export interface UIEditorService {
  loadSchema(entityType: string): Promise<UIEditorSchema | null>
  loadComponents(): Promise<Array<{ id: string; name: string; type: string; icon: string; template?: Record<string, unknown> }>>
  getFieldBlueprints(): Promise<Record<string, Record<string, unknown>>>
  validateField(field: Record<string, unknown>): { valid: boolean; errors: string[] }
  validateSchema(schema: UIEditorSchema): { valid: boolean; errors: string[] }
}

class UIEditorServiceImpl implements UIEditorService {
  private schemaCache: Record<string, UIEditorSchema> = {}

  async loadSchema(entityType: string): Promise<UIEditorSchema | null> {
    if (this.schemaCache[entityType]) {
      return this.schemaCache[entityType]
    }
    try {
      const res = await fetch(`/struct/editor/${entityType}.json`)
      if (!res.ok) {
        console.warn(`[UIEditorService] Schema not found for ${entityType}`)
        return null
      }
      const schema = await res.json()
      this.schemaCache[entityType] = schema
      return schema
    } catch (e) {
      console.error(`[UIEditorService] Error loading schema ${entityType}:`, e)
      return null
    }
  }

  async loadComponents(): Promise<Array<{ id: string; name: string; type: string; icon: string; template?: Record<string, unknown> }>> {
    try {
      const blueprints = await this.getFieldBlueprints()
      return Object.entries(blueprints).map(([key, blueprint]) => ({
        id: key,
        icon: '📝',
        name: (blueprint.label as string) || key.replace('_base', '').replace(/_/g, ' '),
        type: (blueprint.type as string) || 'text',
        template: blueprint
      }))
    } catch (e) {
      console.error('[UIEditorService] Error loading components:', e)
      return []
    }
  }

  async getFieldBlueprints(): Promise<Record<string, Record<string, unknown>>> {
    try {
      const res = await fetch('/struct/editor/ui_editor.json')
      if (!res.ok) throw new Error('Failed to load ui_editor.json')
      const data = await res.json() as { field_blueprints?: Record<string, Record<string, unknown>> }
      return data.field_blueprints || {}
    } catch (e) {
      console.error('[UIEditorService] Error loading field blueprints:', e)
      return {}
    }
  }

  validateField(field: Record<string, unknown>): { valid: boolean; errors: string[] } {
    const errors: string[] = []
    if (!field.id || typeof field.id !== 'string') {
      errors.push('Field must have a valid id (string)')
    }
    if (!field.label || typeof field.label !== 'string') {
      errors.push('Field must have a label (string)')
    }
    if (!field.type || typeof field.type !== 'string') {
      errors.push('Field must have a type (string)')
    }
    if (field.options && !Array.isArray(field.options)) {
      errors.push('Field options must be an array')
    }
    if (field.required !== undefined && typeof field.required !== 'boolean') {
      errors.push('Field required must be a boolean')
    }
    return { valid: errors.length === 0, errors }
  }

  validateSchema(schema: UIEditorSchema): { valid: boolean; errors: string[] } {
    const errors: string[] = []
    if (!schema.name || typeof schema.name !== 'string') {
      errors.push('Schema must have a name (string)')
    }
    if (!Array.isArray(schema.sections)) {
      errors.push('Schema must have sections array')
    } else {
      schema.sections.forEach((section, idx) => {
        if (!section.id || typeof section.id !== 'string') {
          errors.push(`Section ${idx} must have a valid id`)
        }
        if (!section.title || typeof section.title !== 'string') {
          errors.push(`Section ${idx} must have a title`)
        }
      })
    }
    if (schema.templates && typeof schema.templates !== 'object') {
      errors.push('Schema templates must be an object')
    }
    return { valid: errors.length === 0, errors }
  }
}

export const uiEditorService = new UIEditorServiceImpl()
