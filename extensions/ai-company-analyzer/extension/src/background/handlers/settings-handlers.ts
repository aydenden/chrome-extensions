import { registerHandler } from '../external-api';

const PROMPT_SETTINGS_KEY = 'promptSettings';

interface StoredPromptSettings {
  imageAnalysis?: { prompt: string; updatedAt: string };
  synthesis?: { prompt: string; updatedAt: string };
}

/**
 * 설정 관련 External API 핸들러 등록
 */
export function registerSettingsHandlers(): void {
  /**
   * GET_PROMPT_SETTINGS: 프롬프트 설정 조회
   */
  registerHandler('GET_PROMPT_SETTINGS', async () => {
    const result = await chrome.storage.local.get(PROMPT_SETTINGS_KEY);
    const settings: StoredPromptSettings = result[PROMPT_SETTINGS_KEY] || {};

    return {
      imageAnalysis: settings.imageAnalysis || null,
      synthesis: settings.synthesis || null,
    };
  });

  /**
   * SET_PROMPT_SETTINGS: 프롬프트 설정 저장
   */
  registerHandler('SET_PROMPT_SETTINGS', async (payload) => {
    const result = await chrome.storage.local.get(PROMPT_SETTINGS_KEY);
    const existing: StoredPromptSettings = result[PROMPT_SETTINGS_KEY] || {};

    const now = new Date().toISOString();
    const updated: StoredPromptSettings = { ...existing };

    if (payload.imageAnalysis) {
      updated.imageAnalysis = {
        prompt: payload.imageAnalysis.prompt,
        updatedAt: now,
      };
    }

    if (payload.synthesis) {
      updated.synthesis = {
        prompt: payload.synthesis.prompt,
        updatedAt: now,
      };
    }

    await chrome.storage.local.set({ [PROMPT_SETTINGS_KEY]: updated });

    return { updatedAt: now };
  });
}
