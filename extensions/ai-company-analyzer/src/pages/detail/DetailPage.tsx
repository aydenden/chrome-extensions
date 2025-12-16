import React, { useState, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { getCompany, getCompanyData, getImageUrl, getAnalysisResult, saveAnalysisResult } from '@/lib/storage';
import type { ExtractedData, DataType, AnalysisResult } from '@/types/storage';
import './detail.css';

// 소스 탭 정의
const SOURCE_TABS = [
  { key: 'company_info' as DataType, label: '원티드' },
  { key: 'finance_inno' as DataType, label: '혁신의숲' },
  { key: 'finance_dart' as DataType, label: 'DART' },
  { key: 'finance_smes' as DataType, label: '중기부' },
  { key: 'review_blind' as DataType, label: '블라인드' },
  { key: 'review_jobplanet' as DataType, label: '잡플래닛' },
];

// 이미지 모달 컴포넌트
interface ImageModalProps {
  imageUrl: string;
  onClose: () => void;
}

function ImageModal({ imageUrl, onClose }: ImageModalProps) {
  return (
    <div className="image-modal-overlay" onClick={onClose}>
      <div className="image-modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="image-modal-close" onClick={onClose}>×</button>
        <img src={imageUrl} alt="확대 보기" />
      </div>
    </div>
  );
}

// 데이터 리스트 컴포넌트
interface DataListProps {
  data: ExtractedData[];
  onImageClick: (imageUrl: string) => void;
}

function DataList({ data, onImageClick }: DataListProps) {
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});

  // 이미지 URL 로드
  React.useEffect(() => {
    const loadImages = async () => {
      const urls: Record<string, string> = {};
      for (const item of data) {
        const url = await getImageUrl(item.id);
        if (url) {
          urls[item.id] = url;
        }
      }
      setImageUrls(urls);
    };

    loadImages();

    // Cleanup: URL 해제
    return () => {
      Object.values(imageUrls).forEach(url => URL.revokeObjectURL(url));
    };
  }, [data]);

  if (data.length === 0) {
    return <div className="data-empty">수집된 데이터가 없습니다.</div>;
  }

  return (
    <div className="data-list">
      {/* 이미지 데이터 */}
      <div className="image-data-section">
        <div className="image-grid">
          {data.map((item) => {
            const url = imageUrls[item.id];
            return url ? (
              <div key={item.id} className="image-item">
                <img
                  src={url}
                  alt={`${item.type} 이미지`}
                  onClick={() => onImageClick(url)}
                />
                <div className="image-meta">
                  <span className="data-source">{item.source}</span>
                  <span className="data-time">{new Date(item.extractedAt).toLocaleString()}</span>
                </div>
              </div>
            ) : null;
          })}
        </div>
      </div>
    </div>
  );
}

// AI 분석 결과 카드
interface AnalysisCardProps {
  result: AnalysisResult | null;
  isAnalyzing: boolean;
}

function AnalysisCard({ result, isAnalyzing }: AnalysisCardProps) {
  if (isAnalyzing) {
    return (
      <div className="analysis-card analyzing">
        <h2>AI 분석 중...</h2>
        <p>잠시만 기다려주세요.</p>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="analysis-card empty">
        <h2>AI 분석 결과</h2>
        <p>아직 분석되지 않았습니다. "재분석" 버튼을 눌러 분석을 시작하세요.</p>
      </div>
    );
  }

  return (
    <div className="analysis-card">
      <h2>AI 분석 결과</h2>

      {/* 종합 점수 */}
      <div className="score-section">
        <div className="total-score">
          <div className="score-label">종합 점수</div>
          <div className="score-value">{result.totalScore.toFixed(1)}</div>
          <div className="score-max">/ 5.0</div>
        </div>
      </div>

      {/* Runway */}
      {result.runway && (
        <div className="analysis-section">
          <h3>Runway 분석</h3>
          <div className="runway-info">
            <div className="runway-months">{result.runway.months}개월</div>
            <div className="runway-confidence">신뢰도: {result.runway.confidence}</div>
            <p className="runway-reasoning">{result.runway.reasoning}</p>
          </div>
        </div>
      )}

      {/* 재무 리스크 */}
      {result.financialRisk && (
        <div className="analysis-section">
          <h3>재무 리스크</h3>
          <div className={`risk-level risk-${result.financialRisk.level}`}>
            {result.financialRisk.level === 'high' && '높음'}
            {result.financialRisk.level === 'medium' && '중간'}
            {result.financialRisk.level === 'low' && '낮음'}
          </div>
          <ul className="risk-factors">
            {result.financialRisk.factors.map((factor, idx) => (
              <li key={idx}>{factor}</li>
            ))}
          </ul>
        </div>
      )}

      {/* 리뷰 요약 */}
      {result.reviewSummary && (
        <div className="analysis-section">
          <h3>리뷰 요약</h3>
          <div className="review-summary">
            <div className="review-positive">
              <h4>긍정적인 점</h4>
              <ul>
                {result.reviewSummary.positive.map((item, idx) => (
                  <li key={idx}>{item}</li>
                ))}
              </ul>
            </div>
            <div className="review-negative">
              <h4>부정적인 점</h4>
              <ul>
                {result.reviewSummary.negative.map((item, idx) => (
                  <li key={idx}>{item}</li>
                ))}
              </ul>
            </div>
            <p className="review-summary-text">{result.reviewSummary.summary}</p>
          </div>
        </div>
      )}

      <div className="analysis-meta">
        분석 시각: {new Date(result.analyzedAt).toLocaleString()}
      </div>
    </div>
  );
}

