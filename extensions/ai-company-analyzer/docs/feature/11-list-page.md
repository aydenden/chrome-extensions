# 11. 회사 리스트 페이지

## 개요
저장된 회사 목록 페이지 구현

## 선행 조건
- 02-data-storage 완료
- 09-webllm-text-analysis 완료

## 기술 스택
| 분류 | 기술 |
|------|------|
| UI | React + TypeScript |
| 데이터 조회 | dexie-react-hooks |

---

## 화면 구성

```
┌─────────────────────────────────────────────────────┐
│ AI 기업분석 - 회사 목록                              │
├─────────────────────────────────────────────────────┤
│ [🔍 검색...]           정렬: [최근순 ▼]              │
├─────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────┐ │
│ │ 삼성전자                              ⭐ 4.2    │ │
│ │ [원티드] [혁신의숲] [DART]                      │ │
│ │ 수집일: 2024-01-15                      [🗑️]   │ │
│ └─────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────┐ │
│ │ 네이버                                분석 전   │ │
│ │ [원티드] [블라인드]                             │ │
│ │ 수집일: 2024-01-14                      [🗑️]   │ │
│ └─────────────────────────────────────────────────┘ │
│ ...                                                 │
└─────────────────────────────────────────────────────┘
```

---

## 구현

### src/pages/list/ListPage.tsx

```typescript
import React, { useState, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { deleteCompany } from '@/lib/storage';
import type { Company } from '@/types/storage';
import './list.css';

type SortOption = 'recent' | 'name' | 'score';

function ListPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('recent');

  // 회사 목록 실시간 조회
  const companies = useLiveQuery(() => db.companies.toArray(), [], []);

  // 분석 결과 조회
  const analysisResults = useLiveQuery(
    () => db.analysisResults.toArray(),
    [],
    []
  );

  // 추출 데이터 조회 (소스 배지용)
  const extractedData = useLiveQuery(
    () => db.extractedData.toArray(),
    [],
    []
  );

  // 회사별 데이터 매핑
  const companyDataMap = useMemo(() => {
    const map = new Map<string, { score?: number; sources: string[] }>();

    companies.forEach((company) => {
      const analysis = analysisResults.find((a) => a.companyId === company.id);
      const data = extractedData.filter((d) => d.companyId === company.id);
      const sources = [...new Set(data.map((d) => getSourceLabel(d.type)))];

      map.set(company.id, {
        score: analysis?.totalScore,
        sources,
      });
    });

    return map;
  }, [companies, analysisResults, extractedData]);

  // 필터링 및 정렬
  const filteredCompanies = useMemo(() => {
    let result = [...companies];

    // 검색 필터
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter((c) => c.name.toLowerCase().includes(query));
    }

    // 정렬
    switch (sortBy) {
      case 'recent':
        result.sort((a, b) => b.updatedAt - a.updatedAt);
        break;
      case 'name':
        result.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'score':
        result.sort((a, b) => {
          const scoreA = companyDataMap.get(a.id)?.score || 0;
          const scoreB = companyDataMap.get(b.id)?.score || 0;
          return scoreB - scoreA;
        });
        break;
    }

    return result;
  }, [companies, searchQuery, sortBy, companyDataMap]);

  // 삭제 핸들러
  const handleDelete = async (company: Company) => {
    if (confirm(`"${company.name}" 회사를 삭제하시겠습니까?`)) {
      await deleteCompany(company.id);
    }
  };

  // 상세 페이지 이동
  const handleOpenDetail = (companyId: string) => {
    chrome.tabs.create({
      url: chrome.runtime.getURL(`pages/detail/detail.html?id=${companyId}`),
    });
  };

  return (
    <div className="list-page">
      <header className="page-header">
        <h1>AI 기업분석</h1>
        <p className="subtitle">저장된 회사 목록</p>
      </header>

      <div className="controls">
        <div className="search-box">
          <input
            type="text"
            placeholder="회사명 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="sort-box">
          <label>정렬:</label>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
          >
            <option value="recent">최근순</option>
            <option value="name">이름순</option>
            <option value="score">점수순</option>
          </select>
        </div>
      </div>

      <div className="company-list">
        {filteredCompanies.length === 0 ? (
          <div className="empty-state">
            {searchQuery ? '검색 결과가 없습니다.' : '저장된 회사가 없습니다.'}
          </div>
        ) : (
          filteredCompanies.map((company) => {
            const data = companyDataMap.get(company.id);
            return (
              <CompanyCard
                key={company.id}
                company={company}
                score={data?.score}
                sources={data?.sources || []}
                onClick={() => handleOpenDetail(company.id)}
                onDelete={() => handleDelete(company)}
              />
            );
          })
        )}
      </div>
    </div>
  );
}

// 회사 카드 컴포넌트
interface CompanyCardProps {
  company: Company;
  score?: number;
  sources: string[];
  onClick: () => void;
  onDelete: () => void;
}

function CompanyCard({ company, score, sources, onClick, onDelete }: CompanyCardProps) {
  return (
    <div className="company-card" onClick={onClick}>
      <div className="card-header">
        <h3 className="company-name">{company.name}</h3>
        <div className="score">
          {score !== undefined ? (
            <span className="score-value">⭐ {score.toFixed(1)}</span>
          ) : (
            <span className="score-pending">분석 전</span>
          )}
        </div>
      </div>

      <div className="source-badges">
        {sources.map((source) => (
          <span key={source} className="badge">
            {source}
          </span>
        ))}
      </div>

      <div className="card-footer">
        <span className="date">
          수집일: {new Date(company.updatedAt).toLocaleDateString()}
        </span>
        <button
          className="delete-btn"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          title="삭제"
        >
          🗑️
        </button>
      </div>
    </div>
  );
}

// 데이터 타입 → 소스 레이블
function getSourceLabel(type: string): string {
  const labels: Record<string, string> = {
    company_info: '원티드',
    finance_inno: '혁신의숲',
    finance_dart: 'DART',
    finance_smes: '중기벤처',
    review_blind: '블라인드',
    review_jobplanet: '잡플래닛',
  };
  return labels[type] || type;
}

// 렌더링
const root = createRoot(document.getElementById('root')!);
root.render(<ListPage />);
```

