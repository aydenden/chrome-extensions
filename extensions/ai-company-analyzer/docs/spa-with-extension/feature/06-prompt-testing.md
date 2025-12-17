# 프롬프트 테스트 가이드 (promptfoo + Ollama)

## 1. 개요

프롬프트 품질 검증을 위한 promptfoo + Ollama 로컬 테스트 환경 구성.

### 1.1 배경

- 기존 E2E 테스트: 브라우저에서 VLM 엔진 로드 → 2.5분+ 소요
- 개선: promptfoo + Ollama 로컬 테스트 → 수초 내 완료

### 1.2 지원 범위

| 테스트 유형 | 지원 |
|-------------|------|
| 텍스트 분류 프롬프트 | O |
| 텍스트 분석 프롬프트 | O |
| Vision 이미지 분류 | O (HTTP Provider) |
| 출력 형식 검증 | O |

---

## 2. 사전 요구사항

### 2.1 Ollama 설치

```bash
# macOS
brew install ollama

# Linux
curl -fsSL https://ollama.com/install.sh | sh

# 서버 시작
ollama serve
```

### 2.2 모델 다운로드

```bash
# 텍스트 모델 (분류/분석용)
ollama pull qwen3:0.6b

# Grading용 더 큰 모델
ollama pull llama3.2:3b

# Vision 모델 (이미지 분류용)
ollama pull llava
```

### 2.3 promptfoo 설치

```bash
# 프로젝트 의존성에 추가
bun add -D promptfoo

# 또는 전역 설치
npm install -g promptfoo
```

---

## 3. 텍스트 프롬프트 테스트

### 3.1 설정 파일 (promptfoo.yaml)

```yaml
description: "AI Company Analyzer 프롬프트 테스트"

providers:
  - id: ollama:chat:qwen3:0.6b
    config:
      temperature: 0.1
      num_predict: 256

  # Grading용
  - id: ollama:chat:llama3.2:3b
    label: grader

prompts:
  - id: classification
    raw: |
      You are a document classifier for Korean company data.
      Classify the text into exactly one category.
      Reply with ONLY the category name, nothing else.

      Categories: revenue_trend, balance_sheet, income_statement, employee_trend, review_positive, review_negative, company_overview, unknown

      Text:
      {{text}}

      Category:

  - id: analysis
    raw: |
      You are a financial analyst.
      Summarize the key information in Korean.
      Be concise and focus on important numbers and facts.
      Maximum 3-4 sentences.

      Category: {{category}}
      Hint: {{hint}}

      Text:
      {{text}}

      요약:

tests:
  # === 분류 테스트 ===
  - description: "매출 추이 텍스트 분류"
    vars:
      text: |
        2023년 매출액 150억원
        2022년 매출액 120억원
        전년대비 25% 성장
    assert:
      - type: equals
        value: "revenue_trend"

  - description: "재무제표 텍스트 분류"
    vars:
      text: |
        자산총계 500억원
        부채총계 200억원
        자본총계 300억원
    assert:
      - type: equals
        value: "balance_sheet"

  - description: "긍정 리뷰 텍스트 분류"
    vars:
      text: |
        워라밸이 좋고 복지가 훌륭합니다.
        팀 분위기도 좋고 성장 기회가 많아요.
    assert:
      - type: equals
        value: "review_positive"

  - description: "부정 리뷰 텍스트 분류"
    vars:
      text: |
        야근이 많고 연봉이 낮습니다.
        경영진에 대한 불만이 있어요.
    assert:
      - type: equals
        value: "review_negative"

  # === 분석 테스트 ===
  - description: "매출 분석 - 한국어 응답"
    vars:
      category: "revenue_trend"
      hint: "매출 금액, 증감률, 기간에 집중"
      text: |
        2023년 매출액 150억원
        2022년 매출액 120억원
        2021년 매출액 100억원
    assert:
      - type: contains
        value: "매출"
      - type: llm-rubric
        value: "응답이 한국어로 작성되어 있는가?"
        provider: ollama:chat:llama3.2:3b

  - description: "리뷰 분석 - 요점 포함"
    vars:
      category: "review_positive"
      hint: "긍정적인 포인트 요약"
      text: |
        복지가 좋고 연봉도 만족스럽습니다.
        팀원들이 친절하고 협업이 잘 됩니다.
    assert:
      - type: contains-any
        value:
          - 복지
          - 연봉
          - 팀
      - type: javascript
        value: "output.length < 500"

  # === 출력 형식 테스트 ===
  - description: "분류 - 단일 단어 응답"
    vars:
      text: "테스트 텍스트"
    assert:
      - type: javascript
        value: "output.trim().split(/\\s+/).length <= 2"

  - description: "분석 - 적절한 길이"
    vars:
      category: "company_overview"
      hint: "회사 기본 정보 요약"
      text: "테크스타트업 2020년 설립 직원 50명"
    assert:
      - type: javascript
        value: "output.length >= 20 && output.length <= 500"

defaultTest:
  options:
    provider:
      text:
        id: ollama:chat:qwen3:0.6b

outputPath: ./promptfoo-results.json
```

