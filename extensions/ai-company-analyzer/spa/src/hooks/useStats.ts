import { useQuery } from '@tanstack/react-query';
import { getExtensionClient } from '@/lib/extension-client';
import { queryKeys } from '@/lib/query/keys';

export function useStats() {
  const client = getExtensionClient();
  return useQuery({
    queryKey: queryKeys.stats(),
    queryFn: () => client.send('GET_STATS'),
    staleTime: 60_000,
  });
}
