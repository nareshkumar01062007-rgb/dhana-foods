const express = require("express");
const Database = require("better-sqlite3");

const app = express();
const PORT = 3000;

const db = new Database("dhanafoods.db");

db.prepare(`
    CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_name TEXT NOT NULL,
        phone TEXT NOT NULL,
        address TEXT NOT NULL,
        product TEXT NOT NULL,
        quantity TEXT NOT NULL,
        price INTEGER NOT NULL,
        delivery_date TEXT NOT NULL,
        status TEXT DEFAULT 'Pending',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
`).run();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));

app.get("/api/test", (req, res) => {
    res.json({
        success: true,
        message: "Dhana Foods backend is working!"
    });
});

app.post("/api/orders", (req, res) => {
    const {
        customerName,
        phone,
        address,
        product,
        quantity,
        price,
        deliveryDate
    } = req.body;

    if (!customerName || !phone || !address || !product || !quantity || !price || !deliveryDate) {
        return res.status(400).json({
            success: false,
            message: "Please fill all required fields."
        });
    }

    const result = db.prepare(`
        INSERT INTO orders (
            customer_name,
            phone,
            address,
            product,
            quantity,
            price,
            delivery_date
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
        customerName,
        phone,
        address,
        product,
        quantity,
        price,
        deliveryDate
    );

    res.json({
        success: true,
        orderId: result.lastInsertRowid
    });
});

app.get("/api/orders", (req, res) => {
    const orders = db.prepare(`
        SELECT *
        FROM orders
        ORDER BY created_at DESC
    `).all();

    res.json(orders);
});

app.put("/api/orders/:id", (req, res) => {
    const { status } = req.body;
    const orderId = req.params.id;

    const allowedStatuses = [
        "Pending",
        "Confirmed",
        "Delivered",
        "Cancelled"
    ];

    if (!allowedStatuses.includes(status)) {
        return res.status(400).json({
            success: false,
            message: "Invalid status."
        });
    }

    const result = db.prepare(`
        UPDATE orders
        SET status = ?
        WHERE id = ?
    `).run(status, orderId);

    if (result.changes === 0) {
        return res.status(404).json({
            success: false,
            message: "Order not found."
        });
    }

    res.json({
        success: true,
        message: "Order status updated."
    });
});

app.listen(PORT, () => {
    console.log(`Dhana Foods running at http://localhost:${PORT}`);
});