import express from 'express';
import { createServer as createViteServer } from 'vite';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import fs from 'fs';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Mehmet.123';
const ADMIN_COOKIE_SECRET = process.env.ADMIN_COOKIE_SECRET || 'hillbodysport-admin-secret';

function parseCookies(req) {
  const cookieHeader = req.headers.cookie || '';
  return cookieHeader.split(';').reduce((cookies, cookie) => {
    const [name, ...rest] = cookie.split('=');
    if (!name) return cookies;
    cookies[name.trim()] = rest.join('=').trim();
    return cookies;
  }, {});
}

function createAdminToken() {
  return crypto.createHmac('sha256', ADMIN_COOKIE_SECRET).update(ADMIN_PASSWORD).digest('hex');
}

function isAdminAuthenticated(req) {
  const cookies = parseCookies(req);
  return cookies.adminAuth === createAdminToken();
}

function adminAuthMiddleware(req, res, next) {
  if (isAdminAuthenticated(req)) {
    return next();
  }
  return res.status(401).json({ message: 'Unauthorized' });
}

const vite = await createViteServer({
  server: { middlewareMode: true },
  appType: 'html',
  root: path.join(__dirname, 'src'),
});

app.use(vite.middlewares);

const donationSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, trim: true, default: '' },
  amount: { type: Number, required: true, min: 1 },
  note: { type: String, trim: true, default: '' },
  createdAt: { type: Date, default: Date.now },
});

const Donation = mongoose.model('Donation', donationSchema);

const orderSchema = new mongoose.Schema({
  orderId: { type: String, required: true, unique: true },
  productId: { type: String, required: true },
  productName: { type: String, required: true },
  customerName: { type: String, required: true, trim: true },
  customerEmail: { type: String, trim: true, default: '' },
  customerPhone: { type: String, trim: true, default: '' },
  amount: { type: Number, required: true, min: 1 },
  status: { type: String, default: 'Beklemede' },
  createdAt: { type: Date, default: Date.now },
});

const Order = mongoose.model('Order', orderSchema);

let inMemoryDonations = [];
let inMemoryOrders = [];
let mongoReady = false;

let products = [
  {
    id: 'product-1',
    name: 'Modern Chair',
    price: 250,
    description: 'Şık ve konforlu sandalye.',
    image: './assets/images/product-img-1.jpg',
  },
  {
    id: 'product-2',
    name: 'Floor Lamp',
    price: 320,
    description: 'Ortama sıcaklık katan dekoratif aydınlatma.',
    image: './assets/images/product-img-2.jpg',
  },
  {
    id: 'product-3',
    name: 'Comfort Chair',
    price: 420,
    description: 'Rahat oturum deneyimi için tasarlandı.',
    image: './assets/images/product-img-3.jpg',
  },
  {
    id: 'product-4',
    name: 'Luxury Stool',
    price: 280,
    description: 'Modern yaşam alanlarına uygun tabure.',
    image: './assets/images/product-img-4.jpg',
  },
  {
    id: 'product-5',
    name: 'High Back Boss Chair',
    price: 520,
    description: 'Yüksek destekli yönetici koltuğu.',
    image: './assets/images/product-img-5.jpg',
  },
  {
    id: 'product-6',
    name: 'Fancy Metal Clock',
    price: 180,
    description: 'Duvarınıza şıklık katacak metal saat.',
    image: './assets/images/product-img-6.jpg',
  },
  {
    id: 'product-7',
    name: 'Modern Frame Stool',
    price: 220,
    description: 'Minimalist tasarımlı oturma taburesi.',
    image: './assets/images/product-img-7.jpg',
  },
  {
    id: 'product-8',
    name: 'Decor Pillow',
    price: 140,
    description: 'Renkli ve konforlu dekoratif yastık.',
    image: './assets/images/product-img-8.jpg',
  },
];

let nextProductId = 9;

let sliders = [
  {
    id: 'slider-1',
    image: './assets/images/slider/slider-img-2.png',
    badge: '%20 Sell',
    title: 'Comfy Sofa Home-Office',
    description: 'Comfortable and stylish sofa for your home office.',
    priceLabel: '$50',
    buttonText: 'View Details',
    buttonLink: '#',
  },
  {
    id: 'slider-2',
    image: './assets/images/slider/slider-img-1.png',
    badge: '%10 Sell',
    title: 'Exchange your old furniture',
    description: 'Save up to $50 for your home office.',
    priceLabel: '$45',
    buttonText: 'View Details',
    buttonLink: '#',
  },
  {
    id: 'slider-3',
    image: './assets/images/slider/slider-img-3.png',
    badge: '%25 Sell',
    title: 'Crafted royal comfort sofa',
    description: 'Experience the elegance of timeless craftsmanship with our Sofa.',
    priceLabel: '$89',
    buttonText: 'View Details',
    buttonLink: '#',
  },
];

