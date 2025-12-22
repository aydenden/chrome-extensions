import { registerHandler } from '../external-api';
import {
  getAllCompanies,
  getCompany,
  deleteCompany,
  getImagesByCompany,
} from '@/lib/storage';
import { db } from '@/lib/db';

async function toCompanyDTO(company: any) {
  const images = await getImagesByCompany(company.id);
  const dataSources = [...new Set(images.map(img => img.siteType))];
  const analyzedCount = images.filter(img => img.rawText || img.category).length;

  return {
    id: company.id,
    name: company.name,
    url: company.url,
    siteType: company.siteType,
    dataSources,
    imageCount: images.length,
    analyzedCount,
    analysisScore: company.analysis?.score,
    analysisRecommendation: company.analysis?.recommendation,
    createdAt: company.createdAt.toISOString(),
    updatedAt: company.updatedAt.toISOString(),
  };
}

async function toCompanyDetailDTO(company: any) {
  const dto = await toCompanyDTO(company);
  return {
    ...dto,
    metadata: company.metadata,
    analysis: company.analysis,
  };
}

export function registerCompanyHandlers(): void {
  registerHandler('GET_COMPANIES', async (payload) => {
    const { siteType, sortBy = 'createdAt', sortOrder = 'desc' } = payload || {};

    let companies = await db.companies.orderBy(sortBy).toArray();
    if (sortOrder === 'desc') companies = companies.reverse();
    if (siteType) companies = companies.filter(c => c.siteType === siteType);

    return Promise.all(companies.map(toCompanyDTO));
  });

  registerHandler('GET_COMPANY', async (payload) => {
    const { companyId } = payload;
    const company = await getCompany(companyId);
    if (!company) throw new Error(`Company not found: ${companyId}`);
    return toCompanyDetailDTO(company);
  });

  registerHandler('DELETE_COMPANY', async (payload) => {
    const { companyId } = payload;
    const company = await getCompany(companyId);
    if (!company) throw new Error(`Company not found: ${companyId}`);

    const images = await getImagesByCompany(companyId);
    await db.images.where('companyId').equals(companyId).delete();
    await db.companies.delete(companyId);

    return { deletedImages: images.length };
  });
}
