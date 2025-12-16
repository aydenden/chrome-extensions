import React, { useState, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import type { Company, ExtractedData, AnalysisResult, DataType } from '@/types/storage';
import './list.css';

// 데이터 소스 레이블 매핑
const SOURCE_LABELS: Record<DataType, string> = {
  company_info: '원티드',
  finance_inno: '혁신의숲',
  finance_dart: 'DART',
  finance_smes: '중기부',
  review_blind: '블라인드',
  review_jobplanet: '잡플래닛',
};

// 데이터 소스 색상
const SOURCE_COLORS: Record<DataType, string> = {
  company_info: '#3366ff',
  finance_inno: '#00a651',
  finance_dart: '#1a365d',
  finance_smes: '#ff6b35',
  review_blind: '#ffc107',
  review_jobplanet: '#00c362',
};

type SortBy = 'recent' | 'name' | 'score';

interface CompanyCardProps {
  company: Company;
  dataSources: DataType[];
  analysisResult?: AnalysisResult;
  onDelete: (id: string) => void;
  onOpenDetail: (id: string) => void;
}

function CompanyCard({ company, dataSources, analysisResult, onDelete, onOpenDetail }: CompanyCardProps) {
  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm(`"${company.name}" 회사를 삭제하시겠습니까?\n관련된 모든 데이터가 삭제됩니다.`)) {
      onDelete(company.id);
    }
  };

  return (
    <div className="company-card" onClick={() => onOpenDetail(company.id)}>
      <div className="card-header">
        <h3 className="company-name">{company.name}</h3>
        <button className="delete-btn" onClick={handleDelete} title="삭제">
          ✕
        </button>
      </div>

      <div className="card-body">
        <div className="score-section">
          {analysisResult ? (
            <>
              <div className="score-value">{analysisResult.totalScore.toFixed(1)}</div>
              <div className="score-label">/ 5.0</div>
            </>
          ) : (
            <div className="score-pending">분석 대기</div>
          )}
        </div>

        <div className="sources-section">
          <div className="sources-label">데이터 소스</div>
          <div className="source-badges">
            {dataSources.length > 0 ? (
              dataSources.map((type) => (
                <span
                  key={type}
                  className="source-badge"
                  style={{ backgroundColor: SOURCE_COLORS[type] }}
                >
                  {SOURCE_LABELS[type]}
                </span>
              ))
            ) : (
              <span className="no-data">데이터 없음</span>
            )}
          </div>
        </div>

        <div className="card-footer">
          <div className="saved-date">
            수집일: {new Date(company.createdAt).toLocaleDateString('ko-KR')}
          </div>
        </div>
      </div>
    </div>
  );
}

function ListPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortBy>('recent');

  // Dexie LiveQuery로 실시간 데이터 조회
  const companies = useLiveQuery(() => db.companies.toArray(), []);
  const extractedData = useLiveQuery(() => db.extractedData.toArray(), []);
  const analysisResults = useLiveQuery(() => db.analysisResults.toArray(), []);

  // 회사별 데이터 소스 및 분석 결과 매핑
  const companyDataMap = useMemo(() => {
    if (!companies || !extractedData || !analysisResults) return new Map();

    const map = new Map<string, { sources: DataType[]; analysis?: AnalysisResult }>();

    companies.forEach((company) => {
      // 해당 회사의 데이터 소스 추출
      const sources = extractedData
        .filter((data) => data.companyId === company.id)
        .map((data) => data.type)
        .filter((type, index, self) => self.indexOf(type) === index); // 중복 제거

      // 해당 회사의 분석 결과 (가장 최근 것)
      const analysis = analysisResults
        .filter((result) => result.companyId === company.id)
        .sort((a, b) => b.analyzedAt - a.analyzedAt)[0];

      map.set(company.id, { sources, analysis });
    });

    return map;
  }, [companies, extractedData, analysisResults]);

  // 필터링 및 정렬된 회사 목록
  const filteredCompanies = useMemo(() => {
    if (!companies) return [];

    let filtered = companies;

    // 검색 필터
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((c) => c.name.toLowerCase().includes(query));
    }

    // 정렬
    const sorted = [...filtered];
    switch (sortBy) {
      case 'recent':
        sorted.sort((a, b) => b.updatedAt - a.updatedAt);
        break;
      case 'name':
        sorted.sort((a, b) => a.name.localeCompare(b.name, 'ko'));
        break;
      case 'score':
        sorted.sort((a, b) => {
          const aData = companyDataMap.get(a.id);
          const bData = companyDataMap.get(b.id);
          const aScore = aData?.analysis?.totalScore ?? -1;
          const bScore = bData?.analysis?.totalScore ?? -1;
          return bScore - aScore;
        });
        break;
    }

    return sorted;
  }, [companies, searchQuery, sortBy, companyDataMap]);

  const handleDelete = async (companyId: string) => {
    try {
      await db.transaction('rw', [db.companies, db.extractedData, db.binaryData, db.analysisResults], async () => {
        // 관련 데이터 ID 조회
        const dataIds = await db.extractedData.where('companyId').equals(companyId).primaryKeys();

        // 바이너리 데이터 삭제
        await db.binaryData.bulkDelete(dataIds);

        // 추출 데이터 삭제
        await db.extractedData.where('companyId').equals(companyId).delete();

        // 분석 결과 삭제
        await db.analysisResults.where('companyId').equals(companyId).delete();

        // 회사 삭제
        await db.companies.delete(companyId);
      });
    } catch (error) {
      console.error('Failed to delete company:', error);
      alert('회사 삭제 중 오류가 발생했습니다.');
    }
  };

  const handleOpenDetail = (companyId: string) => {
    window.location.href = `../detail/detail.html?id=${companyId}`;
  };

  if (!companies || !extractedData || !analysisResults) {
    return (
      <div className="list-page">
        <div className="loading">데이터 로딩 중...</div>
      </div>
    );
  }

  return (
    <div className="list-page">
      <header className="page-header">
        <h1>저장된 회사 목록</h1>
        <p className="subtitle">총 {companies.length}개 회사</p>
      </header>

      <div className="controls">
        <div className="search-box">
          <input
            type="text"
            placeholder="회사명 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
        </div>

        <div className="sort-box">
          <label htmlFor="sort-select">정렬:</label>
          <select
            id="sort-select"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortBy)}
            className="sort-select"
          >
            <option value="recent">최근순</option>
            <option value="name">이름순</option>
            <option value="score">점수순</option>
          </select>
        </div>
      </div>

      {filteredCompanies.length === 0 ? (
        <div className="empty-state">
          {searchQuery ? (
            <>
              <div className="empty-icon">🔍</div>
              <p className="empty-title">검색 결과가 없습니다</p>
              <p className="empty-description">다른 키워드로 검색해보세요.</p>
            </>
          ) : (
            <>
              <div className="empty-icon">📋</div>
              <p className="empty-title">저장된 회사가 없습니다</p>
              <p className="empty-description">원티드, 혁신의숲 등 지원 사이트에서 회사 정보를 수집하세요.</p>
            </>
          )}
        </div>
      ) : (
        <div className="company-grid">
          {filteredCompanies.map((company) => {
            const data = companyDataMap.get(company.id);
            return (
              <CompanyCard
                key={company.id}
                company={company}
                dataSources={data?.sources ?? []}
                analysisResult={data?.analysis}
                onDelete={handleDelete}
                onOpenDetail={handleOpenDetail}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

// React 앱 마운트
const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<ListPage />);
}
