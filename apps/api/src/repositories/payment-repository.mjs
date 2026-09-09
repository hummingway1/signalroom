// apps/api/src/repositories/payment-repository.mjs
//
// §결제 보안 핵심 — 프론트가 보낸 amount를 절대 신뢰하지 않는다. order.amount(서버가 주문 생성
// 시점에 저장해둔 값)와 Toss 응답의 실제 승인 금액을 대조한 뒤, 일치할 때만 Payment/Order/
// Entitlement를 하나의 트랜잭션으로 처리한다. FOR UPDATE로 행을 잠가서 동시 요청(중복 클릭,
// webhook과 프론트 콜백이 동시에 도착하는 경우)에도 단 한 번만 지급되게 한다.
import { randomUUID } from 'node:crypto';
import { getPool } from '../../../../packages/shared/postgres-client.mjs';

export class PaymentConfirmationError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

/**
 * @param {object} params
 * @param {string} params.orderId
 * @param {string} params.userId - 세션에서 얻은 값. order 소유자와 다르면 거부(§16 권한 검증).
 * @param {string} params.paymentKey - Toss가 발급한 값.
 * @param {string} params.method
 * @param {number} params.amount - Toss 승인 API가 실제로 반환한 금액(클라이언트가 아니라 Toss 응답).
 * @param {object} params.rawResponse - Toss 승인 API 원본 응답(감사/디버깅용).
 */
