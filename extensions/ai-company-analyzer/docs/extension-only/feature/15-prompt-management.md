# 15. 프롬프트 관리 시스템 - 구현 가이드

## 개요

promptfoo 기반 프롬프트 버전 관리 및 테스트 시스템 도입

## 배경

### 현재 문제
1. **extraction.ts의 JSON 프롬프트** - 중국어 반복 출력, JSON 파싱 실패
2. **이미지 리사이즈** - 448x448 강제로 종횡비 왜곡, OCR 품질 저하
3. **프롬프트 관리** - 코드에 하드코딩, 변경 추적 어려움, 테스트 없음

### 목표
1. YAML 기반 프롬프트 분리 (코드와 분리)
2. promptfoo로 프롬프트 테스트 자동화
3. extraction.ts를 단순 텍스트 형식으로 리팩토링
4. 이미지 리사이즈 개선 (종횡비 유지)

## 기술 스택

- **프롬프트 관리**: YAML 파일 + promptfoo
- **테스트**: promptfoo CLI
- **파싱**: yaml 패키지

## 파일 구조

```
extensions/ai-company-analyzer/
├── prompts/                           # 프롬프트 YAML 저장소 (신규)
│   ├── extraction.yaml                # 텍스트 추출 프롬프트
│   ├── classification.yaml            # 분류 프롬프트
│   └── analysis.yaml                  # 분석 프롬프트
├── promptfoo.yaml                     # promptfoo 설정 (신규)
├── src/lib/prompts/
│   ├── extraction.ts                  # 수정: JSON → 단순 텍스트
│   ├── classification.ts              # 유지 (이미 단순 형식)
│   ├── analysis.ts                    # 유지 (이미 단순 형식)
│   ├── loader.ts                      # 신규: YAML 로더
│   └── index.ts                       # 수정: loader export
├── src/background/
│   ├── smolvlm-engine.ts              # 수정: 이미지 리사이즈 개선
│   └── extraction-queue.ts            # 수정: 2단계 추출 로직
└── e2e/fixtures/prompts/              # 프롬프트 테스트 이미지 (신규)
```

---

## 구현 상세

### Phase 1: YAML 프롬프트 파일 생성

#### 1.1 extraction.yaml

```yaml
# prompts/extraction.yaml
#
# 텍스트 추출 프롬프트
# JSON 형식 제거, 단순 텍스트 추출로 변경
#
# 변경 이력:
# - v2.0 (2025-01): JSON 제거, 단순 텍스트 형식
# - v1.0 (2024-12): 초기 버전 (JSON 형식)

text_extraction:
  version: "2.0"
  description: "이미지에서 모든 텍스트 추출 (JSON 없음)"
  model: "qwen2-vl"
  template: |
    Extract ALL visible text from this image.
    Output only the raw text exactly as shown.
    Do NOT output:
    - JSON or any structured format
    - Chinese characters
    - Repeated text or patterns

    Text:
```

#### 1.2 classification.yaml

```yaml
# prompts/classification.yaml
#
# 이미지 분류 프롬프트

classification:
  version: "1.0"
  description: "이미지 종류 분류"
  model: "qwen2-vl"
  template: |
    What type of image is this? Reply with ONE word only.

    Categories:
    - company_overview (회사정보)
    - revenue_trend (매출추이)
    - employee_trend (인원추이)
    - balance_sheet (재무제표)
    - review_positive (긍정리뷰)
    - review_negative (부정리뷰)
    - review_mixed (복합리뷰)
    - rating_summary (평점)
    - bar_chart (막대그래프)
    - line_chart (라인차트)
    - table_data (표)
    - unknown

    Answer:

  site_hints:
    company_info: "Hint: company_overview, table_data"
    finance_inno: "Hint: revenue_trend, employee_trend, bar_chart"
    finance_dart: "Hint: balance_sheet, table_data"
    finance_smes: "Hint: balance_sheet, table_data"
    review_blind: "Hint: review_positive, review_negative, review_mixed"
    review_jobplanet: "Hint: review_positive, review_negative, review_mixed"
```

### Phase 2: promptfoo 설정

#### 2.1 promptfoo.yaml

```yaml
# promptfoo.yaml
description: "AI Company Analyzer 프롬프트 테스트"

prompts:
  - id: text_extraction
    raw: |
      Extract ALL visible text from this image.
      Output only the raw text exactly as shown.
      Do NOT output JSON, Chinese characters, or repeated text.

  - id: classification
    raw: |
      What type of image is this? Reply with ONE word only.
      Categories: company_overview, revenue_trend, employee_trend...
      Answer:

# 로컬 테스트용 echo provider (실제 모델 없이 테스트)
providers:
  - id: echo

# 테스트 케이스
tests:
  # 텍스트 추출 테스트
  - description: "텍스트 추출 - JSON 출력 없음"
    vars:
      prompt: text_extraction
    assert:
      - type: not-contains
        value: "{"
      - type: not-contains
        value: "rawText"

  - description: "텍스트 추출 - 중국어 출력 없음"
    vars:
      prompt: text_extraction
    assert:
      - type: not-contains
        value: "现在"
      - type: not-contains
        value: "的"

  # 분류 테스트
  - description: "분류 - 유효한 카테고리 출력"
    vars:
      prompt: classification
    assert:
      - type: javascript
        value: |
          const validCategories = [
            'company_overview', 'revenue_trend', 'employee_trend',
            'balance_sheet', 'review_positive', 'review_negative',
            'review_mixed', 'rating_summary', 'bar_chart',
            'line_chart', 'table_data', 'unknown'
          ];
          return validCategories.some(c => output.toLowerCase().includes(c));
```

