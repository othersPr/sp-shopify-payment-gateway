# Shopify Payment Gateway Integration
## NOWPayments (Crypto) + FedaPay (Mobile Money)

This project adds crypto and mobile money payments to your Shopify store.

---

## HOW IT WORKS

1. Customer places an order on your Shopify store
2. Customer chooses "Pay with Crypto" or "Pay with Mobile Money"  
3. After checkout, they're redirected to a payment page
4. They pay via NOWPayments (crypto) or FedaPay (mobile money)
5. Once payment is confirmed, your Shopify order is automatically marked as paid

---

## SETUP GUIDE (Step by Step)

### STEP 1: Create a GitHub Account (skip if you have one)
1. Go to https://github.com
2. Click "Sign up"
3. Complete the registration

### STEP 2: Create a GitHub Repository
1. Go to https://github.com/new
2. Repository name: `shopify-payment-gateway`
3. Set it to **Private**
4. Click "Create repository"
5. Upload ALL the files from this project to the repository:
   - You can drag and drop files on the GitHub page
   - Or use the "uploading an existing file" link
   - Make sure to maintain the folder structure:
     ```
     shopify-payment-gateway/
     ├── api/
     │   ├── nowpayments-create.js
     │   ├── nowpayments-webhook.js
     │   ├── fedapay-create.js
     │   └── fedapay-webhook.js
     ├── public/
     │   ├── pay.html
     │   ├── success.html
     │   └── cancel.html
     ├── package.json
     └── vercel.json
     ```

### STEP 3: Create a Vercel Account & Deploy
1. Go to https://vercel.com
2. Click "Sign up" → "Continue with GitHub"
3. Authorize Vercel to access your GitHub
4. Once logged in, click "Add New..." → "Project"
5. Find your `shopify-payment-gateway` repository and click "Import"
6. Leave all settings as default
7. Click "Deploy"
8. Wait for deployment to complete (usually 30-60 seconds)
9. Note your deployment URL (e.g., `shopify-payment-gateway.vercel.app`)

### STEP 4: Configure Environment Variables in Vercel
1. In your Vercel project, go to "Settings" → "Environment Variables"
2. Add these variables one by one:

| Name                        | Value                                | Where to find it                     |
|-----------------------------|--------------------------------------|--------------------------------------|
| `NOWPAYMENTS_API_KEY`       | Your NOWPayments API key             | NOWPayments Dashboard → API Keys     |
| `NOWPAYMENTS_IPN_SECRET`    | Your NOWPayments IPN secret          | NOWPayments Dashboard → IPN Settings |
| `FEDAPAY_SECRET_KEY`        | Your FedaPay secret key              | FedaPay Dashboard → API Keys         |
| `FEDAPAY_ENV`               | `sandbox` (for testing) or `live`    | Use `sandbox` first, then `live`     |
| `SHOPIFY_SHOP`              | `your-store` (just the name)         | The part before .myshopify.com       |
| `SHOPIFY_CLIENT_ID`         | Your Shopify app Client ID           | See Step 5 below                     |
| `SHOPIFY_CLIENT_SECRET`     | Your Shopify app Client Secret       | See Step 5 below                     |

3. After adding all variables, go to "Deployments" and click "Redeploy" on the latest deployment

### STEP 5: Create a Shopify App (Client Credentials)
1. In your Shopify admin, go to **Settings** → **Apps and sales channels**
2. Click **"Develop apps"** (you may need to enable developer access first)
3. Click **"Create an app"**
4. Name it: `Payment Gateway`
5. Go to **"Configuration"** → under Admin API integration, click **"Configure"**
6. Enable these permissions:
   - `read_orders`
   - `write_orders`
   - `read_customers`
7. Click **"Save"**
8. Go to **"API credentials"** tab
9. Copy the **Client ID** and **Client Secret**
10. Add them as `SHOPIFY_CLIENT_ID` and `SHOPIFY_CLIENT_SECRET` in Vercel (Step 4)
11. Set `SHOPIFY_SHOP` to your store name (e.g., `my-store` — just the name, not `.myshopify.com`)

### STEP 6: Configure NOWPayments IPN
1. Log into your NOWPayments dashboard
2. Go to **Settings** → **IPN** (Instant Payment Notifications)
3. Set the IPN callback URL to:
   ```
   https://YOUR-VERCEL-URL.vercel.app/api/nowpayments-webhook
   ```
