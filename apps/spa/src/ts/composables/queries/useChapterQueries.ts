import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query';
import { chapterApi } from '../../services/api/chapter.api';

export function useChapters(project: string) {
  return useQuery({
    queryKey: ['chapters', project],
    queryFn: () => chapterApi.getChaptersList(project),
    enabled: !!project
  });
}

export function useChapter(project: string, chapterId: string) {
  return useQuery({
    queryKey: ['chapters', project, chapterId],
    queryFn: () => chapterApi.getChapter(project, chapterId),
    enabled: !!project && !!chapterId
  });
}

export function useHierarchy(project: string) {
  return useQuery({
    queryKey: ['hierarchy', project],
    queryFn: () => chapterApi.getHierarchy(project),
    enabled: !!project
  });
}

import type { Chapter } from '../../types/generated/Chapter';

export function useSaveChapter() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ project, data }: { project: string; data: Chapter | (Record<string, unknown> & { id?: string }) }) => 
      chapterApi.saveChapter(project, data as Chapter),
    onSuccess: (_, { project, data }) => {
      queryClient.invalidateQueries({ queryKey: ['chapters', project] });
      queryClient.invalidateQueries({ queryKey: ['hierarchy', project] });
      if (data.id) {
        queryClient.invalidateQueries({ queryKey: ['chapters', project, data.id] });
      }
    }
  });
}

export function useDeleteChapter() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ project, chapterId }: { project: string; chapterId: string }) => 
      chapterApi.deleteChapter(project, chapterId),
    onSuccess: (_, { project, chapterId }) => {
      queryClient.invalidateQueries({ queryKey: ['chapters', project] });
      queryClient.invalidateQueries({ queryKey: ['hierarchy', project] });
      queryClient.removeQueries({ queryKey: ['chapters', project, chapterId] });
    }
  });
}
