require('dotenv').config();
const express = require('express');
const crypto = require('crypto');
const path = require('path');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const pool = require('./db');
const { verifyToken, optionalAuth, isAdmin } = require('./middleware/auth');

if (!process.env.JWT_SECRET) {
  console.error('JWT_SECRET is missing in .env');
  process.exit(1);
}

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);

const dummyHash = bcrypt.hashSync('placeholder-password-1', 10);
const phonePattern = /^(?:\+?88)?01[3-9]\d{8}$/;
const cookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  maxAge: 7 * 24 * 60 * 60 * 1000
};

function rateLimit(max, windowMs) {
  const hits = new Map();
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of hits) {
      if (entry.reset <= now) hits.delete(key);
    }
  }, windowMs).unref();

  return (req, res, next) => {
    const now = Date.now();
    const entry = hits.get(req.ip);
    if (!entry || entry.reset <= now) {
      hits.set(req.ip, { count: 1, reset: now + windowMs });
      return next();
    }
    entry.count += 1;
    if (entry.count > max) {
      res.set('Retry-After', String(Math.ceil((entry.reset - now) / 1000)));
      return res.status(429).json({ error: 'Too many requests, try again later' });
    }
    next();
  };
}

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function cleanEmail(value) {
  if (typeof value !== 'string') return null;
  const email = value.trim().toLowerCase();
  if (email.length > 254) return null;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

function isValidPassword(value) {
  return (
    typeof value === 'string' &&
    value.length >= 8 &&
    value.length <= 72 &&
    /[A-Za-z]/.test(value) &&
    /\d/.test(value)
  );
}

function cleanText(value, min, max) {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  return text.length >= min && text.length <= max ? text : null;
}

function makeToken(user) {
  return jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });
}

