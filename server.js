/* =========================================================
   DHANA FOODS
   MongoDB Order Server (works locally AND on Vercel)
========================================================= */
require("dotenv").config();
const dns = require("dns");
dns.setServers(["8.8.8.8", "1.1.1.1"]);
const express = require("express");
const path = require("path");
const crypto = require("crypto");
const { promisify } = require("util");
const scrypt = promisify(crypto.scrypt);
const { MongoClient, ObjectId } = require("mongodb");
const Razorpay = require("razorpay");
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

const app = express();

const PORT = process.env.PORT || 3000;
const HOST = "0.0.0.0";


/* =========================================================
   DATABASE (lazy connection - required for Vercel)
========================================================= */

// Removes accidental quotes / spaces / "MONGODB_URI=" prefix
function getMongoUri() {
  let uri = String(process.env.MONGODB_URI || "").trim();
  uri = uri.replace(/^MONGODB_URI\s*=\s*/i, "");
  uri = uri.replace(/^["']+|["']+$/g, "").trim();
  return uri;
}

let clientPromise = null;

async function getDb() {
  const uri = getMongoUri();

  if (!uri) {
    throw new Error("MONGODB_URI is missing.");
  }

  if (!clientPromise) {
    clientPromise = new MongoClient(uri)
      .connect()
      .catch((err) => {
        clientPromise = null; // allow retry on next request
        throw err;
      });
  }

  const client = await clientPromise;
  return client.db("DhanaFoods");
}

async function getOrders() {
  const db = await getDb();
  return db.collection("orders");
}


/* =========================================================
   MIDDLEWARE
========================================================= */

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Only the "public" folder is served (never expose .env or server.js).
// On Vercel, the public folder is also served automatically by the CDN.
app.use(express.static(path.join(__dirname, "public")));


/* =========================================================
   ADMIN AUTHENTICATION
   Admin credentials and signing secret must be configured
   as environment variables. Never hardcode them in frontend.
========================================================= */

function safeEqualText(a, b) {
  const left = Buffer.from(String(a || ""));
  const right = Buffer.from(String(b || ""));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function createAdminToken(username) {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("ADMIN_SESSION_SECRET must contain at least 32 characters.");
  }
  const payload = Buffer.from(JSON.stringify({
    sub: username,
    role: "admin",
    exp: Date.now() + (8 * 60 * 60 * 1000)
  })).toString("base64url");
  const signature = crypto.createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

function requireAdmin(req, res, next) {
  const authHeader = String(req.headers.authorization || "");
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  const secret = process.env.ADMIN_SESSION_SECRET;

  if (!token || !secret || secret.length < 32) {
    return res.status(401).json({ error: "Admin authentication required." });
  }

  const parts = token.split(".");
  if (parts.length !== 2) {
    return res.status(401).json({ error: "Invalid or expired admin session." });
  }

  const [payload, receivedSignature] = parts;
  const expectedSignature = crypto.createHmac("sha256", secret).update(payload).digest("base64url");
  if (!safeEqualText(receivedSignature, expectedSignature)) {
    return res.status(401).json({ error: "Invalid or expired admin session." });
  }

  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (session.role !== "admin" || !session.sub || !Number.isFinite(session.exp) || session.exp < Date.now()) {
      return res.status(401).json({ error: "Invalid or expired admin session." });
    }
    req.admin = { username: session.sub, role: session.role };
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired admin session." });
  }
}

app.post("/api/admin/login", (req, res) => {
  const configuredUsername = process.env.ADMIN_USERNAME;
  const configuredPassword = process.env.ADMIN_PASSWORD;
  const sessionSecret = process.env.ADMIN_SESSION_SECRET;

  if (!configuredUsername || !configuredPassword || !sessionSecret || sessionSecret.length < 32) {
    return res.status(503).json({ error: "Admin login is not configured. Set the required server environment variables." });
  }

  const { username, password } = req.body || {};
  if (!safeEqualText(username, configuredUsername) || !safeEqualText(password, configuredPassword)) {
    return res.status(401).json({ error: "Invalid username or password." });
  }

  return res.json({ success: true, token: createAdminToken(configuredUsername), username: configuredUsername });
});

app.get("/api/admin/me", requireAdmin, (req, res) => {
  res.json({ authenticated: true, username: req.admin.username, role: req.admin.role });
});

/* =========================================================
   CUSTOMER AUTHENTICATION
   Passwords are salted + hashed with Node.js scrypt.
========================================================= */

function customerSessionSecret() {
  const secret = process.env.CUSTOMER_SESSION_SECRET || process.env.ADMIN_SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error("CUSTOMER_SESSION_SECRET must contain at least 32 characters.");
  return secret;
}

function createCustomerToken(customer) {
  const payload = Buffer.from(JSON.stringify({
    sub: customer._id.toString(), role: "customer",
    exp: Date.now() + (7 * 24 * 60 * 60 * 1000)
  })).toString("base64url");
  const signature = crypto.createHmac("sha256", customerSessionSecret()).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

async function verifyCustomerToken(req, res, next) {
  const header = String(req.headers.authorization || "");
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  const secret = process.env.CUSTOMER_SESSION_SECRET || process.env.ADMIN_SESSION_SECRET;
  if (!token || !secret || secret.length < 32) return res.status(401).json({ error: "Customer login required." });
  const parts = token.split(".");
  if (parts.length !== 2) return res.status(401).json({ error: "Invalid or expired customer session." });
  const [payload, signature] = parts;
  const expected = crypto.createHmac("sha256", secret).update(payload).digest("base64url");
  if (!safeEqualText(signature, expected)) return res.status(401).json({ error: "Invalid or expired customer session." });
  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (session.role !== "customer" || !session.sub || !Number.isFinite(session.exp) || session.exp < Date.now()) {
      return res.status(401).json({ error: "Invalid or expired customer session." });
    }
    const db = await getDb();
    const customer = await db.collection("customers").findOne({ _id: new ObjectId(session.sub) }, { projection: { passwordHash: 0, passwordSalt: 0 } });
    if (!customer) return res.status(401).json({ error: "Customer account not found." });
    req.customer = customer;
    next();
  } catch (error) {
    if (error instanceof TypeError || error.name === "BSONError") return res.status(401).json({ error: "Invalid customer session." });
    console.error("Customer session error:", error);
    return res.status(500).json({ error: "Unable to verify customer session." });
  }
}

app.post("/api/customer/register", async (req, res) => {
  try {
    const name = String(req.body.name || "").trim();
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");
    if (name.length < 2 || name.length > 80) return badRequest(res, "Name must be between 2 and 80 characters.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return badRequest(res, "Enter a valid email address.");
    if (password.length < 8 || password.length > 128) return badRequest(res, "Password must be 8 to 128 characters.");
    const db = await getDb();
    const customers = db.collection("customers");
    await customers.createIndex({ email: 1 }, { unique: true });
    if (await customers.findOne({ email })) return res.status(409).json({ error: "An account with this email already exists." });
    const salt = crypto.randomBytes(16);
    const hash = await scrypt(password, salt, 64);
    const customer = { name, email, passwordSalt: salt.toString("hex"), passwordHash: hash.toString("hex"), createdAt: new Date(), updatedAt: new Date() };
    const result = await customers.insertOne(customer);
    customer._id = result.insertedId;
    return res.status(201).json({ success: true, token: createCustomerToken(customer), customer: { id: result.insertedId.toString(), name, email } });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ error: "An account with this email already exists." });
    console.error("Customer registration error:", error);
    return res.status(500).json({ error: "Unable to create customer account." });
  }
});

app.post("/api/customer/login", async (req, res) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");
    const db = await getDb();
    const customer = await db.collection("customers").findOne({ email });
    if (!customer) return res.status(401).json({ error: "Invalid email or password." });
    const hash = await scrypt(password, Buffer.from(customer.passwordSalt, "hex"), 64);
    if (!safeEqualText(hash.toString("hex"), customer.passwordHash)) return res.status(401).json({ error: "Invalid email or password." });
    return res.json({ success: true, token: createCustomerToken(customer), customer: { id: customer._id.toString(), name: customer.name, email: customer.email } });
  } catch (error) {
    console.error("Customer login error:", error);
    return res.status(500).json({ error: "Unable to sign in." });
  }
});

