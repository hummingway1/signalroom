// apps/api/src/services/birth-selection-service.mjs
//
// §5/§6/§7/§8 — 후보마다 새 계산 로직을 만들지 않는다. 기존 createChart(사주+자미두수 통합
// Canonical JSON을 만드는 함수, chart-service.mjs)를 그대로 재사용한다. AI는 이 계산 결과를
// "해석"만 한다 — 날짜/사주/명반을 직접 계산하지 않는다(§16).
//
// §Phase1(택일 AI 평가 엔진) — rankCandidatesMock을 실제 2단계(1차 넓고 얕게 → 2차 좁고 깊게)
// AI 평가로 교체. 절대 점수 없음, 신강/신약·격국·용신·희신·조후는 계산 엔진에 없으므로 AI에게
// 전달하지도, 요구하지도 않는다.
import { generateCandidateDateTimes } from '../../../../packages/chart-engine/birth-selection-candidates.mjs';
import { createCharts } from './chart-service.mjs';
import { getAnalysisScopeById, verifyAnalysisScopeOwnership, fillAnalysisScopeResultOnce } from '../repositories/analysis-scope-repository.mjs';
import {
  buildFirstPassPrompt, buildFirstPassSchema,
  buildSecondPassPrompt, buildSecondPassSchema,
  SAFETY_DISCLOSURE_TEXT,
} from '../../../../packages/character/birth-selection-prompt.mjs';

export class BirthSelectionError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

/** 후보 날짜/시간마다 실제 Canonical Chart(사주+자미두수)를 계산한다.
 * §Phase2 — 계산은 순차(기존과 동일한 순서/동작), 저장만 배치(createCharts)로 바꿔서 300개
 * 규모에서 파일 I/O를 N번에서 1번으로 줄인다. 반환 구조/순서/candidateId 매핑은 기존과 동일. */
export async function computeCandidateCharts({ dateRangeStart, dateRangeEnd, timeRangeStart, timeRangeEnd, intervalMinutes, gender, city }) {
  const candidates = generateCandidateDateTimes({ dateRangeStart, dateRangeEnd, timeRangeStart, timeRangeEnd, intervalMinutes });
  const charts = await createCharts(candidates.map((c) => ({ birthInput: { birthDate: c.birthDate, birthTime: c.birthTime, gender, city } })));
  return candidates.map((candidate, i) => ({
    ...candidate,
    chartId: charts[i].id,
    canonical: charts[i].canonical,
    candidateId: makeCandidateId(candidate.birthDate, candidate.birthTime),
  }));
}

/** §9 — candidate_id는 date+time으로부터 결정론적으로 생성한다(같은 입력이면 항상 같은 ID,
 * AI가 지어낼 수 없는 형식). 사용자에게 노출되는 chartId(내부 DB PK)와는 별개다. */
export function makeCandidateId(date, time) {
  return `${date}T${time}`;
}

/** §7 — 각 후보에서 택일 해석에 필요한 필드만 추린다. depth에 따라 1차(shallow)/2차(deep)로
 * 분리한다 — "데이터를 많이 보내는 게 좋은 게 아니다"(§6) 원칙에 따라, 1차는 후보 간 핵심
 * 차이(일간, 사주 4기둥의 간지/십신/십이운성, 합충형파해)만, 2차는 지장간/신살/공망/자미두수
 * 명궁까지 상세를 포함한다.
 *
 * §1 실측 확인 결과 — void_branches(공망)는 saju 최상위에 실제로 존재하지만 기존 함수가
 * 가져오지 않고 있었다(빠뜨린 필드). 2차 depth에 추가해서 보강한다.
 * hidden_stems(지장간)는 pillars[].hidden_stems에 이미 중첩되어 있다 — 별도 필드가 아니다.
 * ziwei.palaces는 12궁 전체(각 궁마다 별 목록)라 매우 방대하다 — §5 검토 결과, 택일 비교에는
 * "타고난 기질/그릇"을 보는 명궁(life palace)의 별 구성만 유의미하다고 판단해서 그것만 추출한다.
 * 나머지 11궁(형제/부부/자녀/재물/질병/이동/친구/사업/부동산/복덕/부모)은 상세 사주 상담(별도
 * 유료 상품)의 영역이지 두 후보를 비교하는 택일 목적에는 과도한 정보라 제외한다.
 */
