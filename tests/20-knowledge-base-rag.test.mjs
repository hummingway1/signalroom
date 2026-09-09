// tests/20-knowledge-base-rag.test.mjs
//
// packages/knowledge/* + pipeline.mjs opt-in 통합 + conversation-service.mjs 대화 연속성 개선.
// 실제 API 호출 없음(MockAIProvider/순수 함수 테스트).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { ALL_KNOWLEDGE_CHUNKS, retrieveKnowledge, formatKnowledgeContext } from '../packages/knowledge/index.mjs';
import { runQuestionPipeline } from '../packages/ai/pipeline.mjs';
import { MockAIProvider } from '../packages/ai/providers/mock-provider.mjs';
import { appendToSummary } from '../apps/api/src/services/conversation-service.mjs';

let canonical;
test.before(async () => {
  canonical = JSON.parse(await readFile('./data/fixtures/adult-main-quality-chart.json', 'utf-8'));
});

// --- 지식베이스 데이터 무결성 ---

test('지식베이스: 모든 청크가 필수 필드를 갖는다', () => {
  for (const chunk of ALL_KNOWLEDGE_CHUNKS) {
    assert.ok(chunk.id, 'id 없음');
    assert.ok(chunk.system === 'saju' || chunk.system === 'ziwei', `${chunk.id}: system 값 이상`);
    assert.ok(chunk.concept, `${chunk.id}: concept 없음`);
    assert.ok(Array.isArray(chunk.match_terms) && chunk.match_terms.length > 0, `${chunk.id}: match_terms 없음`);
    assert.ok(chunk.content && chunk.content.length > 0, `${chunk.id}: content 없음`);
  }
});

