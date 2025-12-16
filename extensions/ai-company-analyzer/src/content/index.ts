// Content Script 진입점
import { activateAreaCapture } from './graph-capture';
import './confirm-popup';

console.log('AI 기업분석 - Content Script 로드됨');

// 현재 URL 확인
const currentUrl = window.location.href;
console.log('현재 URL:', currentUrl);

// 메시지 리스너
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Content Script - Message received:', message);

  switch (message.type) {
    case 'ACTIVATE_CAPTURE':
      console.log('이미지 캡처 모드 활성화 요청');
      activateAreaCapture();
      sendResponse({ status: 'capture_activated' });
      break;
    default:
      sendResponse({ status: 'unknown_message' });
  }

  return true;
});
