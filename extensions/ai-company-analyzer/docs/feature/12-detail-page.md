# 12. 회사 상세 페이지

## 개요
회사별 상세 정보 및 AI 분석 결과 페이지 구현

## 선행 조건
- 09-webllm-text-analysis 완료
- 10-transformers-image-analysis 완료
- 11-list-page 완료

## 기술 스택
| 분류 | 기술 |
|------|------|
| UI | React + TypeScript |
| 데이터 조회 | dexie-react-hooks |

---

## 화면 구성

```
┌─────────────────────────────────────────────────────────────┐
│ ← 목록으로                                     [재분석]     │
├─────────────────────────────────────────────────────────────┤
│ 삼성전자                                                    │
│ 마지막 수집: 2024-01-15                                     │
├─────────────────────────────────────────────────────────────┤
│ AI 분석 결과                                                │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 종합 점수: ⭐ 4.2 / 5.0                                 │ │
│ │                                                         │ │
│ │ 📊 Runway: 24개월 (신뢰도: 높음)                        │ │
│ │ 분석: 현금 흐름이 안정적이며...                         │ │
│ │                                                         │ │
│ │ ⚠️ 재무 리스크: 낮음                                    │ │
│ │ • 부채비율 양호                                         │ │
│ │ • 현금 보유량 충분                                      │ │
│ │                                                         │ │
│ │ 💬 리뷰 요약                                            │ │
│ │ 긍정: 복지 좋음, 연봉 높음, 성장 가능성                 │ │
│ │ 부정: 야근 많음, 경쟁 심함                              │ │
│ └─────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│ 수집된 데이터                                               │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐                     │
│ │ 원티드   │ │ 혁신의숲  │ │ DART     │                     │
│ └──────────┘ └──────────┘ └──────────┘                     │
│ [선택된 소스의 데이터 표시]                                 │
│ - 텍스트 데이터                                             │
│ - 그래프 이미지 (클릭 시 모달)                              │
│ - PDF 페이지들                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 구현

### src/pages/detail/DetailPage.tsx

```typescript
import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { getImageUrl, getAnalysisResult, saveAnalysisResult } from '@/lib/storage';
import type { Company, ExtractedData, AnalysisResult } from '@/types/storage';
import './detail.css';