app.get("/api/customer/me", verifyCustomerToken, (req, res) => {
  res.json({ id: req.customer._id.toString(), name: req.customer.name, email: req.customer.email });
});

app.get("/api/customer/orders", verifyCustomerToken, async (req, res) => {
  try {
    const orders = await (await getOrders()).find({ customerId: req.customer._id.toString() }).sort({ createdAt: -1 }).toArray();
    res.json(orders.map(formatOrder));
  } catch (error) {
    console.error("Customer order history error:", error);
    res.status(500).json({ error: "Unable to load your orders." });
  }
});

app.post("/api/customer/orders/:id/cancel", verifyCustomerToken, async (req, res) => {
  try {
    const id = String(req.params.id || "").trim();
    const customerId = req.customer._id.toString();

    if (!id) {
      return res.status(400).json({ error: "Invalid order ID." });
    }

    const ordersCollection = await getOrders();

    // Only this customer's order can be cancelled
    const order = await ordersCollection.findOne({
      id,
      customerId
    });

    if (!order) {
      return res.status(404).json({
        error: "Order not found."
      });
    }

    // Only Pending and Confirmed orders can be cancelled
    if (!["Pending", "Confirmed"].includes(order.status)) {
      return res.status(400).json({
        error: "This order can no longer be cancelled."
      });
    }

    // Captured Razorpay payments need a separate refund process
    if (order.paymentStatus === "Paid") {
      return res.status(400).json({
        error: "Payment already completed. Please contact support for cancellation and refund."
      });
    }

    // Update only if the order is still cancellable
    const result = await ordersCollection.updateOne(
      {
        id,
        customerId,
        status: { $in: ["Pending", "Confirmed"] },
        paymentStatus: { $ne: "Paid" }
      },
      {
        $set: {
          status: "Cancelled",
          updatedAt: new Date()
        }
      }
    );

    if (result.modifiedCount === 0) {
      return res.status(409).json({
        error: "Order status changed. Please refresh and try again."
      });
    }

    console.log(`Order #${id} cancelled by customer`);

    return res.json({
      success: true,
      message: "Order cancelled successfully.",
      order: {
        id,
        status: "Cancelled"
      }
    });

  } catch (error) {
    console.error("Customer cancellation error:", error);

    return res.status(500).json({
      error: "Unable to cancel order."
    });
  }
});



