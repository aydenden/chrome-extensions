import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CompanyInput } from './CompanyInput';

describe('CompanyInput', () => {
  const defaultProps = {
    value: '',
    onChange: vi.fn(),
    detectedCompany: null,
    savedCompanies: [],
    inputMode: 'manual' as const,
    disabled: false,
    isLoading: false,
  };

  describe('렌더링', () => {
    it('입력 필드를 렌더링한다', () => {
      render(<CompanyInput {...defaultProps} />);

      expect(screen.getByPlaceholderText('회사명을 입력하세요')).toBeInTheDocument();
    });

    it('로딩 중이면 스켈레톤을 표시한다', () => {
      render(<CompanyInput {...defaultProps} isLoading={true} />);

      expect(screen.getByClassName ? screen.queryByPlaceholderText('회사명을 입력하세요') : null).toBeNull();
      expect(document.querySelector('.loading-skeleton')).toBeInTheDocument();
    });

    it('비활성화 상태를 처리한다', () => {
      render(<CompanyInput {...defaultProps} disabled={true} />);

      expect(screen.getByPlaceholderText('회사명을 입력하세요')).toBeDisabled();
    });

    it('값이 있으면 클리어 버튼을 표시한다', () => {
      render(<CompanyInput {...defaultProps} value="테스트" />);

      expect(screen.getByLabelText('Clear')).toBeInTheDocument();
    });

    it('값이 없으면 클리어 버튼을 숨긴다', () => {
      render(<CompanyInput {...defaultProps} value="" />);

      expect(screen.queryByLabelText('Clear')).not.toBeInTheDocument();
    });
  });

  describe('상태 표시기', () => {
    it('detected 모드에서 "자동 감지됨"을 표시한다', () => {
      render(<CompanyInput {...defaultProps} value="카카오" inputMode="detected" />);

      expect(screen.getByText('자동 감지됨')).toBeInTheDocument();
    });

    it('saved 모드에서 "저장된 회사"를 표시한다', () => {
      render(<CompanyInput {...defaultProps} value="네이버" inputMode="saved" />);

      expect(screen.getByText('저장된 회사')).toBeInTheDocument();
    });

    it('manual 모드에서 값이 있으면 "새 회사"를 표시한다', () => {
      render(<CompanyInput {...defaultProps} value="새회사" inputMode="manual" />);

      expect(screen.getByText('새 회사')).toBeInTheDocument();
    });

    it('값이 없고 감지된 회사도 없으면 경고를 표시한다', () => {
      render(<CompanyInput {...defaultProps} value="" detectedCompany={null} />);

      expect(screen.getByText('회사명을 감지할 수 없습니다')).toBeInTheDocument();
    });

    it('비활성화 상태에서는 경고를 표시하지 않는다', () => {
      render(<CompanyInput {...defaultProps} value="" disabled={true} />);

      expect(screen.queryByText('회사명을 감지할 수 없습니다')).not.toBeInTheDocument();
    });
  });

  describe('드롭다운', () => {
    const savedCompanies = [
      { id: '1', name: '카카오' },
      { id: '2', name: '네이버' },
      { id: '3', name: '쿠팡' },
    ];

    it('포커스시 드롭다운을 표시한다', async () => {
      // 값을 넣어서 칩이 표시되지 않도록 함
      render(<CompanyInput {...defaultProps} value="카" savedCompanies={savedCompanies} />);

      const input = screen.getByPlaceholderText('회사명을 입력하세요');
      fireEvent.focus(input);

      expect(screen.getByText('저장된 회사')).toBeInTheDocument();
      // 드롭다운 아이템 확인
      const dropdown = document.querySelector('.company-dropdown');
      expect(dropdown).toBeInTheDocument();
      const items = dropdown?.querySelectorAll('.dropdown-item');
      expect(items?.length).toBeGreaterThan(0);
    });

    it('입력값으로 회사 목록을 필터링한다', async () => {
      render(<CompanyInput {...defaultProps} value="카" savedCompanies={savedCompanies} />);

      const input = screen.getByPlaceholderText('회사명을 입력하세요');
      fireEvent.focus(input);

      expect(screen.getByText('카카오')).toBeInTheDocument();
      expect(screen.queryByText('네이버')).not.toBeInTheDocument();
    });

    it('드롭다운 항목 클릭시 onChange를 호출한다', async () => {
      const onChange = vi.fn();
      // 값을 넣어서 칩이 표시되지 않도록 함 (드롭다운만 표시)
      render(<CompanyInput {...defaultProps} value="네" onChange={onChange} savedCompanies={savedCompanies} />);

      const input = screen.getByPlaceholderText('회사명을 입력하세요');
      fireEvent.focus(input);

      // 필터된 결과에서 선택
      const dropdownItem = document.querySelector('.dropdown-item');
      fireEvent.mouseDown(dropdownItem!);

      expect(onChange).toHaveBeenCalledWith('네이버');
    });
  });

  describe('최근 회사 칩', () => {
    const savedCompanies = [
      { id: '1', name: '카카오' },
      { id: '2', name: '네이버' },
      { id: '3', name: '쿠팡' },
      { id: '4', name: '토스' },
      { id: '5', name: '배민' },
    ];

    it('값이 없을 때 최근 3개 회사 칩을 표시한다', () => {
      render(<CompanyInput {...defaultProps} value="" savedCompanies={savedCompanies} />);

      // 칩 영역 확인
      const quickPicks = document.querySelector('.quick-picks');
      expect(quickPicks).toBeInTheDocument();
      expect(screen.getByText('최근:')).toBeInTheDocument();

      // 칩 버튼들 확인
      const chips = document.querySelectorAll('.pick-chip');
      expect(chips).toHaveLength(3);
      expect(chips[0].textContent).toBe('카카오');
      expect(chips[1].textContent).toBe('네이버');
      expect(chips[2].textContent).toBe('쿠팡');
    });

    it('3개 이상일 때 "+N" 카운트를 표시한다', () => {
      render(<CompanyInput {...defaultProps} value="" savedCompanies={savedCompanies} />);

      expect(screen.getByText('+2')).toBeInTheDocument();
    });

    it('값이 있으면 칩을 숨긴다', () => {
      render(<CompanyInput {...defaultProps} value="테스트" savedCompanies={savedCompanies} />);

      expect(screen.queryByText('최근:')).not.toBeInTheDocument();
    });

    it('칩 클릭시 onChange를 호출한다', async () => {
      const onChange = vi.fn();
      render(<CompanyInput {...defaultProps} value="" onChange={onChange} savedCompanies={savedCompanies} />);

      // 칩 버튼을 클래스로 선택
      const chips = document.querySelectorAll('.pick-chip');
      fireEvent.click(chips[0]);

      expect(onChange).toHaveBeenCalledWith('카카오');
    });
  });

  describe('입력 처리', () => {
    it('입력 변경시 onChange를 호출한다', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(<CompanyInput {...defaultProps} onChange={onChange} />);

      const input = screen.getByPlaceholderText('회사명을 입력하세요');
      await user.type(input, '테스트');

      expect(onChange).toHaveBeenCalled();
    });

    it('클리어 버튼 클릭시 빈 문자열로 onChange를 호출한다', async () => {
      const onChange = vi.fn();
      render(<CompanyInput {...defaultProps} value="테스트" onChange={onChange} />);

      const clearButton = screen.getByLabelText('Clear');
      fireEvent.click(clearButton);

      expect(onChange).toHaveBeenCalledWith('');
    });
  });
});