#### 2.2 package.json 스크립트

```json
{
  "scripts": {
    "test:prompts": "promptfoo eval",
    "test:prompts:view": "promptfoo view"
  },
  "devDependencies": {
    "promptfoo": "^0.100.0"
  }
}
```

### Phase 3: extraction.ts 리팩토링

#### 3.1 단순 텍스트 프롬프트로 변경

```typescript
// src/lib/prompts/extraction.ts

// Before (JSON 형식)
const FINANCIAL_PROMPTS = {
  balance_sheet: `Extract text and numbers from this balance sheet.
Return JSON:
{"rawText":"<all visible text>","summary":"<Korean summary>"...}`,
};

// After (단순 텍스트)
const TEXT_EXTRACTION_PROMPT = `Extract ALL visible text from this image.
Output only the raw text exactly as shown.
Do NOT output JSON, Chinese characters, or repeated text.

Text:`;

// 모든 카테고리에 동일한 프롬프트 사용
export function getExtractionPrompt(category: ImageSubCategory): string {
  return TEXT_EXTRACTION_PROMPT;
}
```

#### 3.2 2단계 추출 로직

```typescript
// src/background/extraction-queue.ts

// 1단계: VLM으로 텍스트만 추출
const rawText = await analyzeImage(blob, TEXT_EXTRACTION_PROMPT);

// 2단계: 카테고리에 따라 정규표현식으로 구조화
const structured = parseTextByCategory(rawText, category);

interface StructuredData {
  rawText: string;
  numbers?: { label: string; value: number; unit: string }[];
  dates?: string[];
  percentages?: number[];
}

function parseTextByCategory(text: string, category: ImageSubCategory): StructuredData {
  const result: StructuredData = { rawText: text };

  // 숫자 추출 (예: "156억원", "12.5%")
  const numberPattern = /(\d+(?:,\d{3})*(?:\.\d+)?)\s*(억원|만원|원|%|명)/g;
  const numbers: { label: string; value: number; unit: string }[] = [];
  let match;
  while ((match = numberPattern.exec(text)) !== null) {
    numbers.push({
      label: '',
      value: parseFloat(match[1].replace(/,/g, '')),
      unit: match[2],
    });
  }
  if (numbers.length > 0) result.numbers = numbers;

  // 연도 추출
  const yearPattern = /\b(20\d{2})\b/g;
  const dates = [...text.matchAll(yearPattern)].map(m => m[1]);
  if (dates.length > 0) result.dates = [...new Set(dates)];

  return result;
}
```

### Phase 4: 이미지 리사이즈 개선

```typescript
// src/background/smolvlm-engine.ts

const MAX_DIMENSION = 896; // 448 → 896으로 증가

async function analyzeWithVision(imageBlob: Blob, prompt: string): Promise<string> {
  // ...

  const rawImage = await RawImage.fromBlob(new Blob([arrayBuffer]));

  // Before: 강제 정사각형
  // const image = await rawImage.resize(448, 448);

  // After: 종횡비 유지
  const { width, height } = rawImage;
  const scale = Math.min(MAX_DIMENSION / width, MAX_DIMENSION / height, 1);
  const newWidth = Math.round(width * scale);
  const newHeight = Math.round(height * scale);

  // 28의 배수로 반올림 (Qwen2-VL 권장)
  const alignedWidth = Math.round(newWidth / 28) * 28 || 28;
  const alignedHeight = Math.round(newHeight / 28) * 28 || 28;

  const image = await rawImage.resize(alignedWidth, alignedHeight);
  console.log(`[VLM] 리사이즈: ${width}x${height} → ${alignedWidth}x${alignedHeight}`);

  // ...
}
```

---

## 실행 방법

```bash
# 1. 의존성 설치
bun add -D promptfoo yaml

# 2. 프롬프트 테스트 (로컬)
bun run test:prompts

# 3. 테스트 결과 UI로 확인
bun run test:prompts:view

# 4. E2E 테스트 (실제 모델)
bun run test:e2e
```

---

## 테스트 전략

### promptfoo 테스트 (단위 테스트)
- 프롬프트 형식 검증
- 금지 패턴 체크 (JSON, 중국어)
- 카테고리 유효성

### E2E 테스트 (통합 테스트)
- 실제 Qwen2-VL 모델로 추출
- fixture 이미지로 정확도 검증
- 기존 e2e/fixtures 활용

---

## 마이그레이션 체크리스트

- [ ] prompts/ 디렉토리 생성
- [ ] extraction.yaml, classification.yaml, analysis.yaml 작성
- [ ] promptfoo.yaml 설정
- [ ] extraction.ts JSON 프롬프트 제거
- [ ] extraction-queue.ts 2단계 로직 구현
- [ ] smolvlm-engine.ts 리사이즈 개선
- [ ] package.json 스크립트 추가
- [ ] promptfoo 테스트 통과 확인
- [ ] E2E 테스트 통과 확인

---

## 참고

- [promptfoo GitHub](https://github.com/promptfoo/promptfoo)
- [Qwen2-VL 이미지 처리](https://huggingface.co/docs/transformers/en/model_doc/qwen2_vl)
- [프롬프트 관리 가이드](https://agenta.ai/blog/the-definitive-guide-to-prompt-management-systems)
