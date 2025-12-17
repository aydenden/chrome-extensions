# 15. 프롬프트 관리 시스템 - 체크리스트

## Phase 1: YAML 프롬프트 파일 생성
- [x] prompts/ 디렉토리 생성
- [x] prompts/extraction.yaml 작성
- [x] prompts/classification.yaml 작성
- [x] prompts/analysis.yaml 작성
- [x] promptfoo.yaml 설정 파일 작성

## Phase 2: extraction.ts 리팩토링
- [x] JSON 프롬프트 제거
- [x] 단순 텍스트 추출 프롬프트로 변경
- [x] 텍스트 후처리 유틸리티 (extractNumbers, extractYears, extractPercentages)
- [x] parseExtractedText 함수 구현

## Phase 3: extraction-queue.ts 수정
- [x] isValidVLMResponse에서 JSON 구조 확인 제거
- [x] parseExtractedText 사용하도록 변경
- [x] ParsedNumber → ExtractedNumber 변환 로직

## Phase 4: smolvlm-engine.ts 이미지 리사이즈 개선
- [x] 448x448 고정 리사이즈 제거
- [x] 종횡비 유지 리사이즈 구현 (최대 560px로 축소)
- [x] 28의 배수로 정렬 (Qwen2-VL 권장)

## Phase 5: package.json 업데이트
- [x] promptfoo devDependency 추가
- [x] test:prompts 스크립트 추가
- [x] test:prompts:view 스크립트 추가

## Phase 6: 검증 (v2.0)
- [x] bun install 성공
- [x] bun run build 성공
- [ ] bun run test:prompts 실행 확인
- [ ] 실제 이미지 텍스트 추출 테스트

---

## v3.0 파이프라인 재설계: VLM(OCR) + LM(분석) 분리

### Phase 1: VLM OCR 프롬프트 단순화
- [x] extraction.ts - 단일 OCR 프롬프트로 변경 ('Read all text in this image.')
- [x] 카테고리별 힌트 제거 (분류는 텍스트 LM에서 수행)

### Phase 2: Qwen3 텍스트 LM 엔진 추가
- [x] `src/background/text-llm-engine.ts` 신규 생성
- [x] onnx-community/Qwen3-0.6B-ONNX 모델 사용
- [x] WebGPU + q4f16 양자화 설정
- [x] generateText(), isTextLLMReady() 함수 구현

### Phase 3: 분류/분석 프롬프트 작성
- [x] `src/lib/prompts/text-analysis.ts` 신규 생성
- [x] CLASSIFY_SYSTEM - 분류 시스템 프롬프트
- [x] ANALYZE_SYSTEM - 분석 시스템 프롬프트
- [x] buildClassifyPrompt(), buildAnalyzePrompt() 함수
- [x] parseCategory() - 분류 결과 파싱

### Phase 4: extraction-queue.ts 파이프라인 통합
- [x] 'classify' → 'extract' 흐름을 'ocr' → 'analyze'로 변경
- [x] runClassification() → runOCR() - VLM OCR만 수행
- [x] runTextExtraction() → runTextAnalysis() - 텍스트 LM 분류/분석
- [x] 텍스트 LM 로딩 실패 시 graceful degradation

### Phase 5: 빌드 검증
- [x] bun run build 성공
- [ ] 실제 이미지 OCR 테스트
- [ ] 분류 정확도 테스트
- [ ] 분석 품질 테스트

## 변경된 파일

### 신규 파일
- `prompts/extraction.yaml`
- `prompts/classification.yaml`
- `prompts/analysis.yaml`
- `promptfoo.yaml`
- `docs/feature/15-prompt-management.md`
- `docs/feature/15-prompt-management.checklist.md`
- `src/background/text-llm-engine.ts` - Qwen3 텍스트 LM 엔진 (v3.0)
- `src/lib/prompts/text-analysis.ts` - 분류/분석 프롬프트 (v3.0)

### 수정된 파일
- `src/lib/prompts/extraction.ts` - OCR 프롬프트로 단순화 (v3.0)
- `src/background/extraction-queue.ts` - VLM→LM 2단계 파이프라인 (v3.0)
- `src/background/smolvlm-engine.ts` - 종횡비 유지 리사이즈 (560px)
- `package.json` - promptfoo 의존성, 스크립트

## 다음 단계 (수동 검증)
1. Chrome에서 익스텐션 로드
2. 이미지 캡처 → OCR 텍스트 추출 확인
3. 분류 결과 확인 (콘솔 로그: '분류 결과: category')
4. 분석 요약 확인 (콘솔 로그: '분석 결과: ...')
5. 텍스트 LM 로딩 시간 측정 (첫 로딩 시 ~600MB 다운로드)
