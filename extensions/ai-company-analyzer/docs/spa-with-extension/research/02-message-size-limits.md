# 메시지 크기 제한 기술 조사

## 개요

Chrome Extension ↔ SPA 간 `chrome.runtime.sendMessage` 사용 시 메시지 크기 제한 조사.

## 1. 크기 제한

### 1.1 공식 문서

Chrome 공식 문서에는 **명시적인 크기 제한이 없음**.

### 1.2 실제 테스트 결과 (커뮤니티)

| 크기 | 결과 |
|------|------|
| 1MB | 문제 없음 |
| 10MB | 문제 없음 |
| 50MB | 대부분 성공 |
| 100MB+ | 불안정, 타임아웃 가능 |

### 1.3 권장 크기

- **안전**: 5MB 이하
- **권장**: 10MB 이하
- **최대**: 50MB (보장 안 됨)

## 2. Base64 인코딩 오버헤드

### 2.1 왜 Base64가 필요한가?

`chrome.runtime.sendMessage`는 **JSON 직렬화** 사용:
- Binary 데이터 (Blob, ArrayBuffer) 직접 전송 불가
- Base64 문자열로 변환 필요

### 2.2 오버헤드 계산

```
Base64 인코딩: 원본 크기 × 1.33 (약 33% 증가)

예시:
- 3MB 이미지 → 4MB Base64 문자열
- 10MB 이미지 → 13.3MB Base64 문자열
```

### 2.3 예시 코드

```typescript
// Blob → Base64
async function blobToBase64(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Base64 → Blob
function base64ToBlob(base64: string, mimeType: string): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mimeType });
}
```

## 3. 대용량 데이터 전송 전략

### 3.1 Option A: ID 기반 조회 (권장)

```typescript
// Extension에서 이미지 저장 시 ID 반환
// SPA에서 ID로 이미지 요청

// Step 1: 이미지 목록 조회 (메타데이터만)
const images = await sendToExtension({
  type: 'GET_IMAGES',
  payload: { companyId: 'abc123' }
});
// images: [{ id: 'img1', size: 3000000, ... }, ...]

// Step 2: 개별 이미지 조회
const imageData = await sendToExtension({
  type: 'GET_IMAGE_BLOB',
  payload: { imageId: 'img1' }
});
// imageData: { base64: 'iVBORw0...', mimeType: 'image/png' }
```

**장점:**
- 필요한 이미지만 전송
- 메모리 효율적
- 에러 시 개별 재시도 가능

### 3.2 Option B: 청킹 (Chunking)

```typescript
// Extension에서 청크로 분할
const CHUNK_SIZE = 1024 * 1024; // 1MB

async function sendLargeData(data: string, chunkSize = CHUNK_SIZE) {
  const totalChunks = Math.ceil(data.length / chunkSize);
  const transferId = crypto.randomUUID();

  for (let i = 0; i < totalChunks; i++) {
    const chunk = data.slice(i * chunkSize, (i + 1) * chunkSize);
    await sendToExtension({
      type: 'CHUNK',
      payload: {
        transferId,
        chunkIndex: i,
        totalChunks,
        data: chunk,
      }
    });
  }

  return transferId;
}

// SPA에서 청크 조립
const pendingTransfers = new Map<string, string[]>();

function handleChunk(message: ChunkMessage) {
  const { transferId, chunkIndex, totalChunks, data } = message.payload;

  if (!pendingTransfers.has(transferId)) {
    pendingTransfers.set(transferId, new Array(totalChunks).fill(null));
  }

  const chunks = pendingTransfers.get(transferId)!;
  chunks[chunkIndex] = data;

  // 모든 청크 수신 확인
  if (chunks.every(c => c !== null)) {
    const fullData = chunks.join('');
    pendingTransfers.delete(transferId);
    return fullData;
  }
}
```

**장점:**
- 매우 큰 데이터도 전송 가능
- 진행률 표시 가능

**단점:**
- 구현 복잡
- 오류 복구 어려움

