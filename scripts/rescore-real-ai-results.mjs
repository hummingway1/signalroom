// scripts/rescore-real-ai-results.mjs
//
// npm run rescore:real
//
// Re-applies tests/real-ai/validators.mjs to ALREADY-SAVED result files —
// no API calls, no cost, no re-running the model. Use this whenever the
// validator logic changes (e.g. the 2026-08-17 negation-aware fix for
// forbidden_certainty_phrases false positives) and you want existing
// results re-graded against the corrected rules without spending money to
// regenerate them.
//
// Usage:
//   node scripts/rescore-real-ai-results.mjs [directory]
//   (defaults to ./tests/real-ai)
//
// Overwrites each file's `validation` field in place; everything else
// (question, routing, extracted_data, usage, response, full_analysis, ...)
// is left untouched — this only re-grades, it never touches what the model
// actually said.

import { readFile, writeFile, readdir } from 'node:fs/promises';
import path from 'node:path';

import { validateRealAIResult } from '../tests/real-ai/validators.mjs';
import { SINGLE_TURN_QUESTIONS, CONVERSATION_TEST } from '../tests/real-ai/questions.mjs';
import { resolveFixture } from '../tests/real-ai/fixtures.mjs';

const SCOPE_BY_FILE = Object.fromEntries(SINGLE_TURN_QUESTIONS.map((q) => [q.file, q.scope_check]));

const targetDir = process.argv[2] ?? './tests/real-ai';

const canonicalCache = new Map();
async function loadCanonicalForFixture(fixtureId) {
  const id = fixtureId ?? 'edge_case'; // legacy files predate the fixture tag — they were all edge_case
  if (canonicalCache.has(id)) return canonicalCache.get(id);
  const fixture = resolveFixture(id);
  const canonical = JSON.parse(await readFile(fixture.path, 'utf-8'));
  canonicalCache.set(id, canonical);
  return canonical;
}

async function findResultFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await findResultFiles(fullPath)));
    } else if (entry.isFile() && entry.name.endsWith('.json')) {
      files.push(fullPath);
    }
  }
  return files;
}

const filePaths = await findResultFiles(targetDir);

if (filePaths.length === 0) {
  console.log(`⚠️  ${targetDir}에 재채점할 .json 결과 파일이 없습니다.`);
  process.exit(0);
}

let changedCount = 0;
let totalCount = 0;

for (const filePath of filePaths) {
  const content = JSON.parse(await readFile(filePath, 'utf-8'));
  const baseName = path.basename(filePath).replace(/\.json$/, '');
  const canonical = await loadCanonicalForFixture(content.fixture);

  if (Array.isArray(content.turns)) {
    // conversation file
    for (const turn of content.turns) {
      totalCount++;
      const before = turn.validation?.overall_pass;
      turn.validation = validateRealAIResult({
        analysisData: turn.full_analysis,
        routing: turn.routing,
        extracted: turn.extracted_data,
        canonical,
        expectedScope: CONVERSATION_TEST.scope_check,
      });
      const after = turn.validation.overall_pass;
      if (before !== after) changedCount++;
      console.log(`[${baseName} turn ${turn.turn}] ${before ? 'PASS' : 'FAIL'} -> ${after ? 'PASS' : 'FAIL'}${before !== after ? '  ⚠️ changed' : ''}`);
    }
  } else if (content.full_analysis) {
    totalCount++;
    const before = content.validation?.overall_pass;
    content.validation = validateRealAIResult({
      analysisData: content.full_analysis,
      routing: content.routing,
      extracted: content.extracted_data,
      canonical,
      expectedScope: SCOPE_BY_FILE[baseName] ?? 'unconstrained',
    });
    const after = content.validation.overall_pass;
    if (before !== after) changedCount++;
    console.log(`[${baseName}] ${before ? 'PASS' : 'FAIL'} -> ${after ? 'PASS' : 'FAIL'}${before !== after ? '  ⚠️ changed' : ''}`);
  } else {
    continue; // not a recognized result file — skip silently
  }

  await writeFile(filePath, JSON.stringify(content, null, 2), 'utf-8');
}

console.log(`\n✅ 재채점 완료: ${totalCount}건 중 ${changedCount}건 판정 변경.`);
