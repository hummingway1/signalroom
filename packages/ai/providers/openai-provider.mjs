// packages/ai/providers/openai-provider.mjs
//
// Real OpenAI Responses API provider. Mirrors the pattern already validated
// in the previous project's analyze.mjs (Structured Outputs, strict JSON
// schema, explicit error handling for missing key / network failure / HTTP
// error / refusal / malformed JSON).
//
// API key and model are read from env vars ONLY — never hardcoded (spec §2
// of the earlier stage, still honored here).

import { BaseAIProvider } from './base-provider.mjs';

const RESPONSES_API_URL = 'https://api.openai.com/v1/responses';

// 진단 로깅 — HTTP status/error code/error type/error message/model명만 남긴다.
// 절대 로그하지 않는 것: API 키, Authorization 헤더, 요청 body 전체, 사용자 개인정보(system/user
// 프롬프트 내용). outputText는 파싱 실패 원인 확인에 필요한 최소량(200자)만 남긴다.
function logProviderFailure(stage, details) {
  console.error(`[OpenAIProvider 실패: ${stage}]`, details);
}

export class OpenAIProvider extends BaseAIProvider {
  constructor({ apiKey = process.env.OPENAI_API_KEY, model = process.env.OPENAI_MODEL } = {}) {
    super();
    if (!apiKey) throw new Error('OpenAIProvider: OPENAI_API_KEY is not set.');
    if (!model) throw new Error('OpenAIProvider: OPENAI_MODEL is not set.');
    this.apiKey = apiKey;
    this.model = model;
  }

  async complete({ system, user, jsonSchema, schemaName }) {
    let httpResponse;
    try {
      httpResponse = await fetch(RESPONSES_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          input: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
          text: {
            format: { type: 'json_schema', name: schemaName, schema: jsonSchema, strict: true },
          },
        }),
      });
    } catch (err) {
      logProviderFailure('NETWORK_ERROR', { model: this.model, message: err.message, type: err.name ?? 'UNKNOWN' });
      throw new AIProviderError('NETWORK_ERROR', `OpenAI API 네트워크 요청 실패: ${err.message}`);
    }

    const rawText = await httpResponse.text();
    let body;
    try {
      body = JSON.parse(rawText);
    } catch {
      logProviderFailure('INVALID_HTTP_RESPONSE', { model: this.model, status: httpResponse.status, bodyPreview: rawText.slice(0, 200) });
      throw new AIProviderError('INVALID_HTTP_RESPONSE', `OpenAI API가 JSON이 아닌 응답을 반환함 (HTTP ${httpResponse.status}): ${rawText.slice(0, 300)}`);
    }

    if (!httpResponse.ok) {
      const apiErr = body?.error;
      // OpenAI 에러 응답은 보통 { error: { message, type, code, param } } 형태다. 여기서 정확히
      // status/code/type/message/model만 남기고, request body(system/user 프롬프트, API key)는
      // 절대 로그하지 않는다.
      logProviderFailure('API_ERROR', {
        model: this.model,
        status: httpResponse.status,
        code: apiErr?.code ?? null,
        type: apiErr?.type ?? null,
        message: apiErr?.message ?? null,
      });
      throw new AIProviderError('API_ERROR', `OpenAI API 오류 (HTTP ${httpResponse.status}): ${apiErr?.message ?? JSON.stringify(body)}`, { status: httpResponse.status, apiError: apiErr });
    }

    const messageItems = (body.output ?? []).filter((item) => item.type === 'message');
    let outputText = '';
    let refusalText = null;
    for (const msg of messageItems) {
      for (const block of msg.content ?? []) {
        if (block.type === 'output_text') outputText += block.text;
        if (block.type === 'refusal') refusalText = block.refusal;
      }
    }

    if (refusalText) {
      // §중요 — HTTP 200이어도 여기서 실패할 수 있다(모델이 콘텐츠 정책 등으로 거부한 경우).
      logProviderFailure('REFUSAL', { model: this.model, status: httpResponse.status, refusalPreview: refusalText.slice(0, 200) });
      throw new AIProviderError('REFUSAL', `모델이 응답을 거부함: ${refusalText}`, { raw: body });
    }

    if (!outputText) {
      // §중요 — HTTP 200, refusal도 아닌데 output_text 자체가 비어있는 경우(예: output에 message
      // 타입 항목이 아예 없거나, reasoning만 있고 실제 텍스트가 없는 경우). 이것도 HTTP status만
      // 보면 "성공"처럼 보이지만 실제로는 실패다.
      logProviderFailure('EMPTY_OUTPUT', { model: this.model, status: httpResponse.status, outputItemTypes: (body.output ?? []).map((i) => i.type), stopReason: body.status ?? null });
    }

    let data;
    try {
      data = JSON.parse(outputText);
    } catch (err) {
      logProviderFailure('MALFORMED_JSON', { model: this.model, status: httpResponse.status, parseErrorMessage: err.message, outputTextPreview: outputText.slice(0, 200) });
      throw new AIProviderError('MALFORMED_JSON', `모델 응답 JSON 파싱 실패: ${err.message}`, { raw: body, outputText });
    }

    const usage = body.usage
      ? {
          input_tokens: body.usage.input_tokens,
          output_tokens: body.usage.output_tokens,
          total_tokens: body.usage.total_tokens,
          cached_input_tokens: body.usage.input_tokens_details?.cached_tokens ?? 0,
          reasoning_tokens: body.usage.output_tokens_details?.reasoning_tokens ?? 0,
        }
      : { input_tokens: 0, output_tokens: 0, total_tokens: 0, cached_input_tokens: 0, reasoning_tokens: 0 };

    return { data, usage, raw: body };
  }
}

export class AIProviderError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'AIProviderError';
    this.code = code;
    this.details = details;
  }
}