---

## 4. Vision 프롬프트 테스트 (이미지 + 프롬프트)

### 4.1 개요

기존 E2E 테스트의 VLM 이미지 분류를 promptfoo로 대체.

| 항목 | 상태 |
|------|------|
| promptfoo 이미지 지원 | `file://` → base64 자동 변환 |
| Ollama Vision 모델 | llava, qwen2-vl 등 |
| promptfoo + Ollama Vision | HTTP Provider 사용 |

### 4.2 HTTP Provider 방식

```yaml
# promptfoo-vision.yaml
description: "Vision 모델 이미지 분류 테스트"

providers:
  - id: http
    label: ollama-llava
    config:
      url: http://localhost:11434/api/generate
      method: POST
      headers:
        Content-Type: application/json
      body:
        model: llava
        prompt: "{{prompt}}"
        images: ["{{image}}"]
        stream: false
      responseParser: "json.response"

prompts:
  - id: vision-classify
    raw: |
      What type of company data is shown in this image?
      Reply with ONE word only from: company_overview, revenue_trend, employee_trend, balance_sheet, review_positive, review_negative, unknown

tests:
  - description: "재무정보 이미지 분류"
    vars:
      prompt: "{{vision-classify}}"
      image: file://e2e/fixtures/generated/finance-good.png
    assert:
      - type: contains-any
        value: [balance_sheet, revenue_trend, finance]

  - description: "리뷰 이미지 분류"
    vars:
      prompt: "{{vision-classify}}"
      image: file://e2e/fixtures/generated/review-positive.png
    assert:
      - type: contains-any
        value: [review_positive, review]

  - description: "고용현황 이미지 분류"
    vars:
      prompt: "{{vision-classify}}"
      image: file://e2e/fixtures/generated/employment-growing.png
    assert:
      - type: contains-any
        value: [employee_trend, employment]

  - description: "회사개요 이미지 분류"
    vars:
      prompt: "{{vision-classify}}"
      image: file://e2e/fixtures/generated/company-info-medium.png
    assert:
      - type: contains-any
        value: [company_overview, company]

outputPath: ./promptfoo-vision-results.json
```

### 4.3 대안: passthrough 옵션 (실험적)

```yaml
providers:
  - id: ollama:llava
    config:
      passthrough:
        images: ["{{image}}"]

tests:
  - vars:
      image: file://e2e/fixtures/generated/finance-good.png
```

### 4.4 활용 가능한 Fixture 이미지

```
e2e/fixtures/generated/
├── company-info-small.png     # 회사 개요 (소규모)
├── company-info-medium.png    # 회사 개요 (중규모)
├── company-info-large.png     # 회사 개요 (대규모)
├── employment-growing.png     # 고용 현황 (성장)
├── employment-stable.png      # 고용 현황 (안정)
├── employment-shrinking.png   # 고용 현황 (감소)
├── finance-good.png           # 재무 정보 (양호)
├── finance-average.png        # 재무 정보 (보통)
├── finance-bad.png            # 재무 정보 (부정적)
├── review-positive.png        # 리뷰 (긍정)
├── review-neutral.png         # 리뷰 (중립)
└── review-negative.png        # 리뷰 (부정)
```

---

## 5. 실행 방법

### 5.1 텍스트 프롬프트 테스트

```bash
# 테스트 실행
promptfoo eval -c promptfoo.yaml

# 또는 package.json 스크립트
bun run test:prompts
```