export function extractBirthSelectionFields(canonical, depth = 'deep') {
  const saju = canonical.saju ?? {};
  const ziwei = canonical.ziwei ?? {};

  if (depth === 'shallow') {
    return {
      saju: {
        day_master: saju.day_master ?? null,
        pillars: (saju.pillars ?? []).map((p) => ({
          position: p.position, ganzi: p.ganzi, heavenly_stem: p.heavenly_stem, earthly_branch: p.earthly_branch,
          ten_god: p.ten_god, twelve_stage: p.twelve_stage,
        })),
        relations: saju.relations ?? null,
      },
    };
  }

  const lifePalace = (ziwei.palaces ?? []).find((p) => p.position === 'life') ?? null;
  return {
    saju: {
      day_master: saju.day_master ?? null,
      pillars: saju.pillars ?? null, // hidden_stems 포함 전체
      relations: saju.relations ?? null,
      special_stars: saju.special_stars ?? null,
      void_branches: saju.void_branches ?? null,
    },
    ziwei: {
      five_elements_bureau: ziwei.five_elements_bureau ?? null,
      life_palace: ziwei.life_palace ?? null,
      life_palace_stars: lifePalace?.stars ?? null,
      body_palace: ziwei.body_palace ?? null,
    },
  };
}

const FIRST_PASS_BATCH_SIZE = 100; // §11 — 100개 단위로 나눈다(API context 한계 고려, 명리학적 사전 배제 아님).

/**
 * §2/§3 — 2단계 AI 평가 오케스트레이션.
 * - ~20개: 1차 생략, 2차만.
 * - ~100개: 1차 1회 + 2차 1회.
 * - ~300개: 1차를 100개씩 나눠 여러 번(기술적 분할, 조기 탈락 없음 — 각 배치는 "태깅"만 하고
 *   A tier 전부를 다음 단계로 넘긴다) + 2차 1회.
 * aiProvider는 호출자가 주입(tier에 따라 Luna/Terra 등 — 이 파일은 provider 종류를 모른다).
 */
export async function evaluateCandidates({ candidatesWithFields, aiProvider }) {
  const allCandidateIds = candidatesWithFields.map((c) => c.candidateId);

  let secondPassPool = candidatesWithFields;
  let firstPassUsage = [];

  if (candidatesWithFields.length > 20) {
    // 1차 평가 — 100개씩 배치.
    const batches = [];
    for (let i = 0; i < candidatesWithFields.length; i += FIRST_PASS_BATCH_SIZE) {
      batches.push(candidatesWithFields.slice(i, i + FIRST_PASS_BATCH_SIZE));
    }

    const tieredResults = [];
    for (const batch of batches) {
      const batchIds = batch.map((c) => c.candidateId);
      const input = batch.map((c) => ({ candidate_id: c.candidateId, date: c.birthDate, time: c.birthTime, ...extractBirthSelectionFields(c.canonical, 'shallow') }));
      const result = await aiProvider.complete({
        system: buildFirstPassPrompt(),
        user: `총 ${batch.length}개 후보를 비교 평가하세요. 각 후보 데이터:\n${JSON.stringify(input)}`,
        jsonSchema: buildFirstPassSchema(batchIds),
        schemaName: 'birth_selection_first_pass',
      });
      firstPassUsage.push(result.usage);
      // §9 무결성 2차 방어 — 이 배치의 candidate_id 목록에 없는 값이 있으면 실패.
      validateNoFabricatedCandidates(result.data.evaluations.map((e) => e.candidate_id), batchIds);
      tieredResults.push(...result.data.evaluations);
    }

    const aTierIds = new Set(tieredResults.filter((e) => e.relative_tier === 'A').map((e) => e.candidate_id));
    if (aTierIds.size === 0) {
      // §안전장치 — AI가 극단적으로 전부 B/C만 준 경우, 2차가 빈 입력을 받지 않도록 전체를 그대로 넘긴다.
      secondPassPool = candidatesWithFields;
    } else {
      secondPassPool = candidatesWithFields.filter((c) => aTierIds.has(c.candidateId));
    }
  }

  // 2차 평가 — 최종 비교(항상 1회).
  const secondPassIds = secondPassPool.map((c) => c.candidateId);
  const secondPassInput = secondPassPool.map((c) => ({ candidate_id: c.candidateId, date: c.birthDate, time: c.birthTime, ...extractBirthSelectionFields(c.canonical, 'deep') }));
  const secondPassResult = await aiProvider.complete({
    system: buildSecondPassPrompt(),
    user: `1차 평가를 통과한 ${secondPassPool.length}개 후보를 최종 비교하세요. 각 후보 상세 데이터:\n${JSON.stringify(secondPassInput)}`,
    jsonSchema: buildSecondPassSchema(secondPassIds),
    schemaName: 'birth_selection_second_pass',
  });

  // §9 무결성 2차 방어 — 2차 결과에 등장하는 모든 candidate_id가 실제 후보 목록(전체) 안에 있는지 확인.
  const mentionedIds = [
    secondPassResult.data.top1.candidate_id,
    ...secondPassResult.data.top2to5.map((c) => c.candidate_id),
    ...secondPassResult.data.candidate_comparison.map((c) => c.candidate_id),
  ];
  validateNoFabricatedCandidates(mentionedIds, allCandidateIds);

  return {
    top1: secondPassResult.data.top1,
    top2to5: secondPassResult.data.top2to5,
    total_candidates_considered: candidatesWithFields.length,
    safety_disclosure: SAFETY_DISCLOSURE_TEXT,
    chat_context: {
      top1: secondPassResult.data.top1,
      top2to5: secondPassResult.data.top2to5,
      candidate_comparison: secondPassResult.data.candidate_comparison,
    },
    usage: { firstPass: firstPassUsage, secondPass: secondPassResult.usage },
  };
}

