# Dhana Foods — Admin security setup

## Required environment variables

Configure these in your local `.env` file and in Netlify Site configuration → Environment variables:

- `MONGODB_URI` — MongoDB Atlas connection string
- `RAZORPAY_KEY_ID` — Razorpay key ID
- `RAZORPAY_KEY_SECRET` — Razorpay secret (server-side only)
- `ADMIN_USERNAME` — a unique admin username
- `ADMIN_PASSWORD` — a long, unique admin password
- `ADMIN_SESSION_SECRET` — a random secret of at least 32 characters

Generate a session secret with Node.js:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Do not commit `.env` or share any of these values. Set the same required variables in Netlify before deploying this version.

## Local run

```bash
npm install
npm start
```

Open `http://localhost:3000/admin-login.html`. Admin login is verified by the backend. The server issues an 8-hour signed session token; dashboard order listing, status updates and deletion require that token.

## What changed

- Removed hardcoded `admin` / `dhana123` credentials from browser JavaScript.
- Added backend `POST /api/admin/login` and `GET /api/admin/me`.
- Protected `GET /api/orders`, `PUT /api/orders/:id`, and `DELETE /api/orders/:id`.
- Left customer order creation, public single-order lookup, COD and Razorpay routes unchanged.

Before production deployment, test login, dashboard loading, status update, deletion, COD checkout and Razorpay test/live checkout in a controlled manner.
