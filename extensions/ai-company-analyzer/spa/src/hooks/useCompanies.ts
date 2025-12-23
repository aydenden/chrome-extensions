import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getExtensionClient } from '@/lib/extension-client';
import { queryKeys } from '@/lib/query/keys';
import type { DataType } from '@shared/constants';

interface CompanyFilters {
  siteType?: DataType;
  sortBy?: 'name' | 'createdAt' | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
}

export function useCompanies(filters?: CompanyFilters) {
  const client = getExtensionClient();
  return useQuery({
    queryKey: filters ? queryKeys.companiesFiltered(filters) : queryKeys.companies(),
    queryFn: () => client.send('GET_COMPANIES', filters),
    staleTime: 30_000,
  });
}

export function useCompany(companyId: string | undefined) {
  const client = getExtensionClient();
  return useQuery({
    queryKey: queryKeys.company(companyId!),
    queryFn: () => client.send('GET_COMPANY', { companyId: companyId! }),
    enabled: !!companyId,
    staleTime: 60_000,
  });
}

export function useDeleteCompany() {
  const client = getExtensionClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (companyId: string) => client.send('DELETE_COMPANY', { companyId }),
    onSuccess: (_, companyId) => {
      qc.invalidateQueries({ queryKey: queryKeys.companies() });
      qc.removeQueries({ queryKey: queryKeys.company(companyId) });
      qc.removeQueries({ queryKey: queryKeys.images(companyId) });
    },
  });
}

export function useUpdateCompanyContext() {
  const client = getExtensionClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ companyId, analysisContext }: { companyId: string; analysisContext: string }) =>
      client.send('UPDATE_COMPANY_CONTEXT', { companyId, analysisContext }),
    onSuccess: (_, { companyId }) => {
      qc.invalidateQueries({ queryKey: queryKeys.company(companyId) });
    },
  });
}