let nextSliderId = 4;

async function connectDatabase() {
  const uri = process.env.MONGO_URI;

  if (!uri || /<[^>]+>/.test(uri)) {
    console.warn('MONGO_URI is not set to a real MongoDB Atlas connection string. Using in-memory storage for now.');
    return;
  }

  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
    mongoReady = true;
    console.log('MongoDB connected successfully.');
  } catch (error) {
    console.warn('MongoDB connection failed. Falling back to in-memory storage.', error.message);
  }
}

async function getAllDonations() {
  if (mongoReady) {
    return Donation.find().sort({ createdAt: -1 });
  }

  return inMemoryDonations.slice().reverse();
}

async function createDonation(payload) {
  if (mongoReady) {
    return Donation.create(payload);
  }

  const donation = {
    ...payload,
    createdAt: new Date(),
  };

  inMemoryDonations.push(donation);
  return donation;
}

async function getAllOrders() {
  if (mongoReady) {
    return Order.find().sort({ createdAt: -1 });
  }

  return inMemoryOrders.slice().reverse();
}

async function createOrder(payload) {
  if (mongoReady) {
    return Order.create(payload);
  }

  const order = {
    ...payload,
    createdAt: new Date(),
  };

  inMemoryOrders.push(order);
  return order;
}

function getBaseUrl(req) {
  const forwardedProto = req.headers['x-forwarded-proto'];
  const protocol = Array.isArray(forwardedProto) ? forwardedProto[0] : forwardedProto || req.protocol;
  const host = req.get('host');
  return `${protocol}://${host}`;
}

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', mode: mongoReady ? 'mongodb' : 'memory' });
});

app.post('/api/admin/login', (req, res) => {
  const { password } = req.body || {};
  if (!password || password !== ADMIN_PASSWORD) {
    return res.status(401).json({ message: 'Şifre yanlış.' });
  }

  const token = createAdminToken();
  res.cookie('adminAuth', token, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000,
  });

  return res.json({ ok: true });
});

app.post('/api/admin/logout', (req, res) => {
  res.cookie('adminAuth', '', { maxAge: 0, httpOnly: true, sameSite: 'lax' });
  return res.json({ ok: true });
});

app.use('/api/admin', adminAuthMiddleware);

app.get('/api/donations', async (_req, res) => {
  try {
    const donations = await getAllDonations();
    res.json(donations);
  } catch (error) {
    res.status(500).json({ message: 'Unable to fetch donations.', error: error.message });
  }
});

app.get('/api/admin/summary', async (_req, res) => {
  try {
    const donations = await getAllDonations();
    const orders = await getAllOrders();
    const totalAmount = donations.reduce((sum, donation) => sum + Number(donation.amount || 0), 0);

    res.json({
      totalDonations: donations.length,
      totalAmount: Number(totalAmount.toFixed(2)),
      recentDonations: donations.slice(0, 5),
      totalOrders: orders.length,
      recentOrders: orders.slice(0, 5),
    });
  } catch (error) {
    res.status(500).json({ message: 'Unable to calculate summary.', error: error.message });
  }
});

app.post('/api/donations', async (req, res) => {
  const { name, email, amount, note } = req.body || {};
  const parsedAmount = Number(amount);

  if (!name || !String(name).trim()) {
    return res.status(400).json({ message: 'Lütfen adınızı yazın.' });
  }

  if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
    return res.status(400).json({ message: 'Bağış tutarı geçerli bir sayı olmalı.' });
  }

  try {
    const donation = await createDonation({
      name: String(name).trim(),
      email: String(email || '').trim(),
      amount: parsedAmount,
      note: String(note || '').trim(),
    });

    res.status(201).json({ message: 'Bağışınız başarıyla alındı.', donation });
  } catch (error) {
    res.status(500).json({ message: 'Bağış kaydedilemedi.', error: error.message });
  }
});

app.get('/api/products', (_req, res) => {
  res.json(products);
});

app.get('/api/sliders', (_req, res) => {
  res.json(sliders);
});

app.get('/api/admin/products', (_req, res) => {
  res.json(products);
});

app.get('/api/admin/sliders', (_req, res) => {
  res.json(sliders);
});

app.post('/api/admin/sliders', (req, res) => {
  const { image, badge, title, description, priceLabel, buttonText, buttonLink } = req.body || {};

  if (!title || !String(title).trim()) {
    return res.status(400).json({ message: 'Slider başlığı zorunlu.' });
  }

  const slider = {
    id: `slider-${nextSliderId++}`,
    image: String(image || './assets/images/slider/slider-img-1.png').trim(),
    badge: String(badge || '').trim(),
    title: String(title).trim(),
    description: String(description || '').trim(),
    priceLabel: String(priceLabel || '').trim(),
    buttonText: String(buttonText || 'View Details').trim(),
    buttonLink: String(buttonLink || '#').trim(),
  };

  sliders = [slider, ...sliders];
  res.status(201).json(slider);
});

