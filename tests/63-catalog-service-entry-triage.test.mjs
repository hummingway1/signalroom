// tests/63-catalog-service-entry-triage.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { isServiceEntryIntent, selectOpeningChoices } from '../packages/character/catalog-selector.mjs';
import { QUESTION_CATALOG } from '../packages/character/question-catalog.mjs';

test('1. 명시적 서비스 진입 발화는 true로 감지된다', () => {
  assert.equal(isServiceEntryIntent('사주볼래'), true);
  assert.equal(isServiceEntryIntent('사주 봐줘'), true);
  assert.equal(isServiceEntryIntent('내 사주 보고 싶어'), true);
  assert.equal(isServiceEntryIntent('사주 분석 시작'), true);
  assert.equal(isServiceEntryIntent('자미두수로 볼래'), true);
  assert.equal(isServiceEntryIntent('자미두수 봐줘'), true);
});

test('2. 실제 분석 질문은 서비스 진입으로 오분류되지 않는다', () => {
  assert.equal(isServiceEntryIntent('내 직업운은 어때?'), false);
  assert.equal(isServiceEntryIntent('나는 돈을 많이 벌 수 있을까?'), false);
  assert.equal(isServiceEntryIntent('올해 결혼운은?'), false);
  assert.equal(isServiceEntryIntent('내 사주에서 재물운이 어때?'), false);
});

test('3. 일반 대화(casual)는 서비스 진입으로 오분류되지 않는다', () => {
  assert.equal(isServiceEntryIntent('뭐해?'), false);
  assert.equal(isServiceEntryIntent('안녕'), false);
  assert.equal(isServiceEntryIntent('오늘 뭐 먹지'), false);
});

test('4. 결제/구매 관련 발화는 서비스 진입으로 오분류되지 않는다', () => {
  assert.equal(isServiceEntryIntent('결제할래'), false);
  assert.equal(isServiceEntryIntent('구매하고 싶어'), false);
});

test('5. selectOpeningChoices는 오프닝 후보로 free:true 항목만 뽑는다', () => {
  const openers = selectOpeningChoices({ catalog: QUESTION_CATALOG });
  assert.ok(openers.length > 0);
  assert.ok(openers.every((c) => c.free === true));
});

test('6. pickCatalogChoice가 free:true 항목에는 authorizeBeforeAnalysis를 null로 넘긴다', async () => {
  const source = await readFile('./apps/api/src/services/conversation-service.mjs', 'utf-8');
  assert.ok(source.includes('const authorizeBeforeAnalysis = entry.free ? null :'));
});

test('7. saju_question 경로는 isServiceEntryIntent를 authorization 정의보다 먼저 체크한다', async () => {
  const source = await readFile('./apps/api/src/services/conversation-service.mjs', 'utf-8');
  const serviceEntryIdx = source.indexOf('if (isServiceEntryIntent(text))');
  const authDefIdx = source.lastIndexOf('const authorizeBeforeAnalysis = async (routerResult) => {');
  assert.ok(serviceEntryIdx > -1 && serviceEntryIdx < authDefIdx);
});

test('8. 서비스 진입 발화는 AI 호출 없이 오프닝 선택지를 다시 반환한다', async () => {
  const source = await readFile('./apps/api/src/services/conversation-service.mjs', 'utf-8');
  const blockStart = source.indexOf('if (isServiceEntryIntent(text))');
  const blockEnd = source.indexOf('const authorizeBeforeAnalysis = async (routerResult) => {', blockStart);
  const block = source.slice(blockStart, blockEnd);
  assert.ok(block.includes('getOpeningChoices('));
  assert.ok(!block.includes('aiProvider.complete'));
});
