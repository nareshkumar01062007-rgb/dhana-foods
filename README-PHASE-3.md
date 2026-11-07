# Dhana Foods — Phase 3 Product Management

## What's added
- MongoDB-backed product catalogue (the original 13 products are seeded automatically on first catalogue request).
- Admin-only product APIs protected by the existing signed admin session.
- Admin dashboard tools to add products, edit names/descriptions/icons/schedule/prices, set availability, and hide products.
- Customer storefront loads current product prices from `/api/products` and displays newly added products.
- Server recalculates order prices from MongoDB and rejects inactive/out-of-stock products for both COD and Razorpay order creation.
- Product removal is a soft-hide, so existing order records are preserved.

## Setup
1. Keep a backup of the working Phase 2 project.
2. Extract this ZIP.
3. Copy the Phase 2 `.env` file into the `dhana-foods-main` folder in this project. Do not share or commit `.env`.
4. Preserve the existing MongoDB, Razorpay, admin, customer and DNS configuration values.
5. Install and run:
   ```bash
   npm install
   npm start
   ```
6. Sign in at `http://localhost:3000/admin-login.html`.
7. Open the admin dashboard and use the **Product Management** section.

## Important
- Product catalogue is stored in the MongoDB `products` collection in the existing `DhanaFoods` database.
- Do not run live payment tests just to verify product management; use COD for routine tests.
- The storefront only lists active products marked **Available**.
- Removing a product hides it from the storefront; it does not erase historical orders.
- Before deployment, set the same environment variables in Netlify and test the deployed functions separately.

## Recommended test sequence
1. Admin dashboard loads all 13 existing products.
2. Edit one product's price and confirm it changes on the customer storefront after refresh.
3. Mark a product Out of Stock and confirm it is unavailable for checkout.
4. Add a temporary test product and confirm it appears on the storefront.
5. Hide the temporary product and confirm it disappears.
6. Place a COD test order and verify its saved total uses the current database price.
7. Confirm unauthenticated requests to `/api/admin/products` are rejected.