### 3.3 Option C: 스트리밍 (Port 사용)

```typescript
// Extension에서
const port = chrome.runtime.connectExternal.addListener((port) => {
  const imageData = getImageData(message.imageId);
  const chunks = splitIntoChunks(imageData, 512 * 1024); // 512KB

  for (const chunk of chunks) {
    port.postMessage({ type: 'CHUNK', data: chunk });
  }
  port.postMessage({ type: 'END' });
});

// SPA에서
const port = chrome.runtime.connect(EXTENSION_ID);
let receivedData = '';

port.onMessage.addListener((msg) => {
  if (msg.type === 'CHUNK') {
    receivedData += msg.data;
  } else if (msg.type === 'END') {
    processImage(receivedData);
    port.disconnect();
  }
});

port.postMessage({ type: 'REQUEST_IMAGE', imageId: 'img1' });
```

## 4. Transferable Objects

### 4.1 지원 여부

`chrome.runtime.sendMessage`는 **Transferable Objects 미지원**:
- ArrayBuffer 직접 전송 불가
- SharedArrayBuffer 불가
- 모든 데이터는 JSON 직렬화됨

### 4.2 대안

Content Script ↔ 웹페이지 통신(`postMessage`)에서는 Transferable 지원:
```typescript
// Content Script에서
window.postMessage({ type: 'DATA', buffer }, '*', [buffer]);
```

하지만 우리 아키텍처에서는 `externally_connectable`을 사용하므로 해당 없음.

## 5. 메모리 고려사항

### 5.1 Service Worker 메모리 제한

- Chrome Extension Service Worker: **약 128MB** (추정)
- 대용량 이미지 여러 개 동시 처리 시 OOM 가능

### 5.2 권장 사항

```typescript
// 처리 후 즉시 메모리 해제
async function processImage(imageId: string) {
  const blob = await getImageBlob(imageId);
  const base64 = await blobToBase64(blob);

  // blob 참조 해제
  // (자동 GC되지만 명시적 해제 권장)

  return { base64, mimeType: blob.type };
}
```

## 6. 최종 권장 전략

### 6.1 우리 프로젝트에 적합한 방식

**ID 기반 조회** 권장:

1. Extension이 스크린샷 캡처 시 IndexedDB에 저장
2. SPA에서 이미지 목록 요청 (메타데이터만)
3. 필요한 이미지를 ID로 개별 요청
4. 분석 결과를 Extension으로 전송 (텍스트, 작은 크기)

### 6.2 데이터 흐름

```
[Extension]                         [SPA]
    │                                  │
    │  ← GET_COMPANIES                │
    │  → { companies: [...] }         │
    │                                  │
    │  ← GET_IMAGES { companyId }     │
    │  → { images: [meta...] }        │ (메타데이터만)
    │                                  │
    │  ← GET_IMAGE_BLOB { imageId }   │
    │  → { base64, mimeType }         │ (개별 이미지)
    │                                  │
    │  ← SAVE_ANALYSIS { result }     │ (분석 결과)
    │  → { success: true }            │
```

### 6.3 예상 크기

| 데이터 | 예상 크기 |
|--------|----------|
| 회사 목록 | ~10KB |
| 이미지 메타 목록 | ~50KB |
| 개별 이미지 (Base64) | 1~5MB |
| 분석 결과 | ~10KB |

모든 전송이 **10MB 이하**로 안전한 범위.

## 7. 참고 자료

- [Chrome Extension Message Passing](https://developer.chrome.com/docs/extensions/mv3/messaging/)
- [Transferable Objects - MDN](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Transferable_objects)
- [Base64 Encoding](https://developer.mozilla.org/en-US/docs/Glossary/Base64)

## 8. 결론

- 명시적 크기 제한 없지만 **10MB 이하 권장**
- Base64 인코딩으로 **33% 오버헤드** 발생
- **ID 기반 조회** 방식이 가장 안전하고 효율적
- 청킹은 복잡도 대비 이점이 적음
