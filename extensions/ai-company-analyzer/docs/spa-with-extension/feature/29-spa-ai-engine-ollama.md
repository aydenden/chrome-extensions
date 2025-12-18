# Feature 29: Ollama 폴백 엔진

## 개요

Ollama 로컬 서버를 활용한 AI 엔진으로, WebGPU 미지원 환경의 폴백입니다.

## 범위

- OllamaEngine 클래스
- Ollama REST API 통합
- 연결 상태 확인
- 모델 목록 조회

## 의존성

- Feature 27: AI Engine Strategy 인터페이스

## 구현 상세

### spa/src/lib/ai/engines/ollama.ts

```typescript
import { BaseAIEngine } from '../base-engine';
import type { ClassificationResult, AnalysisResult, AnalysisContext } from '../types';
import { CLASSIFICATION_PROMPT, ANALYSIS_PROMPT } from '../prompts';

const DEFAULT_MODEL = 'qwen2.5:0.5b';

interface OllamaGenerateRequest {
  model: string;
  prompt: string;
  stream?: boolean;
  options?: {
    temperature?: number;
    num_predict?: number;
    top_p?: number;
  };
}

interface OllamaGenerateResponse {
  model: string;
  response: string;
  done: boolean;
}

export class OllamaEngine extends BaseAIEngine {
  readonly name = 'Ollama';

  private endpoint: string;
  private model: string;

  constructor(endpoint: string = 'http://localhost:11434', model: string = DEFAULT_MODEL) {
    super();
    this.endpoint = endpoint.replace(/\/$/, '');
    this.model = model;
  }

  async initialize(): Promise<void> {
    this.setStatus({ type: 'loading', progress: 0, message: 'Ollama 연결 확인 중...' });

    try {
      // 연결 확인
      const response = await fetch(`${this.endpoint}/api/tags`);
      if (!response.ok) {
        throw new Error(`Ollama 서버 응답 오류: ${response.status}`);
      }

      const data = await response.json();
      const models = data.models || [];

      // 모델 확인
      const hasModel = models.some((m: any) => m.name.startsWith(this.model.split(':')[0]));
      if (!hasModel) {
        this.setStatus({
          type: 'loading',
          progress: 50,
          message: `${this.model} 모델 다운로드 필요...`,
        });
        // 모델 풀
        await this.pullModel();
      }

      this.setStatus({ type: 'ready' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Ollama 연결 실패';
      this.setStatus({ type: 'error', error: message });
      throw new Error(`Ollama 초기화 실패: ${message}`);
    }
  }

  private async pullModel(): Promise<void> {
    const response = await fetch(`${this.endpoint}/api/pull`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: this.model }),
    });

    if (!response.ok) {
      throw new Error(`모델 다운로드 실패: ${response.status}`);
    }

    // 스트리밍 응답 소비
    const reader = response.body?.getReader();
    if (reader) {
      while (true) {
        const { done } = await reader.read();
        if (done) break;
      }
    }
  }

  private async generate(prompt: string, options?: OllamaGenerateRequest['options']): Promise<string> {
    const request: OllamaGenerateRequest = {
      model: this.model,
      prompt,
      stream: false,
      options: {
        temperature: 0.5,
        num_predict: 512,
        ...options,
      },
    };

    const response = await fetch(`${this.endpoint}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`Ollama API 오류: ${response.status}`);
    }

    const data: OllamaGenerateResponse = await response.json();
    return data.response;
  }

  async classify(imageData: string, ocrText?: string): Promise<ClassificationResult> {
    if (this.status.type !== 'ready') {
      throw new Error('엔진이 초기화되지 않았습니다.');
    }

    this.setStatus({ type: 'processing', progress: 0, message: '이미지 분류 중...' });

    const prompt = CLASSIFICATION_PROMPT.replace('{{OCR_TEXT}}', ocrText || '(텍스트 없음)');

    try {
      const output = await this.generate(prompt, { temperature: 0.3 });
      this.setStatus({ type: 'ready' });

      const parsed = this.parseJSON<ClassificationResult>(output);

      if (parsed) {
        return parsed;
      }

      return {
        category: 'UNKNOWN',
        subCategory: 'UNKNOWN',
        confidence: 0.5,
        reasoning: output,
      };
    } catch (error) {
      this.setStatus({ type: 'error', error: String(error) });
      throw error;
    }
  }

  async analyze(text: string, context?: AnalysisContext): Promise<AnalysisResult> {
    if (this.status.type !== 'ready') {
      throw new Error('엔진이 초기화되지 않았습니다.');
    }

    this.setStatus({ type: 'processing', progress: 0, message: '텍스트 분석 중...' });

    const prompt = ANALYSIS_PROMPT
      .replace('{{COMPANY_NAME}}', context?.companyName || '회사')
      .replace('{{TEXT}}', text.slice(0, 3000));

    try {
      const output = await this.generate(prompt, { num_predict: 1024 });
      this.setStatus({ type: 'ready' });

      const parsed = this.parseJSON<AnalysisResult>(output);

      if (parsed) {
        return parsed;
      }

      return {
        summary: output.slice(0, 500),
        keyPoints: [],
        keywords: [],
        raw: output,
      };
    } catch (error) {
      this.setStatus({ type: 'error', error: String(error) });
      throw error;
    }
  }

  async query(prompt: string): Promise<string> {
    if (this.status.type !== 'ready') {
      throw new Error('엔진이 초기화되지 않았습니다.');
    }

    this.setStatus({ type: 'processing', progress: 0, message: '응답 생성 중...' });

    try {
      const output = await this.generate(prompt);
      this.setStatus({ type: 'ready' });
      return output;
    } catch (error) {
      this.setStatus({ type: 'error', error: String(error) });
      throw error;
    }
  }

  async dispose(): Promise<void> {
    this.setStatus({ type: 'idle' });
  }
}
```

### spa/src/lib/ai/ollama-utils.ts

```typescript
/** Ollama 서버 상태 확인 */
export async function checkOllamaStatus(endpoint: string = 'http://localhost:11434'): Promise<{
  connected: boolean;
  models: string[];
  error?: string;
}> {
  try {
    const response = await fetch(`${endpoint}/api/tags`, {
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      return {
        connected: false,
        models: [],
        error: `서버 응답 오류: ${response.status}`,
      };
    }

    const data = await response.json();
    const models = (data.models || []).map((m: any) => m.name);

    return {
      connected: true,
      models,
    };
  } catch (error) {
    return {
      connected: false,
      models: [],
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/** 모델 상세 정보 조회 */
export async function getModelInfo(
  endpoint: string,
  modelName: string
): Promise<{
  exists: boolean;
  size?: number;
  parameters?: string;
}> {
  try {
    const response = await fetch(`${endpoint}/api/show`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: modelName }),
    });

    if (!response.ok) {
      return { exists: false };
    }

    const data = await response.json();
    return {
      exists: true,
      parameters: data.details?.parameter_size,
    };
  } catch {
    return { exists: false };
  }
}
```

## 완료 기준

- [ ] OllamaEngine 클래스 구현
- [ ] Ollama REST API 통합 (/api/generate)
- [ ] 연결 상태 확인 (/api/tags)
- [ ] 모델 자동 다운로드 (/api/pull)
- [ ] classify: 이미지 분류
- [ ] analyze: 텍스트 분석
- [ ] query: 자유 형식 질의
- [ ] 에러 처리 및 타임아웃

## 참조 문서

- spec/03-spa-structure.md Section 6.2 (Ollama)
