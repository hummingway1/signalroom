// apps/api/src/repositories/campaign-repository.mjs
import { randomUUID } from 'node:crypto';
import { getPool } from '../../../../packages/shared/postgres-client.mjs';

export async function getActiveCampaign(productCode) {
  const pool = getPool();
  const result = await pool.query(
    `select id, campaign_code, product_code, limit_count, used_count, active
     from campaigns
     where product_code = $1 and active = true
       and (ends_at is null or ends_at > now())
       and used_count < limit_count
     limit 1`,
    [productCode]
  );
  return result.rows[0] ?? null;
}

export async function hasExistingEntitlement(userId, productId) {
  const pool = getPool();
  const result = await pool.query(
    `select id from entitlements where user_id = $1 and product_id = $2 limit 1`,
    [userId, productId]
  );
  return result.rows.length > 0;
}

export async function claimFreeCampaignSlot({ userId, campaignCode, product }) {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const existing = await client.query(
      `select id from entitlements where user_id = $1 and product_id = $2 limit 1`,
      [userId, product.id]
    );
    if (existing.rows.length > 0) {
      await client.query('ROLLBACK');
      return { claimed: false, reason: 'ALREADY_CLAIMED' };
    }

    const campaignUpdate = await client.query(
      `update campaigns set used_count = used_count + 1
       where campaign_code = $1 and used_count < limit_count and active = true
       returning id, used_count`,
      [campaignCode]
    );
    if (campaignUpdate.rows.length === 0) {
      await client.query('ROLLBACK');
      return { claimed: false, reason: 'CAMPAIGN_FULL' };
    }

    const orderId = randomUUID();
    await client.query(
      `insert into orders (id, user_id, product_id, order_name, amount, status, created_at, paid_at)
       values ($1, $2, $3, $4, 0, 'PAID', now(), now())`,
      [orderId, userId, product.id, `${product.name} (무료 캠페인)`]
    );

    const entitlementId = randomUUID();
    await client.query(
      `insert into entitlements (id, user_id, product_id, order_id, quantity, remaining_quantity, expires_at, created_at)
       values ($1, $2, $3, $4, 1, $5,
         case when $6::int is null then null else now() + ($6::int || ' hours')::interval end,
         now())`,
      [entitlementId, userId, product.id, orderId, product.question_quota ?? 1, product.validity_hours ?? null]
    );

    await client.query('COMMIT');
    return { claimed: true, entitlementId, orderId };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
