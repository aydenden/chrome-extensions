/**
 * 캡처 설정 타입
 * Chrome Storage에 저장되는 캡처 관련 설정
 */
export interface CaptureSettings {
  /** 빠른 캡처 모드: 확인 팝업 스킵 */
  quickCaptureEnabled: boolean;
  /** 연속 캡처 모드: 팝업 유지하면서 여러 이미지 캡처 */
  continuousCaptureEnabled: boolean;
  /** 마지막 선택한 회사 ID (빠른 캡처용) */
  lastSelectedCompanyId?: string;
}

/** 캡처 설정 기본값 */
export const DEFAULT_CAPTURE_SETTINGS: CaptureSettings = {
  quickCaptureEnabled: false,
  continuousCaptureEnabled: false,
};
