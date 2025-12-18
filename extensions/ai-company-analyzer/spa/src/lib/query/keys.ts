export const queryKeys = {
  all: ['extension'] as const,
  companies: () => [...queryKeys.all, 'companies'] as const,
  companiesFiltered: (filters: { siteType?: string; sortBy?: string }) =>
    [...queryKeys.companies(), filters] as const,
  company: (id: string) => [...queryKeys.all, 'company', id] as const,
  images: (companyId: string) => [...queryKeys.all, 'images', companyId] as const,
  imagesFiltered: (companyId: string, filters: { category?: string; hasAnalysis?: boolean }) =>
    [...queryKeys.images(companyId), filters] as const,
  imageData: (id: string) => [...queryKeys.all, 'imageData', id] as const,
  thumbnail: (id: string) => [...queryKeys.all, 'thumbnail', id] as const,
  stats: () => [...queryKeys.all, 'stats'] as const,
} as const;
