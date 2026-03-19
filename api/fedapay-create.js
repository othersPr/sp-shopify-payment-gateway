/**
 * FedaPay - Create Transaction Endpoint
 * 
 * Creates a mobile money payment request via FedaPay API.
 * Called when a customer chooses to pay with Mobile Money.
 * 
 * POST /api/fedapay-create
 * Body: { order_id, amount, currency, description, customer }
 */

const { createPayment } = require('./_db');

module.exports = async (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { order_id, amount, currency = 'XOF', description, customer } = req.body;

    if (!order_id || !amount) {
      return res.status(400).json({ error: 'Missing order_id or amount' });
    }

    const FEDAPAY_SECRET_KEY = process.env.FEDAPAY_SECRET_KEY;
    const FEDAPAY_ENV = process.env.FEDAPAY_ENV || 'live'; // 'sandbox' or 'live'
    const VERCEL_URL = process.env.VERCEL_URL || 'your-app.vercel.app';

    const apiBase = FEDAPAY_ENV === 'sandbox'
      ? 'https://sandbox-api.fedapay.com'
      : 'https://api.fedapay.com';

    // Step 1: Create a transaction
    const transactionResponse = await fetch(`${apiBase}/v1/transactions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${FEDAPAY_SECRET_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        description: description || `Order #${order_id} - Tangem Wallet`,
        amount: parseInt(amount),
        currency: { iso: currency },
        callback_url: `https://${VERCEL_URL}/api/fedapay-webhook`,
        customer: customer || {}
      })
    });

    const transactionData = await transactionResponse.json();

    if (!transactionResponse.ok) {
      console.error('FedaPay transaction error:', transactionData);
      return res.status(500).json({ error: 'Failed to create transaction', details: transactionData });
    }

    const transactionId = transactionData.v1.transaction.id;

    // Step 2: Generate a payment token/URL for this transaction
    const tokenResponse = await fetch(`${apiBase}/v1/transactions/${transactionId}/token`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${FEDAPAY_SECRET_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok) {
      console.error('FedaPay token error:', tokenData);
      return res.status(500).json({ error: 'Failed to generate payment token', details: tokenData });
    }

    // Record payment in database
    await createPayment({
      order_id: String(order_id),
      provider: 'fedapay',
      amount: parseInt(amount),
      currency: currency,
      transaction_id: String(transactionId),
    });

    return res.status(200).json({
      success: true,
      payment_url: tokenData.url || tokenData.token,
      transaction_id: transactionId,
      order_id: order_id
    });

  } catch (error) {
    console.error('Error creating FedaPay transaction:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