/* =========================================================
   OFFICIAL PRODUCTS & PRICES
========================================================= */

const PRODUCTS = {
  "Idli Batter": { "500g": 25, "1kg": 45 },
  "Dosa Batter": { "500g": 25, "1kg": 45 },
  "Adai Batter": { "500g": 40, "1kg": 80 },
  "Mappilai Samba Batter": { "500g": 40, "1kg": 80 },
  "Appam Batter": { "500g": 30, "1kg": 60 },
  "Millet Batter": { "500g": 40, "1kg": 80 },
  "Poonghar Batter": { "500g": 40, "1kg": 80 },
  "Karuppu Kavuni Batter": { "500g": 40, "1kg": 80 },
  "Keerai Batter": { "500g": 40, "1kg": 80 },
  "Kambu Yasnam Batter": { "500g": 40, "1kg": 80 },
  "Ragi Batter": { "500g": 40, "1kg": 80 },
  "Karunguruvai Batter": { "500g": 40, "1kg": 80 },
  "Pachai Payiru Batter": { "500g": 40, "1kg": 80 }
};


/* =========================================================
   PRODUCT ALIASES
========================================================= */

const PRODUCT_ALIASES = {
  "idli": "Idli Batter",
  "idli batter": "Idli Batter",

  "dosa": "Dosa Batter",
  "dosa batter": "Dosa Batter",

  "adai": "Adai Batter",
  "adai batter": "Adai Batter",

  "mappilai samba": "Mappilai Samba Batter",
  "mappilai samba batter": "Mappilai Samba Batter",
  "mapillai samba": "Mappilai Samba Batter",
  "mapillai samba batter": "Mappilai Samba Batter",

  "appam": "Appam Batter",
  "appam batter": "Appam Batter",

  "millet": "Millet Batter",
  "millet batter": "Millet Batter",

  "poonghar": "Poonghar Batter",
  "poonghar batter": "Poonghar Batter",
  "poongar": "Poonghar Batter",
  "poongar batter": "Poonghar Batter",

  "karuppu kavuni": "Karuppu Kavuni Batter",
  "karuppu kavuni batter": "Karuppu Kavuni Batter",
  "karupu kavuni": "Karuppu Kavuni Batter",
  "karupu kavuni batter": "Karuppu Kavuni Batter",

  "keerai": "Keerai Batter",
  "keerai batter": "Keerai Batter",

  "kambu yasnam": "Kambu Yasnam Batter",
  "kambu yasnam batter": "Kambu Yasnam Batter",

  "ragi": "Ragi Batter",
  "ragi batter": "Ragi Batter",

  "karunguruvai": "Karunguruvai Batter",
  "karunguruvai batter": "Karunguruvai Batter",
  "karinagaruvai": "Karunguruvai Batter",
  "karinagaruvai batter": "Karunguruvai Batter",
  "karunaguvrai": "Karunguruvai Batter",
  "karunaguvrai batter": "Karunguruvai Batter",
  "karumburuvai": "Karunguruvai Batter",
  "karumburuvai batter": "Karunguruvai Batter",

  "pachai payiru": "Pachai Payiru Batter",
  "pachai payiru batter": "Pachai Payiru Batter",
  "pachai payir": "Pachai Payiru Batter",
  "pachai payir batter": "Pachai Payiru Batter"
};


/* =========================================================
   STATUS
========================================================= */

const VALID_STATUSES = [
  "Pending",
  "Confirmed",
  "Preparing",
  "Out for Delivery",
  "Delivered",
  "Cancelled"
];


/* =========================================================
   HELPERS
========================================================= */

function normalizeProductKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, " ");
}

function normalizeProductName(value) {
  const original = String(value || "").trim();
  if (!original) return "";
  return PRODUCT_ALIASES[normalizeProductKey(original)] || original;
}

function getOfficialPrice(product, size) {
  const canonical = normalizeProductName(product);
  if (!PRODUCTS[canonical] || !PRODUCTS[canonical][size]) return null;
  return PRODUCTS[canonical][size];
}

function calculateTotal(items) {
  return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
}

function formatOrder(order) {
  return {
    id: order.id || order._id.toString(),
    customerName: order.customerName,
    phone: order.phone,
    address: order.address,
    items: order.items,
    total: Number(order.total || 0),
    deliveryDate: order.deliveryDate,
    paymentMethod: order.paymentMethod || "COD",
    status: order.status,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt
  };
}

