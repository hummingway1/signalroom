// packages/ai/providers/base-provider.mjs
//
// Abstract interface all providers implement, so the rest of the codebase
// (question router, pipeline, API routes) never talks to the OpenAI SDK
// directly — swapping models/providers later means writing one new class
// here, nothing else changes (spec §17).

export class BaseAIProvider {
  /**
   * @param {object} params
   * @param {string} params.system - system prompt
   * @param {string} params.user - user prompt (question + extracted data etc.)
   * @param {object} params.jsonSchema - JSON Schema the reply must conform to
   * @param {string} params.schemaName - name for the schema (required by some APIs)
   * @returns {Promise<{ data: object, usage: { input_tokens:number, output_tokens:number, total_tokens:number }, raw: object }>}
   */
  // eslint-disable-next-line no-unused-vars
  async complete({ system, user, jsonSchema, schemaName }) {
    throw new Error('BaseAIProvider.complete() must be implemented by subclass');
  }

  get name() {
    return this.constructor.name;
  }
}
