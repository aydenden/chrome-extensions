import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getExtensionClient } from '@/lib/extension-client';
import { queryKeys } from '@/lib/query/keys';
import { DEFAULT_IMAGE_ANALYSIS_PROMPT, DEFAULT_SYNTHESIS_PROMPT } from '@/lib/prompts';
import type { PromptSettings } from '@/lib/prompts';

export function usePromptSettings() {
  const client = getExtensionClient();

  return useQuery({
    queryKey: queryKeys.promptSettings(),
    queryFn: async (): Promise<PromptSettings> => {
      const result = await client.send('GET_PROMPT_SETTINGS');
      return {
        imageAnalysis: result.imageAnalysis || {
          prompt: DEFAULT_IMAGE_ANALYSIS_PROMPT,
          updatedAt: new Date().toISOString(),
        },
        synthesis: result.synthesis || {
          prompt: DEFAULT_SYNTHESIS_PROMPT,
          updatedAt: new Date().toISOString(),
        },
      };
    },
    staleTime: 60_000,
  });
}

interface SavePromptSettingsParams {
  imageAnalysis?: { prompt: string };
  synthesis?: { prompt: string };
}

export function useSavePromptSettings() {
  const client = getExtensionClient();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (params: SavePromptSettingsParams) =>
      client.send('SET_PROMPT_SETTINGS', params),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.promptSettings() });
    },
  });
}

export function useResetPromptSettings() {
  const client = getExtensionClient();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (type: 'imageAnalysis' | 'synthesis' | 'all') => {
      const params: SavePromptSettingsParams = {};

      if (type === 'imageAnalysis' || type === 'all') {
        params.imageAnalysis = { prompt: DEFAULT_IMAGE_ANALYSIS_PROMPT };
      }
      if (type === 'synthesis' || type === 'all') {
        params.synthesis = { prompt: DEFAULT_SYNTHESIS_PROMPT };
      }

      return client.send('SET_PROMPT_SETTINGS', params);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.promptSettings() });
    },
  });
}
