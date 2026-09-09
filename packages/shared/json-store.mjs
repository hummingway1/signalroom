// packages/shared/json-store.mjs
//
// Minimal JSON-file-backed collection store for MVP/dev use (spec §15:
// "개발 초기에는 SQLite 또는 JSON 기반으로 시작해도 된다"). Deliberately
// dumb (whole-file read/write, in-memory cache) — this is NOT meant to
// scale, it's meant to let repositories have a real, working persistence
// implementation to code against today.
//
// To move to PostgreSQL later: implement a new class with the same
// interface (list/find/create/update/remove) and swap the import in each
// repository — nothing above the repository layer needs to change, because
// services only depend on repository interfaces, not on JsonStore directly.

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

export class JsonStore {
  /** @param {string} filePath - e.g. './data/db/charts.json' */
  constructor(filePath) {
    this.filePath = path.resolve(filePath);
    this._cache = null;
  }

  async _load() {
    if (this._cache) return this._cache;
    try {
      const text = await readFile(this.filePath, 'utf-8');
      this._cache = JSON.parse(text);
    } catch (err) {
      if (err.code === 'ENOENT') {
        this._cache = [];
      } else {
        throw err;
      }
    }
    return this._cache;
  }

  async _save() {
    await mkdir(path.dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, JSON.stringify(this._cache, null, 2), 'utf-8');
  }

  async list() {
    return [...(await this._load())];
  }

  async find(predicate) {
    const items = await this._load();
    return items.find(predicate) ?? null;
  }

  async filter(predicate) {
    const items = await this._load();
    return items.filter(predicate);
  }

  async insert(record) {
    const items = await this._load();
    items.push(record);
    await this._save();
    return record;
  }

  /** §Phase2(택일 300개 성능 개선) — 여러 레코드를 한 번의 load+save로 원자적으로 추가한다.
   * 기존 insert()를 N번 호출하면 매번 전체 파일을 다시 읽고 통째로 다시 쓰는 O(N^2) 패턴이
   * 된다(파일이 커질수록 매 삽입이 더 느려짐) — insertMany는 이걸 O(N) 1회 쓰기로 바꾼다.
   * 동시 쓰기 자체가 없으므로(단일 호출 안에서 순차적으로 push 후 한 번만 저장) 레이스
   * 컨디션 위험도 없다. 기존 insert()는 다른 모든 호출부에 영향 없이 그대로 유지된다. */
  async insertMany(records) {
    const items = await this._load();
    items.push(...records);
    await this._save();
    return records;
  }

  async update(id, patch) {
    const items = await this._load();
    const idx = items.findIndex((i) => i.id === id);
    if (idx === -1) return null;
    items[idx] = { ...items[idx], ...patch };
    await this._save();
    return items[idx];
  }

  async remove(id) {
    const items = await this._load();
    const next = items.filter((i) => i.id !== id);
    const removed = next.length !== items.length;
    this._cache = next;
    if (removed) await this._save();
    return removed;
  }
}
