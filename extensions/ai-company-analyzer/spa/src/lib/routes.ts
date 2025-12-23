export const ROUTES = {
  HOME: '/',
  COMPANY_DETAIL: (id: string) => `/company/${id}`,
  ANALYSIS: (id: string) => `/analysis/${id}`,
  OLLAMA_REQUIRED: (id: string) => `/ollama-required/${id}`,
  SETTINGS: '/settings',
} as const;
