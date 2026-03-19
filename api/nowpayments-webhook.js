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
const { markShopifyOrderAsPaid } = require('./_shopify');
const { isAlreadyPaid, markPaid, markFailed } = require('./_db');

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

    const { order_id, payment_status, pay_currency } = req.body;

    console.log(`NOWPayments webhook: Order ${order_id}, Status: ${payment_status}`);

    // Only mark as paid when payment is fully confirmed
    if (payment_status === 'finished' || payment_status === 'confirmed') {
      // Prevent double payment
      if (await isAlreadyPaid(order_id)) {
        console.log(`Order ${order_id} already paid, skipping`);
        return res.status(200).json({ success: true, skipped: true });
      }

      await markShopifyOrderAsPaid(order_id, {
        gateway: `NOWPayments - ${pay_currency}`,
      });
      await markPaid(order_id, 'nowpayments', req.body.payment_id?.toString());
    } else if (payment_status === 'failed' || payment_status === 'expired') {
      await markFailed(order_id, 'nowpayments');
    }

    return res.status(200).json({ success: true });

  } catch (error) {
    console.error('NOWPayments webhook error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
