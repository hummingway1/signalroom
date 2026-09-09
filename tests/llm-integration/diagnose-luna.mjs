// tests/llm-integration/diagnose-luna.mjs
//
// gpt-5.6-luna(OPENAI_CHILD_COACH_MODEL) 호출 실패 원인을 딱 1회 호출로 확인하는 최소 진단
// 스크립트. 서버를 띄우지 않고, 96개 질문 러너도 돌리지 않는다 — provider.complete()를 직접
// 한 번만 호출한다. API 키/Authorization/개인정보/전체 request body는 절대 출력하지 않는다.
//
// 실행: node tests/llm-integration/diagnose-luna.mjs

import { loadEnvFile } from '../../packages/shared/load-env.mjs';
import { OpenAIProvider } from '../../packages/ai/providers/openai-provider.mjs';
import { CASUAL_RESPONSE_SCHEMA } from '../../packages/character/casual-chat-prompt.mjs';

async function main() {
  await loadEnvFile();

  if (!process.env.OPENAI_API_KEY) {
    console.error('OPENAI_API_KEY가 없습니다. .env를 확인하세요.');
    process.exit(1);
  }
  const model = process.env.OPENAI_CHILD_COACH_MODEL;
  if (!model) {
    console.error('OPENAI_CHILD_COACH_MODEL이 .env에 없습니다.');
    process.exit(1);
  }

  console.log(`=== gpt-5.6-luna(설정값: ${model}) 단일 호출 진단 ===`);
  console.log('API 키는 로그에 출력하지 않습니다.\n');

  const provider = new OpenAIProvider({ apiKey: process.env.OPENAI_API_KEY, model });

  const jsonSchema = {
    type: 'object',
    additionalProperties: false,
    required: ['reaction'],
    properties: { reaction: { type: 'string' } },
  };

  try {
    const result = await provider.complete({
      system: '너는 친근한 캐릭터야. 사용자 메시지에 짧게 반말로 답해.',
      user: '안녕',
      jsonSchema,
      schemaName: 'diagnostic_test',
    });
    console.log('=== 테스트1 성공(최소 스키마, suggestedQuestions 없음) ===');
    console.log('응답:', result.data);
    console.log('usage:', result.usage);
  } catch (err) {
    console.log('\n=== 테스트1 실패 (위에 [OpenAIProvider 실패: ...] 로그가 상세 원인입니다) ===');
    console.log('code:', err.code);
    console.log('message:', err.message);
    console.log('status:', err.details?.status ?? '(없음)');

    console.log('\n=== 후보 판정 ===');
    const status = err.details?.status;
    const apiErrorType = err.details?.apiError?.type;
    const apiErrorCode = err.details?.apiError?.code;

    if (err.code === 'NETWORK_ERROR') {
      console.log('→ H. 기타 (네트워크 연결 자체가 실패 — 방화벽/프록시/인터넷 연결 확인 필요)');
    } else if (err.code === 'API_ERROR' && status === 401) {
      console.log('→ C. API key 또는 project 설정 문제 (인증 실패, 401)');
    } else if (err.code === 'API_ERROR' && status === 403) {
      console.log('→ B. 해당 모델에 대한 API 접근 권한 없음 (403)');
    } else if (err.code === 'API_ERROR' && status === 404) {
      console.log('→ A. 모델 ID가 존재하지 않음 (404 — "gpt-5.6-luna"라는 모델명 자체가 무효할 가능성 높음)');
    } else if (err.code === 'API_ERROR' && status === 400) {
      console.log('→ D. 요청 파라미터 문제 (400) 또는 A(모델 미존재를 400으로 반환하는 경우도 있음) — 위 apiError type/code 확인 필요');
    } else if (err.code === 'API_ERROR' && status === 429) {
      console.log('→ H. 기타 (OpenAI 측 rate limit/쿼터 초과, 모델 자체 문제 아님)');
    } else if (err.code === 'API_ERROR') {
      console.log(`→ H. 기타 (HTTP ${status}, apiError.type=${apiErrorType}, apiError.code=${apiErrorCode} — 위 정보로 재분류 필요)`);
    } else if (err.code === 'REFUSAL') {
      console.log('→ G. 애플리케이션(모델)이 정상 응답 대신 거부를 반환 (콘텐츠 정책 등)');
    } else if (err.code === 'MALFORMED_JSON') {
      console.log('→ F. API는 성공했지만 응답 파싱 단계에서 실패(모델이 JSON 스키마를 못 지킴)');
    } else if (err.code === 'INVALID_HTTP_RESPONSE') {
      console.log('→ H. 기타 (OpenAI가 JSON이 아닌 응답을 반환 — 프록시/게이트웨이 문제일 수 있음)');
    } else {
      console.log('→ H. 기타 (알 수 없는 에러 코드:', err.code, ')');
    }
  }

  // §테스트2 — 가설: CASUAL_RESPONSE_SCHEMA는 properties에 suggestedQuestions가 있지만
  // required에는 reaction만 있다. OpenAI strict:true 모드는 properties의 모든 필드가 required에도
  // 있어야 한다는 제약이 있다 — 이 스키마가 그 제약을 위반해서 실제 프로덕션 호출만 실패할
  // 가능성이 있다. 진짜 프로덕션 스키마를 그대로 써서 딱 1번 더 호출해 이 가설을 확인한다.
  console.log('\n\n=== 테스트2: 실제 프로덕션 스키마(CASUAL_RESPONSE_SCHEMA)로 재현 시도 ===');
  console.log('required:', JSON.stringify(CASUAL_RESPONSE_SCHEMA.required));
  console.log('properties 키:', JSON.stringify(Object.keys(CASUAL_RESPONSE_SCHEMA.properties)));
  try {
    const result2 = await provider.complete({
      system: '너는 친근한 캐릭터야. 사용자 메시지에 짧게 반말로 답해.',
      user: '안녕',
      jsonSchema: CASUAL_RESPONSE_SCHEMA,
      schemaName: 'casual_reaction',
    });
    console.log('=== 테스트2 성공 — 가설 기각(스키마가 원인이 아님) ===');
    console.log('응답:', result2.data);
  } catch (err) {
    console.log('=== 테스트2 실패 ===');
    console.log('code:', err.code);
    console.log('message:', err.message);
    console.log('status:', err.details?.status ?? '(없음)');
    if (err.code === 'API_ERROR' && err.details?.status === 400) {
      console.log('\n판정: D. 요청 파라미터 문제 — CASUAL_RESPONSE_SCHEMA가 OpenAI strict 모드 제약');
      console.log('(properties의 모든 필드가 required에도 있어야 함)을 위반해서 실패하는 것으로 확정.');
      console.log('테스트1(최소 스키마)은 성공, 테스트2(실제 스키마)만 실패 → 모델 자체 문제 아님.');
    } else {
      console.log('\n판정: 테스트1과 다른 실패 패턴 — 추가 분석 필요.');
    }
    process.exit(1);
  }
}

main();