// 메인 페이지 컴포넌트
function DetailPage() {
  // URL 파라미터에서 회사 ID 추출
  const urlParams = new URLSearchParams(window.location.search);
  const companyId = urlParams.get('id');

  // 상태
  const [selectedSource, setSelectedSource] = useState<DataType>('company_info');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [modalImage, setModalImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Dexie LiveQuery로 데이터 조회
  const company = useLiveQuery(
    () => companyId ? db.companies.get(companyId) : undefined,
    [companyId]
  );

  const extractedData = useLiveQuery(
    () => companyId ? db.extractedData.where('companyId').equals(companyId).toArray() : undefined,
    [companyId]
  );

  const analysisResult = useLiveQuery(
    () => companyId ? db.analysisResults.where('companyId').equals(companyId).last() : undefined,
    [companyId]
  );

  // 소스별 데이터 그룹핑
  const sourceGroups = useMemo((): Record<DataType, ExtractedData[]> => {
    const groups: Record<DataType, ExtractedData[]> = {
      company_info: [],
      finance_inno: [],
      finance_dart: [],
      finance_smes: [],
      review_blind: [],
      review_jobplanet: [],
    };

    if (extractedData) {
      extractedData.forEach(data => {
        groups[data.type].push(data);
      });
    }

    return groups;
  }, [extractedData]);

  // 에러 처리
  React.useEffect(() => {
    if (!companyId) {
      setError('회사 ID가 없습니다.');
    } else if (company === undefined) {
      // 로딩 중
    } else if (!company) {
      setError('회사를 찾을 수 없습니다.');
    }
  }, [companyId, company]);

  // 목록으로 돌아가기
  const handleBack = () => {
    window.location.href = '/src/pages/list/list.html';
  };

  // 재분석 (이미지 기반)
  const handleReanalyze = async () => {
    if (!companyId || !extractedData) return;

    setIsAnalyzing(true);
    try {
      // 1. 이미지 데이터 수집
      const imageDataList: { id: string; type: DataType; url: string }[] = [];
      for (const item of extractedData) {
        const url = await getImageUrl(item.id);
        if (url) {
          imageDataList.push({ id: item.id, type: item.type, url });
        }
      }

      if (imageDataList.length === 0) {
        alert('분석할 이미지 데이터가 없습니다.');
        setIsAnalyzing(false);
        return;
      }

      // 2. SmolVLM 엔진 초기화 확인
      const statusResponse = await chrome.runtime.sendMessage({
        type: 'GET_ENGINE_STATUS',
      });

      if (!statusResponse.success || !statusResponse.status.isReady) {
        // 엔진 초기화
        const initResponse = await chrome.runtime.sendMessage({
          type: 'INIT_SMOLVLM',
        });
        if (!initResponse.success) {
          throw new Error(initResponse.error || '엔진 초기화 실패');
        }
      }

      // 3. 모든 이미지 분석
      console.log(`[재분석] 총 ${imageDataList.length}개 이미지 분석 시작`);
      const allResults: { description: string; trend: string; insights: string[]; score: number }[] = [];

      for (let i = 0; i < imageDataList.length; i++) {
        const imageData = imageDataList[i];
        console.log(`[재분석] ${i + 1}/${imageDataList.length} 분석 중: ${imageData.type}`);

        const analysisResponse = await chrome.runtime.sendMessage({
          type: 'ANALYZE_BY_CATEGORY',
          data: { extractedDataId: imageData.id },
        });

        if (analysisResponse.success && analysisResponse.data) {
          const { category, analysis } = analysisResponse.data;
          allResults.push({
            category,
            analysis,
            type: imageData.type,
          });
          const summaryPreview = analysis.summary || JSON.stringify(analysis).substring(0, 100);
          console.log(`[재분석] ${i + 1}/${imageDataList.length} 완료: [${category}]`, summaryPreview);
        } else {
          // pending이거나 에러인 경우 스킵
          console.warn(`[재분석] ${i + 1}/${imageDataList.length} 스킵:`, analysisResponse.error);
        }
      }

      if (allResults.length === 0) {
        throw new Error('모든 이미지 분석에 실패했습니다. (분류되지 않은 이미지만 있을 수 있습니다)');
      }

      // 4. 결과 종합 (카테고리별 분석 결과에서 요약 추출)
      const summaries = allResults
        .map(r => r.analysis.summary || r.analysis.rawResponse || JSON.stringify(r.analysis))
        .filter(Boolean);
      const allInsights = allResults
        .flatMap(r => r.analysis.warnings || r.analysis.insights || [])
        .slice(0, 5);
      const summaryDescriptions = summaries.join(' | ').substring(0, 500);

      console.log(`[재분석] 종합 결과: ${allResults.length}개 분석 완료`);

      // 5. 결과 저장 (카테고리 분석 결과 기반)
      await saveAnalysisResult({
        companyId,
        analyzedAt: Date.now(),
        totalScore: 3, // 기본값 (카테고리별 분석에서는 점수 없음)
        reviewSummary: {
          positive: allInsights.slice(0, 3),
          negative: [],
          summary: summaryDescriptions || '분석 완료',
        },
      });

      alert('재분석이 완료되었습니다!');
    } catch (error) {
      console.error('재분석 실패:', error);
      alert(`재분석 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // 로딩 중
  if (!companyId || company === undefined) {
    return (
      <div className="detail-page loading">
        <div className="loading-spinner">로딩 중...</div>
      </div>
    );
  }

  // 에러
  if (error || !company) {
    return (
      <div className="detail-page error">
        <div className="error-message">
          <h2>오류</h2>
          <p>{error || '회사를 찾을 수 없습니다.'}</p>
          <button onClick={handleBack}>목록으로 돌아가기</button>
        </div>
      </div>
    );
  }

  const currentData = sourceGroups[selectedSource] || [];

  return (
    <div className="detail-page">
      {/* 헤더 */}
      <header className="detail-header">
        <div className="header-left">
          <button className="back-button" onClick={handleBack}>← 목록</button>
        </div>
        <div className="header-center">
          <h1>{company.name}</h1>
          <div className="company-meta">
            <span>생성: {new Date(company.createdAt).toLocaleString()}</span>
            <span>수정: {new Date(company.updatedAt).toLocaleString()}</span>
          </div>
        </div>
        <div className="header-right">
          <button
            className="reanalyze-button"
            onClick={handleReanalyze}
            disabled={isAnalyzing}
          >
            {isAnalyzing ? '분석 중...' : '재분석'}
          </button>
        </div>
      </header>

      {/* AI 분석 결과 */}
      <section className="analysis-section-wrapper">
        <AnalysisCard result={analysisResult || null} isAnalyzing={isAnalyzing} />
      </section>

      {/* 수집된 데이터 */}
      <section className="collected-data-section">
        <h2>수집된 데이터</h2>

        {/* 소스 탭 */}
        <div className="source-tabs">
          {SOURCE_TABS.map((tab) => {
            const count = sourceGroups[tab.key]?.length || 0;
            return (
              <button
                key={tab.key}
                className={`source-tab ${selectedSource === tab.key ? 'active' : ''}`}
                onClick={() => setSelectedSource(tab.key)}
              >
                {tab.label}
                {count > 0 && <span className="tab-count">{count}</span>}
              </button>
            );
          })}
        </div>

        {/* 데이터 리스트 */}
        <DataList data={currentData} onImageClick={setModalImage} />
      </section>

      {/* 이미지 모달 */}
      {modalImage && (
        <ImageModal imageUrl={modalImage} onClose={() => setModalImage(null)} />
      )}
    </div>
  );
}

// 렌더링
const root = createRoot(document.getElementById('root')!);
root.render(<DetailPage />);
