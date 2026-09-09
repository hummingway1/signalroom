// apps/api/src/repositories/order-repository.mjs
import { randomUUID } from 'node:crypto';
import { getPool } from '../../../../packages/shared/postgres-client.mjs';

/** amount/order_name은 반드시 호출자가 product.price/name의 "현재 값"을 스냅샷으로 넘겨야 한다
 * — 나중에 상품 가격이 바뀌어도 이 주문의 금액은 불변이어야 하기 때문(§설계).
 * subjectChartId/subjectChildProfileId(§Phase4) — 이 주문이 상세분석 구매라면, 결제 완료 시
 * analysis_scope를 만들어 entitlement에 연결하기 위해 "어떤 chart/child_profile에 대한
 * 구매인지"를 여기 저장해둔다. subjectFortuneYear(§Phase5) — 신년운세 주문이면 "몇 년도"인지도
 * 함께 저장한다. 전부 선택적(기본 상품 등은 아직 미해당 — null로 남음). */
export async function createOrder({ userId, productId, orderName, amount, subjectChartId = null, subjectChildProfileId = null, subjectFortuneYear = null, subjectDateSelectionParams = null }) {
  const pool = getPool();
  const id = randomUUID();
  await pool.query(
    'insert into orders (id, user_id, product_id, order_name, amount, status, subject_chart_id, subject_child_profile_id, subject_fortune_year, subject_date_selection_params) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)',
    [id, userId, productId, orderName, amount, 'PENDING', subjectChartId, subjectChildProfileId, subjectFortuneYear, subjectDateSelectionParams ? JSON.stringify(subjectDateSelectionParams) : null]
  );
  return { id, userId, productId, orderName, amount, status: 'PENDING', subjectChartId, subjectChildProfileId, subjectFortuneYear, subjectDateSelectionParams };
}

export async function getOrderById(id) {
  const pool = getPool();
  const result = await pool.query('select id, user_id, product_id, order_name, amount, status, created_at, paid_at, subject_chart_id, subject_child_profile_id, subject_fortune_year, subject_date_selection_params from orders where id = $1', [id]);
  return result.rows[0] ?? null;
}

export async function listOrdersForUser(userId) {
  const pool = getPool();
  const result = await pool.query('select id, product_id, order_name, amount, status, created_at, paid_at from orders where user_id = $1 order by created_at desc', [userId]);
  return result.rows;
}
