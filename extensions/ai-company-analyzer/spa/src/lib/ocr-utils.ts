export function cleanOCRText(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[^\w\s가-힣ㄱ-ㅎㅏ-ㅣ.,!?@#$%^&*()\-+=\[\]{}|;:'\"<>/\\]/g, '')
    .replace(/^\s*[\r\n]/gm, '');
}

export function filterByConfidence(
  words: Array<{ text: string; confidence: number }>,
  minConfidence: number = 60
): string {
  return words
    .filter(w => w.confidence >= minConfidence)
    .map(w => w.text)
    .join(' ');
}
