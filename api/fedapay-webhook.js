/**
 * FedaPay - Webhook Handler
 *
 * Receives callback notifications from FedaPay when payment status changes.
 * Marks the Shopify order as paid when payment is approved.
 *
 * POST /api/fedapay-webhook
 */

const { markShopifyOrderAsPaid } = require('./_shopify');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const event = req.body;

    console.log('FedaPay webhook received:', JSON.stringify(event));

    // FedaPay sends events like 'transaction.approved', 'transaction.declined', etc.
    const eventType = event.name || event.type;
    const transaction = event.object || event.entity || event;

    if (eventType === 'transaction.approved' || eventType === 'transaction.completed') {
      const description = transaction.description || '';
      // Extract order_id from description (format: "Order #ORDER_ID - ...")
      const orderMatch = description.match(/Order #(\S+)/);

      if (orderMatch) {
        const orderId = orderMatch[1];
        await markShopifyOrderAsPaid(orderId, {
          gateway: `FedaPay - ${transaction.currency?.iso || 'XOF'}`,
        });
      } else {
        console.error('Could not extract order_id from FedaPay transaction:', description);
      }
    }

    return res.status(200).json({ success: true });

  } catch (error) {
    console.error('FedaPay webhook error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
