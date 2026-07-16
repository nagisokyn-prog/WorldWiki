import { useFloatingEditors } from './useFloatingEditors';

export function useFloatingWindows(ctx: { projectName: string }) {
  const { openFloatingEditor } = useFloatingEditors();

  // Expose globally for legacy components
  if (typeof window !== 'undefined') {
    (window as any).openFloatingEditor = (type: string, id: string) => openFloatingEditor(ctx.projectName, type, id);
  }

  return { openFloatingEditor };
}