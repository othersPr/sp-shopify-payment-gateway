/**
 * FedaPay - Webhook Handler
 * 
 * Receives callback notifications from FedaPay when payment status changes.
 * Marks the Shopify order as paid when payment is approved.
 * 
 * POST /api/fedapay-webhook
 */

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
          method: 'FedaPay (Mobile Money)',
          amount: transaction.amount,
          currency: transaction.currency?.iso || 'XOF'
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

/**
 * Mark a Shopify order as paid using the Admin API
 */
async function markShopifyOrderAsPaid(orderId, paymentDetails) {
  const SHOPIFY_STORE = process.env.SHOPIFY_STORE_DOMAIN;
  const SHOPIFY_TOKEN = process.env.SHOPIFY_ADMIN_API_TOKEN;

  // Find the order by order number
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

  // Create a transaction to mark as paid
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
          gateway: `FedaPay - ${paymentDetails.currency}`,
          source: 'external'
        }
      })
    }
  );

  const transactionData = await transactionResponse.json();
  console.log(`Shopify order ${orderId} marked as paid via FedaPay:`, transactionData);
}
