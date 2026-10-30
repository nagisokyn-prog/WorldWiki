import type { PresetQuery } from '../SurrealConsole.model'

export interface SurrealConsolePresetsProps {
  presets: PresetQuery[];
}

export type SurrealConsolePresetsEmits = {
  (e: 'select', preset: PresetQuery): void;
};
