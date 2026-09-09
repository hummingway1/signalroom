// tests/real-ai/fixtures.mjs
//
// Registry of the fixed test charts used by the real-AI evaluation. Both
// were generated ONLY by the real calculation engine
// (packages/chart-engine/compute.mjs + packages/canonical/transform.mjs) —
// no star, sihua, or daewoon value in either file was hand-written or
// invented. See CHANGELOG for how each was produced.
//
//   edge_case    — data/fixtures/edge-case-infant-chart.json
//     Birth 2026-08-06, so at evaluation time (2026-08-17) the subject is
//     11 days old (age 0). Deliberately KEPT (not deleted) as a stress test:
//     "does the AI invent/stretch data when asked adult-oriented questions
//     (직업/사업/현재 대운 등) against a chart that structurally cannot
//     support them yet (age is below the first 대운's start_age)?" This is
//     the original test chart from the first real-AI run (2026-08-17).
//
//   main_quality — data/fixtures/adult-main-quality-chart.json
//     Birth 1988-11-22 14:30, Seoul, female. Age 37 in 2026 — solidly inside
//     an active 대운 (35~44세, 己未), with populated palaces, sihua, and a
//     non-trivial 관록궁 공궁 case. Meant to evaluate realistic interpretive
//     quality for career/money/relationship/current-daewoon questions,
//     which the infant chart structurally cannot exercise.
export const FIXTURES = {
  edge_case: {
    path: './data/fixtures/edge-case-infant-chart.json',
    label: 'Edge Case (유아 명반, 2026-08-06 출생)',
    outputSubdir: 'edge-case',
  },
  main_quality: {
    path: './data/fixtures/adult-main-quality-chart.json',
    label: 'Main Quality (성인 명반, 1988-11-22 출생, 37세)',
    outputSubdir: 'main-quality',
  },
};

export const DEFAULT_FIXTURE_ID = 'edge_case';

export function resolveFixture(id = DEFAULT_FIXTURE_ID) {
  const fixture = FIXTURES[id];
  if (!fixture) {
    throw new Error(`Unknown fixture id "${id}". Valid ids: ${Object.keys(FIXTURES).join(', ')}`);
  }
  return { id, ...fixture };
}
