/**
 * Database helper for payments tracking
 *
 * Uses Neon Postgres (serverless). The table is auto-created on first use.
 *
 * Required: Add a Neon Postgres database to your project via
 * Vercel Dashboard → Storage → Create → Neon Postgres
 * (This auto-sets the DATABASE_URL env var)
 */

const { neon } = require('@neondatabase/serverless');

const sql = neon(process.env.DATABASE_URL);

let tableReady = false;

async function ensureTable() {
  if (tableReady) return;

  await sql`
    CREATE TABLE IF NOT EXISTS payments (
      id SERIAL PRIMARY KEY,
      order_id TEXT NOT NULL,
      provider TEXT NOT NULL,
      amount NUMERIC,
      currency TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      transaction_id TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_payments_order_provider
    ON payments (order_id, provider)
  `;

  tableReady = true;
}

/**
 * Record a new payment when customer initiates checkout
 */
async function createPayment({ order_id, provider, amount, currency, transaction_id }) {
  await ensureTable();

  const rows = await sql`
    INSERT INTO payments (order_id, provider, amount, currency, status, transaction_id)
    VALUES (${order_id}, ${provider}, ${amount}, ${currency}, 'pending', ${transaction_id})
    RETURNING *
  `;

  return rows[0];
}

/**
 * Check if an order has already been paid (prevents double payment)
 */
async function isAlreadyPaid(order_id) {
  await ensureTable();

  const rows = await sql`
    SELECT id FROM payments
    WHERE order_id = ${order_id} AND status = 'paid'
    LIMIT 1
  `;

  return rows.length > 0;
}

/**
 * Mark a payment as paid
 */
async function markPaid(order_id, provider, transaction_id) {
  await ensureTable();

  const rows = await sql`
    UPDATE payments
    SET status = 'paid', transaction_id = COALESCE(${transaction_id}, transaction_id), updated_at = NOW()
    WHERE order_id = ${order_id} AND provider = ${provider} AND status = 'pending'
    RETURNING *
  `;

  return rows[0];
}

/**
 * Mark a payment as failed
 */
async function markFailed(order_id, provider) {
  await ensureTable();

  await sql`
    UPDATE payments
    SET status = 'failed', updated_at = NOW()
    WHERE order_id = ${order_id} AND provider = ${provider} AND status = 'pending'
  `;
}

module.exports = { createPayment, isAlreadyPaid, markPaid, markFailed };
