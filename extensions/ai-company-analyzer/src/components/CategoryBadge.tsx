/**
 * 카테고리 배지 컴포넌트
 * 이미지 분류 결과를 시각적으로 표시
 */

import React from 'react';
import type { ImageSubCategory, ClassificationStatus } from '@/types/storage';

interface CategoryBadgeProps {
  subCategory?: ImageSubCategory;
  status: ClassificationStatus;
  size?: 'small' | 'medium';
}

// 카테고리별 색상 정의
const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  // 재무 (파란색 계열)
  balance_sheet: { bg: '#e3f2fd', text: '#1565c0', border: '#90caf9' },
  income_statement: { bg: '#e3f2fd', text: '#1565c0', border: '#90caf9' },
  cash_flow: { bg: '#e3f2fd', text: '#1565c0', border: '#90caf9' },
  financial_ratio: { bg: '#e8eaf6', text: '#3949ab', border: '#9fa8da' },
  revenue_trend: { bg: '#e8eaf6', text: '#3949ab', border: '#9fa8da' },
  employee_trend: { bg: '#ede7f6', text: '#5e35b1', border: '#b39ddb' },

  // 리뷰 (초록/빨강/노랑 계열)
  review_positive: { bg: '#e8f5e9', text: '#2e7d32', border: '#a5d6a7' },
  review_negative: { bg: '#ffebee', text: '#c62828', border: '#ef9a9a' },
  review_mixed: { bg: '#fff8e1', text: '#f57f17', border: '#ffe082' },
  rating_summary: { bg: '#fce4ec', text: '#c2185b', border: '#f48fb1' },

  // 차트 (청록색 계열)
  bar_chart: { bg: '#e0f7fa', text: '#00838f', border: '#80deea' },
  line_chart: { bg: '#e0f7fa', text: '#00838f', border: '#80deea' },
  pie_chart: { bg: '#e0f7fa', text: '#00838f', border: '#80deea' },
  table_data: { bg: '#eceff1', text: '#37474f', border: '#b0bec5' },

  // 회사정보 (보라색 계열)
  company_overview: { bg: '#f3e5f5', text: '#7b1fa2', border: '#ce93d8' },
  team_info: { bg: '#f3e5f5', text: '#7b1fa2', border: '#ce93d8' },
  benefits_info: { bg: '#fce4ec', text: '#ad1457', border: '#f48fb1' },
  tech_stack: { bg: '#e8eaf6', text: '#512da8', border: '#9575cd' },

  // 기타
  unknown: { bg: '#fafafa', text: '#616161', border: '#e0e0e0' },
  pending: { bg: '#fff3e0', text: '#e65100', border: '#ffcc80' },
};

// 카테고리 한글 레이블
const CATEGORY_LABELS: Record<ImageSubCategory, string> = {
  balance_sheet: '대차대조표',
  income_statement: '손익계산서',
  cash_flow: '현금흐름표',
  financial_ratio: '재무비율',
  revenue_trend: '매출추이',
  employee_trend: '고용추이',
  review_positive: '긍정 리뷰',
  review_negative: '부정 리뷰',
  review_mixed: '복합 리뷰',
  rating_summary: '평점 요약',
  bar_chart: '막대그래프',
  line_chart: '라인차트',
  pie_chart: '원형차트',
  table_data: '표 데이터',
  company_overview: '기업 개요',
  team_info: '팀 구성',
  benefits_info: '복지 정보',
  tech_stack: '기술스택',
  unknown: '미분류',
  pending: '분류 중',
};

export function CategoryBadge({ subCategory, status, size = 'medium' }: CategoryBadgeProps) {
  // 상태에 따른 표시
  if (status === 'pending') {
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          padding: size === 'small' ? '2px 6px' : '4px 8px',
          fontSize: size === 'small' ? '10px' : '12px',
          fontWeight: 500,
          borderRadius: '4px',
          backgroundColor: CATEGORY_COLORS.pending.bg,
          color: CATEGORY_COLORS.pending.text,
          border: `1px solid ${CATEGORY_COLORS.pending.border}`,
        }}
      >
        <LoadingSpinner />
        분류 중...
      </span>
    );
  }

  if (status === 'failed') {
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          padding: size === 'small' ? '2px 6px' : '4px 8px',
          fontSize: size === 'small' ? '10px' : '12px',
          fontWeight: 500,
          borderRadius: '4px',
          backgroundColor: '#ffebee',
          color: '#c62828',
          border: '1px solid #ef9a9a',
        }}
      >
        <WarningIcon />
        분류 실패
      </span>
    );
  }

  // 분류 완료 상태
  const category = subCategory || 'unknown';
  const colors = CATEGORY_COLORS[category] || CATEGORY_COLORS.unknown;
  const label = CATEGORY_LABELS[category] || '알 수 없음';

  return (
    <span
      style={{
        display: 'inline-block',
        padding: size === 'small' ? '2px 6px' : '4px 8px',
        fontSize: size === 'small' ? '10px' : '12px',
        fontWeight: 500,
        borderRadius: '4px',
        backgroundColor: colors.bg,
        color: colors.text,
        border: `1px solid ${colors.border}`,
      }}
    >
      {label}
    </span>
  );
}

// 로딩 스피너 아이콘
function LoadingSpinner() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      style={{
        animation: 'spin 1s linear infinite',
      }}
    >
      <style>
        {`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}
      </style>
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="3"
        fill="none"
        strokeDasharray="31.4 31.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

// 경고 아이콘
function WarningIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
    </svg>
  );
}

export default CategoryBadge;
