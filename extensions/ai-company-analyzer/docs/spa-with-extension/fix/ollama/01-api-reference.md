# Ollama API 레퍼런스

## 기본 정보

- **기본 엔드포인트**: `http://localhost:11434`
- **Content-Type**: `application/json`

---

## 엔드포인트 목록

| 엔드포인트 | 메서드 | 용도 |
|-----------|--------|------|
| `/` | GET | 헬스체크 |
| `/api/tags` | GET | 설치된 모델 목록 |
| `/api/show` | POST | 모델 상세 정보 |
| `/api/chat` | POST | 채팅 (이미지 지원) |
| `/api/ps` | GET | 실행 중인 모델 |

---

## 1. 헬스체크

### 요청
```http
GET /
```

### 응답
```
Ollama is running
```

### TypeScript 예시
```typescript
async function checkOllamaHealth(endpoint: string): Promise<boolean> {
  try {
    const res = await fetch(endpoint);
    const text = await res.text();
    return text === 'Ollama is running';
  } catch {
    return false;
  }
}
```

---

## 2. 모델 목록 조회

### 요청
```http
GET /api/tags
```

### 응답
```json
{
  "models": [
    {
      "name": "gemma3:latest",
      "model": "gemma3:latest",
      "modified_at": "2025-01-10T15:30:00Z",
      "size": 4294967296,
      "digest": "sha256:abc123...",
      "details": {
        "parent_model": "",
        "format": "gguf",
        "family": "gemma3",
        "families": ["gemma3"],
        "parameter_size": "4B",
        "quantization_level": "Q4_K_M"
      }
    }
  ]
}
```

### TypeScript 예시
```typescript
// API 응답 원본 타입 (OllamaContext에서 가공하여 OllamaModel로 변환)
export interface OllamaModelInfo {
  name: string;
  model: string;
  size: number;
  modified_at: string;
  details: {
    parameter_size: string;
    quantization_level: string;
  };
}

async function fetchModelList(endpoint: string): Promise<OllamaModelInfo[]> {
  const res = await fetch(`${endpoint}/api/tags`);
  const data = await res.json();
  return data.models || [];
}
```

---

## 3. 모델 상세 정보

### 요청
```http
POST /api/show
Content-Type: application/json

{
  "name": "gemma3:latest"
}
```

### 응답
```json
{
  "modelfile": "FROM gemma3...",
  "parameters": "temperature 0.7\n...",
  "template": "{{ .System }}\n{{ .Prompt }}",
  "details": {
    "parent_model": "",
    "format": "gguf",
    "family": "gemma3",
    "parameter_size": "4B"
  },
  "capabilities": ["completion", "vision"]
}
```

### Vision 모델 확인
```typescript
async function isVisionModel(endpoint: string, modelName: string): Promise<boolean> {
  const res = await fetch(`${endpoint}/api/show`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: modelName })
  });
  const data = await res.json();
  return data.capabilities?.includes('vision') ?? false;
}
```

---

## 4. 채팅 API (이미지 지원)

### 요청
```http
POST /api/chat
Content-Type: application/json

{
  "model": "gemma3:latest",
  "messages": [
    {
      "role": "user",
      "content": "이 이미지를 분석해주세요",
      "images": ["base64_encoded_image_data"]
    }
  ],
  "stream": false
}
```

### 응답
```json
{
  "model": "gemma3:latest",
  "created_at": "2025-01-10T15:30:00Z",
  "message": {
    "role": "assistant",
    "content": "이 이미지에는..."
  },
  "done": true,
  "total_duration": 5000000000,
  "eval_count": 100
}
```

### TypeScript 예시
```typescript
// 채팅 메시지 타입 (OllamaContext에서 import하여 사용)
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  images?: string[];  // base64 인코딩된 이미지 배열
}

// 채팅 응답 타입
export interface ChatResponse {
  model: string;
  created_at: string;
  message: {
    role: string;
    content: string;
  };
  done: boolean;
  total_duration?: number;
  eval_count?: number;
}

// 채팅 옵션 타입
export interface ChatOptions {
  num_ctx?: number;  // Context window 크기 (기본: 2048, 권장: 8192)
}

async function chat(
  endpoint: string,
  model: string,
  messages: ChatMessage[],
  options?: ChatOptions
): Promise<string> {
  const res = await fetch(`${endpoint}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages,
      stream: false,
      options: options ? { num_ctx: options.num_ctx } : undefined
    })
  });

  const data: ChatResponse = await res.json();
  return data.message.content;
}
```

---

## 5. 이미지 분석 예시

### 이미지 base64 변환
```typescript
// dataUrl에서 base64 추출
function extractBase64(dataUrl: string): string {
  // "data:image/png;base64,ABC123..." → "ABC123..."
  return dataUrl.split(',')[1];
}
```

### 이미지 분석 호출
```typescript
async function analyzeImage(
  endpoint: string,
  model: string,
  imageBase64: string,
  prompt: string
): Promise<string> {
  return chat(endpoint, model, [
    {
      role: 'user',
      content: prompt,
      images: [imageBase64]
    }
  ]);
}
```

### 사용 예시
```typescript
const result = await analyzeImage(
  'http://localhost:11434',
  'gemma3:latest',
  imageBase64,
  `이 이미지는 기업 정보 스크린샷입니다.
다음을 분석해주세요:
1. 이미지 유형 (채용공고, 리뷰, 재무정보 등)
2. 핵심 내용 요약
3. 주요 수치 데이터`
);
```

---

## 6. Vision 모델 목록

| 모델 | 명령어 | 특징 |
|------|--------|------|
| Gemma3 | `ollama pull gemma3` | 한국어 + 이미지, 권장 |
| LLaVA | `ollama pull llava` | 이미지 분석 전문 |
| LLaVA 1.6 | `ollama pull llava:13b` | 고해상도, 문서 인식 |
| Llama 3.2 Vision | `ollama pull llama3.2-vision` | 고성능, 영어만 |

---

## 7. 에러 처리

### 연결 실패
```typescript
try {
  const res = await fetch(`${endpoint}/api/tags`);
} catch (error) {
  // Ollama 서버 미실행
  console.error('Ollama 연결 실패:', error);
}
```

### 모델 없음
```json
{
  "error": "model 'gemma3' not found, try pulling it first"
}
```

### 타임아웃
이미지 분석은 시간이 걸릴 수 있으므로 적절한 타임아웃 설정 필요:
```typescript
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 60000); // 60초

try {
  const res = await fetch(url, { signal: controller.signal });
} finally {
  clearTimeout(timeoutId);
}
```
