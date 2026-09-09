// Chart entity: one Canonical Chart JSON per birth-data submission. A user
// can have multiple charts; each chart can be reused across multiple
// conversations (spec §12 User -> Chart -> Conversation[]).
import { randomUUID } from 'node:crypto';
import { storeFor } from './base.mjs';

const store = storeFor('charts');

/** §Phase2 계약 수정 — timestamp 생성 책임을 한 곳에 모은다. createChartRecord와
 * createChartRecords(배치) 둘 다 이 헬퍼를 "레코드마다 개별 호출"해서, 배치로 만들어도
 * 단건 생성과 완전히 동일하게 각 레코드가 자신만의 생성 시각을 갖는다(배치 시작 시 timestamp
 * 하나를 미리 계산해서 전체에 똑같이 넣던 이전 방식과 다름 — 그건 실제 계약 차이였다). */
function buildChartRecord({ userId = null, canonical, rawEngineOutput = null }) {
  return {
    id: randomUUID(),
    user_id: userId,
    canonical,
    raw_engine_output: rawEngineOutput, // kept for audit/debugging; not sent to the AI
    created_at: new Date().toISOString(),
  };
}

export async function createChartRecord(entry) {
  return store.insert(buildChartRecord(entry));
}

/** §Phase2(택일 300개 성능 개선) — 여러 chart를 한 번에 저장한다(파일 I/O 1회, 기존
 * createChartRecord를 N번 부르면 N번의 전체 파일 재작성이 발생하던 것을 개선). 각 레코드의
 * 구조/필드는 createChartRecord와 완전히 동일 — buildChartRecord를 항목마다 개별 호출하므로
 * created_at도 각자 다르게 생성된다(단건 생성과 동일한 semantics). 저장 방식만 배치로 바뀐다.
 * §추가 확인 반영 — 빈 배열이면 insertMany(파일 재작성)를 아예 호출하지 않는다. */
export async function createChartRecords(entries) {
  if (entries.length === 0) return [];
  const charts = entries.map(buildChartRecord);
  await store.insertMany(charts);
  return charts;
}

export async function getChart(id) {
  return store.find((c) => c.id === id);
}

export async function listChartsForUser(userId) {
  return store.filter((c) => c.user_id === userId);
}