4. Copy the IPN Secret and add it to Vercel as `NOWPAYMENTS_IPN_SECRET`

### STEP 7: Add Payment Methods in Shopify
1. In Shopify admin, go to **Settings** → **Payments**
2. Scroll to **"Manual payment methods"**
3. Click **"Create custom payment method"**

**For Crypto (NOWPayments):**
- Payment method name: `Pay with Crypto (BTC, ETH, USDT & more)`
- Additional details: `After placing your order, you will be redirected to complete payment with your preferred cryptocurrency.`
- Payment instructions: `Please click the payment link below or check your email for the crypto payment invoice.`

**For Mobile Money (FedaPay):**
- Payment method name: `Pay with Mobile Money (MTN, Moov, Orange)`
- Additional details: `After placing your order, you will be redirected to complete payment via Mobile Money.`
- Payment instructions: `Please click the payment link below or check your email for the Mobile Money payment request.`

### STEP 8: Add Redirect Script to Shopify
This is the key step — it automatically redirects customers to your payment page after checkout.

1. In Shopify admin, go to **Settings** → **Checkout**
2. Scroll down to **"Order status page"** → **"Additional scripts"**
3. Paste this script:

```html
<script>
  // Only run for orders with manual payment methods
  if (Shopify.checkout.payment_method && 
      (Shopify.checkout.payment_method.includes('Crypto') || 
       Shopify.checkout.payment_method.includes('Mobile Money'))) {
    
    var orderId = Shopify.checkout.order_id;
    var totalPrice = Shopify.checkout.total_price;
    var currency = Shopify.checkout.currency;
    
    // Redirect to your payment page
    var payUrl = 'https://YOUR-VERCEL-URL.vercel.app/pay/?order_id=' + orderId + 
                 '&amount=' + totalPrice + 
                 '&currency=' + currency +
                 '&description=' + encodeURIComponent('Tangem Wallet');
    
    window.location.href = payUrl;
  }
</script>
```

**IMPORTANT:** Replace `YOUR-VERCEL-URL.vercel.app` with your actual Vercel deployment URL.

### STEP 9: Update Store URLs in the Code
Before deploying, update these files with your actual Shopify store URL:
- `public/success.html` — Replace `YOUR-STORE.myshopify.com` with your store URL
- `public/cancel.html` — Replace `YOUR-STORE.myshopify.com` with your store URL

---

## TESTING

### Test the Flow
1. First, set `FEDAPAY_ENV` to `sandbox` in Vercel
2. Place a test order on your Shopify store
3. Choose one of the custom payment methods
4. Verify you're redirected to the payment page
5. Test the crypto payment flow (NOWPayments has a sandbox mode too)
6. Check that the order status updates in Shopify after payment

### Test URLs
- Payment page: `https://YOUR-VERCEL-URL.vercel.app/pay/?order_id=TEST123&amount=59.99&currency=EUR`
- Success page: `https://YOUR-VERCEL-URL.vercel.app/public/success.html?order_id=TEST123`
- Cancel page: `https://YOUR-VERCEL-URL.vercel.app/public/cancel.html?order_id=TEST123`

---

## TROUBLESHOOTING

**Payment page not loading?**
→ Check your Vercel deployment logs for errors

**Orders not being marked as paid?**
→ Verify your Shopify Admin API token has the correct permissions
→ Check Vercel logs for webhook errors

**NOWPayments not sending callbacks?**
→ Verify IPN URL is correct in NOWPayments dashboard
→ Make sure IPN Secret matches in Vercel environment variables

**FedaPay errors?**
→ Make sure FEDAPAY_ENV matches your key type (sandbox vs live)
→ Check FedaPay dashboard for transaction status

---

## FILE STRUCTURE

```
shopify-payment-gateway/
├── api/
│   ├── nowpayments-create.js    → Creates crypto payment invoices
│   ├── nowpayments-webhook.js   → Handles crypto payment confirmations
│   ├── fedapay-create.js        → Creates mobile money payments
│   └── fedapay-webhook.js       → Handles mobile money confirmations
├── public/
│   ├── pay.html                 → Payment method selection page
│   ├── success.html             → Payment success page
│   └── cancel.html              → Payment cancelled page
├── package.json
├── vercel.json                  → Vercel deployment config
└── README.md                    → This file
```
