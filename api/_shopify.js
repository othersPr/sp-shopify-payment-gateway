/**
 * Shared Shopify client credentials helper
 *
 * Based on: https://github.com/Shopify/example-auth--client-credentials-grant--node
 *
 * Uses Client ID + Client Secret to get a short-lived access token
 * instead of a static Admin API token.
 *
 * Required env vars:
 *   SHOPIFY_SHOP          - store name (e.g., "my-store", not the full domain)
 *   SHOPIFY_CLIENT_ID     - app Client ID
 *   SHOPIFY_CLIENT_SECRET - app Client Secret
 */

const { URLSearchParams } = require('url');

const SHOP = process.env.SHOPIFY_SHOP;
const CLIENT_ID = process.env.SHOPIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.SHOPIFY_CLIENT_SECRET;

let token = null;
let tokenExpiresAt = 0;

async function getToken() {
  if (token && Date.now() < tokenExpiresAt - 60_000) return token;

  const response = await fetch(
    `https://${SHOP}.myshopify.com/admin/oauth/access_token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`Shopify token request failed: ${response.status} ${await response.text()}`);
  }

  const { access_token, expires_in } = await response.json();
  token = access_token;
  tokenExpiresAt = Date.now() + expires_in * 1000;
  return token;
}

/**
 * Make an authenticated request to Shopify Admin REST API
 */
async function shopifyFetch(path, options = {}) {
  const accessToken = await getToken();
  const url = `https://${SHOP}.myshopify.com/admin/api/2025-01${path}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      'X-Shopify-Access-Token': accessToken,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  return response.json();
}

/**
 * Mark a Shopify order as paid
 */
async function markShopifyOrderAsPaid(orderId, paymentDetails) {
  // Find the order by order number
  const searchData = await shopifyFetch(
    `/orders.json?name=${encodeURIComponent('#' + orderId)}&status=any`
  );

  if (!searchData.orders || searchData.orders.length === 0) {
    console.error(`Order ${orderId} not found in Shopify`);
    return;
  }

  const shopifyOrder = searchData.orders[0];

  // Create a transaction to mark as paid
  const transactionData = await shopifyFetch(
    `/orders/${shopifyOrder.id}/transactions.json`,
    {
      method: 'POST',
      body: JSON.stringify({
        transaction: {
          kind: 'capture',
          status: 'success',
          amount: shopifyOrder.total_price,
          currency: shopifyOrder.currency,
          gateway: paymentDetails.gateway,
          source: 'external',
        },
      }),
    }
  );

  console.log(`Shopify order ${orderId} marked as paid via ${paymentDetails.gateway}:`, transactionData);
}

module.exports = { getToken, shopifyFetch, markShopifyOrderAsPaid };
