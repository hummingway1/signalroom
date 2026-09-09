// packages/ai/schemas/router-schema.mjs
//
// Structured Output schema for Stage 1 (Question Router). Given the user's
// question (+ short conversation summary), the model classifies intent and
// selects ONLY the canonical data fields relevant to answering it — this is
// the mechanism that avoids sending the entire Canonical JSON on every turn.

import { QUESTION_CATEGORIES, SAJU_FIELDS, ZIWEI_FIELDS, ZIWEI_PALACE_POSITIONS } from '../../shared/categories.mjs';

export const ROUTER_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['categories', 'saju_fields', 'ziwei_fields', 'ziwei_palace_focus', 'reasoning'],
  properties: {
    categories: {
      type: 'array',
      description: '질문에 해당하는 카테고리. 복수 가능.',
      items: { type: 'string', enum: QUESTION_CATEGORIES },
      minItems: 1,
    },
    saju_fields: {
      type: 'array',
      description: '이 질문에 답하기 위해 필요한 canonical.saju의 실제 필드명만 선택.',
      items: { type: 'string', enum: SAJU_FIELDS },
    },
    ziwei_fields: {
      type: 'array',
      description: '이 질문에 답하기 위해 필요한 canonical.ziwei의 실제 필드명만 선택.',
      items: { type: 'string', enum: ZIWEI_FIELDS },
    },
    ziwei_palace_focus: {
      type: 'array',
      description: '"palaces"를 선택했을 때, 그중 실제로 관련 있는 궁만 지정 (비워두면 12궁 전체 사용).',
      items: { type: 'string', enum: ZIWEI_PALACE_POSITIONS },
    },
    reasoning: {
      type: 'string',
      description: '왜 이 필드들을 선택했는지 1~2문장 (디버깅/감사용, 사용자에게 노출하지 않음).',
    },
  },
};