### src/pages/list/list.css

```css
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: #f5f5f5;
  color: #333;
  min-height: 100vh;
}

.list-page {
  max-width: 800px;
  margin: 0 auto;
  padding: 24px;
}

.page-header {
  margin-bottom: 24px;
}

.page-header h1 {
  font-size: 24px;
  font-weight: 600;
  margin-bottom: 4px;
}

.subtitle {
  color: #666;
  font-size: 14px;
}

.controls {
  display: flex;
  gap: 16px;
  margin-bottom: 20px;
}

.search-box {
  flex: 1;
}

.search-box input {
  width: 100%;
  padding: 12px 16px;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-size: 14px;
}

.sort-box {
  display: flex;
  align-items: center;
  gap: 8px;
}

.sort-box label {
  font-size: 14px;
  color: #666;
}

.sort-box select {
  padding: 10px 12px;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-size: 14px;
}

.company-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.company-card {
  background: white;
  border-radius: 12px;
  padding: 16px 20px;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.company-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  transform: translateY(-2px);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.company-name {
  font-size: 18px;
  font-weight: 600;
}

.score-value {
  font-size: 16px;
  font-weight: 500;
  color: #f59e0b;
}

.score-pending {
  font-size: 14px;
  color: #999;
}

.source-badges {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin-bottom: 12px;
}

.badge {
  background: #e3f2fd;
  color: #1976d2;
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
}

.card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.date {
  font-size: 13px;
  color: #999;
}

.delete-btn {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 16px;
  padding: 4px;
  opacity: 0.6;
  transition: opacity 0.2s;
}

.delete-btn:hover {
  opacity: 1;
}

.empty-state {
  text-align: center;
  padding: 60px 20px;
  color: #999;
}
```

### src/pages/list/list.html

```html
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>회사 목록 - AI 기업분석</title>
  <link rel="stylesheet" href="./list.css">
</head>
<body>
  <div id="root"></div>
  <script type="module" src="./ListPage.tsx"></script>
</body>
</html>
```

---

## 산출물

| 파일 | 설명 |
|------|------|
| `src/pages/list/ListPage.tsx` | 리스트 페이지 컴포넌트 |
| `src/pages/list/list.css` | 스타일 |
| `src/pages/list/list.html` | HTML 엔트리 |

---

## 참조 문서
- [spec/05-ui-structure.md](../spec/05-ui-structure.md) - UI 구조 (리스트 페이지 섹션)