function badRequest(res, message) {
  return res.status(400).json({ error: message });
}


/* =========================================================
   HEALTH CHECK
========================================================= */

app.get("/health", async (req, res) => {
  try {
    const db = await getDb();
    await db.command({ ping: 1 });

    res.json({
      ok: true,
      database: "connected",
      service: "Dhana Foods"
    });
  } catch (error) {
    console.error("Health check error:", error);

    res.status(500).json({
      ok: false,
      database: "error"
    });
  }
});


/* =========================================================
   PRODUCTS API
========================================================= */

// Seed the original 13 products once, preserving any admin edits thereafter.
const DEFAULT_PRODUCT_META = {
  "Idli Batter": ["🥞", "Soft & fluffy homemade idlis.", "DAILY"],
  "Dosa Batter": ["🫓", "Crispy & delicious homemade dosas.", "DAILY"],
  "Adai Batter": ["🥞", "Traditional protein-rich adai.", "MONDAY"],
  "Mappilai Samba Batter": ["🌾", "Traditional red rice goodness.", "MONDAY"],
  "Appam Batter": ["🥣", "Soft centre with delicious edges.", "TUE / SAT"],
  "Millet Batter": ["🌾", "Wholesome millet goodness.", "WEDNESDAY"],
  "Poonghar Batter": ["🌾", "Traditional Poonghar rice batter.", "THURSDAY"],
  "Karuppu Kavuni Batter": ["🌾", "Nutritious black rice batter.", "THURSDAY"],
  "Keerai Batter": ["🥬", "Homemade greens batter.", "FRIDAY"],
  "Kambu Yasnam Batter": ["🌾", "Wholesome pearl millet batter.", "FRIDAY"],
  "Ragi Batter": ["🌾", "Nutritious ragi batter.", "SATURDAY"],
  "Karunguruvai Batter": ["🌾", "Traditional Karunguruvai rice batter.", "SATURDAY"],
  "Pachai Payiru Batter": ["🌱", "Protein-rich green gram batter.", "SUNDAY"]
};

async function getProductCollection() {
  const db = await getDb();
  const collection = db.collection("products");
  const operations = Object.entries(PRODUCTS).map(([name, sizes]) => {
    const meta = DEFAULT_PRODUCT_META[name] || ["🥣", "Fresh homemade batter.", "FRESH"];
    return {
      updateOne: {
        filter: { name },
        update: { $setOnInsert: {
          name, sizes, icon: meta[0], description: meta[1], schedule: meta[2],
          active: true, stockStatus: "Available", createdAt: new Date(), updatedAt: new Date()
        }},
        upsert: true
      }
    };
  });
  if (operations.length) await collection.bulkWrite(operations);
  return collection;
}

function publicProductShape(product) {
  return {
    id: product._id.toString(),
    name: product.name,
    sizes: product.sizes || {},
    icon: product.icon || "🥣",
    description: product.description || "",
    schedule: product.schedule || "FRESH",
    active: product.active !== false,
    stockStatus: product.stockStatus || "Available"
  };
}

app.get("/api/products", async (req, res) => {
  try {
    const products = await (await getProductCollection()).find({ active: { $ne: false }, stockStatus: "Available" }).sort({ name: 1 }).toArray();
    const result = {};
    for (const product of products) result[product.name] = product.sizes || {};
    res.json(result);
  } catch (error) {
    console.error("Public products error:", error);
    res.status(500).json({ error: "Unable to load products." });
  }
});

app.get("/api/admin/products", requireAdmin, async (req, res) => {
  try {
    const products = await (await getProductCollection()).find({}).sort({ name: 1 }).toArray();
    res.json(products.map(publicProductShape));
  } catch (error) {
    console.error("Admin products error:", error);
    res.status(500).json({ error: "Unable to load products." });
  }
});

app.post("/api/admin/products", requireAdmin, async (req, res) => {
  try {
    const name = String(req.body.name || "").trim();
    const description = String(req.body.description || "").trim();
    const icon = String(req.body.icon || "🥣").trim().slice(0, 8);
    const schedule = String(req.body.schedule || "FRESH").trim().slice(0, 40);
    const sizes = req.body.sizes || {};
    if (name.length < 2 || name.length > 100) return badRequest(res, "Product name must be 2–100 characters.");
    if (!sizes || !Number.isFinite(Number(sizes["500g"])) || Number(sizes["500g"]) <= 0 ||
        !Number.isFinite(Number(sizes["1kg"])) || Number(sizes["1kg"]) <= 0) {
      return badRequest(res, "Enter valid prices for both 500g and 1kg.");
    }
    const collection = await getProductCollection();
    if (await collection.findOne({ name })) return res.status(409).json({ error: "A product with this name already exists." });
    const doc = { name, description, icon, schedule, sizes: { "500g": Number(sizes["500g"]), "1kg": Number(sizes["1kg"]) },
      active: true, stockStatus: "Available", createdAt: new Date(), updatedAt: new Date() };
    const result = await collection.insertOne(doc);
    res.status(201).json({ success: true, product: publicProductShape({ ...doc, _id: result.insertedId }) });
  } catch (error) {
    console.error("Create product error:", error);
    res.status(500).json({ error: "Unable to create product." });
  }
});

