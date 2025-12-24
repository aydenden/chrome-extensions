import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CaptureOptions } from './CaptureOptions';

describe('CaptureOptions', () => {
  const defaultProps = {
    quickCapture: false,
    continuousCapture: false,
    canQuickCapture: true,
    onQuickCaptureChange: vi.fn(),
    onContinuousCaptureChange: vi.fn(),
  };

  describe('렌더링', () => {
    it('Capture Mode 헤더를 렌더링한다', () => {
      render(<CaptureOptions {...defaultProps} />);

      expect(screen.getByText('Capture Mode')).toBeInTheDocument();
    });

    it('빠른 캡처 옵션을 렌더링한다', () => {
      render(<CaptureOptions {...defaultProps} />);

      expect(screen.getByText('빠른 캡처')).toBeInTheDocument();
      expect(screen.getByText('확인 생략')).toBeInTheDocument();
    });

    it('연속 캡처 옵션을 렌더링한다', () => {
      render(<CaptureOptions {...defaultProps} />);

      expect(screen.getByText('연속 캡처')).toBeInTheDocument();
      expect(screen.getByText('팝업 유지')).toBeInTheDocument();
    });
  });

  describe('빠른 캡처 옵션', () => {
    it('canQuickCapture가 false이면 비활성화된다', () => {
      render(<CaptureOptions {...defaultProps} canQuickCapture={false} />);

      const checkboxes = screen.getAllByRole('checkbox');
      const quickCaptureCheckbox = checkboxes[0];

      expect(quickCaptureCheckbox).toBeDisabled();
    });

    it('canQuickCapture가 true이면 활성화된다', () => {
      render(<CaptureOptions {...defaultProps} canQuickCapture={true} />);

      const checkboxes = screen.getAllByRole('checkbox');
      const quickCaptureCheckbox = checkboxes[0];

      expect(quickCaptureCheckbox).not.toBeDisabled();
    });

    it('quickCapture 상태에 따라 체크된다', () => {
      render(<CaptureOptions {...defaultProps} quickCapture={true} />);

      const checkboxes = screen.getAllByRole('checkbox');
      const quickCaptureCheckbox = checkboxes[0];

      expect(quickCaptureCheckbox).toBeChecked();
    });

    it('클릭시 onQuickCaptureChange를 호출한다', () => {
      const onQuickCaptureChange = vi.fn();
      render(<CaptureOptions {...defaultProps} onQuickCaptureChange={onQuickCaptureChange} />);

      const checkboxes = screen.getAllByRole('checkbox');
      const quickCaptureCheckbox = checkboxes[0];
      fireEvent.click(quickCaptureCheckbox);

      expect(onQuickCaptureChange).toHaveBeenCalledWith(true);
    });

    it('비활성화 상태에서 툴팁을 표시한다', () => {
      render(<CaptureOptions {...defaultProps} canQuickCapture={false} />);

      const labels = document.querySelectorAll('.option-item');
      const quickCaptureLabel = labels[0];

      expect(quickCaptureLabel).toHaveAttribute('title', expect.stringContaining('저장된 회사를 선택해야'));
    });
  });

  describe('연속 캡처 옵션', () => {
    it('항상 활성화되어 있다', () => {
      render(<CaptureOptions {...defaultProps} />);

      const checkboxes = screen.getAllByRole('checkbox');
      const continuousCaptureCheckbox = checkboxes[1];

      expect(continuousCaptureCheckbox).not.toBeDisabled();
    });

    it('continuousCapture 상태에 따라 체크된다', () => {
      render(<CaptureOptions {...defaultProps} continuousCapture={true} />);

      const checkboxes = screen.getAllByRole('checkbox');
      const continuousCaptureCheckbox = checkboxes[1];

      expect(continuousCaptureCheckbox).toBeChecked();
    });

    it('클릭시 onContinuousCaptureChange를 호출한다', () => {
      const onContinuousCaptureChange = vi.fn();
      render(<CaptureOptions {...defaultProps} onContinuousCaptureChange={onContinuousCaptureChange} />);

      const checkboxes = screen.getAllByRole('checkbox');
      const continuousCaptureCheckbox = checkboxes[1];
      fireEvent.click(continuousCaptureCheckbox);

      expect(onContinuousCaptureChange).toHaveBeenCalledWith(true);
    });

    it('체크 해제시 false로 호출한다', () => {
      const onContinuousCaptureChange = vi.fn();
      render(
        <CaptureOptions
          {...defaultProps}
          continuousCapture={true}
          onContinuousCaptureChange={onContinuousCaptureChange}
        />
      );

      const checkboxes = screen.getAllByRole('checkbox');
      const continuousCaptureCheckbox = checkboxes[1];
      fireEvent.click(continuousCaptureCheckbox);

      expect(onContinuousCaptureChange).toHaveBeenCalledWith(false);
    });
  });

  describe('상태 조합', () => {
    it('두 옵션 모두 활성화할 수 있다', () => {
      render(<CaptureOptions {...defaultProps} quickCapture={true} continuousCapture={true} />);

      const checkboxes = screen.getAllByRole('checkbox');

      expect(checkboxes[0]).toBeChecked();
      expect(checkboxes[1]).toBeChecked();
    });

    it('canQuickCapture가 false일 때 quickCapture가 true여도 비활성화된다', () => {
      render(<CaptureOptions {...defaultProps} quickCapture={true} canQuickCapture={false} />);

      const checkboxes = screen.getAllByRole('checkbox');
      const quickCaptureCheckbox = checkboxes[0];

      expect(quickCaptureCheckbox).toBeChecked();
      expect(quickCaptureCheckbox).toBeDisabled();
    });
  });
});
