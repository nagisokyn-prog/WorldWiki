import { ref } from 'vue';

export function useFloatingEntities(project: string) {
  const floatingEditors = ref<Array<{ id: string; project: string; type: string; entityId: string }>>([]);

  const handleOpenEntity = (data: { type: string, id: string }) => {
    try {
      const editorId = `${data.type}-${data.id}-${Date.now()}`;
      floatingEditors.value.push({
        id: editorId,
        project: project,
        type: data.type,
        entityId: data.id
      });
      console.log('[ChaptersMain] Открыл редактор сущности:', data.type, data.id);
    } catch (e) {
      console.error('Ошибка открытия редактора сущности:', e);
    }
  };

  const closeFloatingEditor = (editorId: string) => {
    const idx = floatingEditors.value.findIndex(e => e.id === editorId);
    if (idx !== -1) {
      floatingEditors.value.splice(idx, 1);
    }
  };

  return { floatingEditors, handleOpenEntity, closeFloatingEditor };
}
