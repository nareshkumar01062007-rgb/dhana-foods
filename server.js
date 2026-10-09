/* =========================================================
   DHANA FOODS
   MongoDB Order Server (works locally AND on Vercel)
========================================================= */

const express = require("express");
const path = require("path");
const { MongoClient, ObjectId } = require("mongodb");
require("dotenv").config();

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
  "Preparing",
  "Out for Delivery",
  "Delivered"
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

app.get("/api/products", (req, res) => {
  res.json(PRODUCTS);
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

    for (const item of items) {
      const product = normalizeProductName(item.product);
      const size = String(item.size || "").trim();
      const quantity = Number(item.quantity);

      if (!PRODUCTS[product]) {
        return badRequest(res, `Invalid product: ${item.product}`);
      }

      if (size !== "500g" && size !== "1kg") {
        return badRequest(res, `Invalid size for ${product}.`);
      }

      if (!Number.isInteger(quantity) || quantity <= 0 || quantity > 100) {
        return badRequest(res, `Invalid quantity for ${product}.`);
      }

      const officialPrice = getOfficialPrice(product, size);

      if (officialPrice === null) {
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
   GET ALL ORDERS
========================================================= */

app.get("/api/orders", async (req, res) => {
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

app.get("/api/orders/:id", async (req, res) => {
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

app.put("/api/orders/:id", async (req, res) => {
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

app.delete("/api/orders/:id", async (req, res) => {
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

if (!process.env.VERCEL) {
  app.listen(PORT, HOST, () => {
    console.log("========================================");
    console.log("🥣 DHANA FOODS SERVER STARTED");
    console.log(`🌐 http://localhost:${PORT}`);
    console.log("========================================");
  });
}

module.exports = app;