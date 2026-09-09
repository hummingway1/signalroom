// packages/shared/load-env.mjs
//
// Minimal .env loader — no external dependency. Only sets variables NOT
// already present in process.env, so real shell-exported vars always win.

import { readFile } from 'node:fs/promises';
import path from 'node:path';

export async function loadEnvFile(envPath = '.env') {
  let content;
  try {
    content = await readFile(path.resolve(envPath), 'utf-8');
  } catch {
    return; // no .env file — fine, rely on real env vars
  }
  // Windows 메모장이 "UTF-8" 저장 시 파일 맨 앞에 보이지 않는 BOM(U+FEFF)을 붙이는 경우가 있다.
  // `type .env`나 메모장 화면에는 안 보이지만, 그대로 두면 첫 번째 키 이름이
  // "\uFEFFOPENAI_API_KEY"가 되어 정확히 "OPENAI_API_KEY"와 매칭되지 않는다 — 실제 사용자 리포트로
  // 발견된 버그(파일에 키가 분명히 있는데도 "설정 안 됨"으로 나오던 문제).
  if (content.charCodeAt(0) === 0xfeff) content = content.slice(1);

  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eqIdx = line.indexOf('=');
    if (eqIdx === -1) continue;
    const key = line.slice(0, eqIdx).trim();
    let value = line.slice(eqIdx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}
