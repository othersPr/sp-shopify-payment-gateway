/**
 * NOWPayments - Create Invoice Endpoint
 * 
 * This endpoint creates a crypto payment invoice via NOWPayments API.
 * Called when a customer chooses to pay with crypto at checkout.
 * 
 * POST /api/nowpayments-create
 * Body: { order_id, amount, currency, order_description }
 */

module.exports = async (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { order_id, amount, currency = 'eur', order_description } = req.body;

    if (!order_id || !amount) {
      return res.status(400).json({ error: 'Missing order_id or amount' });
    }

    const NOWPAYMENTS_API_KEY = process.env.NOWPAYMENTS_API_KEY;
    const VERCEL_URL = process.env.VERCEL_URL || 'your-app.vercel.app';

    // Create payment invoice via NOWPayments API
    const response = await fetch('https://api.nowpayments.io/v1/invoice', {
      method: 'POST',
      headers: {
        'x-api-key': NOWPAYMENTS_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        price_amount: parseFloat(amount),
        price_currency: currency.toLowerCase(),
        order_id: String(order_id),
        order_description: order_description || `Order #${order_id} - Tangem Wallet`,
        ipn_callback_url: `https://${VERCEL_URL}/api/nowpayments-webhook`,
        success_url: `https://${VERCEL_URL}/public/success.html?order_id=${order_id}&method=crypto`,
        cancel_url: `https://${VERCEL_URL}/public/cancel.html?order_id=${order_id}`
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('NOWPayments error:', data);
      return res.status(500).json({ error: 'Failed to create invoice', details: data });
    }

    return res.status(200).json({
      success: true,
      invoice_url: data.invoice_url,
      invoice_id: data.id,
      order_id: order_id
    });

  } catch (error) {
    console.error('Error creating NOWPayments invoice:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
