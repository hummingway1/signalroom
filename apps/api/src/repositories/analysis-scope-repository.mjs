// apps/api/src/repositories/analysis-scope-repository.mjs
//
// Phase 2 — Entitlement가 "무엇을 샀는지"가 아니라 "어떤 특정 분석 결과에 대한 권한인지"를 알 수
// 있게 하는 canonical source. 기존 apps/api/src/repositories/analysis-repository.mjs(질문 1건당
// 로그, 완전히 다른 개념)와 절대 혼동하지 않도록 파일/테이블명을 analysis_scope로 분리했다.
// §14 — 생성 후 result_data는 절대 변경하지 않는다(변경 함수 자체를 export하지 않음 —
// purchased-analysis-repository.mjs와 동일한 immutable 원칙).
import { randomUUID } from 'node:crypto';
import { getPool } from '../../../../packages/shared/postgres-client.mjs';
import { isValidAnalysisType } from '../../../../packages/shared/analysis-types.mjs';
import { getChart } from './chart-repository.mjs';
import { getChildProfile } from './child-profile-repository.mjs';

export class AnalysisScopeError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

/**
 * §6/§17 — chart_id/child_profile_id는 Postgres FK가 불가능(JsonStore 기반)하므로, 여기서
 * 애플리케이션 레벨로 "그 chart/child_profile이 실제 존재하고 이 userId 소유가 맞는지"를
 * 확인한다. 다른 사용자의 chart_id를 넣어서 analysis_scope를 만드는 것을 여기서 차단한다.
 */
export async function verifySubjectOwnership({ userId, chartId, childProfileId }) {
  if (chartId) {
    const chart = await getChart(chartId);
    if (!chart) throw new AnalysisScopeError('SUBJECT_NOT_FOUND', 'chart를 찾을 수 없습니다.');
    // 익명 사용자가 만든 chart는 user_id가 없을 수 있다(§익명 승계 이전 상태) — 이 경우는
    // 소유권 충돌로 보지 않는다. 단, chart.user_id가 있는데 다른 사람이면 명확히 거부한다.
    if (chart.user_id && chart.user_id !== userId) {
      throw new AnalysisScopeError('SUBJECT_OWNERSHIP_MISMATCH', '본인의 chart가 아닙니다.');
    }
  }
  if (childProfileId) {
    const profile = await getChildProfile(childProfileId);
    if (!profile) throw new AnalysisScopeError('SUBJECT_NOT_FOUND', 'child profile을 찾을 수 없습니다.');
    if (profile.user_id !== userId) {
      throw new AnalysisScopeError('SUBJECT_OWNERSHIP_MISMATCH', '본인의 자녀 프로필이 아닙니다.');
    }
  }
}

/**
 * @param {object} params
 * @param {string} params.userId
 * @param {string} params.analysisType - packages/shared/analysis-types.mjs의 canonical 값만 허용
 * @param {string} [params.chartId]
 * @param {string} [params.childProfileId]
 * @param {number} [params.fortuneYear]
 * @param {object} [params.resultData] - 생성 시점에 이미 있으면 함께 저장(없으면 나중에 채울 수도 있음 — 이번 Phase는 스키마만, 실제 결과 생성 파이프라인 연결은 Phase 5)
 */
export async function createAnalysisScope({ userId, analysisType, chartId = null, childProfileId = null, fortuneYear = null, resultData = null }) {
  if (!isValidAnalysisType(analysisType)) {
    throw new AnalysisScopeError('INVALID_ANALYSIS_TYPE', `알 수 없는 analysis_type: ${analysisType}`);
  }
  await verifySubjectOwnership({ userId, chartId, childProfileId });

  const pool = getPool();
  const id = randomUUID();
  await pool.query(
    'insert into analysis_scopes (id, user_id, analysis_type, chart_id, child_profile_id, fortune_year, result_data) values ($1, $2, $3, $4, $5, $6, $7)',
    [id, userId, analysisType, chartId, childProfileId, fortuneYear, resultData ? JSON.stringify(resultData) : null]
  );
  return { id, userId, analysisType, chartId, childProfileId, fortuneYear };
}