### 5.2 Vision 프롬프트 테스트

```bash
# Vision 테스트 실행
promptfoo eval -c promptfoo-vision.yaml

# 또는 package.json 스크립트
bun run test:prompts:vision
```

### 5.3 결과 확인

```bash
# 웹 UI로 결과 확인
promptfoo view

# JSON 결과 파일 확인
cat promptfoo-results.json
```

---

## 6. Assertion 유형

### 6.1 기본 Assertion

| 유형 | 설명 | 예시 |
|------|------|------|
| `equals` | 정확한 일치 | `value: "revenue_trend"` |
| `contains` | 문자열 포함 | `value: "매출"` |
| `contains-any` | 하나라도 포함 | `value: [a, b, c]` |
| `contains-all` | 모두 포함 | `value: [a, b, c]` |

### 6.2 JavaScript Assertion

```yaml
assert:
  - type: javascript
    value: "output.length < 500"

  - type: javascript
    value: "output.trim().split(/\\s+/).length <= 2"

  - type: javascript
    value: |
      const categories = ['revenue_trend', 'balance_sheet'];
      return categories.includes(output.trim());
```

### 6.3 LLM Rubric (AI 평가)

```yaml
assert:
  - type: llm-rubric
    value: "응답이 한국어로 작성되어 있는가?"
    provider: ollama:chat:llama3.2:3b

  - type: llm-rubric
    value: "응답이 전문적이고 객관적인가?"
    provider: ollama:chat:llama3.2:3b
```

---

## 7. 컨텍스트 제공 방식

### 7.1 vars를 통한 제공

```yaml
tests:
  - vars:
      text: |
        (주)테크스타트
        설립: 2020년
        직원수: 50명
        매출액: 100억원
      category: "company_overview"
      hint: "회사 기본 정보 요약"
```

### 7.2 외부 파일 참조

```yaml
tests:
  - vars:
      text: file://test/fixtures/texts/revenue-trend.txt
      image: file://e2e/fixtures/generated/finance-good.png
```

### 7.3 JSON 데이터셋

```yaml
# 별도 JSON 파일 사용
tests: file://test/fixtures/prompt-test-cases.json
```

---

## 8. package.json 스크립트

```json
{
  "scripts": {
    "test:prompts": "promptfoo eval -c promptfoo.yaml",
    "test:prompts:vision": "promptfoo eval -c promptfoo-vision.yaml",
    "test:prompts:view": "promptfoo view",
    "test:prompts:all": "bun run test:prompts && bun run test:prompts:vision"
  }
}
```

---

## 9. CI/CD 통합

### 9.1 GitHub Actions

```yaml
# .github/workflows/test.yml
jobs:
  prompt-test:
    runs-on: ubuntu-latest
    services:
      ollama:
        image: ollama/ollama
        ports:
          - 11434:11434
    steps:
      - uses: actions/checkout@v4

      - name: Pull Ollama models
        run: |
          ollama pull qwen3:0.6b
          ollama pull llama3.2:3b
          ollama pull llava

      - name: Install dependencies
        run: bun install

      - name: Run text prompt tests
        run: bun run test:prompts

      - name: Run vision prompt tests
        run: bun run test:prompts:vision
```

---

## 10. 트러블슈팅

### 10.1 Ollama 연결 실패

```bash
# Ollama 서버 상태 확인
curl http://localhost:11434/api/version

# 서버 재시작
ollama serve
```

### 10.2 모델 로드 느림

```bash
# 미리 모델 로드
ollama run qwen3:0.6b "hello"
```

### 10.3 Vision 테스트 실패

- HTTP Provider 사용 시 `stream: false` 필수
- `responseParser: "json.response"` 설정 확인
- 이미지 경로가 `file://` 프로토콜로 시작하는지 확인

---

## 11. 관련 문서

| 문서 | 내용 |
|------|------|
| [테스트 전략](../spec/07-testing-strategy.md) | 전체 테스트 전략 |
| [분석 파이프라인](./03-analysis-pipeline.md) | 프롬프트 상세 |
| [promptfoo 공식 문서](https://www.promptfoo.dev/docs/) | promptfoo 레퍼런스 |
| [Ollama API](https://github.com/ollama/ollama/blob/main/docs/api.md) | Ollama API 레퍼런스 |