export async function confirmPaymentTransaction({ orderId, userId, paymentKey, method, amount, rawResponse }) {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // FOR UPDATE — 동시에 두 번 승인 요청이 들어와도(중복 클릭, webhook+프론트 동시 도착) 하나가
    // 먼저 행을 잠그고 처리를 끝낼 때까지 다른 하나는 대기했다가, 아래 idempotent 체크로 조용히
    // 통과한다.
    const orderResult = await client.query('select id, user_id, product_id, amount, status, subject_chart_id, subject_child_profile_id, subject_fortune_year, subject_date_selection_params from orders where id = $1 for update', [orderId]);
    const order = orderResult.rows[0];
    if (!order) throw new PaymentConfirmationError('ORDER_NOT_FOUND', '주문을 찾을 수 없습니다.');
    if (order.user_id !== userId) throw new PaymentConfirmationError('UNAUTHORIZED', '본인의 주문이 아닙니다.');

    if (order.status === 'PAID') {
      // 이미 처리된 주문 — 중복 승인 요청(webhook과 프론트 콜백 동시 도착 등)이므로 에러 대신
      // 조용히 기존 상태를 그대로 반환한다(idempotent).
      await client.query('COMMIT');
      const existingPayment = await pool.query('select id, payment_key, status from payments where order_id = $1 and status = $2', [orderId, 'APPROVED']);
      return { alreadyProcessed: true, order, payment: existingPayment.rows[0] ?? null };
    }

    // §금액 위조 방지 핵심 — 서버가 주문 생성 시점에 저장해둔 amount와, Toss가 실제로 승인한
    // 금액을 대조한다. 클라이언트가 보낸 값이 아니라 Toss 응답의 amount를 사용해야 한다(호출자
    // 책임 — 이 함수는 이미 Toss가 승인한 금액이 params.amount로 들어온다고 가정).
    if (order.amount !== amount) {
      throw new PaymentConfirmationError('AMOUNT_MISMATCH', `주문 금액(${order.amount})과 승인 금액(${amount})이 일치하지 않습니다.`);
    }

    const paymentId = randomUUID();
    // payment_key UNIQUE 제약이 최종 방어선 — 같은 paymentKey로 두 번 INSERT되면 여기서
    // DB 레벨 제약 위반으로 실패한다(이 시점까지 왔다는 건 이미 order 잠금을 통과했다는 뜻이라
    // 정상 흐름에서는 발생하지 않지만, 방어 심층화 차원에서 유지).
    await client.query(
      'insert into payments (id, order_id, payment_key, method, amount, status, approved_at, raw_response) values ($1, $2, $3, $4, $5, $6, now(), $7)',
      [paymentId, orderId, paymentKey, method, amount, 'APPROVED', JSON.stringify(rawResponse ?? {})]
    );

    await client.query("update orders set status = 'PAID', paid_at = now() where id = $1", [orderId]);

    // §정책 확정 — 상품마다 지급되는 이용권의 수량/유효기간/analysis_type이 다르다. 상품코드로
    // 분기하지 않고 product 설정(question_quota/validity_hours/analysis_type)을 그대로 읽어서
    // 발급한다 — 새 tier/도메인이 추가돼도 이 코드는 안 바뀐다.
    //
    // §Phase3 선행작업 — entitlement.analysis_type을 여기서 채운다(지금까지는 컬럼만 있고 항상
    // NULL이었음). product.analysis_type은 Phase 2에서 이미 canonical 값(SAJU_DETAIL 등)으로
    // 통일해뒀으므로 그대로 복사한다 — 결제 검증/트랜잭션/중복지급방지 로직은 전혀 건드리지 않고
    // INSERT 컬럼 하나만 추가하는 최소 확장이다.
    const productResult = await client.query('select question_quota, validity_hours, analysis_type, subscription_group from products where id = $1', [order.product_id]);
    const product = productResult.rows[0];
    const quantity = product?.question_quota ?? 1;
    const validityHours = product?.validity_hours ?? null;
    const analysisType = product?.analysis_type ?? null;
    const subscriptionGroup = product?.subscription_group ?? null;

    const entitlementId = randomUUID();
    // entitlements.order_id UNIQUE 제약이 이중 지급의 최종 방어선.
    await client.query(
      `insert into entitlements (id, user_id, product_id, order_id, quantity, remaining_quantity, expires_at, analysis_type, subscription_group)
       values ($1, $2, $3, $4, $5, $6, ${validityHours != null ? "now() + ($7 || ' hours')::interval" : 'null'}, $${validityHours != null ? 8 : 7}, $${validityHours != null ? 9 : 8})`,
      validityHours != null
        ? [entitlementId, userId, order.product_id, orderId, quantity, quantity, validityHours, analysisType, subscriptionGroup]
        : [entitlementId, userId, order.product_id, orderId, quantity, quantity, analysisType, subscriptionGroup]
    );

    // §Phase4 핵심 — analysis_scope 실제 생성 + entitlement 연결. 같은 트랜잭션(client)으로
    // 처리해서, 이 결제가 승인됐는데 analysis_scope 생성만 실패하는 반쪽 상태를 방지한다.
    //
    // 현재 스키마상 analysis_scopes는 chart_id "하나" 또는 child_profile_id "하나"만 가리킬 수
    // 있다(§Phase2 설계). SAJU_DETAIL(chart 하나)과 CHILD_DETAIL(child_profile 하나)은 이 구조에
    // 정확히 들어맞아서 여기서 실제로 연결한다.
    //
    // ⚠️ 발견한 구조적 충돌(보고 대상, §14 STOP 조건에 해당하지만 §13에서 이미 "궁합의 별도 채팅
    // 서비스"가 이번 작업 범위 밖으로 명시되어 있어 진행을 막지 않고 기록만 한다) — RELATIONSHIP_
    // DETAIL(궁합)은 본질적으로 두 사람(chart 2개)의 관계 데이터인데 analysis_scopes.chart_id는
    // 하나뿐이라 지금 스키마로는 표현할 수 없다. 이번 라운드에서는 RELATIONSHIP_DETAIL의
    // analysis_scope 연결을 시도하지 않는다 — entitlement.analysis_id는 NULL로 남고,
    // entitlement.analysis_type(=RELATIONSHIP_DETAIL)만으로 이미 Phase 3 authorization이
    // 동작하므로 채팅 권한 판정 자체는 정상 작동한다. 실제 "이 궁합 결과 데이터"를 조회하는
    // 기능이 필요해지면 그때 스키마 확장(예: chart_id_b 컬럼 추가)이 필요하다.
    let analysisScopeId = null;
    if (analysisType === 'SAJU_DETAIL' && order.subject_chart_id) {
      analysisScopeId = randomUUID();
      await client.query(
        'insert into analysis_scopes (id, user_id, analysis_type, chart_id) values ($1, $2, $3, $4)',
        [analysisScopeId, userId, analysisType, order.subject_chart_id]
      );
    } else if (analysisType === 'CHILD_DETAIL' && order.subject_child_profile_id) {
      analysisScopeId = randomUUID();
      await client.query(
        'insert into analysis_scopes (id, user_id, analysis_type, child_profile_id) values ($1, $2, $3, $4)',
        [analysisScopeId, userId, analysisType, order.subject_child_profile_id]
      );
    } else if (analysisType === 'YEARLY_FORTUNE' && order.subject_fortune_year && (order.subject_chart_id || order.subject_child_profile_id)) {
      // §Phase5 — 성인은 chart_id, 자녀는 child_profile_id로 대상을 구분(§1 정책 그대로). 반드시
      // fortune_year와 함께 저장 — 이게 없으면 authorization이 "몇 년도 신년운세인지" 구분할
      // 방법이 없어진다(§5 연도 귀속 원칙).
      analysisScopeId = randomUUID();
      await client.query(
        'insert into analysis_scopes (id, user_id, analysis_type, chart_id, child_profile_id, fortune_year) values ($1, $2, $3, $4, $5, $6)',
        [analysisScopeId, userId, analysisType, order.subject_chart_id ?? null, order.subject_child_profile_id ?? null, order.subject_fortune_year]
      );
    } else if (analysisType === 'DATE_SELECTION' && order.subject_date_selection_params) {
      // §출생일 택일 — 대상이 chart_id/child_profile_id로 표현 불가능(아직 태어나지 않은 아이의
      // 출생 조건 자체가 대상)하므로, order에 저장된 날짜/시간 범위 조건을 그대로 analysis_scope
      // 로 옮긴다(YEARLY_FORTUNE의 fortune_year 귀속 원칙과 동일한 정신 — 이 조건 없이는 "어떤
      // 분석 결과인지" 구분할 방법이 없다).
      analysisScopeId = randomUUID();
      await client.query(
        'insert into analysis_scopes (id, user_id, analysis_type, date_selection_params) values ($1, $2, $3, $4)',
        [analysisScopeId, userId, analysisType, JSON.stringify(order.subject_date_selection_params)]
      );
    }
    if (analysisScopeId) {
      await client.query('update entitlements set analysis_id = $1 where id = $2', [analysisScopeId, entitlementId]);
    }

    await client.query('COMMIT');
    return { alreadyProcessed: false, paymentId, entitlementId, analysisScopeId };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * §Phase9 — analysis_scope가 어떤 tier(basic/detail)의 상품으로 구매됐는지 서버가 직접 조회한다.
 * 클라이언트가 tier를 지정해서 보내는 걸 신뢰하지 않는다 — entitlement.analysis_id로 역참조.
 */
export async function findEntitlementByAnalysisScopeId(analysisScopeId) {
  const pool = getPool();
  const result = await pool.query(
    `select e.id, p.tier from entitlements e join products p on p.id = e.product_id where e.analysis_id = $1 limit 1`,
    [analysisScopeId]
  );
  return result.rows[0] ?? null;
}

/** §출생일 택일 채팅 — access 판정 전용(findActiveEntitlementByAnalysisType과 정확히 같은
 * 원칙: remaining_quantity는 여기서 필터링하지 않는다 — access는 "이 analysis_scope에 연결된
 * 유효한(만료 안 된) entitlement가 있는가"만 확인하고, quota 소진 여부는 호출부가 별도로
 * 판단해서 필요하면 그때 실패 처리한다. §Phase10에서 고쳤던 것과 동일한 버그를 새로 만들지
 * 않기 위한 설계). */
export async function findActiveEntitlementByAnalysisScopeId(userId, analysisScopeId) {
  const pool = getPool();
  const result = await pool.query(
    `select id, remaining_quantity, expires_at from entitlements
     where user_id = $1 and analysis_id = $2
       and (expires_at is null or expires_at > now())
     limit 1`,
    [userId, analysisScopeId]
  );
  return result.rows[0] ?? null;
}

export async function listEntitlementsForUser(userId) {
  const pool = getPool();
  const result = await pool.query(
    `select e.id, e.product_id, p.code as product_code, p.name as product_name, e.remaining_quantity, e.expires_at
     from entitlements e join products p on p.id = e.product_id
     where e.user_id = $1 order by e.created_at desc`,
    [userId]
  );
  return result.rows;
}

/**
 * §Phase3 핵심 — 클라이언트가 보낸 entitlementId를 신뢰하지 않는다. 대신 서버가 "이 사용자가
 * 이 analysis_type에 대한 유효한(만료 안 됐고 잔여량 있는) entitlement를 실제로 갖고 있는지"를
 * 직접 조회한다. legacy entitlement(analysis_type이 NULL — Phase 2 이전 구매)는 여기서 절대
 * 매칭되지 않는다(§2 — 임의로 권한을 승격하지 않음, deterministic하게 그냥 조회 결과가 없을 뿐).
 * 같은 analysis_type의 entitlement가 여러 개면 만료가 더 늦게 되는 순으로 우선 사용한다.
 */
export async function findActiveEntitlementByAnalysisType(userId, analysisType) {
  const pool = getPool();
  // §실측 버그 수정(live-db 테스트에서 발견) — 이 함수는 오직 access 판정(entitlement-
  // authorization-service.mjs의 findAccessEntitlement)에서만 쓰인다. "이 analysis_type의
  // 유효한(만료 안 된) entitlement를 보유하는가"만 확인해야 하며, remaining_quantity(잔여
  // 횟수)는 access와 별개 개념이다. 예전엔 WHERE절에 remaining_quantity > 0이 있어서, SAJU_
  // DETAIL 10회를 다 쓴 사용자는 "SAJU_DETAIL을 산 적이 없다"고 취급되어 access 자체가
  // 거부됐다 — 그 결과 MINGRI_SUBSCRIPTION으로 quota만 보충하는 로직(Phase6 핵심 설계)에
  // 아예 도달하지 못하는 심각한 버그였다(구독 상품의 존재 이유를 무력화). quota=0 여부는
  // 호출부가 entitlement.remaining_quantity를 보고 별도로 판단해서 구독 fallback으로
  // 넘어간다 — 여기서는 access만 정확히 판정한다.
  const result = await pool.query(
    `select id, remaining_quantity, expires_at from entitlements
     where user_id = $1 and analysis_type = $2
       and (expires_at is null or expires_at > now())
     order by remaining_quantity desc, expires_at desc nulls last
     limit 1`,
    [userId, analysisType]
  );
  return result.rows[0] ?? null;
}

/**
 * §Phase5 전용 — YEARLY_FORTUNE_BASIC(990원)과 YEARLY_FORTUNE_CHAT(4900원)이 같은
 * analysis_type='YEARLY_FORTUNE' 문자열을 공유하기 때문에(SAJU_BASIC/SAJU_DETAIL처럼 서로 다른
 * 문자열이 아님), 일반 findActiveEntitlementByAnalysisType만으로는 990원 결과-열람 전용
 * entitlement가 채팅 권한을 잘못 허용해버릴 위험이 있다. 그래서 반드시:
 *   1. products.tier = 'detail'(채팅 가능한 상품)인지
 *   2. analysis_scopes가 정확히 이 대상(chart_id 또는 child_profile_id)과 이 fortune_year를
 *      가리키는지
 * 를 함께 확인한다. 2027년 entitlement로 2028년 질문을 허용하는 것(§5 금지)과, 자녀 A
 * entitlement로 자녀 B 질문을 허용하는 것(§7 금지)이 여기서 구조적으로 막힌다.
 */
export async function findActiveYearlyFortuneChatEntitlement(userId, { chartId = null, childProfileId = null, fortuneYear }) {
  const pool = getPool();
  const result = await pool.query(
    `select e.id, e.remaining_quantity, e.expires_at
     from entitlements e
     join products p on p.id = e.product_id
     join analysis_scopes s on s.id = e.analysis_id
     where e.user_id = $1
       and e.analysis_type = 'YEARLY_FORTUNE'
       and p.tier = 'detail'
       and e.remaining_quantity > 0
       and (e.expires_at is null or e.expires_at > now())
       and s.fortune_year = $2
       and (
         ($3::text is not null and s.chart_id = $3)
         or ($4::text is not null and s.child_profile_id = $4)
       )
     order by e.expires_at desc nulls last
     limit 1`,
    [userId, fortuneYear, chartId, childProfileId]
  );
  return result.rows[0] ?? null;
}

/**
 * §Phase6 — 구독은 "분석 데이터 접근권"을 절대 만들지 않는다(§7/§31 원칙). 오직 특정 도메인
 * 그룹('MINGRI' | 'CHILD_SIGNAL')의 채팅 quota만 제공한다. 이 함수는 access 판정에는 절대
 * 쓰이지 않고, access가 이미 확인된 뒤 "소비할 quota를 찾는" 보조 용도로만 쓰인다.
 */
export async function findActiveSubscriptionQuota(userId, subscriptionGroup) {
  const pool = getPool();
  const result = await pool.query(
    `select id, remaining_quantity, expires_at from entitlements
     where user_id = $1 and subscription_group = $2 and remaining_quantity > 0
       and (expires_at is null or expires_at > now())
     order by expires_at desc nulls last
     limit 1`,
    [userId, subscriptionGroup]
  );
  return result.rows[0] ?? null;
}

export class EntitlementError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

/**
 * §8 24시간 정책 — "결과를 받은 후 24시간 동안 질문 가능", 질문 1회당 정확히 1회 차감. 이 함수는
 * 실제 채팅 API 라우트가 사용자 질문 하나를 처리하기 "직전"에 정확히 한 번만 호출해야 한다.
 * AI 응답이 프론트에서 여러 버블로 나뉘는 것과는 완전히 무관하다 — 백엔드는 애초에 "버블"이라는
 * 개념 자체를 모른다(분리는 apps/web/src/utils/splitIntoBubbles.js가 응답을 다 받은 뒤 프론트
 * 에서만 수행). 따라서 이 함수를 질문당 1번만 호출하도록 구현하면 "버블 개수와 무관하게 1회
 * 차감"은 구조적으로 자동 보장된다.
 *
 * FOR UPDATE로 잠가서 동시에 여러 요청이 와도 잔여 수량이 음수로 내려가지 않는다.
 */
export async function consumeQuestionEntitlement(entitlementId, userId) {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(
      'select id, user_id, remaining_quantity, expires_at from entitlements where id = $1 for update',
      [entitlementId]
    );
    const entitlement = result.rows[0];
    if (!entitlement) throw new EntitlementError('ENTITLEMENT_NOT_FOUND', '이용권을 찾을 수 없습니다.');
    if (entitlement.user_id !== userId) throw new EntitlementError('UNAUTHORIZED', '본인의 이용권이 아닙니다.');
    if (entitlement.expires_at && new Date(entitlement.expires_at) < new Date()) {
      throw new EntitlementError('ENTITLEMENT_EXPIRED', '이용 가능 시간이 지났습니다.');
    }
    if (entitlement.remaining_quantity <= 0) {
      throw new EntitlementError('ENTITLEMENT_EXHAUSTED', '남은 질문 횟수가 없습니다.');
    }
    const updated = await client.query(
      'update entitlements set remaining_quantity = remaining_quantity - 1 where id = $1 returning remaining_quantity',
      [entitlementId]
    );
    await client.query('COMMIT');
    return { remainingQuantity: updated.rows[0].remaining_quantity };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