/** §9 — checkNoFabricatedCandidate의 서버측 완성본. AI 응답에 등장하는 candidate_id가 실제로
 * 서버가 생성한 후보 목록(source of truth) 안에 있는지 확인한다. 하나라도 없으면 실패시킨다. */
export function validateNoFabricatedCandidates(mentionedIds, validIds) {
  const validSet = new Set(validIds);
  const fabricated = mentionedIds.filter((id) => !validSet.has(id));
  if (fabricated.length > 0) {
    throw new BirthSelectionError('FABRICATED_CANDIDATE', `AI가 존재하지 않는 candidate_id를 반환했습니다: ${fabricated.join(', ')}`);
  }
  return true;
}

/**
 * §다음 미완료 Phase(상품/entitlement/API) — 신년운세의 "생성 1회 + 영구 열람" 패턴을 그대로
 * 재사용한다(getOrGenerateYearlyFortuneResult와 동일한 정신). result_data가 이미 있으면 AI를
 * 다시 호출하지 않고 즉시 반환, 없으면 저장된 date_selection_params로 실제 평가를 실행하고
 * fillAnalysisScopeResultOnce로 원자적으로 저장한다(동시 요청 경쟁에서도 이중 생성 방지).
 */
export async function getOrGenerateBirthSelectionResult({ analysisScopeId, userId, aiProvider }) {
  const scope = await verifyAnalysisScopeOwnership(analysisScopeId, userId);
  if (scope.analysis_type !== 'DATE_SELECTION') {
    throw new BirthSelectionError('NOT_DATE_SELECTION_SCOPE', '출생일 택일 분석이 아닙니다.');
  }
  if (scope.result_data) {
    return { resultData: scope.result_data, generatedNow: false };
  }
  if (!scope.date_selection_params) {
    throw new BirthSelectionError('PARAMS_NOT_FOUND', '이 분석의 날짜/시간 조건을 찾을 수 없습니다.');
  }
  if (!aiProvider) {
    throw new BirthSelectionError('PROVIDER_NOT_CONFIGURED', 'AI 모델이 설정되지 않았습니다.');
  }

  const candidatesWithFields = await computeCandidateCharts(scope.date_selection_params);
  const evaluation = await evaluateCandidates({ candidatesWithFields, aiProvider });

  const filled = await fillAnalysisScopeResultOnce(analysisScopeId, evaluation);
  if (!filled) {
    const latest = await getAnalysisScopeById(analysisScopeId);
    return { resultData: latest.result_data, generatedNow: false };
  }
  return { resultData: evaluation, generatedNow: true };
}

