/**
 * NOWPayments - Webhook Handler
 * 
 * Receives IPN (Instant Payment Notification) from NOWPayments
 * when a crypto payment status changes.
 * Marks the Shopify order as paid when payment is confirmed.
 * 
 * POST /api/nowpayments-webhook
 */

const crypto = require('crypto');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const IPN_SECRET = process.env.NOWPAYMENTS_IPN_SECRET;

    // Verify the webhook signature
    if (IPN_SECRET) {
      const hmac = crypto.createHmac('sha512', IPN_SECRET);
      // Sort the body keys for consistent hashing
      const sortedBody = Object.keys(req.body)
        .sort()
        .reduce((acc, key) => {
          if (key !== 'np_sig') acc[key] = req.body[key];
          return acc;
        }, {});
      hmac.update(JSON.stringify(sortedBody));
      const signature = hmac.digest('hex');

      if (signature !== req.headers['x-nowpayments-sig']) {
        console.error('Invalid NOWPayments webhook signature');
        return res.status(401).json({ error: 'Invalid signature' });
      }
    }

    const { order_id, payment_status, pay_amount, pay_currency, actually_paid } = req.body;

    console.log(`NOWPayments webhook: Order ${order_id}, Status: ${payment_status}`);

    // Only mark as paid when payment is fully confirmed
    if (payment_status === 'finished' || payment_status === 'confirmed') {
      await markShopifyOrderAsPaid(order_id, {
        method: 'NOWPayments (Crypto)',
        currency: pay_currency,
        amount: actually_paid || pay_amount
      });
    }

    return res.status(200).json({ success: true });

  } catch (error) {
    console.error('NOWPayments webhook error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Mark a Shopify order as paid using the Admin API
 */
async function markShopifyOrderAsPaid(orderId, paymentDetails) {
  const SHOPIFY_STORE = process.env.SHOPIFY_STORE_DOMAIN; // e.g., your-store.myshopify.com
  const SHOPIFY_TOKEN = process.env.SHOPIFY_ADMIN_API_TOKEN;

  // First, find the order by order number or name
  const searchResponse = await fetch(
    `https://${SHOPIFY_STORE}/admin/api/2024-01/orders.json?name=${encodeURIComponent('#' + orderId)}&status=any`,
    {
      headers: {
        'X-Shopify-Access-Token': SHOPIFY_TOKEN,
        'Content-Type': 'application/json'
      }
    }
  );

  const searchData = await searchResponse.json();
  
  if (!searchData.orders || searchData.orders.length === 0) {
    console.error(`Order ${orderId} not found in Shopify`);
    return;
  }

  const shopifyOrder = searchData.orders[0];

  // Create a transaction to mark the order as paid
  const transactionResponse = await fetch(
    `https://${SHOPIFY_STORE}/admin/api/2024-01/orders/${shopifyOrder.id}/transactions.json`,
    {
      method: 'POST',
      headers: {
        'X-Shopify-Access-Token': SHOPIFY_TOKEN,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        transaction: {
          kind: 'capture',
          status: 'success',
          amount: shopifyOrder.total_price,
          currency: shopifyOrder.currency,
          gateway: `NOWPayments - ${paymentDetails.currency}`,
          source: 'external'
        }
      })
    }
  );

  const transactionData = await transactionResponse.json();
  console.log(`Shopify order ${orderId} marked as paid:`, transactionData);
}
