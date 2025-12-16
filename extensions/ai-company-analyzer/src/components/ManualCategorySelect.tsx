/**
 * 수동 카테고리 선택 컴포넌트
 * 분류 실패 시 사용자가 직접 카테고리를 선택할 수 있는 드롭다운
 */

import React, { useState } from 'react';
import type { ImageSubCategory } from '@/types/storage';

interface ManualCategorySelectProps {
  extractedDataId: string;
  currentCategory?: ImageSubCategory;
  onSelect?: (category: ImageSubCategory) => void;
}

// 카테고리 그룹 정의
const CATEGORY_GROUPS = [
  {
    label: '재무',
    categories: [
      { id: 'balance_sheet', label: '대차대조표' },
      { id: 'income_statement', label: '손익계산서' },
      { id: 'cash_flow', label: '현금흐름표' },
      { id: 'financial_ratio', label: '재무비율' },
      { id: 'revenue_trend', label: '매출추이' },
      { id: 'employee_trend', label: '고용추이' },
    ],
  },
  {
    label: '리뷰',
    categories: [
      { id: 'review_positive', label: '긍정 리뷰' },
      { id: 'review_negative', label: '부정 리뷰' },
      { id: 'review_mixed', label: '복합 리뷰' },
      { id: 'rating_summary', label: '평점 요약' },
    ],
  },
  {
    label: '차트',
    categories: [
      { id: 'bar_chart', label: '막대그래프' },
      { id: 'line_chart', label: '라인차트' },
      { id: 'pie_chart', label: '원형차트' },
      { id: 'table_data', label: '표 데이터' },
    ],
  },
  {
    label: '회사정보',
    categories: [
      { id: 'company_overview', label: '기업 개요' },
      { id: 'team_info', label: '팀 구성' },
      { id: 'benefits_info', label: '복지 정보' },
      { id: 'tech_stack', label: '기술스택' },
    ],
  },
] as const;

export function ManualCategorySelect({
  extractedDataId,
  currentCategory,
  onSelect,
}: ManualCategorySelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<ImageSubCategory | undefined>(
    currentCategory
  );

  const handleSelect = async (category: ImageSubCategory) => {
    setSelectedCategory(category);
    setIsSubmitting(true);

    try {
      // Background에 수동 분류 요청
      const response = await chrome.runtime.sendMessage({
        type: 'MANUAL_CLASSIFY',
        data: {
          extractedDataId,
          subCategory: category,
        },
      });

      if (response.success) {
        onSelect?.(category);
        setIsOpen(false);
      } else {
        console.error('수동 분류 실패:', response.error);
      }
    } catch (error) {
      console.error('수동 분류 요청 실패:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      {/* 토글 버튼 */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={isSubmitting}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          padding: '4px 8px',
          fontSize: '12px',
          fontWeight: 500,
          borderRadius: '4px',
          backgroundColor: '#fff3e0',
          color: '#e65100',
          border: '1px solid #ffcc80',
          cursor: isSubmitting ? 'wait' : 'pointer',
          opacity: isSubmitting ? 0.7 : 1,
        }}
      >
        {isSubmitting ? '저장 중...' : '분류 선택'}
        <ChevronIcon isOpen={isOpen} />
      </button>

      {/* 드롭다운 메뉴 */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            marginTop: '4px',
            minWidth: '200px',
            maxHeight: '300px',
            overflowY: 'auto',
            backgroundColor: 'white',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            border: '1px solid #e0e0e0',
            zIndex: 1000,
          }}
        >
          {CATEGORY_GROUPS.map((group) => (
            <div key={group.label}>
              {/* 그룹 헤더 */}
              <div
                style={{
                  padding: '8px 12px',
                  fontSize: '11px',
                  fontWeight: 600,
                  color: '#757575',
                  backgroundColor: '#fafafa',
                  borderBottom: '1px solid #e0e0e0',
                  textTransform: 'uppercase',
                }}
              >
                {group.label}
              </div>

              {/* 카테고리 항목 */}
              {group.categories.map((category) => (
                <button
                  key={category.id}
                  onClick={() => handleSelect(category.id as ImageSubCategory)}
                  style={{
                    display: 'block',
                    width: '100%',
                    padding: '8px 12px',
                    fontSize: '13px',
                    textAlign: 'left',
                    backgroundColor:
                      selectedCategory === category.id ? '#e3f2fd' : 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    color: selectedCategory === category.id ? '#1565c0' : '#424242',
                  }}
                  onMouseEnter={(e) => {
                    if (selectedCategory !== category.id) {
                      e.currentTarget.style.backgroundColor = '#f5f5f5';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (selectedCategory !== category.id) {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }
                  }}
                >
                  {category.label}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* 오버레이 (클릭 시 닫기) */}
      {isOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 999,
          }}
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
}

// 화살표 아이콘
function ChevronIcon({ isOpen }: { isOpen: boolean }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="currentColor"
      style={{
        transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
        transition: 'transform 0.2s',
      }}
    >
      <path d="M7 10l5 5 5-5z" />
    </svg>
  );
}

export default ManualCategorySelect;
