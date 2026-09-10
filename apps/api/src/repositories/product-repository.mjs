// apps/api/src/repositories/product-repository.mjs
import { getPool } from '../../../../packages/shared/postgres-client.mjs';

export async function listActiveProducts() {
  const pool = getPool();
  const result = await pool.query('select id, code, name, price, analysis_type, description, question_quota, validity_hours, tier from products where active = true order by created_at');
  return result.rows;
}

export async function getProductByCode(code) {
  const pool = getPool();
  const result = await pool.query('select id, code, name, price, analysis_type, description, active from products where code = $1', [code]);
  return result.rows[0] ?? null;
}

export async function getProductById(id) {
  const pool = getPool();
  const result = await pool.query('select id, code, name, price, analysis_type, description, active from products where id = $1', [id]);
  return result.rows[0] ?? null;
}