function DetailPage() {
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [selectedSource, setSelectedSource] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [modalImage, setModalImage] = useState<string | null>(null);

  // URL에서 회사 ID 추출
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    setCompanyId(id);
  }, []);

  // 회사 정보 조회
  const company = useLiveQuery(
    () => (companyId ? db.companies.get(companyId) : undefined),
    [companyId]
  );

  // 분석 결과 조회
  const analysisResult = useLiveQuery(
    () => (companyId ? db.analysisResults.where('companyId').equals(companyId).last() : undefined),
    [companyId]
  );

  // 추출 데이터 조회
  const extractedData = useLiveQuery(
    () => (companyId ? db.extractedData.where('companyId').equals(companyId).toArray() : []),
    [companyId],
    []
  );

  // 소스별 그룹핑
  const sourceGroups = React.useMemo(() => {
    const groups: Record<string, ExtractedData[]> = {};
    extractedData.forEach((data) => {
      const source = getSourceLabel(data.type);
      if (!groups[source]) groups[source] = [];
      groups[source].push(data);
    });
    return groups;
  }, [extractedData]);

  // 재분석 실행
  const handleReanalyze = async () => {
    if (!companyId) return;

    setIsAnalyzing(true);

    try {
      // 텍스트 데이터 수집
      const textData = extractedData
        .filter((d) => d.textContent)
        .map((d) => d.textContent!)
        .join('\n\n');

      // 재무 분석
      const financialResult = await chrome.runtime.sendMessage({
        type: 'ANALYZE_FINANCIALS',
        payload: { data: textData },
      });

      // 리뷰 분석
      const reviews = extractedData
        .filter((d) => d.type.includes('review'))
        .map((d) => d.textContent!)
        .filter(Boolean);

      const reviewResult = await chrome.runtime.sendMessage({
        type: 'ANALYZE_REVIEWS',
        payload: { reviews },
      });

      // 종합 점수 계산
      const scoreResult = await chrome.runtime.sendMessage({
        type: 'CALCULATE_SCORE',
        payload: {
          financial: financialResult.result,
          review: reviewResult.result,
        },
      });

      // 결과 저장
      await saveAnalysisResult({
        companyId,
        analyzedAt: Date.now(),
        totalScore: scoreResult.result?.score || 0,
        runway: financialResult.result?.runway,
        financialRisk: financialResult.result?.risk,
        reviewSummary: reviewResult.result,
      });
    } catch (error) {
      console.error('분석 실패:', error);
      alert('분석 중 오류가 발생했습니다.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // 뒤로가기
  const handleBack = () => {
    chrome.tabs.create({
      url: chrome.runtime.getURL('pages/list/list.html'),
    });
  };

  if (!companyId || !company) {
    return <div className="loading">로딩 중...</div>;
  }

  return (
    <div className="detail-page">
      <header className="page-header">
        <button className="back-btn" onClick={handleBack}>
          ← 목록으로
        </button>
        <button
          className="reanalyze-btn"
          onClick={handleReanalyze}
          disabled={isAnalyzing}
        >
          {isAnalyzing ? '분석 중...' : '재분석'}
        </button>
      </header>

      <section className="company-info">
        <h1>{company.name}</h1>
        <p className="last-updated">
          마지막 수집: {new Date(company.updatedAt).toLocaleDateString()}
        </p>
      </section>

      {/* AI 분석 결과 */}
      <section className="analysis-section">
        <h2>AI 분석 결과</h2>
        {analysisResult ? (
          <AnalysisCard result={analysisResult} />
        ) : (
          <div className="no-analysis">
            <p>아직 분석되지 않았습니다.</p>
            <button onClick={handleReanalyze} disabled={isAnalyzing}>
              분석 시작
            </button>
          </div>
        )}
      </section>

      {/* 수집된 데이터 */}
      <section className="data-section">
        <h2>수집된 데이터</h2>
        <div className="source-tabs">
          {Object.keys(sourceGroups).map((source) => (
            <button
              key={source}
              className={`tab ${selectedSource === source ? 'active' : ''}`}
              onClick={() => setSelectedSource(source)}
            >
              {source}
            </button>
          ))}
        </div>

        {selectedSource && sourceGroups[selectedSource] && (
          <DataList
            data={sourceGroups[selectedSource]}
            onImageClick={setModalImage}
          />
        )}
      </section>

      {/* 이미지 모달 */}
      {modalImage && (
        <ImageModal
          imageUrl={modalImage}
          onClose={() => setModalImage(null)}
        />
      )}
    </div>
  );
}

// 분석 결과 카드
function AnalysisCard({ result }: { result: AnalysisResult }) {
  return (
    <div className="analysis-card">
      <div className="total-score">
        종합 점수: ⭐ {result.totalScore.toFixed(1)} / 5.0
      </div>

      {result.runway && (
        <div className="analysis-item">
          <h4>📊 Runway</h4>
          <p>
            {result.runway.months}개월 (신뢰도: {result.runway.confidence})
          </p>
          <p className="reasoning">{result.runway.reasoning}</p>
        </div>
      )}

      {result.financialRisk && (
        <div className="analysis-item">
          <h4>⚠️ 재무 리스크: {result.financialRisk.level}</h4>
          <ul>
            {result.financialRisk.factors.map((factor, i) => (
              <li key={i}>{factor}</li>
            ))}
          </ul>
        </div>
      )}

      {result.reviewSummary && (
        <div className="analysis-item">
          <h4>💬 리뷰 요약</h4>
          <p>
            <strong>긍정:</strong> {result.reviewSummary.positive.join(', ')}
          </p>
          <p>
            <strong>부정:</strong> {result.reviewSummary.negative.join(', ')}
          </p>
          <p className="summary">{result.reviewSummary.summary}</p>
        </div>
      )}
    </div>
  );
}

// 데이터 리스트
function DataList({
  data,
  onImageClick,
}: {
  data: ExtractedData[];
  onImageClick: (url: string) => void;
}) {
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    // 이미지 URL 로드
    data.forEach(async (item) => {
      if (!item.textContent) {
        const url = await getImageUrl(item.id);
        if (url) {
          setImageUrls((prev) => ({ ...prev, [item.id]: url }));
        }
      }
    });
  }, [data]);

  return (
    <div className="data-list">
      {data.map((item) => (
        <div key={item.id} className="data-item">
          <div className="data-meta">
            <span className="data-type">{item.type}</span>
            <span className="data-date">
              {new Date(item.extractedAt).toLocaleDateString()}
            </span>
          </div>

          {item.textContent ? (
            <div className="text-content">{item.textContent}</div>
          ) : imageUrls[item.id] ? (
            <img
              src={imageUrls[item.id]}
              alt="수집된 이미지"
              className="image-thumbnail"
              onClick={() => onImageClick(imageUrls[item.id])}
            />
          ) : (
            <div className="loading-image">이미지 로딩 중...</div>
          )}
        </div>
      ))}
    </div>
  );
}

// 이미지 모달
function ImageModal({
  imageUrl,
  onClose,
}: {
  imageUrl: string;
  onClose: () => void;
}) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>
          ✕
        </button>
        <img src={imageUrl} alt="확대 이미지" />
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
root.render(<DetailPage />);
```

---

## 산출물

| 파일 | 설명 |
|------|------|
| `src/pages/detail/DetailPage.tsx` | 상세 페이지 컴포넌트 |
| `src/pages/detail/detail.css` | 스타일 |
| `src/pages/detail/detail.html` | HTML 엔트리 |

---

## 참조 문서
- [spec/05-ui-structure.md](../spec/05-ui-structure.md) - UI 구조 (상세 페이지 섹션)
