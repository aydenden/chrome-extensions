# Feature 40: promptfoo 프롬프트 테스트

## 개요

promptfoo를 활용하여 AI 프롬프트의 품질을 테스트합니다.

## 범위

- promptfoo 설정
- 분류 프롬프트 테스트
- 분석 프롬프트 테스트
- 골든 데이터셋

## 의존성

- Feature 30: 분류/분석 프롬프트 정의

## 구현 상세

### spa/promptfoo.yaml

```yaml
description: AI Company Analyzer Prompt Tests

providers:
  - id: ollama:qwen2.5:0.5b
    config:
      temperature: 0.3
      max_tokens: 256

prompts:
  - file://prompts/classification.txt
  - file://prompts/analysis.txt

tests:
  # 분류 테스트
  - vars:
      ocr_text: |
        원티드
        프론트엔드 개발자
        연봉 5000만원 ~ 7000만원
        React, TypeScript 필수
    assert:
      - type: contains-json
        value:
          category: WANTED
      - type: javascript
        value: output.includes('"confidence"') && parseFloat(output.match(/"confidence":\s*([\d.]+)/)[1]) > 0.7

  - vars:
      ocr_text: |
        블라인드
        ★★★★☆ 4.2
        장점: 워라밸 좋음
        단점: 연봉이 낮음
    assert:
      - type: contains-json
        value:
          category: BLIND
      - type: javascript
        value: output.includes('"subCategory"')

  - vars:
      ocr_text: |
        2024년 3분기 재무제표
        매출액: 150억원
        영업이익: 25억원
    assert:
      - type: contains-json
        value:
          category: DART

  # 분석 테스트
  - vars:
      company_name: 테스트 회사
      text: |
        회사 리뷰: 워라밸이 좋고 복지가 훌륭합니다.
        연봉은 업계 평균 수준이며, 성장 가능성이 높습니다.
    assert:
      - type: contains
        value: summary
      - type: contains
        value: keyPoints
      - type: javascript
        value: |
          const json = JSON.parse(output.match(/```json\n([\s\S]*?)\n```/)?.[1] || output);
          return json.keywords && json.keywords.length > 0;

defaultTest:
  options:
    transformOutput: |
      // JSON 블록 추출
      const match = output.match(/```json\n([\s\S]*?)\n```/);
      return match ? match[1] : output;
```

### spa/prompts/classification.txt

```
당신은 채용/기업 정보 이미지 분류 전문가입니다.

다음 OCR 텍스트를 분석하여 이미지의 카테고리를 분류해주세요.

## 카테고리 정의

### WANTED (원티드)
- JOB_POSTING: 채용공고, 포지션 상세
- COMPANY_PROFILE: 회사 소개, 팀 소개
- COMPENSATION: 연봉, 복리후생 정보

### BLIND (블라인드)
- SALARY_REVIEW: 연봉 정보, 연봉 협상
- COMPANY_REVIEW: 회사 리뷰, 장단점
- INTERVIEW_REVIEW: 면접 후기

### DART (다트)
- FINANCIAL_STATEMENT: 재무제표
- DISCLOSURE: 공시 정보

## OCR 텍스트
{{ocr_text}}

## 응답 형식 (JSON)
```json
{
  "category": "WANTED | BLIND | DART | UNKNOWN",
  "subCategory": "해당 하위 카테고리",
  "confidence": 0.0-1.0,
  "reasoning": "분류 근거"
}
```

JSON만 응답하세요.
```

### spa/prompts/analysis.txt

```
당신은 기업 분석 전문가입니다.

## 회사명
{{company_name}}

## 분석할 텍스트
{{text}}

## 요청사항
1. 핵심 내용 요약 (2-3문장)
2. 주요 포인트 추출 (3-5개)
3. 핵심 키워드 (5-10개)
4. 전반적 톤 (positive/negative/neutral)

## 응답 형식 (JSON)
```json
{
  "summary": "요약 내용",
  "keyPoints": ["포인트1", "포인트2"],
  "keywords": ["키워드1", "키워드2"],
  "sentiment": "positive | negative | neutral"
}
```

JSON만 응답하세요.
```

### spa/test/golden-dataset.json

```json
{
  "classification": [
    {
      "input": "원티드 채용공고 프론트엔드 개발자 React TypeScript 5000만원",
      "expected": {
        "category": "WANTED",
        "subCategory": "JOB_POSTING"
      }
    },
    {
      "input": "블라인드 익명 리뷰 장점 단점 별점 4.5",
      "expected": {
        "category": "BLIND",
        "subCategory": "COMPANY_REVIEW"
      }
    },
    {
      "input": "2024년 감사보고서 매출 영업이익 자산총계",
      "expected": {
        "category": "DART",
        "subCategory": "FINANCIAL_STATEMENT"
      }
    }
  ],
  "analysis": [
    {
      "input": {
        "companyName": "테크스타트업",
        "text": "성장하는 스타트업, 워라밸 좋음, 연봉 협상 가능"
      },
      "expectedKeywords": ["스타트업", "워라밸", "연봉"],
      "expectedSentiment": "positive"
    }
  ]
}
```

### package.json 스크립트

```json
{
  "scripts": {
    "prompt:test": "promptfoo eval",
    "prompt:view": "promptfoo view",
    "prompt:compare": "promptfoo eval --compare"
  }
}
```

### GitHub Actions 통합

```yaml
# .github/workflows/prompt-test.yml
name: Prompt Tests

on:
  push:
    paths:
      - 'spa/prompts/**'
      - 'spa/promptfoo.yaml'
  pull_request:
    paths:
      - 'spa/prompts/**'

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm install -g promptfoo

      - name: Run prompt tests
        run: cd spa && promptfoo eval --no-cache
        env:
          OLLAMA_HOST: ${{ secrets.OLLAMA_HOST }}
```

## 완료 기준

- [ ] promptfoo.yaml 설정
- [ ] 분류 프롬프트 테스트 케이스 (3개 이상)
- [ ] 분석 프롬프트 테스트 케이스 (2개 이상)
- [ ] 골든 데이터셋 (golden-dataset.json)
- [ ] JSON 응답 검증 assertion
- [ ] confidence 임계값 검증
- [ ] npm 스크립트 (prompt:test, prompt:view)

## 참조 문서

- spec/03-spa-structure.md Section 8.2 (프롬프트 테스트)
