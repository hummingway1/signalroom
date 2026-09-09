// scripts/rescore-service-quality.mjs
//
// npm run rescore:service-quality
//
// Re-applies semantic validators to already-saved Q6~Q10 results — no API calls.

import { readFile, writeFile, readdir } from 'node:fs/promises';
import path from 'node:path';

import {
  checkEmpathyOpeningStructure,
  checkCitationDensity,
  checkCrossPersonSimilarity,
  classifyOrgVsIndependentLean,
  checkLeanConsistency,
  checkOverlyPositiveLanguage,
  checkBalanceGivenTensionSignal,
  checkToneActuallyApplied,
} from '../tests/service-quality/semantic-validators.mjs';

function allTextOf(fa, response) {
  return [response, fa?.saju?.interpretation, fa?.ziwei?.interpretation, fa?.cross_analysis?.common_direction, fa?.cross_analysis?.differences, fa?.cross_analysis?.overall_judgment, fa?.cross_analysis?.real_world_checks]
    .filter(Boolean)
    .join('\n');
}

const targetDir = process.argv[2] ?? './tests/real-ai/service-quality';
const entries = await readdir(targetDir, { withFileTypes: true });
const files = entries.filter((e) => e.isFile() && e.name.endsWith('.json')).map((e) => e.name);

if (files.length === 0) {
  console.log(`⚠️  ${targetDir}에 재채점할 .json 결과 파일이 없습니다.`);
  process.exit(0);
}

for (const filename of files) {
  const filePath = path.join(targetDir, filename);
  const d = JSON.parse(await readFile(filePath, 'utf-8'));
  const before = d.overall_pass;

  if (d.file === 'q6-empathy') {
    const text = allTextOf(d.full_analysis, d.response);
    const check = checkEmpathyOpeningStructure(text);
    d.semantic_validation = { overall_pass: check.pass, checks: { empathyOpeningStructure: check } };
    d.overall_pass = d.base_validation.overall_pass && check.pass;
  } else if (d.file === 'q7-specificity') {
    const texts = d.runs.map((r) => allTextOf(r.full_analysis, r.response));
    for (let i = 0; i < d.runs.length; i++) d.runs[i].citation_density = checkCitationDensity(texts[i]);
    const similarity = checkCrossPersonSimilarity(texts[0], texts[1]);
    const semPass = d.runs.every((r) => r.citation_density.pass) && similarity.pass;
    d.semantic_validation = { overall_pass: semPass, cross_person_similarity: similarity };
    d.overall_pass = d.runs.every((r) => r.base_validation.overall_pass) && semPass;
  } else if (d.file === 'q8-consistency') {
    const leans = d.runs.map((r) => classifyOrgVsIndependentLean(allTextOf(r.full_analysis, r.response)));
    for (let i = 0; i < d.runs.length; i++) d.runs[i].lean = leans[i];
    const leanConsistency = checkLeanConsistency(leans);
    d.semantic_validation = { overall_pass: leanConsistency.pass, lean_consistency: leanConsistency };
    d.overall_pass = d.runs.every((r) => r.base_validation.overall_pass) && leanConsistency.pass;
  } else if (d.file === 'q9-overpositive') {
    const text = allTextOf(d.full_analysis, d.response);
    const overlyPositive = checkOverlyPositiveLanguage(text);
    const balance = checkBalanceGivenTensionSignal(text, d.extracted_data.saju);
    const semPass = overlyPositive.pass && balance.pass;
    d.semantic_validation = { overall_pass: semPass, checks: { overlyPositiveLanguage: overlyPositive, balanceGivenTensionSignal: balance } };
    d.overall_pass = d.base_validation.overall_pass && semPass;
  } else if (d.file === 'q10-character-invariance') {
    const toneApplied = checkToneActuallyApplied(d.baseline.response, d.character.response);
    const factsUnchanged = d.baseline.gwimun_existence.pass && d.character.gwimun_existence.pass
      && d.baseline.gwimun_position.pass && d.character.gwimun_position.pass
      && d.baseline.gwimun_existence.details.actually_exists === d.character.gwimun_existence.details.actually_exists;
    d.semantic_validation = { overall_pass: factsUnchanged && toneApplied.pass, facts_unchanged_across_tone: factsUnchanged, tone_actually_applied: toneApplied };
    d.overall_pass = d.baseline.base_validation.overall_pass && d.character.base_validation.overall_pass && factsUnchanged && toneApplied.pass;
  } else {
    console.log(`[${filename}] 알 수 없는 파일 형식 — 건너뜀`);
    continue;
  }

  const after = d.overall_pass;
  console.log(`[${d.file}] ${before ? 'PASS' : 'FAIL'} -> ${after ? 'PASS' : 'FAIL'}${before !== after ? '  ⚠️ changed' : ''}`);
  await writeFile(filePath, JSON.stringify(d, null, 2), 'utf-8');
}

console.log('\n✅ 재채점 완료.');
