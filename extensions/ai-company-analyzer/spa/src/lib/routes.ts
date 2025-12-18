export const ROUTES = {
  HOME: '/',
  COMPANY_DETAIL: (id: string) => `/company/${id}`,
  ANALYSIS: (id: string) => `/analysis/${id}`,
  SETTINGS: '/settings',
} as const;
