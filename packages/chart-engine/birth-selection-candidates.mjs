// packages/chart-engine/birth-selection-candidates.mjs
//
// 출산일시 택일 §4 — 후보 날짜/시간 생성. 순수 함수, AI 관여 없음, deterministic.
export function generateCandidateDateTimes({ dateRangeStart, dateRangeEnd, timeRangeStart, timeRangeEnd, intervalMinutes = 60 }) {
  const candidates = [];
  // §버그수정 — 로컬 타임존(예: KST, UTC+9)에서 'YYYY-MM-DDT00:00:00'을 파싱하면 로컬 자정으로
  // 해석되고, 이후 toISOString()이 UTC로 변환하면서 날짜가 하루 밀린다(실측 확인: 2027-05-01
  // 입력 -> 2027-04-30 출력). 파싱/직렬화를 전부 UTC로 통일해서 시스템 타임존과 무관하게 만든다.
  const start = new Date(`${dateRangeStart}T00:00:00Z`);
  const end = new Date(`${dateRangeEnd}T00:00:00Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
    throw new Error('유효하지 않은 날짜 범위입니다.');
  }
  const [startH, startM] = timeRangeStart.split(':').map(Number);
  const [endH, endM] = timeRangeEnd.split(':').map(Number);
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;
  if (startMinutes > endMinutes) throw new Error('시작 시간이 종료 시간보다 늦을 수 없습니다.');

  const ONE_DAY_MS = 24 * 60 * 60 * 1000;
  for (let t = start.getTime(); t <= end.getTime(); t += ONE_DAY_MS) {
    const dateStr = new Date(t).toISOString().slice(0, 10);
    for (let m = startMinutes; m <= endMinutes; m += intervalMinutes) {
      const hh = String(Math.floor(m / 60)).padStart(2, '0');
      const mm = String(m % 60).padStart(2, '0');
      candidates.push({ birthDate: dateStr, birthTime: `${hh}:${mm}` });
    }
  }
  return candidates;
}