app.put('/api/admin/sliders/:id', (req, res) => {
  const { id } = req.params;
  const { image, badge, title, description, priceLabel, buttonText, buttonLink } = req.body || {};

  if (!title || !String(title).trim()) {
    return res.status(400).json({ message: 'Slider başlığı zorunlu.' });
  }

  const index = sliders.findIndex((item) => item.id === id);
  if (index === -1) {
    return res.status(404).json({ message: 'Slider bulunamadı.' });
  }

  sliders[index] = {
    ...sliders[index],
    image: String(image || sliders[index].image || './assets/images/slider/slider-img-1.jpg').trim(),
    badge: String(badge || sliders[index].badge || '').trim(),
    title: String(title).trim(),
    description: String(description || sliders[index].description || '').trim(),
    priceLabel: String(priceLabel || sliders[index].priceLabel || '').trim(),
    buttonText: String(buttonText || sliders[index].buttonText || 'View Details').trim(),
    buttonLink: String(buttonLink || sliders[index].buttonLink || '#').trim(),
  };

  res.json(sliders[index]);
});

app.delete('/api/admin/sliders/:id', (req, res) => {
  const { id } = req.params;
  const existing = sliders.find((item) => item.id === id);
  if (!existing) {
    return res.status(404).json({ message: 'Slider bulunamadı.' });
  }

  sliders = sliders.filter((item) => item.id !== id);
  res.json({ message: 'Slider silindi.', id });
});

app.get('/api/admin/orders', async (_req, res) => {
  try {
    const orders = await getAllOrders();
    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: 'Siparişler alınamadı.', error: error.message });
  }
});

app.put('/api/admin/orders/:orderId/status', async (req, res) => {
  const { orderId } = req.params;
  const { status } = req.body || {};

  try {
    if (mongoReady) {
      const updatedOrder = await Order.findOneAndUpdate({ orderId }, { status: String(status || 'Beklemede').trim() }, { new: true });
      if (!updatedOrder) {
        return res.status(404).json({ message: 'Sipariş bulunamadı.' });
      }
      return res.json(updatedOrder);
    }

    const index = inMemoryOrders.findIndex((item) => item.orderId === orderId);
    if (index === -1) {
      return res.status(404).json({ message: 'Sipariş bulunamadı.' });
    }

    inMemoryOrders[index] = { ...inMemoryOrders[index], status: String(status || 'Beklemede').trim() };
    return res.json(inMemoryOrders[index]);
  } catch (error) {
    res.status(500).json({ message: 'Sipariş durumu güncellenemedi.', error: error.message });
  }
});

app.post('/api/admin/products', (req, res) => {
  const { name, price, description, image } = req.body || {};
  const parsedPrice = Number(price);

  if (!name || !String(name).trim()) {
    return res.status(400).json({ message: 'Ürün adı zorunlu.' });
  }

  if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
    return res.status(400).json({ message: 'Ürün fiyatı geçerli olmalı.' });
  }

  const product = {
    id: `product-${nextProductId++}`,
    name: String(name).trim(),
    price: Number(parsedPrice.toFixed(2)),
    description: String(description || '').trim(),
    image: String(image || './assets/images/product-img-1.jpg').trim(),
  };

  products = [product, ...products];
  res.status(201).json(product);
});

app.put('/api/admin/products/:id', (req, res) => {
  const { id } = req.params;
  const { name, price, description, image } = req.body || {};
  const parsedPrice = Number(price);

  if (!name || !String(name).trim()) {
    return res.status(400).json({ message: 'Ürün adı zorunlu.' });
  }

  if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
    return res.status(400).json({ message: 'Ürün fiyatı geçerli olmalı.' });
  }

  const index = products.findIndex((item) => item.id === id);
  if (index === -1) {
    return res.status(404).json({ message: 'Ürün bulunamadı.' });
  }

  products[index] = {
    ...products[index],
    name: String(name).trim(),
    price: Number(parsedPrice.toFixed(2)),
    description: String(description || '').trim(),
    image: String(image || products[index].image || './assets/images/product-img-1.jpg').trim(),
  };

  res.json(products[index]);
});

app.delete('/api/admin/products/:id', (req, res) => {
  const { id } = req.params;
  const existing = products.find((item) => item.id === id);
  if (!existing) {
    return res.status(404).json({ message: 'Ürün bulunamadı.' });
  }

  products = products.filter((item) => item.id !== id);
  res.json({ message: 'Ürün silindi.', id });
});