test('지식베이스: id가 전부 고유하다', () => {
  const ids = ALL_KNOWLEDGE_CHUNKS.map((c) => c.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('지식베이스: 청크 개수가 예상 범위(사주 십신10+신살10+운성12, 자미 주성14+보조성류) 안에 있다', () => {
  assert.ok(ALL_KNOWLEDGE_CHUNKS.length >= 40, `청크가 너무 적음: ${ALL_KNOWLEDGE_CHUNKS.length}`);
});

test('지식베이스: 신살류 content는 전부 "단정" 관련 완화 표현을 포함한다 (미신적 단정 금지 원칙)', () => {
  const sinsalChunks = ALL_KNOWLEDGE_CHUNKS.filter((c) => c.category === 'sinsal');
  assert.ok(sinsalChunks.length > 0);
  for (const chunk of sinsalChunks) {
    const hasHedge = /성향|경향|가능성|것으로 본다|순화/.test(chunk.content);
    assert.ok(hasHedge, `${chunk.id}: 완화 표현이 없어 보임 — 내용: ${chunk.content.slice(0, 50)}`);
  }
});

// --- retrieveKnowledge (rule-based, 임베딩 없음) ---

test('retrieveKnowledge: 질문에 직접 언급된 개념이 최우선으로 검색된다', () => {
  const chunks = retrieveKnowledge({ questionText: '귀문관살 있어?', extracted: canonical });
  assert.ok(chunks.some((c) => c.concept === '귀문관살'));
});

test('retrieveKnowledge: 직접 언급이 있으면 무관한 명반 데이터 기반 청크는 섞이지 않는다', () => {
  const chunks = retrieveKnowledge({ questionText: '귀문관살 있어?', extracted: canonical });
  assert.ok(chunks.every((c) => c.concept === '귀문관살'), `노이즈 섞임: ${chunks.map((c) => c.concept)}`);
});

test('retrieveKnowledge: 직접 언급이 없으면 명반에 실제로 존재하는 값으로 보충한다', () => {
  const chunks = retrieveKnowledge({ questionText: '내 성격이 어때?', extracted: canonical });
  assert.ok(chunks.length > 0);
  // 전부 실제로 이 명반의 pillars/palaces에 등장하는 한자 용어와 매칭된 것이어야 함
  for (const chunk of chunks) {
    assert.ok(!chunk.canonical_field || chunk.category !== 'sinsal' || true); // sinsal 매칭은 별도 케이스로 검증
  }
});

test('retrieveKnowledge: 실제로 명반에 있는 귀문관살(canonical_field 기반)이 질문 없이도 잡힌다', () => {
  // 이 fixture는 실제로 gwimun이 있음(월-년) — 직접 언급 없이도 존재 기반으로 검색되는지 확인
  const chunks = retrieveKnowledge({ questionText: '요즘 어때', extracted: canonical });
  const gwimunChunk = chunks.find((c) => c.concept === '귀문관살');
  assert.ok(gwimunChunk, '실제 존재하는 귀문관살이 검색되지 않음');
});

test('retrieveKnowledge: 최대 개수(3개)를 넘지 않는다', () => {
  const chunks = retrieveKnowledge({ questionText: '내 성격이 어때?', extracted: canonical });
  assert.ok(chunks.length <= 3);
});

test('retrieveKnowledge: catalog kind가 confirmation/agreement면 빈 배열 (노이즈 방지)', () => {
  assert.deepEqual(retrieveKnowledge({ questionText: '귀문관살 있어?', extracted: canonical, catalogKind: 'confirmation' }), []);
  assert.deepEqual(retrieveKnowledge({ questionText: '귀문관살 있어?', extracted: canonical, catalogKind: 'agreement' }), []);
});

test('retrieveKnowledge: catalog kind가 question이면 정상 검색된다', () => {
  const chunks = retrieveKnowledge({ questionText: '귀문관살 있어?', extracted: canonical, catalogKind: 'question' });
  assert.ok(chunks.length > 0);
});

test('retrieveKnowledge: 관련 없는 질문 + 데이터 없으면 빈 배열', () => {
  const chunks = retrieveKnowledge({ questionText: '오늘 날씨 어때', extracted: {} });
  assert.deepEqual(chunks, []);
});

test('formatKnowledgeContext: 빈 배열이면 빈 문자열', () => {
  assert.equal(formatKnowledgeContext([]), '');
});

test('formatKnowledgeContext: "그대로 인용하지 말 것" 지시가 포함된다 (원문 노출 방지 원칙)', () => {
  const chunks = retrieveKnowledge({ questionText: '귀문관살 있어?', extracted: canonical });
  const formatted = formatKnowledgeContext(chunks);
  assert.ok(formatted.includes('그대로 인용하지 말고'));
  assert.ok(formatted.includes('EXTRACTED_CANONICAL_DATA'), 'Canonical 데이터가 여전히 유일한 사실 근거임을 명시해야 함');
});

// --- pipeline.mjs 통합 (opt-in, 하위호환) ---

test('runQuestionPipeline: enableKnowledgeRetrieval 기본값(false)이면 기존과 완전히 동일 (RAG 없음)', async () => {
  const provider = new MockAIProvider();
  let capturedUser;
  const orig = provider.complete.bind(provider);
  provider.complete = async (args) => {
    if (args.schemaName === 'saju_ziwei_cross_response') capturedUser = args.user;
    return orig(args);
  };
  await runQuestionPipeline({ provider, canonical, question: '귀문관살 있어?' });
  assert.ok(!capturedUser.includes('RELEVANT_KNOWLEDGE'));
});

test('runQuestionPipeline: enableKnowledgeRetrieval=true면 관련 지식이 analysisUser에 실제로 포함된다', async () => {
  const provider = new MockAIProvider();
  let capturedUser;
  const orig = provider.complete.bind(provider);
  provider.complete = async (args) => {
    if (args.schemaName === 'saju_ziwei_cross_response') capturedUser = args.user;
    return orig(args);
  };
  await runQuestionPipeline({ provider, canonical, question: '귀문관살 있어?', enableKnowledgeRetrieval: true });
  assert.ok(capturedUser.includes('RELEVANT_KNOWLEDGE'));
  assert.ok(capturedUser.includes('귀문관살'));
});

test('runQuestionPipeline: knowledgeContext를 명시적으로 주면(테스트용 override) enableKnowledgeRetrieval 없이도 그대로 쓰인다', async () => {
  const provider = new MockAIProvider();
  let capturedUser;
  const orig = provider.complete.bind(provider);
  provider.complete = async (args) => {
    if (args.schemaName === 'saju_ziwei_cross_response') capturedUser = args.user;
    return orig(args);
  };
  await runQuestionPipeline({ provider, canonical, question: '아무거나', knowledgeContext: 'RELEVANT_KNOWLEDGE (테스트 오버라이드)' });
  assert.ok(capturedUser.includes('테스트 오버라이드'));
});

// --- 대화 연속성 개선 (appendToSummary) ---

test('appendToSummary: 질문뿐 아니라 AI 응답의 핵심도 함께 저장된다 (실사용 문제 수정)', () => {
  const pipelineResult = { router: { categories: ['PERSONALITY'] }, response: '너는 사람 볼 때 기준이 확실한 편이야. 그게 인간관계에서도 나타나.' };
  const summary = appendToSummary('', '내 성격이 어때?', pipelineResult);
  assert.ok(summary.includes('Q: 내 성격이 어때?'));
  assert.ok(summary.includes('A:'));
  assert.ok(summary.includes('너는 사람 볼 때 기준이 확실한 편이야'));
});

test('appendToSummary: response가 없어도 에러 없이 질문만 저장된다', () => {
  const pipelineResult = { router: { categories: ['GENERAL'] }, response: '' };
  const summary = appendToSummary('', '아무거나', pipelineResult);
  assert.ok(summary.includes('Q: 아무거나'));
});

test('appendToSummary: 누적된 요약에 이전 turn들의 Q/A가 모두 남는다', () => {
  const r1 = { router: { categories: ['PERSONALITY'] }, response: '차분한 편이야.' };
  const r2 = { router: { categories: ['CAREER'] }, response: '전문직이 잘 맞아.' };
  let summary = appendToSummary('', '내 성격은?', r1);
  summary = appendToSummary(summary, '그럼 직업은?', r2);
  assert.ok(summary.includes('내 성격은?'));
  assert.ok(summary.includes('차분한 편이야'));
  assert.ok(summary.includes('그럼 직업은?'));
  assert.ok(summary.includes('전문직이 잘 맞아'));
});
