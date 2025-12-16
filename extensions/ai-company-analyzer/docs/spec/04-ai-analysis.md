# AI 분석

## 개요

Chrome 빌트인 AI (Gemini Nano)를 활용하여 수집된 데이터를 분석.
모든 분석은 로컬에서 수행되며 외부 서버 통신 없음.

## 사용 API

| API | 용도 |
|-----|------|
| **Language Detector API** | 한국어 감지 |
| **Translator API** | 한국어 ↔ 영어 번역 |
| **Prompt API** | 텍스트/이미지 분석 |

## 분석 파이프라인

```
[한국어 데이터]
    ↓
[Language Detector] → 한국어 감지
    ↓
[Translator API] → 영어로 번역
    ↓
[Prompt API] → 영어 프롬프트 → 영어 응답
    ↓
[Translator API] → 한국어로 번역
    ↓
[UI 표시]
```

## 분석 항목

### 1. 회사명 추출

**목적:** 추출된 텍스트에서 회사명 자동 감지

**입력:** 페이지에서 추출한 텍스트

**출력:** 회사명 문자열

**프롬프트:**
```
Extract the company name from the following text.
Return ONLY the company name, nothing else.
Text: {text}
```

### 2. Runway 예측

**목적:** 현금 소진 예상 기간 계산

**입력:** 재무 데이터 (현금, 매출, 비용)

**출력:**
- 예상 개월수
- 신뢰도 (high/medium/low)
- 산정 근거

**프롬프트:**
```
Analyze this company's financial data and provide:
1. Estimated runway in months
2. Financial risk level (high/medium/low)
3. Key risk factors

Financial Data: {financial_data}

Respond in JSON: {
  "runway_months": number,
  "runway_confidence": "high"|"medium"|"low",
  "runway_reasoning": "string",
  "risk_level": "high"|"medium"|"low",
  "risk_factors": ["string"]
}
```

### 3. 재무 리스크 분석

**목적:** 재무 건전성 평가

**입력:** 재무 데이터 (매출, 영업이익, 부채 등)

**출력:**
- 리스크 레벨 (high/medium/low)
- 리스크 요인 목록

*Runway 예측과 동일 프롬프트에서 함께 분석*

### 4. 리뷰 분석

**목적:** 직원 리뷰에서 인사이트 추출

**입력:** 블라인드/잡플래닛 리뷰 텍스트

**출력:**
- 긍정 키워드
- 부정 키워드
- 종합 요약

**프롬프트:**
```
Analyze these company reviews and provide:
1. Key positive themes
2. Key negative themes
3. Overall summary

Reviews: {reviews}

Respond in JSON: {
  "positive_themes": ["string"],
  "negative_themes": ["string"],
  "summary": "string"
}
```

### 5. 종합 점수 산정

**목적:** 모든 분석 결과를 종합한 최종 점수

**입력:** 재무 분석 + 리뷰 분석 결과

**출력:**
- 1~5점 점수
- 산정 근거

**프롬프트:**
```
Based on the analysis, provide an overall score from 1 to 5.
Financial: Runway {runway_months} months, Risk {risk_level}
Reviews: Positive {positive_themes}, Negative {negative_themes}
Weights: Financial {financial_weight}%, Reviews {review_weight}%

Respond: { "score": number, "reasoning": "string" }
```

## 가중치

| 항목 | 기본값 | 설정 |
|------|--------|------|
| 재무 | 60% | 고급 설정에서 변경 가능 |
| 리뷰 | 40% | 고급 설정에서 변경 가능 |

## 데이터 부족 시 처리

| 상황 | 처리 |
|------|------|
| 재무만 있음 | "리뷰 데이터 필요" 표시, 점수 보류 |
| 리뷰만 있음 | "재무 데이터 필요" 표시, 점수 보류 |
| 둘 다 있음 | 종합 점수 산정 |

## 이미지/PDF 분석

### SVG 그래프 분석

```
[SVG 요소]
    ↓
[canvg] → Canvas 변환
    ↓
[canvas.toBlob()] → Blob 생성
    ↓
[Prompt API] → 멀티모달 입력
    ↓
[분석 결과]
```

**프롬프트 예시:**
```javascript
const session = await LanguageModel.create({
  expectedInputs: [{ type: "image" }]
});

const result = await session.prompt([
  { type: "image", value: graphBlob },
  { type: "text", value: "Extract yearly revenue data from this chart. Return as JSON array." }
]);
```

### PDF 분석

```
[PDF 파일]
    ↓
[pdf.js] → 페이지별 Canvas 렌더링
    ↓
[canvas.toBlob()] → 페이지별 Blob 생성
    ↓
[Prompt API] → 멀티모달 입력
    ↓
[재무 데이터 추출]
```

## 에러 처리

| 에러 | 처리 |
|------|------|
| AI 모델 미설치 | "Chrome 138 이상 필요" 안내 |
| 분석 실패 | 재시도 버튼 제공 |
| 토큰 초과 | 데이터 분할 처리 |

## 성능 고려사항

| 환경 | 처리 시간 |
|------|-----------|
| GPU (4GB+ VRAM) | 거의 즉시 |
| CPU 전용 | 60초+ |

**권장사항:**
- GPU 환경 권장
- 대용량 PDF는 주요 페이지만 분석
- 리뷰 분석 시 최근 N개만 선택 권장
