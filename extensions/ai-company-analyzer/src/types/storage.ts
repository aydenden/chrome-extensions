// 데이터 타입 (대분류 - 사이트 기반)
export type DataType =
  | 'company_info'      // 원티드: 기업 기본정보
  | 'finance_inno'      // 혁신의숲: 재무/고용
  | 'finance_dart'      // DART: PDF 재무제표
  | 'finance_smes'      // 중기벤처확인: 대차대조표/손익
  | 'review_blind'      // 블라인드: 리뷰
  | 'review_jobplanet'; // 잡플래닛: 리뷰

// 이미지 소분류 (AI 분류)
export type ImageSubCategory =
  // 재무 관련 (6개)
  | 'balance_sheet'        // 대차대조표
  | 'income_statement'     // 손익계산서
  | 'cash_flow'            // 현금흐름표
  | 'financial_ratio'      // 재무비율
  | 'revenue_trend'        // 매출추이
  | 'employee_trend'       // 고용추이
  // 리뷰 관련 (4개)
  | 'review_positive'      // 긍정 리뷰
  | 'review_negative'      // 부정 리뷰
  | 'review_mixed'         // 복합 리뷰
  | 'rating_summary'       // 평점 요약
  // 그래프/차트 (4개)
  | 'bar_chart'            // 막대그래프
  | 'line_chart'           // 라인차트
  | 'pie_chart'            // 원형차트
  | 'table_data'           // 표 데이터
  // 회사정보 (4개)
  | 'company_overview'     // 기업 개요
  | 'team_info'            // 팀 구성
  | 'benefits_info'        // 복지 정보
  | 'tech_stack'           // 기술스택
  // 기타 (2개)
  | 'unknown'              // 분류 불가
  | 'pending';             // 분류 대기중

// 분류 상태 (레거시 호환)
export type ClassificationStatus = 'pending' | 'completed' | 'failed';

// 추출 상태 (파이프라인용)
export type ExtractionStatus =
  | 'pending'           // 대기
  | 'classifying'       // 분류 중
  | 'extracting_text'   // 텍스트 추출 중
  | 'completed'         // 완료
  | 'failed';           // 실패

// 회사
export interface Company {
  id: string;           // UUID
  name: string;
  createdAt: number;    // timestamp
  updatedAt: number;
}

// 추출된 데이터 (이미지만 저장)
export interface ExtractedData {
  id: string;           // UUID
  companyId: string;    // FK → Company.id
  type: DataType;
  subCategory?: ImageSubCategory;           // AI 분류 결과
  classificationStatus: ClassificationStatus; // 분류 상태 (레거시)
  extractionStatus?: ExtractionStatus;      // 파이프라인 상태
  extractionError?: string;                 // 실패 시 에러 메시지
  source: string;       // 추출한 URL
  extractedAt: number;
  textExtractedAt?: number;   // 텍스트 추출 완료 시간
}

// 바이너리 데이터 (이미지, PDF)
export interface BinaryData {
  id: string;           // FK → ExtractedData.id
  blob: Blob;
  mimeType: string;     // 'image/png' | 'application/pdf'
}

// AI 분석 결과
export interface AnalysisResult {
  id: string;
  companyId: string;
  analyzedAt: number;
  totalScore: number;   // 1-5점

  runway?: {
    months: number;
    confidence: 'high' | 'medium' | 'low';
    reasoning: string;
  };

  financialRisk?: {
    level: 'high' | 'medium' | 'low';
    factors: string[];
  };

  reviewSummary?: {
    positive: string[];
    negative: string[];
    summary: string;
  };
}

// 설정 타입
export interface SiteConfig {
  id: string;
  name: string;
  urlPattern: string;
  dataTypes: DataType[];
  extractionGuide: string;
}

export interface AISettings {
  weights: {
    financial: number;  // 0-100
    review: number;     // 0-100
  };
  prompts: {
    companyExtraction: string;
    financialAnalysis: string;
    reviewAnalysis: string;
    totalScore: string;
  };
}

// ============================================
// RAG 시스템 타입
// ============================================

// 추출된 숫자 데이터
export interface ExtractedNumber {
  label: string;           // "매출", "영업이익" 등
  value: number;
  unit: string;            // "억원", "만원", "%" 등
  year?: number;
}

// 트렌드 정보
export interface TrendInfo {
  direction: 'up' | 'down' | 'stable';
  percentage?: number;
  period?: string;         // "YoY", "QoQ", "3년간" 등
}

// 감정 분석 결과
export interface SentimentInfo {
  score: number;           // -1 ~ 1
  positiveAspects: string[];
  negativeAspects: string[];
}

// 추출된 메타데이터
export interface ExtractedMetadata {
  summary: string;           // 2-3문장 요약
  keyPoints: string[];       // 핵심 포인트
  numbers?: ExtractedNumber[];
  trend?: TrendInfo;
  sentiment?: SentimentInfo;
}

// 추출된 텍스트
export interface ExtractedText {
  id: string;              // FK → ExtractedData.id
  companyId: string;       // 검색 최적화용
  category: ImageSubCategory;
  rawText: string;         // AI가 추출한 전체 텍스트
  metadata: ExtractedMetadata;
  createdAt: number;
}
