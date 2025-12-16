/**
 * Mock Fixture 이미지 로더
 *
 * PNG 파일 → Base64 Data URL 변환
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const FIXTURES_DIR = path.join(__dirname, '..', 'fixtures', 'generated');

/**
 * 단일 fixture 로드
 */
export function loadFixture(filename: string): string {
  const filePath = path.join(FIXTURES_DIR, filename);

  if (!fs.existsSync(filePath)) {
    throw new Error(`Fixture not found: ${filename}`);
  }

  const buffer = fs.readFileSync(filePath);
  const base64 = buffer.toString('base64');

  return `data:image/png;base64,${base64}`;
}

/**
 * 모든 fixture 로드
 */
export function loadAllFixtures(): Map<string, string> {
  const fixtures = new Map<string, string>();

  if (!fs.existsSync(FIXTURES_DIR)) {
    throw new Error(`Fixtures directory not found: ${FIXTURES_DIR}`);
  }

  const files = fs.readdirSync(FIXTURES_DIR).filter((f) => f.endsWith('.png'));

  for (const file of files) {
    fixtures.set(file, loadFixture(file));
  }

  return fixtures;
}

/**
 * Fixture 목록 조회
 */
export function listFixtures(): string[] {
  if (!fs.existsSync(FIXTURES_DIR)) {
    return [];
  }

  return fs.readdirSync(FIXTURES_DIR).filter((f) => f.endsWith('.png'));
}
