const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const Database = require('better-sqlite3');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// ---------- Database setup ----------
const db = new Database(path.join(__dirname, 'ecommerce.db'));
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    price REAL NOT NULL,
    stock INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    total REAL NOT NULL,
    status TEXT NOT NULL DEFAULT 'placed',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL REFERENCES orders(id),
    product_id INTEGER NOT NULL REFERENCES products(id),
    quantity INTEGER NOT NULL,
    price REAL NOT NULL
  );
`);

// Seed sample products on first run
if (db.prepare('SELECT COUNT(*) AS c FROM products').get().c === 0) {
  const insert = db.prepare('INSERT INTO products (name, description, price, stock) VALUES (?, ?, ?, ?)');
  const seed = [
    ['Wireless Headphones', 'Over-ear Bluetooth headphones with 30-hour battery life.', 2499, 15],
    ['Smart Watch', 'Fitness tracking, heart-rate monitor and notifications.', 3999, 10],
    ['Mechanical Keyboard', 'Compact RGB keyboard with tactile brown switches.', 4599, 8],
    ['USB-C Hub', '7-in-1 hub with HDMI, USB 3.0 ports and SD card reader.', 1299, 25],
    ['Laptop Backpack', 'Water-resistant backpack with a padded 15.6-inch laptop sleeve.', 1499, 20],
  ];
  seed.forEach((p) => insert.run(...p));
}

// ---------- Middleware ----------
app.use(express.json());
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'change-me-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 24 }, // 1 day
  })
);
app.use(express.static(path.join(__dirname, 'public')));

const requireLogin = (req, res, next) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Please log in first' });
  next();
};

// ---------- Auth: registration & login ----------
app.post('/api/register', async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password || password.length < 6) {
    return res.status(400).json({ error: 'Name, email and a password of 6+ characters are required' });
  }
  try {
    const hash = await bcrypt.hash(password, 10);
    const result = db
      .prepare('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)')
      .run(name.trim(), email.trim().toLowerCase(), hash);
    req.session.userId = Number(result.lastInsertRowid);
    res.status(201).json({ id: req.session.userId, name, email });
  } catch (err) {
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get((email || '').trim().toLowerCase());
  if (!user || !(await bcrypt.compare(password || '', user.password_hash))) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  req.session.userId = user.id;
  res.json({ id: user.id, name: user.name, email: user.email });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get('/api/me', (req, res) => {
  if (!req.session.userId) return res.json(null);
  const user = db.prepare('SELECT id, name, email FROM users WHERE id = ?').get(req.session.userId);
  res.json(user || null);
});

// ---------- Products ----------
app.get('/api/products', (req, res) => {
  res.json(db.prepare('SELECT id, name, description, price, stock FROM products ORDER BY id').all());
});

app.get('/api/products/:id', (req, res) => {
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!product) return res.status(404).json({ error: 'Product not found' });
  res.json(product);
});

// ---------- Orders ----------
// Runs in one transaction: if any item fails (missing product or no stock),
// nothing is saved and no stock is changed.
const placeOrder = db.transaction((userId, items) => {
  let total = 0;
  const lines = [];

  for (const { productId, quantity } of items) {
    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(productId);
    if (!product) throw new Error(`Product ${productId} does not exist`);
    if (product.stock < quantity) throw new Error(`Not enough stock for ${product.name}`);
    total += product.price * quantity;
    lines.push({ product, quantity });
  }

  const order = db.prepare('INSERT INTO orders (user_id, total) VALUES (?, ?)').run(userId, total);
  const orderId = Number(order.lastInsertRowid);

  for (const { product, quantity } of lines) {
    db.prepare('INSERT INTO order_items (order_id, product_id, quantity, price) VALUES (?, ?, ?, ?)')
      .run(orderId, product.id, quantity, product.price);
    db.prepare('UPDATE products SET stock = stock - ? WHERE id = ?').run(quantity, product.id);
  }
  return { orderId, total };
});

app.post('/api/orders', requireLogin, (req, res) => {
  const { items } = req.body;
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Your cart is empty' });
  }
  const valid = items.every((i) => Number.isInteger(i.productId) && Number.isInteger(i.quantity) && i.quantity > 0);
  if (!valid) return res.status(400).json({ error: 'Invalid cart items' });

  try {
    const result = placeOrder(req.session.userId, items);
    res.status(201).json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/orders', requireLogin, (req, res) => {
  const orders = db.prepare('SELECT * FROM orders WHERE user_id = ? ORDER BY id DESC').all(req.session.userId);
  const itemsStmt = db.prepare(`
    SELECT oi.quantity, oi.price, p.name
    FROM order_items oi JOIN products p ON p.id = oi.product_id
    WHERE oi.order_id = ?`);
  res.json(orders.map((o) => ({ ...o, items: itemsStmt.all(o.id) })));
});

app.listen(PORT, () => console.log(`Shop running at http://localhost:${PORT}`));
