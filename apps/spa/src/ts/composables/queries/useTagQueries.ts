import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query';
import { tagApi, type TagData } from '../../services/api/tag.api';

export function useTags(project: string) {
  return useQuery({
    queryKey: ['tags', project],
    queryFn: () => tagApi.getTags(project),
    enabled: !!project
  });
}

export function useSaveTag() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ project, tag }: { project: string; tag: TagData }) => 
      tagApi.saveTag(project, tag),
    onSuccess: (_, { project }) => {
      queryClient.invalidateQueries({ queryKey: ['tags', project] });
    }
  });
}

export function useDeleteTag() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ project, name }: { project: string; name: string }) => 
      tagApi.deleteTag(project, name),
    onSuccess: (_, { project }) => {
      queryClient.invalidateQueries({ queryKey: ['tags', project] });
    }
  });
}
