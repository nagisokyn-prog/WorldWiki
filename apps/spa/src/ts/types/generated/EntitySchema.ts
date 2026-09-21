import type { FieldDef } from "./FieldDef";

export type EntitySchema = { id: string | null, project_id: string | null, type_key: string, type_name: string, icon: string, color: string, fields_schema: Array<FieldDef>, full_schema: Record<string, unknown> | null, created_at: string | null, };
