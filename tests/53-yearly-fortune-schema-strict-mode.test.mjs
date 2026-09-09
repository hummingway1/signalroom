// tests/53-yearly-fortune-schema-strict-mode.test.mjs
//
// Phase 11에서 실제 OpenAI API 호출로 발견한 버그의 회귀 테스트. OpenAI의 structured outputs
// strict 모드는 "선택적 필드는 required에서 뺀다"는 일반 JSON Schema 관례를 지원하지 않는다 —
// 모든 property가 반드시 required 배열에 포함되어야 하고, 선택성은 nullable 타입으로만
// 표현해야 한다. chart_interaction이 required에서 빠져 있어서 8/8 실제 API 호출이 전부
// HTTP 400으로 실패했었다(콘텐츠 품질 검증 자체가 불가능했던 실제 사건).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { YEARLY_FORTUNE_RESULT_SCHEMA } from '../packages/character/yearly-fortune-prompt.mjs';

test('YEARLY_FORTUNE_RESULT_SCHEMA — properties의 모든 키가 required 배열에 포함되어야 한다(OpenAI strict mode 요구사항)', () => {
  const propertyKeys = Object.keys(YEARLY_FORTUNE_RESULT_SCHEMA.properties);
  const missing = propertyKeys.filter((key) => !YEARLY_FORTUNE_RESULT_SCHEMA.required.includes(key));
  assert.deepEqual(missing, [], `다음 속성이 required에서 빠져 있으면 실제 OpenAI 호출이 HTTP 400으로 전부 실패한다: ${missing.join(', ')}`);
});

test('chart_interaction은 nullable 타입으로 선택성을 표현한다(required에서 빼는 방식이 아니라)', () => {
  const field = YEARLY_FORTUNE_RESULT_SCHEMA.properties.chart_interaction;
  assert.ok(Array.isArray(field.type) && field.type.includes('null'), 'chart_interaction 타입은 null을 포함해야 함(BASIC 결과에서는 null로 채워짐)');
  assert.ok(YEARLY_FORTUNE_RESULT_SCHEMA.required.includes('chart_interaction'));
});