app.put("/api/admin/products/:id", requireAdmin, async (req, res) => {
  try {
    if (!ObjectId.isValid(req.params.id)) return badRequest(res, "Invalid product ID.");
    const name = String(req.body.name || "").trim();
    const description = String(req.body.description || "").trim();
    const icon = String(req.body.icon || "🥣").trim().slice(0, 8);
    const schedule = String(req.body.schedule || "FRESH").trim().slice(0, 40);
    const sizes = req.body.sizes || {};
    const stockStatus = req.body.stockStatus === "Out of Stock" ? "Out of Stock" : "Available";
    const active = req.body.active !== false;
    if (name.length < 2 || name.length > 100) return badRequest(res, "Enter a valid product name.");
    if (!Number.isFinite(Number(sizes["500g"])) || Number(sizes["500g"]) <= 0 ||
        !Number.isFinite(Number(sizes["1kg"])) || Number(sizes["1kg"]) <= 0) return badRequest(res, "Enter valid prices for both sizes.");
    const collection = await getProductCollection();
    const duplicate = await collection.findOne({ name, _id: { $ne: new ObjectId(req.params.id) } });
    if (duplicate) return res.status(409).json({ error: "Another product already uses this name." });
    const result = await collection.findOneAndUpdate(
      { _id: new ObjectId(req.params.id) },
      { $set: { name, description, icon, schedule, sizes: { "500g": Number(sizes["500g"]), "1kg": Number(sizes["1kg"]) },
        stockStatus, active, updatedAt: new Date() } },
      { returnDocument: "after" }
    );
    if (!result) return res.status(404).json({ error: "Product not found." });
    res.json({ success: true, product: publicProductShape(result) });
  } catch (error) {
    console.error("Update product error:", error);
    res.status(500).json({ error: "Unable to update product." });
  }
});

app.delete("/api/admin/products/:id", requireAdmin, async (req, res) => {
  try {
    if (!ObjectId.isValid(req.params.id)) return badRequest(res, "Invalid product ID.");
    const collection = await getProductCollection();
    const result = await collection.updateOne({ _id: new ObjectId(req.params.id) },
      { $set: { active: false, stockStatus: "Out of Stock", updatedAt: new Date() } });
    if (!result.matchedCount) return res.status(404).json({ error: "Product not found." });
    res.json({ success: true, message: "Product hidden from the store." });
  } catch (error) {
    console.error("Delete product error:", error);
    res.status(500).json({ error: "Unable to remove product." });
  }
});
/* =========================================================
   RAZORPAY - CREATE PAYMENT ORDER
========================================================= */

/* =========================================================
   RAZORPAY - CREATE PAYMENT ORDER
========================================================= */