export async function getAnalysisScopeById(id) {
  const pool = getPool();
  const result = await pool.query('select id, user_id, analysis_type, chart_id, child_profile_id, fortune_year, date_selection_params, result_data, created_at from analysis_scopes where id = $1', [id]);
  return result.rows[0] ?? null;
}

/**
 * §6/§20(Test B) 소유권 검증 — analysisId가 실제로 이 userId 소유인지 확인한다. 다른 사용자가
 * 남의 analysis_id를 넣어서 접근을 시도하면 여기서 명확히 차단된다.
 */
export async function verifyAnalysisScopeOwnership(analysisId, userId) {
  const scope = await getAnalysisScopeById(analysisId);
  if (!scope) throw new AnalysisScopeError('ANALYSIS_NOT_FOUND', '분석 결과를 찾을 수 없습니다.');
  if (scope.user_id !== userId) throw new AnalysisScopeError('UNAUTHORIZED', '본인의 분석 결과가 아닙니다.');
  return scope;
}

/**
 * §Phase9 — result_data를 "최초 1회만" 채운다. 이미 값이 있으면(즉 이미 생성된 적 있으면)
 * 아무것도 하지 않고 조용히 무시한다(WHERE result_data IS NULL로 DB 레벨에서 강제) — 이게
 * §14 immutable 원칙("생성 후 절대 변경하지 않는다")을 위반하지 않으면서도 "최초 생성"이라는
 * 지연 생성(lazy generation) 패턴을 가능하게 하는 유일한 안전한 방법이다. 동시에 두 요청이
 * 와도(중복 클릭) UPDATE 자체가 원자적이라 두 번째는 조용히 no-op된다.
 */
export async function fillAnalysisScopeResultOnce(analysisId, resultData) {
  const pool = getPool();
  const result = await pool.query(
    'update analysis_scopes set result_data = $1 where id = $2 and result_data is null returning id',
    [JSON.stringify(resultData), analysisId]
  );
  return result.rows.length > 0; // true면 이번 호출이 실제로 채운 것, false면 이미 누군가 먼저 채웠음(경쟁 상황에서도 안전)
}

export async function listAnalysisScopesForUser(userId, analysisType = null) {
  const pool = getPool();
  const result = analysisType
    ? await pool.query('select id, analysis_type, chart_id, child_profile_id, fortune_year, created_at from analysis_scopes where user_id = $1 and analysis_type = $2 order by created_at desc', [userId, analysisType])
    : await pool.query('select id, analysis_type, chart_id, child_profile_id, fortune_year, created_at from analysis_scopes where user_id = $1 order by created_at desc', [userId]);
  return result.rows;
}

/**
 * §Phase9 Frontend — "본인/자녀 + 연도"로 이미 구매한 신년운세가 있는지 프론트가 확인할 수 있게
 * 하는 조회. 소유권은 userId로 이미 제한되어 있어 다른 사용자의 scope는 애초에 조회 안 됨.
 * 여러 개(BASIC 따로, CHAT 따로 구매했을 수 있음)를 전부 반환 — tier가 높은 것 우선 정렬.
 */
export async function findYearlyFortuneScopesForTarget(userId, { chartId = null, childProfileId = null, fortuneYear }) {
  const pool = getPool();
  const result = await pool.query(
    `select s.id, s.fortune_year, s.result_data is not null as has_result, p.tier, p.code as product_code,
            e.remaining_quantity, e.expires_at
     from analysis_scopes s
     left join entitlements e on e.analysis_id = s.id
     left join products p on p.id = e.product_id
     where s.user_id = $1 and s.analysis_type = 'YEARLY_FORTUNE' and s.fortune_year = $2
       and ($3::text is not null and s.chart_id = $3 or $4::text is not null and s.child_profile_id = $4)
     order by (p.tier = 'detail') desc, s.created_at desc`,
    [userId, fortuneYear, chartId, childProfileId]
  );
  return result.rows;
}
