# Feature 28: Qwen3 WebGPU 엔진

## 개요

Qwen3-0.6B 모델을 WebGPU로 브라우저에서 직접 실행하는 AI 엔진입니다.

## 범위

- Qwen3Engine 클래스
- @huggingface/transformers 통합
- WebGPU 지원 확인
- 모델 로딩 및 추론

## 의존성

- Feature 27: AI Engine Strategy 인터페이스

## 구현 상세

### spa/src/lib/ai/engines/qwen3.ts

```typescript
import { pipeline, env, type TextGenerationPipeline } from '@huggingface/transformers';
import { BaseAIEngine } from '../base-engine';
import type { ClassificationResult, AnalysisResult, AnalysisContext } from '../types';
import { CLASSIFICATION_PROMPT, ANALYSIS_PROMPT } from '../prompts';

// WASM 백엔드 비활성화 (WebGPU 우선)
env.backends.onnx.wasm.proxy = false;

const MODEL_ID = 'Qwen/Qwen2.5-0.5B-Instruct';

export class Qwen3Engine extends BaseAIEngine {
  readonly name = 'Qwen3 WebGPU';

  private generator: TextGenerationPipeline | null = null;

  async initialize(): Promise<void> {
    if (this.generator) {
      this.setStatus({ type: 'ready' });
      return;
    }

    // WebGPU 지원 확인
    if (!navigator.gpu) {
      throw new Error('WebGPU를 지원하지 않는 브라우저입니다.');
    }

    this.setStatus({ type: 'loading', progress: 0, message: '모델 다운로드 중...' });

    try {
      this.generator = await pipeline('text-generation', MODEL_ID, {
        device: 'webgpu',
        progress_callback: (progress: any) => {
          if (progress.status === 'downloading') {
            const pct = Math.round((progress.loaded / progress.total) * 100);
            this.setStatus({
              type: 'loading',
              progress: pct,
              message: `모델 다운로드 중... ${pct}%`,
            });
          }
        },
      });

      this.setStatus({ type: 'ready' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.setStatus({ type: 'error', error: message });
      throw error;
    }
  }

  async classify(imageData: string, ocrText?: string): Promise<ClassificationResult> {
    if (!this.generator) {
      throw new Error('엔진이 초기화되지 않았습니다.');
    }

    this.setStatus({ type: 'processing', progress: 0, message: '이미지 분류 중...' });

    const prompt = CLASSIFICATION_PROMPT.replace('{{OCR_TEXT}}', ocrText || '(텍스트 없음)');

    try {
      const result = await this.generator(prompt, {
        max_new_tokens: 256,
        temperature: 0.3,
        do_sample: true,
      });

      this.setStatus({ type: 'ready' });

      const output = Array.isArray(result) ? result[0].generated_text : result.generated_text;
      const parsed = this.parseJSON<ClassificationResult>(output);

      if (parsed) {
        return parsed;
      }

      // 파싱 실패 시 기본값
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
    if (!this.generator) {
      throw new Error('엔진이 초기화되지 않았습니다.');
    }

    this.setStatus({ type: 'processing', progress: 0, message: '텍스트 분석 중...' });

    const prompt = ANALYSIS_PROMPT
      .replace('{{COMPANY_NAME}}', context?.companyName || '회사')
      .replace('{{TEXT}}', text.slice(0, 2000)); // 토큰 제한

    try {
      const result = await this.generator(prompt, {
        max_new_tokens: 512,
        temperature: 0.5,
        do_sample: true,
      });

      this.setStatus({ type: 'ready' });

      const output = Array.isArray(result) ? result[0].generated_text : result.generated_text;
      const parsed = this.parseJSON<AnalysisResult>(output);

      if (parsed) {
        return parsed;
      }

      // 파싱 실패 시 텍스트 기반 결과
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
    if (!this.generator) {
      throw new Error('엔진이 초기화되지 않았습니다.');
    }

    this.setStatus({ type: 'processing', progress: 0, message: '응답 생성 중...' });

    try {
      const result = await this.generator(prompt, {
        max_new_tokens: 512,
        temperature: 0.7,
        do_sample: true,
      });

      this.setStatus({ type: 'ready' });

      return Array.isArray(result) ? result[0].generated_text : result.generated_text;
    } catch (error) {
      this.setStatus({ type: 'error', error: String(error) });
      throw error;
    }
  }

  async dispose(): Promise<void> {
    this.generator = null;
    this.setStatus({ type: 'idle' });
  }
}
```

### spa/src/lib/ai/webgpu-check.ts

```typescript
export interface WebGPUSupport {
  supported: boolean;
  adapter?: GPUAdapter;
  device?: GPUDevice;
  error?: string;
}

/** WebGPU 지원 여부 확인 */
export async function checkWebGPUSupport(): Promise<WebGPUSupport> {
  if (!navigator.gpu) {
    return {
      supported: false,
      error: '이 브라우저는 WebGPU를 지원하지 않습니다.',
    };
  }

  try {
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
      return {
        supported: false,
        error: 'WebGPU 어댑터를 찾을 수 없습니다.',
      };
    }

    const device = await adapter.requestDevice();

    return {
      supported: true,
      adapter,
      device,
    };
  } catch (error) {
    return {
      supported: false,
      error: error instanceof Error ? error.message : 'WebGPU 초기화 실패',
    };
  }
}

/** WebGPU 정보 조회 */
export async function getWebGPUInfo(): Promise<{
  vendor?: string;
  architecture?: string;
  maxBufferSize?: number;
}> {
  const support = await checkWebGPUSupport();
  if (!support.supported || !support.adapter) {
    return {};
  }

  const info = await support.adapter.requestAdapterInfo();

  return {
    vendor: info.vendor,
    architecture: info.architecture,
    maxBufferSize: support.adapter.limits.maxBufferSize,
  };
}
```

## 완료 기준

- [ ] Qwen3Engine 클래스 구현
- [ ] @huggingface/transformers 통합
- [ ] WebGPU 지원 확인
- [ ] 모델 다운로드 진행률 표시
- [ ] classify: 이미지 분류
- [ ] analyze: 텍스트 분석
- [ ] query: 자유 형식 질의
- [ ] 에러 처리 및 상태 관리

## 참조 문서

- spec/03-spa-structure.md Section 6.1 (Qwen3 WebGPU)
