const express = require('express');
const pool = require('../db');
const router = express.Router();

const IS_LIVE = process.env.SSLC_IS_LIVE === 'true';
const API_DOMAIN = IS_LIVE
  ? 'https://securepay.sslcommerz.com'
  : 'https://sandbox.sslcommerz.com';
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const CURRENCY = process.env.SSLC_CURRENCY || 'USD';

router.post('/init', async (req, res) => {
  const { tranId } = req.body;
  if (!tranId) {
    return res.status(400).json({ error: 'Missing tranId' });
  }

  try {
    // অর্ডার আসে ডাটাবেস থেকে, তাই total ক্লায়েন্ট বদলাতে পারে না
    const result = await pool.query(
      "SELECT * FROM orders WHERE tran_id = $1 AND payment_method = 'online' AND status = 'pending'",
      [tranId]
    );
    const order = result.rows[0];
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const countResult = await pool.query(
      'SELECT COALESCE(SUM(qty), 1) AS n FROM order_items WHERE order_id = $1',
      [order.id]
    );

    const params = new URLSearchParams({
      store_id: process.env.SSLC_STORE_ID,
      store_passwd: process.env.SSLC_STORE_PASS,
      total_amount: Number(order.total).toFixed(2),
      currency: CURRENCY,
      tran_id: order.tran_id,
      success_url: BASE_URL + '/api/pay/success',
      fail_url: BASE_URL + '/api/pay/fail',
      cancel_url: BASE_URL + '/api/pay/cancel',

      cus_name: order.customer_name.slice(0, 50),
      cus_email: 'customer@example.com',   // এখনো ফর্মে ইমেইল নেই, তাই সাময়িক
      cus_add1: order.address.slice(0, 50),
      cus_city: 'Chattogram',
      cus_postcode: '4000',
      cus_country: 'Bangladesh',
      cus_phone: order.phone.slice(0, 20),

      shipping_method: 'NO',
      num_of_item: String(countResult.rows[0].n),
      product_name: 'Nirjas skincare order',
      product_category: 'Skincare',
      product_profile: 'physical-goods'
    });

    const response = await fetch(API_DOMAIN + '/gwprocess/v4/api.php', {
      method: 'POST',
      body: params
    });
   const data = await response.json();

    if (data.status !== 'SUCCESS' || !data.GatewayPageURL) {
      console.error('SSLCommerz init failed:', data.failedreason || data);
      return res.status(502).json({ error: 'Payment gateway error' });
    }

    res.json({ url: data.GatewayPageURL });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// =====================================================
// 2. সফল পেমেন্ট: POST /api/pay/success (গেটওয়ে ক্রেতাকে এখানে পাঠায়)
// =====================================================
router.post('/success', async (req, res) => {
  const { tran_id, val_id } = req.body;

  try {
    if (!tran_id || !val_id) {
      return res.redirect('/order-result.html?status=error');
    }

    // ক্রেতার ব্রাউজারের কথা বিশ্বাস নয়, SSLCommerz কে সরাসরি জিজ্ঞেস করি
    const check = new URLSearchParams({
      val_id: val_id,
      store_id: process.env.SSLC_STORE_ID,
      store_passwd: process.env.SSLC_STORE_PASS,
      format: 'json'
    });
    const vres = await fetch(API_DOMAIN + '/validator/api/validationserverAPI.php?' + check.toString());
    const v = await vres.json();

    const orderResult = await pool.query(
      'SELECT id, total, status FROM orders WHERE tran_id = $1',
      [tran_id]
    );
    const order = orderResult.rows[0];
    if (!order) {
      return res.redirect('/order-result.html?status=error');
    }

    const goodStatus = v.status === 'VALID' || v.status === 'VALIDATED';
const sameTran = v.tran_id === tran_id;
const paidAmount = Number(v.currency_amount || v.amount);
const sameAmount = Math.abs(paidAmount - Number(order.total)) < 0.01;   // ← paidAmount ব্যবহার করো
const sameCurrency = v.currency_type === CURRENCY;

if (!(goodStatus && sameTran && sameAmount && sameCurrency)) {
  console.error('Validation mismatch:', { tran_id, v });
  return res.redirect('/order-result.html?status=error');
}
    await pool.query(
      "UPDATE orders SET status = 'paid' WHERE id = $1 AND status = 'pending'",
      [order.id]
    );

    res.redirect('/order-result.html?status=paid&tran=' + encodeURIComponent(tran_id));
  } catch (error) {
    console.error(error);
    res.redirect('/order-result.html?status=error');
  }
});

// =====================================================
// 3. ব্যর্থ আর বাতিল
// =====================================================
async function closeOrder(req, res, newStatus) {
  const { tran_id } = req.body;
  try {
    if (tran_id) {
      await pool.query(
        'UPDATE orders SET status = $1 WHERE tran_id = $2 AND status = \'pending\'',
        [newStatus, tran_id]
      );
    }
  } catch (error) {
    console.error(error);
  }
  res.redirect('/order-result.html?status=' + newStatus + '&tran=' + encodeURIComponent(tran_id || ''));
}

router.post('/fail', (req, res) => closeOrder(req, res, 'failed'));
router.post('/cancel', (req, res) => closeOrder(req, res, 'cancelled'));

module.exports = router;