app.post("/api/payment/create-order", async (req, res) => {
  try {
    const {
      customerName,
      phone,
      address,
      items,
      deliveryDate
    } = req.body;

    // Customer validation
    if (!customerName || !String(customerName).trim()) {
      return badRequest(res, "Customer name is required.");
    }

    const cleanPhone = String(phone || "").replace(/\D/g, "");

    if (!/^[6-9]\d{9}$/.test(cleanPhone)) {
      return badRequest(res, "Enter a valid mobile number.");
    }

    if (!address || !String(address).trim()) {
      return badRequest(res, "Delivery address is required.");
    }

    if (!deliveryDate || !String(deliveryDate).trim()) {
      return badRequest(res, "Delivery date is required.");
    }

    if (!Array.isArray(items) || items.length === 0) {
      return badRequest(res, "Please select products.");
    }

    // Validate products and calculate official price
    const normalizedItems = [];
    const productDocs = await (await getProductCollection()).find({ active: true, stockStatus: "Available" }).toArray();
    const liveProducts = Object.fromEntries(productDocs.map(p => [p.name, p.sizes || {}]));

    for (const item of items) {
      const product = normalizeProductName(item.product);
      const size = String(item.size || "").trim();
      const quantity = Number(item.quantity);

      if (!liveProducts[product]) {
        return badRequest(res, `${product} is currently unavailable.`);
      }

      if (size !== "500g" && size !== "1kg") {
        return badRequest(res, "Invalid product size.");
      }

      if (!Number.isInteger(quantity) || quantity <= 0 || quantity > 100) {
        return badRequest(res, "Invalid quantity.");
      }

      const officialPrice = Number(liveProducts[product][size]);
      if (!Number.isFinite(officialPrice) || officialPrice <= 0) {
        return badRequest(res, "Invalid product price.");
      }
      normalizedItems.push({ product, size, quantity, price: officialPrice });
    }

    const total = calculateTotal(normalizedItems);

    // Create Razorpay order
    const razorpayOrder = await razorpay.orders.create({
      amount: Math.round(total * 100),
      currency: "INR",
      receipt: `dhana_${Date.now()}`
    });

    // Save pending order in MongoDB
    const ordersCollection = await getOrders();

    const order = {
      id: new ObjectId().toString(),
      customerName: String(customerName).trim(),
      phone: cleanPhone,
      address: String(address).trim(),
      items: normalizedItems,
      total,
      deliveryDate: String(deliveryDate).trim(),
      paymentMethod: "Razorpay",
      paymentStatus: "Pending",
      razorpayOrderId: razorpayOrder.id,
      razorpayPaymentId: null,
      status: "Pending",
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const customerAuth = String(req.headers.authorization || "");
    if (customerAuth.startsWith("Bearer ")) {
      const tokenParts = customerAuth.slice(7).split(".");
      const sessionSecret = process.env.CUSTOMER_SESSION_SECRET || process.env.ADMIN_SESSION_SECRET;
      if (tokenParts.length === 2 && sessionSecret && sessionSecret.length >= 32) {
        const expected = crypto.createHmac("sha256", sessionSecret).update(tokenParts[0]).digest("base64url");
        if (safeEqualText(tokenParts[1], expected)) {
          try {
            const session = JSON.parse(Buffer.from(tokenParts[0], "base64url").toString("utf8"));
            if (session.role === "customer" && session.exp > Date.now() && ObjectId.isValid(session.sub)) {
              const customer = await (await getDb()).collection("customers").findOne({ _id: new ObjectId(session.sub) });
              if (customer) order.customerId = customer._id.toString();
            }
          } catch (_) { /* Invalid optional token: order remains a guest order. */ }
        }
      }
    }

    await ordersCollection.insertOne(order);

    return res.status(201).json({
      success: true,
      key: process.env.RAZORPAY_KEY_ID,
      razorpayOrder,
      orderId: order.id,
      total
    });

  } catch (error) {
    console.error("Create payment order error:", error);

    return res.status(500).json({
      error: "Unable to create payment order."
    });
  }
});
/* =========================================================
   /* =========================================================
   RAZORPAY - VERIFY PAYMENT & UPDATE DATABASE
========================================================= */

app.post("/api/payment/verify", async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      orderId
    } = req.body;

    if (
      !razorpay_order_id ||
      !razorpay_payment_id ||
      !razorpay_signature ||
      !orderId
    ) {
      return badRequest(res, "Missing payment details.");
    }

    // 1. Verify Razorpay signature
    const generatedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    const expectedBuffer = Buffer.from(generatedSignature, "hex");
    const receivedBuffer = Buffer.from(razorpay_signature, "hex");

    if (
      expectedBuffer.length !== receivedBuffer.length ||
      !crypto.timingSafeEqual(expectedBuffer, receivedBuffer)
    ) {
      return res.status(400).json({
        success: false,
        message: "Payment verification failed."
      });
    }

    // 2. Find matching pending order
    const ordersCollection = await getOrders();

    const order = await ordersCollection.findOne({
      id: orderId,
      razorpayOrderId: razorpay_order_id
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found."
      });
    }

    // 3. Prevent duplicate payment processing
    if (order.paymentStatus === "Paid") {
      if (order.razorpayPaymentId === razorpay_payment_id) {
        return res.json({
          success: true,
          message: "Payment already verified.",
          paymentId: razorpay_payment_id
        });
      }

      return res.status(409).json({
        success: false,
        message: "This order has already been paid."
      });
    }

    // 4. Fetch payment details directly from Razorpay
    const payment = await razorpay.payments.fetch(
      razorpay_payment_id
    );

    if (
      payment.order_id !== razorpay_order_id ||
      payment.amount !== Math.round(order.total * 100) ||
      payment.currency !== "INR"
    ) {
      return res.status(400).json({
        success: false,
        message: "Payment details do not match."
      });
    }

    if (payment.status !== "captured") {
      return res.status(400).json({
        success: false,
        message: "Payment is not captured yet."
      });
    }

    // 5. Update MongoDB only after verification
    const result = await ordersCollection.updateOne(
      {
        id: orderId,
        razorpayOrderId: razorpay_order_id,
        paymentStatus: "Pending"
      },
      {
        $set: {
          paymentStatus: "Paid",
          paymentMethod: "Razorpay",
          razorpayPaymentId: razorpay_payment_id,
          status: "Pending",
          updatedAt: new Date()
        }
      }
    );

    if (result.modifiedCount === 0) {
      return res.status(409).json({
        success: false,
        message: "Order payment status could not be updated."
      });
    }

    return res.json({
      success: true,
      message: "Payment verified successfully.",
      paymentId: razorpay_payment_id
    });

  } catch (error) {
    console.error("Payment verification error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to verify payment."
    });
  }
});


/* =========================================================
   CREATE ORDER
========================================================= */

