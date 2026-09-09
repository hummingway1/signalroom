// scripts/rescore-targeted-quality.mjs
//
// npm run rescore:targeted
//
// Re-applies base + semantic validators to already-saved targeted-quality results —
// no API calls, no cost. Mirrors scripts/rescore-real-ai-results.mjs but for the
// targeted-quality file format (base_validation + semantic_validation separately).

import { readFile, writeFile, readdir } from 'node:fs/promises';
import path from 'node:path';

import { validateRealAIResult } from '../tests/real-ai/validators.mjs';
import { deriveExpectedValues } from '../tests/targeted-quality/expected-values.mjs';
import {
  checkAnnualYearAccuracy,
  checkAnnualTenGodAndStageConsistency,
  checkGwimunPositionAccuracy,
  checkGwimunExistenceConsistency,
  checkDaewoonAnnualLink,
  checkNoUnnecessaryAnnualExtraction,
} from '../tests/targeted-quality/semantic-validators.mjs';
import { TARGETED_QUALITY_QUESTIONS } from '../tests/targeted-quality/questions.mjs';
import { resolveFixture } from '../tests/real-ai/fixtures.mjs';

const SEMANTIC_CHECK_FNS = {
  annualYearAccuracy: (text, expected) => checkAnnualYearAccuracy(text, expected),
  annualTenGodAndStage: (text, expected) => checkAnnualTenGodAndStageConsistency(text, expected),
  gwimunPosition: (text, expected) => checkGwimunPositionAccuracy(text, expected),
  gwimunExistence: (text, expected) => checkGwimunExistenceConsistency(text, expected),
  daewoonAnnualLink: (text, expected) => checkDaewoonAnnualLink(text, expected),
};

const SCOPE_BY_FILE = Object.fromEntries(TARGETED_QUALITY_QUESTIONS.map((q) => [q.file, q.scopeCheck]));

const targetDir = process.argv[2] ?? './tests/real-ai/targeted-quality';
const canonical = JSON.parse(await readFile(resolveFixture('main_quality').path, 'utf-8'));
const expected = deriveExpectedValues(canonical, { targetYear: 2027 });

const entries = await readdir(targetDir, { withFileTypes: true });
const files = entries.filter((e) => e.isFile() && e.name.endsWith('.json')).map((e) => e.name);

if (files.length === 0) {
  console.log(`⚠️  ${targetDir}에 재채점할 .json 결과 파일이 없습니다.`);
  process.exit(0);
}

let changedCount = 0;

for (const filename of files) {
  const filePath = path.join(targetDir, filename);
  const content = JSON.parse(await readFile(filePath, 'utf-8'));
  const baseName = filename.replace(/\.json$/, '');
  const q = TARGETED_QUALITY_QUESTIONS.find((qq) => qq.file === baseName);
  if (!q) {
    console.log(`[${baseName}] questions.mjs에 없는 파일 — 건너뜀`);
    continue;
  }

  const before = content.overall_pass;

  const allText = [
    content.response,
    content.full_analysis?.saju?.interpretation,
    content.full_analysis?.ziwei?.interpretation,
    content.full_analysis?.cross_analysis?.common_direction,
    content.full_analysis?.cross_analysis?.differences,
    content.full_analysis?.cross_analysis?.overall_judgment,
    content.full_analysis?.cross_analysis?.real_world_checks,
  ].filter(Boolean).join('\n');

  content.base_validation = validateRealAIResult({
    analysisData: content.full_analysis,
    routing: content.routing,
    extracted: content.extracted_data,
    canonical,
    expectedScope: SCOPE_BY_FILE[baseName] ?? 'unconstrained',
  });

  const semanticChecks = {};
  for (const checkName of q.semanticChecks) {
    semanticChecks[checkName] = checkName === 'noUnnecessaryAnnualExtraction'
      ? checkNoUnnecessaryAnnualExtraction(content.extracted_data.saju, allText)
      : SEMANTIC_CHECK_FNS[checkName](allText, expected);
  }
  const allSemanticPass = Object.values(semanticChecks).every((c) => c.pass);
  content.semantic_validation = { overall_pass: allSemanticPass, checks: semanticChecks };
  content.overall_pass = content.base_validation.overall_pass && allSemanticPass;

  const after = content.overall_pass;
  if (before !== after) changedCount++;
  console.log(`[${baseName}] ${before ? 'PASS' : 'FAIL'} -> ${after ? 'PASS' : 'FAIL'}${before !== after ? '  ⚠️ changed' : ''}`);

  await writeFile(filePath, JSON.stringify(content, null, 2), 'utf-8');
}

console.log(`\n✅ 재채점 완료: ${files.length}건 중 ${changedCount}건 판정 변경.`);
