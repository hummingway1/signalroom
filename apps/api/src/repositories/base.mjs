// apps/api/src/repositories/base.mjs
//
// Shared helper: each repository gets its own JsonStore pointed at
// data/db/<name>.json. See packages/shared/json-store.mjs for the swap-to-
// Postgres note.
//
// §STEP3-fix — storeFor(name)은 이름별로 하나의 JsonStore 인스턴스만 재사용한다(싱글톤).
// 이전엔 호출할 때마다 새 인스턴스(= 별도의 인메모리 캐시)를 만들어서, 같은 컬렉션에 대해
// storeFor를 두 번 이상 호출하는 코드(예: 테스트에서 직접 데이터 조작)가 리포지토리가 보는
// 캐시와 어긋나는 문제가 있었다 — 실제 운영에서는 각 리포지토리 파일이 모듈 로드 시 한 번만
// 호출해서 우연히 드러나지 않았지만, 잠재적 위험이라 이 기회에 근본적으로 고친다.
import { JsonStore } from '../../../../packages/shared/json-store.mjs';
import path from 'node:path';

const instances = new Map();

export function storeFor(name) {
  if (!instances.has(name)) {
    instances.set(name, new JsonStore(path.resolve(`./data/db/${name}.json`)));
  }
  return instances.get(name);
}
