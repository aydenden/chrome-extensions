/**
 * Ollama 스트리밍 응답 파서
 * thinking과 content를 분리하여 처리하고, JSON 추출 기능 제공
 */

// ============================================================================
// JSON Extraction
// ============================================================================

/**
 * content에서 JSON 추출
 * format 파라미터 없이 프롬프트로 JSON 유도 시 사용
 * 여러 전략을 순차적으로 시도하여 최대한 JSON 추출 성공률을 높임
 */
export function extractJsonFromContent(content: string): object | null {
  if (!content || typeof content !== 'string') {
    return null;
  }

  const trimmed = content.trim();

  // 1. JSON 코드 블록 추출 시도 (```json ... ```)
  const jsonBlockMatch = trimmed.match(/```json\s*([\s\S]*?)\s*```/);
  if (jsonBlockMatch) {
    try {
      return JSON.parse(jsonBlockMatch[1].trim());
    } catch {
      // 파싱 실패 시 다음 방법 시도
    }
  }

  // 2. 일반 코드 블록 추출 시도 (``` ... ```)
  const codeBlockMatch = trimmed.match(/```\s*([\s\S]*?)\s*```/);
  if (codeBlockMatch) {
    try {
      return JSON.parse(codeBlockMatch[1].trim());
    } catch {
      // 파싱 실패 시 다음 방법 시도
    }
  }

  // 3. 직접 JSON 파싱 시도
  try {
    return JSON.parse(trimmed);
  } catch {
    // 파싱 실패 시 다음 방법 시도
  }

  // 4. 첫 번째 { ... } 또는 [ ... ] 패턴 찾기
  const jsonMatch = trimmed.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[1]);
    } catch {
      // 파싱 실패
    }
  }

  // 5. 마지막 시도: 줄바꿈으로 구분된 JSON 찾기
  const lines = trimmed.split('\n');
  for (const line of lines) {
    const trimmedLine = line.trim();
    if (trimmedLine.startsWith('{') || trimmedLine.startsWith('[')) {
      try {
        return JSON.parse(trimmedLine);
      } catch {
        // 계속 시도
      }
    }
  }

  return null;
}

// ============================================================================
// Stream Line Parser
// ============================================================================

/** 파싱된 스트림 라인 */
export interface ParsedStreamLine {
  thinking?: string;
  content?: string;
  done: boolean;
}

/**
 * Ollama 스트리밍 응답 라인 파싱
 * NDJSON 형식의 한 줄을 파싱하여 thinking/content 분리
 */
export function parseStreamLine(line: string): ParsedStreamLine | null {
  if (!line || !line.trim()) {
    return null;
  }

  try {
    const json = JSON.parse(line);
    return {
      thinking: json.message?.thinking,
      content: json.message?.content,
      done: json.done ?? false,
    };
  } catch {
    return null;
  }
}

// ============================================================================
// Buffer Management
// ============================================================================

/**
 * 스트림 버퍼 관리 클래스
 * 멀티바이트 문자(한글 등)가 청크 경계에서 잘리는 문제 방지
 */
export class StreamBuffer {
  private buffer = '';
  private decoder = new TextDecoder('utf-8');

  /**
   * 청크를 버퍼에 추가하고 완성된 라인들 반환
   */
  append(chunk: Uint8Array): string[] {
    this.buffer += this.decoder.decode(chunk, { stream: true });
    const lines = this.buffer.split('\n');
    // 마지막 불완전한 라인은 버퍼에 유지
    this.buffer = lines.pop() || '';
    return lines.filter(line => line.trim());
  }

  /**
   * 남은 버퍼 내용 반환 및 초기화
   */
  flush(): string {
    const remaining = this.buffer;
    this.buffer = '';
    return remaining;
  }
}
