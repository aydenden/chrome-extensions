/**
 * Qwen3-VL 최적화 이미지 전처리
 * - 32 배수 정렬 (패치 단위)
 * - max_pixels 제한 (약 200만 픽셀, 텍스트/숫자 인식 가능)
 * - JPEG 압축 (quality 0.92, 선명도 유지)
 */

const PATCH_SIZE = 32;  // Qwen3-VL 패치 단위
const MAX_PIXELS = 2073600;  // 약 1440x1440 - 텍스트/숫자 인식 가능
const MIN_PIXELS = 200704;   // 약 448x448
const JPEG_QUALITY = 0.92;   // 텍스트 선명도 유지

export interface OptimizeResult {
  base64: string;
  originalSize: { width: number; height: number };
  optimizedSize: { width: number; height: number };
  compressionRatio: number;
}

/**
 * VLM 분석을 위한 이미지 최적화
 * @param base64 원본 Base64 이미지 (data:image/... 프리픽스 있어도 됨)
 * @returns 최적화된 Base64 (프리픽스 없음)
 */
export async function optimizeImageForVLM(base64: string): Promise<string> {
  const result = await optimizeImageWithInfo(base64);
  return result.base64;
}

/**
 * VLM 분석을 위한 이미지 최적화 (상세 정보 포함)
 */
export async function optimizeImageWithInfo(base64: string): Promise<OptimizeResult> {
  // 1. Base64 → ImageBitmap
  const blob = base64ToBlob(base64);
  const bitmap = await createImageBitmap(blob);
  const originalSize = { width: bitmap.width, height: bitmap.height };

  // 2. 스마트 리사이징 (32 배수 정렬)
  const optimizedSize = calculateOptimalSize(
    bitmap.width, bitmap.height, MIN_PIXELS, MAX_PIXELS, PATCH_SIZE
  );

  // 3. Canvas로 리사이징 + JPEG 압축
  const canvas = document.createElement('canvas');
  canvas.width = optimizedSize.width;
  canvas.height = optimizedSize.height;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, optimizedSize.width, optimizedSize.height);

  // 4. JPEG Base64 반환 (data:image/jpeg;base64, 제거)
  const optimizedBase64 = canvas.toDataURL('image/jpeg', JPEG_QUALITY).split(',')[1];

  // 원본 크기 추정 (Base64 → 바이트)
  const originalBytes = getBase64Size(base64);
  const optimizedBytes = getBase64Size(optimizedBase64);

  return {
    base64: optimizedBase64,
    originalSize,
    optimizedSize,
    compressionRatio: originalBytes / optimizedBytes
  };
}

function base64ToBlob(base64: string): Blob {
  // data:image/xxx;base64, 프리픽스 처리
  const base64Data = base64.includes(',') ? base64.split(',')[1] : base64;
  const byteString = atob(base64Data);
  const arrayBuffer = new ArrayBuffer(byteString.length);
  const uint8Array = new Uint8Array(arrayBuffer);

  for (let i = 0; i < byteString.length; i++) {
    uint8Array[i] = byteString.charCodeAt(i);
  }

  return new Blob([uint8Array], { type: 'image/jpeg' });
}

function calculateOptimalSize(
  origW: number, origH: number,
  minPixels: number, maxPixels: number,
  patchSize: number
): { width: number; height: number } {
  const pixels = origW * origH;
  let scale = 1;

  if (pixels > maxPixels) {
    scale = Math.sqrt(maxPixels / pixels);
  } else if (pixels < minPixels) {
    scale = Math.sqrt(minPixels / pixels);
  }

  // 패치 단위(32)로 정렬
  const width = Math.round((origW * scale) / patchSize) * patchSize;
  const height = Math.round((origH * scale) / patchSize) * patchSize;

  return {
    width: Math.max(patchSize, width),
    height: Math.max(patchSize, height)
  };
}

function getBase64Size(base64: string): number {
  const base64Data = base64.includes(',') ? base64.split(',')[1] : base64;
  return Math.ceil(base64Data.length * 0.75);
}