app.use((req, res, next) => {
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('X-Frame-Options', 'DENY');
  res.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

app.use(express.static(path.join(__dirname, 'public')));
app.get('/', (req, res) => res.redirect('/shop.html'));
app.use(express.json({ limit: '50kb' }));
app.use(express.urlencoded({ extended: true, limit: '50kb' }));
app.use(cookieParser());
app.use('/api/pay', require('./routes/payment'));

const authLimiter = rateLimit(10, 15 * 60 * 1000);
const orderLimiter = rateLimit(20, 60 * 60 * 1000);

app.get('/api/products', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM products ORDER BY id');
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/orders', orderLimiter, optionalAuth, async (req, res) => {
  const body = req.body || {};
  const name = cleanText(body.name, 2, 100);
  const address = cleanText(body.address, 5, 300);
  const phone = typeof body.phone === 'string' ? body.phone.replace(/[\s-]/g, '') : '';
  const payment = body.payment;
  const items = body.items;

  if (!name) return res.status(400).json({ error: 'Enter a valid name' });
  if (!phonePattern.test(phone)) return res.status(400).json({ error: 'Enter a valid phone number' });
  if (!address) return res.status(400).json({ error: 'Enter a valid address' });
  if (!['cod', 'online'].includes(payment)) return res.status(400).json({ error: 'Invalid payment method' });
  if (!Array.isArray(items) || items.length === 0 || items.length > 50) {
    return res.status(400).json({ error: 'Invalid cart' });
  }

  const merged = new Map();
  for (const item of items) {
    const validItem =
      item &&
      Number.isInteger(item.id) &&
      item.id > 0 &&
      Number.isInteger(item.qty) &&
      item.qty > 0;
    if (!validItem) return res.status(400).json({ error: 'Invalid cart item' });
    merged.set(item.id, (merged.get(item.id) || 0) + item.qty);
  }
  for (const qty of merged.values()) {
    if (qty > 20) return res.status(400).json({ error: 'Maximum 20 per product' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const found = await client.query('SELECT id, price FROM products WHERE id = ANY($1)', [[...merged.keys()]]);
    const priceById = new Map(found.rows.map(row => [row.id, Number(row.price)]));

    let total = 0;
    for (const [id, qty] of merged) {
      const price = priceById.get(id);
      if (price === undefined) throw httpError(400, 'Invalid product ID: ' + id);
      total += price * qty;
    }
    total = Math.round(total * 100) / 100;

    const tranId = 'NJ' + Date.now() + crypto.randomBytes(3).toString('hex');
    const userId = req.user ? req.user.id : null;

    const orderResult = await client.query(
      'INSERT INTO orders (customer_name, phone, address, payment_method, total, status, tran_id, user_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id',
      [name, phone, address, payment, total, 'pending', tranId, userId]
    );
    const orderId = orderResult.rows[0].id;

    for (const [id, qty] of merged) {
      await client.query(
        'INSERT INTO order_items (order_id, product_id, qty, unit_price) VALUES ($1, $2, $3, $4)',
        [orderId, id, qty, priceById.get(id)]
      );
      for (const [id, qty] of merged) {
  await client.query(
    'INSERT INTO order_items (order_id, product_id, qty, unit_price) VALUES ($1, $2, $3, $4)',
    [orderId, id, qty, priceById.get(id)]
  );

  const updated = await client.query(
    'UPDATE products SET stock = stock - $1 WHERE id = $2 AND stock >= $1',
    [qty,id]
  );
  if (updated.rowCount === 0) {
    throw httpError(409, 'Not enough stock for product ' + id);
  }
}
    }

    await client.query('COMMIT');
    res.json({ orderId, tranId });
  } catch (error) {
    await client.query('ROLLBACK');
    if (error.status) {
      return res.status(error.status).json({ error: error.message });
    }
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
});
app.get('/api/me', optionalAuth, async (req, res) => {
  if (!req.user) return res.json({ user: null });

  try {
    const result = await pool.query(
      'SELECT id, name, email, role FROM users WHERE id = $1',
      [req.user.id]
    );
    res.json({ user: result.rows[0] || null });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/signup', authLimiter, async (req, res) => {
  const body = req.body || {};
  const email = cleanEmail(body.email);
  const password = body.password;
  const name = cleanText(body.name, 2, 60);
if (!name) return res.status(400).json({ error: 'Enter your name (2 to 60 characters)' });

  if (!email) return res.status(400).json({ error: 'Enter a valid email' });
  if (!isValidPassword(password)) {
    return res.status(400).json({ error: 'Password must be 8 to 72 characters with a letter and a number' });
  }

  try {
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Email already exists' });
    }

    const hash = await bcrypt.hash(password, 10);
    const created = await pool.query(
      'INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id, role',
      [name, email, hash, 'user']
    );

    res.cookie('token', makeToken(created.rows[0]), cookieOptions);
    res.status(201).json({ message: 'Account created' });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Email already exists' });
    }
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/login', authLimiter, async (req, res) => {
  const body = req.body || {};
  const email = cleanEmail(body.email);
  const password = body.password;

  if (!email || typeof password !== 'string' || password.length === 0 || password.length > 72) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  try {
    const result = await pool.query('SELECT id, password_hash, role FROM users WHERE email = $1', [email]);
    const user = result.rows[0];
    const match = await bcrypt.compare(password, user ? user.password_hash : dummyHash);

    if (!user || !match) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    res.cookie('token', makeToken(user), cookieOptions);
    res.json({ message: 'Login successful', role: user.role });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/logout', (req, res) => {
  res.clearCookie('token', { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' });
  res.json({ message: 'Logged out' });
});
app.get('/api/my/orders', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT o.customer_name, o.phone, o.address,o.id, o.tran_id, o.total, o.status, o.payment_method, o.created_at,
              COALESCE(
                json_agg(json_build_object('product_id', i.product_id, 'name', p.name, 'image_url', p.image_url, 'qty', i.qty, 'price', i.unit_price)ORDER BY i.id)
                FILTER (WHERE i.id IS NOT NULL),
                '[]'::json
              ) AS items
       FROM orders o
       LEFT JOIN order_items i ON i.order_id = o.id
       LEFT JOIN products p ON p.id = i.product_id
       WHERE o.user_id = $1
       GROUP BY o.id
       ORDER BY o.id DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});
app.patch('/api/admin/orders/:id/status', verifyToken, isAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const status = req.body.status;
  const allowed = ['pending', 'paid', 'shipped', 'delivered', 'cancelled'];

  if (!Number.isInteger(id) || !allowed.includes(status)) {
    return res.status(400).json({ error: 'Invalid order or status' });
  }

  try {
    const result = await pool.query(
      'UPDATE orders SET status = $1 WHERE id = $2 RETURNING id, status',
      [status, id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});
app.get('/api/admin/orders', verifyToken, isAdmin, async (req, res) => {
  try {
    const result = await pool.query(
     `SELECT o.id, o.tran_id, o.customer_name, o.phone, o.address, o.total, o.status, o.payment_method, o.created_at, u.email,
        COALESCE(
          json_agg(json_build_object('product_id', i.product_id, 'name', p.name, 'image_url', p.image_url, 'qty', i.qty, 'price', i.unit_price) ORDER BY i.id)
          FILTER (WHERE i.id IS NOT NULL),
          '[]'::json
        ) AS items
 FROM orders o
 LEFT JOIN users u ON u.id = o.user_id
 LEFT JOIN order_items i ON i.order_id = o.id
 LEFT JOIN products p ON p.id = i.product_id
 GROUP BY o.id, u.email
 ORDER BY o.id DESC
 LIMIT 200`
    );
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.use((error, req, res, next) => {
  if (error.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid request body' });
  }
  if (error.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Request too large' });
  }
  console.error(error);
  res.status(500).json({ error: 'Server error' });
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log('Server is running on port ' + port);
});