app.post('/api/paytr/init', async (req, res) => {
  const { productId, name = '', email = '', phone = '' } = req.body || {};
  const product = products.find((item) => item.id === productId);

  if (!product) {
    return res.status(404).json({ message: 'Ürün bulunamadı.' });
  }

  const merchantId = process.env.PAYTR_MERCHANT_ID;
  const merchantKey = process.env.PAYTR_MERCHANT_KEY;
  const merchantSalt = process.env.PAYTR_MERCHANT_SALT;

  if (!merchantId || !merchantKey || !merchantSalt || /<[^>]+>/.test(merchantId) || /<[^>]+>/.test(merchantKey) || /<[^>]+>/.test(merchantSalt)) {
    return res.status(500).json({ message: 'PayTR ortam değişkenleri eksik veya geçersiz.' });
  }

  const paymentAmount = Math.round(Number(product.price) * 100);
  const merchantOid = `product-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const userBasket = JSON.stringify([{ name: product.name, qty: 1, price: paymentAmount }]);
  const merchantOkUrl = `${getBaseUrl(req)}/api/paytr/success`;
  const merchantFailUrl = `${getBaseUrl(req)}/api/paytr/fail`;
  const userIp = req.ip || '127.0.0.1';
  const hashString = `${merchantId}${merchantOid}${paymentAmount}${userBasket}0${0}TRY${merchantOkUrl}${merchantFailUrl}${name}${merchantSalt}`;
  const paytrToken = crypto.createHash('sha256').update(hashString).digest('hex');

  const payload = new URLSearchParams({
    merchant_id: merchantId,
    user_ip: userIp,
    merchant_oid: merchantOid,
    email: String(email || ''),
    payment_amount: String(paymentAmount),
    paytr_token: paytrToken,
    user_basket: userBasket,
    debug_on: '0',
    no_installment: '0',
    max_installment: '0',
    user_name: String(name || ''),
    user_surname: '',
    user_address: '',
    user_phone: String(phone || ''),
    merchant_ok_url: merchantOkUrl,
    merchant_fail_url: merchantFailUrl,
    timeout_limit: '30',
    currency: 'TRY',
    lang: 'tr',
    test_mode: '0',
  });

  try {
    const response = await fetch('https://www.paytr.com/odeme/api/get-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: payload.toString(),
    });

    const data = await response.json().catch(() => ({}));

    if (!data.token) {
      return res.status(502).json({ message: 'PayTR token alınamadı.', error: data });
    }

    const order = await createOrder({
      orderId: merchantOid,
      productId: product.id,
      productName: product.name,
      customerName: String(name || '').trim(),
      customerEmail: String(email || '').trim(),
      customerPhone: String(phone || '').trim(),
      amount: Number(product.price),
      status: 'Beklemede',
    });

    res.json({
      ok: true,
      redirectUrl: `https://www.paytr.com/odeme/start/${data.token}`,
      orderId: merchantOid,
      product,
      order,
    });
  } catch (error) {
    res.status(502).json({ message: 'PayTR isteği sırasında hata oluştu.', error: error.message });
  }
});

app.get('/api/paytr/success', (_req, res) => {
  res.send('Ödeme başarıyla tamamlandı.');
});

app.get('/api/paytr/fail', (_req, res) => {
  res.status(400).send('Ödeme başarısız oldu.');
});

app.get('/admin', (req, res) => {
  if (isAdminAuthenticated(req)) {
    return res.redirect('/admin.html');
  }
  return res.redirect('/admin-login.html');
});

app.get('/admin.html', (req, res) => {
  if (!isAdminAuthenticated(req)) {
    return res.redirect('/admin-login.html');
  }
  return res.sendFile(path.join(__dirname, 'src', 'admin.html'));
});

app.get('/admin-login.html', (_req, res) => {
  return res.sendFile(path.join(__dirname, 'src', 'admin-login.html'));
});

app.get('*', (req, res, next) => {
  if (req.method !== 'GET' || req.path.startsWith('/api/') || path.extname(req.path)) {
    return next();
  }

  const htmlFile = req.path === '/' ? 'index.html' : `${req.path.replace(/^\/+/, '')}.html`;
  const candidatePath = path.join(__dirname, 'src', htmlFile);

  if (fs.existsSync(candidatePath)) {
    return res.sendFile(candidatePath);
  }

  return res.sendFile(path.join(__dirname, 'src', 'index.html'));
});

const port = Number(process.env.PORT || 3000);

await connectDatabase();

function startServer(portNumber, attempt = 1) {
  const server = app.listen(portNumber, '0.0.0.0', () => {
    console.log(`Donation site running at http://localhost:${portNumber}`);
  });

  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE' && attempt < 20) {
      const nextPort = portNumber + 1;
      console.warn(`Port ${portNumber} is busy. Trying ${nextPort} instead.`);
      server.close(() => startServer(nextPort, attempt + 1));
      return;
    }

    throw error;
  });
}

startServer(port);
