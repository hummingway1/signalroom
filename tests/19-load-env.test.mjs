// tests/19-load-env.test.mjs
//
// packages/shared/load-env.mjs 회귀 테스트. 실제 사용자 리포트로 발견된 버그: Windows 메모장이
// ".env"를 "UTF-8" 인코딩으로 저장할 때 파일 맨 앞에 보이지 않는 BOM(U+FEFF)을 붙이는 경우가 있고,
// 이걸 그대로 두면 첫 번째 키 이름이 오염되어(예: "\uFEFFOPENAI_API_KEY") 정확히 "OPENAI_API_KEY"와
// 매칭되지 않는다. `type .env`나 메모장 화면에는 전혀 안 보여서 사용자가 파일 내용을 직접 봐도
// 문제를 못 찾는 매우 혼란스러운 버그였다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFile, rm, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { loadEnvFile } from '../packages/shared/load-env.mjs';

let tmpDir;
test.before(async () => {
  tmpDir = await mkdtemp(path.join(tmpdir(), 'load-env-test-'));
});
test.after(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

async function writeEnvFile(name, content) {
  const filePath = path.join(tmpDir, name);
  await writeFile(filePath, content, 'utf-8');
  return filePath;
}

test('BOM 없는 정상 .env 파일은 그대로 읽힌다', async () => {
  const filePath = await writeEnvFile('normal.env', 'OPENAI_API_KEY=sk-test-normal\nOPENAI_CASUAL_MODEL=gpt-5-nano\n');
  delete process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_CASUAL_MODEL;
  await loadEnvFile(filePath);
  assert.equal(process.env.OPENAI_API_KEY, 'sk-test-normal');
  assert.equal(process.env.OPENAI_CASUAL_MODEL, 'gpt-5-nano');
  delete process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_CASUAL_MODEL;
});

test('실제 버그 재현: UTF-8 BOM이 첫 줄 앞에 있어도 첫 번째 키가 정확히 읽힌다', async () => {
  const contentWithBom = '\uFEFFOPENAI_API_KEY=sk-test-bom\nOPENAI_CASUAL_MODEL=gpt-5-nano\n';
  const filePath = await writeEnvFile('with-bom.env', contentWithBom);
  delete process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_CASUAL_MODEL;
  await loadEnvFile(filePath);
  assert.equal(process.env.OPENAI_API_KEY, 'sk-test-bom', 'BOM 때문에 첫 번째 키가 누락되면 안 됨');
  assert.equal(process.env.OPENAI_CASUAL_MODEL, 'gpt-5-nano');
  delete process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_CASUAL_MODEL;
});

test('BOM이 있는 파일에서 오염된 키 이름("\\uFEFFOPENAI_API_KEY")으로는 설정되지 않는다', async () => {
  const contentWithBom = '\uFEFFOPENAI_API_KEY=sk-test-bom2\n';
  const filePath = await writeEnvFile('with-bom2.env', contentWithBom);
  delete process.env.OPENAI_API_KEY;
  await loadEnvFile(filePath);
  const polluted = Object.keys(process.env).find((k) => k.includes('OPENAI_API_KEY') && k !== 'OPENAI_API_KEY');
  assert.equal(polluted, undefined, 'BOM이 붙은 오염된 키 이름으로 별도 환경변수가 생기면 안 됨');
  delete process.env.OPENAI_API_KEY;
});

test('이미 설정된 실제 환경변수(shell export)는 .env 파일 값보다 항상 우선한다', async () => {
  const filePath = await writeEnvFile('override.env', 'OPENAI_API_KEY=sk-from-file\n');
  process.env.OPENAI_API_KEY = 'sk-from-shell';
  await loadEnvFile(filePath);
  assert.equal(process.env.OPENAI_API_KEY, 'sk-from-shell');
  delete process.env.OPENAI_API_KEY;
});

test('존재하지 않는 .env 파일 경로는 에러 없이 조용히 넘어간다', async () => {
  await assert.doesNotReject(() => loadEnvFile(path.join(tmpDir, 'nonexistent.env')));
});

test('따옴표로 감싼 값은 따옴표가 제거된다', async () => {
  const filePath = await writeEnvFile('quoted.env', 'OPENAI_MODEL="gpt-5.6"\n');
  delete process.env.OPENAI_MODEL;
  await loadEnvFile(filePath);
  assert.equal(process.env.OPENAI_MODEL, 'gpt-5.6');
  delete process.env.OPENAI_MODEL;
});