app.post("/api/orders", async (req, res) => {
  try {
    const ordersCollection = await getOrders();

    const {
      customerName,
      phone,
      address,
      items,
      deliveryDate,
      paymentMethod
    } = req.body;

    /* ---- Customer validation ---- */

    if (!customerName || !String(customerName).trim()) {
      return badRequest(res, "Customer name is required.");
    }

    if (!phone || !String(phone).trim()) {
      return badRequest(res, "Phone number is required.");
    }

    const cleanPhone = String(phone).replace(/\D/g, "");

    if (!/^[6-9]\d{9}$/.test(cleanPhone)) {
      return badRequest(res, "Please enter a valid 10-digit mobile number.");
    }

    if (!address || !String(address).trim()) {
      return badRequest(res, "Delivery address is required.");
    }

    if (!deliveryDate || !String(deliveryDate).trim()) {
      return badRequest(res, "Delivery date is required.");
    }

    /* ---- Items validation ---- */

    if (!Array.isArray(items) || items.length === 0) {
      return badRequest(res, "Please select at least one product.");
    }

    const normalizedItems = [];
    const productDocs = await (await getProductCollection()).find({ active: true, stockStatus: "Available" }).toArray();
    const liveProducts = Object.fromEntries(productDocs.map(p => [p.name, p.sizes || {}]));

    for (const item of items) {
      const product = normalizeProductName(item.product);
      const size = String(item.size || "").trim();
      const quantity = Number(item.quantity);

      if (!liveProducts[product]) {
        return badRequest(res, `${product} is currently unavailable.`);
      }

      if (size !== "500g" && size !== "1kg") {
        return badRequest(res, `Invalid size for ${product}.`);
      }

      if (!Number.isInteger(quantity) || quantity <= 0 || quantity > 100) {
        return badRequest(res, `Invalid quantity for ${product}.`);
      }

      const officialPrice = Number(liveProducts[product][size]);

      if (!Number.isFinite(officialPrice) || officialPrice <= 0) {
        return badRequest(res, `Invalid price for ${product}.`);
      }

      normalizedItems.push({
        product,
        size,
        quantity,
        price: officialPrice
      });
    }

    /* ---- Total & payment ---- */

    const total = calculateTotal(normalizedItems);
    const finalPaymentMethod = paymentMethod === "UPI" ? "UPI" : "COD";

    /* ---- Save order ---- */

    const order = {
      id: new ObjectId().toString(),
      customerName: String(customerName).trim(),
      phone: cleanPhone,
      address: String(address).trim(),
      items: normalizedItems,
      total,
      deliveryDate: String(deliveryDate).trim(),
      paymentMethod: finalPaymentMethod,
      status: "Pending",
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const authHeader = String(req.headers.authorization || "");
    if (authHeader.startsWith("Bearer ")) {
      // Attach order to a logged-in customer; guest checkout remains supported.
      const token = authHeader.slice(7);
      const parts = token.split(".");
      const secret = process.env.CUSTOMER_SESSION_SECRET || process.env.ADMIN_SESSION_SECRET;
      if (parts.length === 2 && secret && secret.length >= 32) {
        const expected = crypto.createHmac("sha256", secret).update(parts[0]).digest("base64url");
        if (safeEqualText(parts[1], expected)) {
          try {
            const session = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
            if (session.role === "customer" && session.exp > Date.now() && ObjectId.isValid(session.sub)) {
              const customer = await (await getDb()).collection("customers").findOne({ _id: new ObjectId(session.sub) });
              if (customer) order.customerId = customer._id.toString();
            }
          } catch (_) { /* Invalid optional customer token: retain guest checkout. */ }
        }
      }
    }

    await ordersCollection.insertOne(order);

    console.log(`🛒 New order #${order.id} - ₹${total}`);

    return res.status(201).json({
      success: true,
      message: "Order placed successfully.",
      id: order.id,
      orderId: order.id,
      order: formatOrder(order)
    });

  } catch (error) {
    console.error("❌ Create order error:", error);

    return res.status(500).json({
      error: "Unable to create order."
    });
  }
});


/* =========================================================
   ADMIN BUSINESS ANALYTICS
   Revenue rules: captured Razorpay payments count unless cancelled;
   COD counts only after delivery. This avoids treating unpaid or
   undelivered COD orders as earned revenue.
========================================================= */
app.get("/api/admin/analytics", requireAdmin, async (req, res) => {
  try {
    const rawDays = String(req.query.days || "30");
    const days = rawDays === "all" ? null : Math.max(1, Math.min(365, Number(rawDays) || 30));
    const ordersCollection = await getOrders();
    const query = days ? { createdAt: { $gte: new Date(Date.now() - days * 86400000) } } : {};
    const orders = await ordersCollection.find(query).sort({ createdAt: 1 }).toArray();
    const activeOrders = orders.filter(o => String(o.status || "Pending") !== "Cancelled");
    const revenueOrders = activeOrders.filter(o =>
      o.paymentStatus === "Paid" ||
      ((o.paymentMethod || "COD").toUpperCase() === "COD" && o.status === "Delivered")
    );
    const revenue = revenueOrders.reduce((sum, o) => sum + Number(o.total || 0), 0);
    const statusCounts = {};
    for (const status of ["Pending", "Confirmed", "Preparing", "Out for Delivery", "Delivered", "Cancelled"]) {
      statusCounts[status] = orders.filter(o => (o.status || "Pending") === status).length;
    }
    const dailyMap = new Map();
    for (const order of revenueOrders) {
      const date = new Date(order.createdAt || order.created_at || Date.now());
      if (Number.isNaN(date.getTime())) continue;
      const key = date.toISOString().slice(0, 10);
      dailyMap.set(key, (dailyMap.get(key) || 0) + Number(order.total || 0));
    }
    const productMap = new Map();
    for (const order of activeOrders) {
      for (const item of (Array.isArray(order.items) ? order.items : [])) {
        const name = String(item.name || item.product || "Unknown product");
        const quantity = Number(item.quantity || 0);
        const current = productMap.get(name) || { name, quantity: 0, sales: 0 };
        current.quantity += quantity;
        current.sales += Number(item.price || 0) * quantity;
        productMap.set(name, current);
      }
    }
    res.json({
      periodDays: days,
      totalOrders: orders.length,
      activeOrders: activeOrders.length,
      deliveredOrders: statusCounts.Delivered,
      cancelledOrders: statusCounts.Cancelled,
      revenue: Math.round(revenue * 100) / 100,
      revenueOrderCount: revenueOrders.length,
      statusCounts,
      dailySales: Array.from(dailyMap, ([date, amount]) => ({ date, amount: Math.round(amount * 100) / 100 })),
      topProducts: Array.from(productMap.values()).sort((a, b) => b.quantity - a.quantity).slice(0, 5)
    });
  } catch (error) {
    console.error("❌ Analytics error:", error);
    res.status(500).json({ error: "Unable to load business analytics." });
  }
});


/* =========================================================
   GET ALL ORDERS
========================================================= */

app.get("/api/orders", requireAdmin, async (req, res) => {
  try {
    const ordersCollection = await getOrders();

    const orders = await ordersCollection
      .find({})
      .sort({ createdAt: -1 })
      .toArray();

    res.json(orders.map(formatOrder));

  } catch (error) {
    console.error("❌ Get orders error:", error);

    res.status(500).json({
      error: "Unable to load orders."
    });
  }
});


/* =========================================================
   GET SINGLE ORDER
========================================================= */

app.get("/api/orders/:id", requireAdmin, async (req, res) => {
  try {
    const ordersCollection = await getOrders();

    const id = String(req.params.id).trim();

    if (!id) {
      return badRequest(res, "Invalid order ID.");
    }

    const order = await ordersCollection.findOne({ id });

    if (!order) {
      return res.status(404).json({ error: "Order not found." });
    }

    res.json(formatOrder(order));

  } catch (error) {
    console.error("❌ Get order error:", error);

    res.status(500).json({
      error: "Unable to load order."
    });
  }
});


/* =========================================================
   UPDATE ORDER STATUS
========================================================= */

app.put("/api/orders/:id", requireAdmin, async (req, res) => {
  try {
    const ordersCollection = await getOrders();

    const id = String(req.params.id).trim();

    if (!id) {
      return badRequest(res, "Invalid order ID.");
    }

    const status = String(req.body.status || "").trim();

    if (!VALID_STATUSES.includes(status)) {
      return badRequest(res, "Invalid order status.");
    }

    const result = await ordersCollection.updateOne(
      { id },
      { $set: { status, updatedAt: new Date() } }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ error: "Order not found." });
    }

    console.log(`📦 Order #${id} → ${status}`);

    res.json({
      success: true,
      message: "Order status updated.",
      order: { id, status }
    });

  } catch (error) {
    console.error("❌ Update status error:", error);

    res.status(500).json({
      error: "Unable to update order status."
    });
  }
});


/* =========================================================
   DELETE ORDER
========================================================= */

app.delete("/api/orders/:id", requireAdmin, async (req, res) => {
  try {
    const ordersCollection = await getOrders();

    const id = String(req.params.id).trim();

    if (!id) {
      return badRequest(res, "Invalid order ID.");
    }

    const result = await ordersCollection.deleteOne({ id });

    if (result.deletedCount === 0) {
      return res.status(404).json({ error: "Order not found." });
    }

    console.log(`🗑️ Order #${id} deleted`);

    res.json({
      success: true,
      message: "Order deleted.",
      id
    });

  } catch (error) {
    console.error("❌ Delete order error:", error);

    res.status(500).json({
      error: "Unable to delete order."
    });
  }
});


/* =========================================================
   404 API
========================================================= */

app.use("/api", (req, res) => {
  res.status(404).json({
    error: "API endpoint not found."
  });
});


/* =========================================================
   START SERVER (local only - Vercel uses the exported app)
========================================================= */

if (require.main === module) {
  app.listen(PORT, HOST, () => {
    console.log("========================================");
    console.log("🥣 DHANA FOODS SERVER STARTED");
    console.log(`🌐 http://localhost:${PORT}`);
    console.log("========================================");
  });
}

module.exports = app;